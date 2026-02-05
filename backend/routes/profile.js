import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Input sanitization helper
const sanitizeString = (str, maxLength = 500) => {
    if (typeof str !== 'string') return '';
    // Remove potentially dangerous HTML/JS
    return str.slice(0, maxLength).trim()
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, ''); // Remove javascript: protocol
};

const sanitizeHandle = (handle) => {
    if (typeof handle !== 'string') return '';
    // Handles should only contain alphanumeric, underscore, hyphen
    return handle.slice(0, 50).replace(/[^a-zA-Z0-9_-]/g, '');
};

// @route   GET /api/profile/me
// @desc    Get current user's profile
// @access  Private
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password -refreshTokens");
        if (!user) return res.status(404).json({ msg: "User not found" });
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

        if (bio !== undefined) user.bio = sanitizeString(bio, 500);

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
            if (platforms.codeforces !== undefined) user.platforms.codeforces = sanitizeHandle(platforms.codeforces);
            if (platforms.leetcode !== undefined) user.platforms.leetcode = sanitizeHandle(platforms.leetcode);
            if (platforms.codechef !== undefined) user.platforms.codechef = sanitizeHandle(platforms.codechef);
            if (platforms.github !== undefined) user.platforms.github = sanitizeHandle(platforms.github);
            if (platforms.cses !== undefined) user.platforms.cses = sanitizeHandle(platforms.cses);
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
        // Sanitize username parameter
        const username = sanitizeHandle(req.params.username);
        if (!username) {
            return res.status(400).json({ msg: "Invalid username" });
        }
        
        const user = await User.findOne({ username }).select("-password -refreshTokens");
        if (!user) return res.status(404).json({ msg: "Profile not found" });
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

export default router;
