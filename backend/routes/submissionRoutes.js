import express from "express";
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
// @desc    Get all submissions for a user
// @access  Public (but respects visibility eventually)
router.get("/user/:userId", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        
        const submissions = await Submission.find({ userId: req.params.userId })
            .sort({ createdAt: -1 })
            .limit(100); // Limit results
        res.json(submissions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/submissions/my
// @desc    Get current user's submissions
// @access  Private
router.get("/my", authMiddleware, async (req, res) => {
    try {
        const submissions = await Submission.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(submissions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/submissions/:id
// @desc    Get a single submission (for code view modal)
// @access  Public (for now)
router.get("/:id", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid submission ID" });
        }
        
        const submission = await Submission.findById(req.params.id);
        if (!submission) return res.status(404).json({ msg: "Submission not found" });
        res.json(submission);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

export default router;
