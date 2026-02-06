import express from "express";
import mongoose from "mongoose";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Input validation helpers
const sanitizeString = (str, maxLength = 1000) => {
    if (typeof str !== 'string') return '';
    return str.slice(0, maxLength).trim();
};

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

// @route   POST /api/submissions
// @desc    Save a new submission (Accepted, Wrong Answer, etc.)
// @access  Private
router.post("/", authMiddleware, async (req, res) => {
    const { problemId, problemName, platform, code, language, verdict, visibility } = req.body;

    try {
        // Validate required fields
        if (!problemId || !platform || !code || !verdict) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        
        const newSubmission = new Submission({
            userId: req.user.id,
            problemId: sanitizeString(problemId, 100),
            problemName: sanitizeString(problemName || '', 200),
            platform: sanitizeString(platform, 50),
            code: sanitizeString(code, 100000), // 100KB max
            language: sanitizeString(language || 'cpp', 50),
            verdict: sanitizeString(verdict, 50),
            visibility: ['public', 'private'].includes(visibility) ? visibility : 'public'
        });

        const savedSubmission = await newSubmission.save();
        res.json(savedSubmission);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/submissions/user/:userId
// @desc    Get public submissions for a user (for profile stalking)
// @access  Public
router.get("/user/:userId", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const platform = req.query.platform;
        const verdict = req.query.verdict;
        
        const query = { userId: req.params.userId, visibility: "public" };
        if (platform) query.platform = sanitizeString(platform, 50);
        if (verdict) query.verdict = sanitizeString(verdict, 50);
        
        const [submissions, total] = await Promise.all([
            Submission.find(query)
                .select("-code") // Don't send code in list view
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Submission.countDocuments(query)
        ]);
        
        res.json({
            submissions,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/submissions/my
// @desc    Get current user's submissions (all, including private)
// @access  Private
router.get("/my", authMiddleware, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        
        const query = { userId: req.user.id };
        if (req.query.platform) query.platform = sanitizeString(req.query.platform, 50);
        
        const [submissions, total] = await Promise.all([
            Submission.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Submission.countDocuments(query)
        ]);
        
        res.json({
            submissions,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/submissions/stats/:userId
// @desc    Get submission statistics for a user
// @access  Public
router.get("/stats/:userId", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        
        const stats = await Submission.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.params.userId), visibility: "public" } },
            { $group: {
                _id: null,
                total: { $sum: 1 },
                accepted: { $sum: { $cond: [{ $in: ["$verdict", ["Accepted", "OK", "ACCEPTED"]] }, 1, 0] } },
                platforms: { $addToSet: "$platform" },
                languages: { $addToSet: "$language" }
            }}
        ]);
        
        const byPlatform = await Submission.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.params.userId), visibility: "public" } },
            { $group: { _id: "$platform", count: { $sum: 1 }, accepted: { $sum: { $cond: [{ $in: ["$verdict", ["Accepted", "OK", "ACCEPTED"]] }, 1, 0] } } } }
        ]);
        
        res.json({
            total: stats[0]?.total || 0,
            accepted: stats[0]?.accepted || 0,
            platforms: stats[0]?.platforms || [],
            languages: stats[0]?.languages || [],
            byPlatform: byPlatform.reduce((acc, p) => { acc[p._id] = { count: p.count, accepted: p.accepted }; return acc; }, {})
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/submissions/solved
// @desc    Get distinct accepted problemIds for the current user, optionally filtered by platform
// @access  Private
router.get("/solved", authMiddleware, async (req, res) => {
    try {
        const query = {
            userId: req.user.id,
            verdict: { $in: ["Accepted", "OK", "ACCEPTED"] }
        };
        if (req.query.platform) {
            query.platform = sanitizeString(req.query.platform, 50);
        }

        const solved = await Submission.distinct("problemId", query);
        res.json({ solved });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/submissions/:id
// @desc    Get a single submission (for code view modal)
// @access  Public (respects visibility - only owner can view private)
router.get("/:id", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid submission ID" });
        }
        
        const submission = await Submission.findById(req.params.id);
        if (!submission) return res.status(404).json({ msg: "Submission not found" });
        
        // Check if private submission is being accessed by non-owner
        if (submission.visibility === "private") {
            // Try to get user from token
            const authHeader = req.headers.authorization;
            let userId = null;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                try {
                    const jwt = await import("jsonwebtoken");
                    const decoded = jwt.default.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
                    userId = decoded.id;
                } catch (e) { /* not authenticated */ }
            }
            if (!userId || userId !== submission.userId.toString()) {
                return res.status(403).json({ msg: "This submission is private" });
            }
        }
        
        res.json(submission);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

export default router;
