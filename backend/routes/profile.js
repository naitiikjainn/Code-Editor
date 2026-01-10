import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// @route   GET /api/profile/me
// @desc    Get current user's profile
// @access  Private
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   PUT /api/profile
// @desc    Update bio and handles
// @access  Private
router.put("/", authMiddleware, async (req, res) => {
    const { bio, platforms } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        if (bio !== undefined) user.bio = bio;

        // Ensure platforms object exists
        if (!user.platforms) {
            user.platforms = {
                codeforces: "",
                leetcode: "",
                codechef: "",
                github: "",
                cses: ""
            };
        }

        if (platforms) {
            if (platforms.codeforces !== undefined) user.platforms.codeforces = platforms.codeforces;
            if (platforms.leetcode !== undefined) user.platforms.leetcode = platforms.leetcode;
            if (platforms.codechef !== undefined) user.platforms.codechef = platforms.codechef;
            if (platforms.github !== undefined) user.platforms.github = platforms.github;
        }

        await user.save();
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/profile/:username
// @desc    Get profile by username (Public view)
// @access  Public
router.get("/:username", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).select("-password");
        if (!user) return res.status(404).json({ msg: "Profile not found" });
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

export default router;
