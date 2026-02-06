import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { cacheMiddleware } from "../middleware/cache.js";
import { addJob } from "../utils/jobQueue.js";
import Submission from "../models/Submission.js";
import CSESProgress from "../models/CSESProgress.js";
import { getTestCount } from "../services/csesTestCaseService.js";

const router = express.Router();

// Supported languages
const SUPPORTED_LANGUAGES = ["cpp", "c++", "python", "python3", "java", "javascript"];

/**
 * Parse time limit string (e.g. "1.00 s") to seconds number.
 */
function parseTimeLimit(str) {
    if (!str || str === "N/A") return 1;
    const match = String(str).match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 1;
}

/**
 * Parse memory limit string (e.g. "256 MB") to MB number.
 */
function parseMemoryLimit(str) {
    if (!str || str === "N/A") return 256;
    const match = String(str).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 256;
}

/**
 * POST /api/cses/submit
 * Submit code for CSES judging.
 */
router.post("/submit", authMiddleware, async (req, res) => {
    try {
        const { taskId, code, language, problemName, timeLimit, memoryLimit } = req.body;
        const userId = req.user.id;

        // Validate taskId
        if (!taskId || !/^\d+$/.test(String(taskId))) {
            return res.status(400).json({ error: "Invalid task ID. Must be a numeric CSES task ID." });
        }

        // Validate language
        const lang = (language || "").toLowerCase().trim();
        if (!SUPPORTED_LANGUAGES.includes(lang)) {
            return res.status(400).json({ error: `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}` });
        }

        // Validate code
        if (!code || typeof code !== "string") {
            return res.status(400).json({ error: "Code is required." });
        }
        if (code.length > 100 * 1024) {
            return res.status(400).json({ error: "Code exceeds 100KB limit." });
        }

        // Create submission record with "Judging" verdict
        const submission = await Submission.create({
            userId,
            problemId: String(taskId),
            problemName: problemName || `CSES Task ${taskId}`,
            platform: "cses",
            code,
            language: lang,
            verdict: "Judging",
            visibility: "public",
        });

        // Parse limits
        const parsedTimeLimit = parseTimeLimit(timeLimit);
        const parsedMemoryLimit = parseMemoryLimit(memoryLimit);

        // Add job to queue
        await addJob("cses-judge", "judge-submission", {
            submissionId: submission._id.toString(),
            taskId: String(taskId),
            code,
            language: lang,
            timeLimit: parsedTimeLimit,
            memoryLimit: parsedMemoryLimit,
            userId,
        });

        res.json({
            success: true,
            submissionId: submission._id,
            message: "Judging started",
        });
    } catch (err) {
        console.error("[CSES Route] Submit error:", err);
        res.status(500).json({ error: "Failed to submit. Please try again." });
    }
});

/**
 * GET /api/cses/submission/:id
 * Get a specific submission with judge results.
 */
router.get("/submission/:id", authMiddleware, async (req, res) => {
    try {
        const submission = await Submission.findOne({
            _id: req.params.id,
            userId: req.user.id,
            platform: "cses",
        });

        if (!submission) {
            return res.status(404).json({ error: "Submission not found" });
        }

        res.json(submission);
    } catch (err) {
        console.error("[CSES Route] Get submission error:", err);
        res.status(500).json({ error: "Failed to fetch submission" });
    }
});

/**
 * GET /api/cses/progress
 * Get current user's CSES progress across all tasks.
 */
router.get("/progress", authMiddleware, async (req, res) => {
    try {
        const progress = await CSESProgress.find({ userId: req.user.id })
            .select("taskId status attempts solvedAt lastAttempt")
            .lean();

        // Build summary
        const solved = progress.filter(p => p.status === "solved");
        const attempted = progress.filter(p => p.status === "attempted");

        // Create a map for quick lookup
        const progressMap = {};
        for (const p of progress) {
            progressMap[p.taskId] = {
                status: p.status,
                attempts: p.attempts,
                solvedAt: p.solvedAt,
                lastAttempt: p.lastAttempt,
            };
        }

        res.json({
            totalSolved: solved.length,
            totalAttempted: attempted.length,
            progress: progressMap,
        });
    } catch (err) {
        console.error("[CSES Route] Progress error:", err);
        res.status(500).json({ error: "Failed to fetch progress" });
    }
});

/**
 * GET /api/cses/progress/:taskId
 * Get progress for a specific task.
 */
router.get("/progress/:taskId", authMiddleware, async (req, res) => {
    try {
        const progress = await CSESProgress.findOne({
            userId: req.user.id,
            taskId: req.params.taskId,
        }).lean();

        if (!progress) {
            return res.json({ status: "not_attempted", attempts: 0 });
        }

        res.json({
            status: progress.status,
            attempts: progress.attempts,
            solvedAt: progress.solvedAt,
            lastAttempt: progress.lastAttempt,
        });
    } catch (err) {
        console.error("[CSES Route] Task progress error:", err);
        res.status(500).json({ error: "Failed to fetch task progress" });
    }
});

/**
 * GET /api/cses/tests/:taskId/info
 * Get test case count for a problem (public, cached).
 */
router.get("/tests/:taskId/info", cacheMiddleware({ ttl: 3600 }), async (req, res) => {
    try {
        const { taskId } = req.params;

        if (!/^\d+$/.test(taskId)) {
            return res.status(400).json({ error: "Invalid task ID" });
        }

        const testCount = await getTestCount(taskId);

        res.json({
            taskId,
            testCount,
        });
    } catch (err) {
        console.error("[CSES Route] Test info error:", err);
        res.status(500).json({ error: "Failed to get test info: " + err.message });
    }
});

/**
 * GET /api/cses/submissions/problem/:problemId
 * Get user's CSES submissions for a specific problem.
 */
router.get("/submissions/problem/:problemId", authMiddleware, async (req, res) => {
    try {
        const submissions = await Submission.find({
            userId: req.user.id,
            platform: "cses",
            problemId: req.params.problemId,
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .select("problemId problemName language verdict judgeResult createdAt")
            .lean();

        res.json({ submissions });
    } catch (err) {
        console.error("[CSES Route] Problem submissions error:", err);
        res.status(500).json({ error: "Failed to fetch submissions" });
    }
});

/**
 * GET /api/cses/submissions
 * Get user's CSES submissions history.
 */
router.get("/submissions", authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const skip = (page - 1) * limit;

        const [submissions, total] = await Promise.all([
            Submission.find({ userId: req.user.id, platform: "cses" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("problemId problemName language verdict judgeResult createdAt")
                .lean(),
            Submission.countDocuments({ userId: req.user.id, platform: "cses" }),
        ]);

        res.json({
            submissions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error("[CSES Route] Submissions error:", err);
        res.status(500).json({ error: "Failed to fetch submissions" });
    }
});

export default router;
