import express from "express";
import Submission from "../models/Submission.js";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// @route   POST /api/submissions
// @desc    Save a new submission (Accepted, Wrong Answer, etc.)
// @access  Private
router.post("/", authMiddleware, async (req, res) => {
    const { problemId, problemName, platform, code, language, verdict, visibility } = req.body;

    try {
        const newSubmission = new Submission({
            userId: req.user.id,
            problemId,
            problemName,
            platform,
            code,
            language,
            verdict,
            visibility: visibility || "public"
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
        const submissions = await Submission.find({ userId: req.params.userId })
            .sort({ createdAt: -1 }); // Newest first
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
            .sort({ createdAt: -1 });
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
        const submission = await Submission.findById(req.params.id);
        if (!submission) return res.status(404).json({ msg: "Submission not found" });
        res.json(submission);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

export default router;
