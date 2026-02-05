import express from "express";
import User from "../models/User.js";
import Activity from "../models/Activity.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// @route   GET /api/friends
// @desc    Get user's friends list with basic info
// @access  Private
router.get("/", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate("friends", "username avatar platforms createdAt")
            .select("friends");

        if (!user) return res.status(404).json({ msg: "User not found" });
        res.json(user.friends || []);
    } catch (err) {
        console.error("Get friends error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

// @route   GET /api/friends/requests
// @desc    Get pending friend requests
// @access  Private
router.get("/requests", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate("friendRequests", "username avatar createdAt")
            .select("friendRequests");

        if (!user) return res.status(404).json({ msg: "User not found" });
        res.json(user.friendRequests || []);
    } catch (err) {
        console.error("Get requests error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

// @route   GET /api/friends/search?q=username
// @desc    Search users by username
// @access  Private
router.get("/search", authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.status(400).json({ msg: "Search query too short" });
        }

        // Escape regex special characters to prevent ReDoS attacks
        const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const users = await User.find({
            username: { $regex: escapedQuery, $options: "i" },
            _id: { $ne: req.user.id } // Exclude self
        })
            .select("username avatar platforms createdAt")
            .limit(20);

        // Add friendship status
        const currentUser = await User.findById(req.user.id).select("friends friendRequests");
        const friendIds = (currentUser.friends || []).map(id => id.toString());
        const requestIds = (currentUser.friendRequests || []).map(id => id.toString());

        const usersWithStatus = users.map(u => ({
            ...u.toObject(),
            isFriend: friendIds.includes(u._id.toString()),
            hasPendingRequest: requestIds.includes(u._id.toString())
        }));

        res.json(usersWithStatus);
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

// @route   POST /api/friends/request/:userId
// @desc    Send friend request
// @access  Private
router.post("/request/:userId", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;

        if (userId === req.user.id) {
            return res.status(400).json({ msg: "Cannot send request to yourself" });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) return res.status(404).json({ msg: "User not found" });

        const currentUser = await User.findById(req.user.id);

        // Check if already friends
        if (currentUser.friends?.includes(userId)) {
            return res.status(400).json({ msg: "Already friends" });
        }

        // Check if request already sent (they have us in their requests)
        if (targetUser.friendRequests?.includes(req.user.id)) {
            return res.status(400).json({ msg: "Request already sent" });
        }

        // Check if they already sent us a request - auto accept
        if (currentUser.friendRequests?.includes(userId)) {
            // Remove from our requests
            currentUser.friendRequests = currentUser.friendRequests.filter(
                id => id.toString() !== userId
            );
            // Add as friends
            currentUser.friends = currentUser.friends || [];
            currentUser.friends.push(userId);
            targetUser.friends = targetUser.friends || [];
            targetUser.friends.push(req.user.id);

            await currentUser.save();
            await targetUser.save();

            // Log activity
            await Activity.create({
                user: req.user.id,
                type: "friend_added",
                data: { friendUsername: targetUser.username }
            });

            return res.json({ msg: "Friend added", status: "accepted" });
        }

        // Add request to target user
        targetUser.friendRequests = targetUser.friendRequests || [];
        targetUser.friendRequests.push(req.user.id);
        await targetUser.save();

        res.json({ msg: "Friend request sent", status: "pending" });
    } catch (err) {
        console.error("Send request error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

// @route   POST /api/friends/accept/:userId
// @desc    Accept friend request
// @access  Private
router.post("/accept/:userId", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;

        const currentUser = await User.findById(req.user.id);
        const requester = await User.findById(userId);

        if (!requester) return res.status(404).json({ msg: "User not found" });

        // Check if request exists
        if (!currentUser.friendRequests?.includes(userId)) {
            return res.status(400).json({ msg: "No pending request from this user" });
        }

        // Remove from requests
        currentUser.friendRequests = currentUser.friendRequests.filter(
            id => id.toString() !== userId
        );

        // Add as friends (both ways)
        currentUser.friends = currentUser.friends || [];
        currentUser.friends.push(userId);
        requester.friends = requester.friends || [];
        requester.friends.push(req.user.id);

        await currentUser.save();
        await requester.save();

        // Log activity
        await Activity.create({
            user: req.user.id,
            type: "friend_added",
            data: { friendUsername: requester.username }
        });

        res.json({ msg: "Friend request accepted" });
    } catch (err) {
        console.error("Accept request error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

// @route   POST /api/friends/reject/:userId
// @desc    Reject friend request
// @access  Private
router.post("/reject/:userId", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;

        const currentUser = await User.findById(req.user.id);

        // Remove from requests
        currentUser.friendRequests = (currentUser.friendRequests || []).filter(
            id => id.toString() !== userId
        );
        await currentUser.save();

        res.json({ msg: "Friend request rejected" });
    } catch (err) {
        console.error("Reject request error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

// @route   DELETE /api/friends/:userId
// @desc    Remove friend
// @access  Private
router.delete("/:userId", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;

        const currentUser = await User.findById(req.user.id);
        const friend = await User.findById(userId);

        if (!friend) return res.status(404).json({ msg: "User not found" });

        // Remove from both users' friends lists
        currentUser.friends = (currentUser.friends || []).filter(
            id => id.toString() !== userId
        );
        friend.friends = (friend.friends || []).filter(
            id => id.toString() !== req.user.id
        );

        await currentUser.save();
        await friend.save();

        res.json({ msg: "Friend removed" });
    } catch (err) {
        console.error("Remove friend error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

// @route   GET /api/friends/activity
// @desc    Get friends' recent activity
// @access  Private
router.get("/activity", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("friends");
        if (!user || !user.friends?.length) {
            return res.json([]);
        }

        const activities = await Activity.find({
            user: { $in: user.friends }
        })
            .populate("user", "username avatar")
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(activities);
    } catch (err) {
        console.error("Get activity error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

// @route   GET /api/friends/:userId/profile
// @desc    Get a specific friend's profile with their recent activity
// @access  Private
router.get("/:userId/profile", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;

        const targetUser = await User.findById(userId)
            .select("-password -refreshTokens -friendRequests");

        if (!targetUser) return res.status(404).json({ msg: "User not found" });

        const currentUser = await User.findById(req.user.id).select("friends");
        const isFriend = currentUser.friends?.map(id => id.toString()).includes(userId);

        // Get their recent activity
        const recentActivity = await Activity.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            ...targetUser.toObject(),
            isFriend,
            recentActivity
        });
    } catch (err) {
        console.error("Get friend profile error:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

export default router;
