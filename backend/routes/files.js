import express from "express";
import File from "../models/File.js";
import Room from "../models/Room.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Input validation helper
const sanitizeString = (str, maxLength = 1000) => {
    if (typeof str !== 'string') return '';
    return str.slice(0, maxLength).trim();
};

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

// GET all files for a user (or host's files if hostId is provided for collaboration)
router.get("/", authMiddleware, async (req, res) => {
    try {
        const { hostId } = req.query;

        // If hostId is provided and valid, fetch that user's files (guest viewing host's files)
        // Otherwise fetch the authenticated user's own files
        let targetUserId = req.user.id;

        if (hostId && isValidObjectId(hostId)) {
            // Guest is viewing host's files in collaborative mode
            targetUserId = hostId;
            console.log(`[Files] Guest ${req.user.id} fetching host ${hostId}'s files`);
        }

        const files = await File.find({ userId: targetUserId }).sort({ updatedAt: -1, name: 1 }).limit(100);
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch files" });
    }
});

// POST create new file
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { name, language, folder, roomId, content } = req.body;
        let userId = req.user.id;

        // Validate required fields
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: "File name is required" });
        }

        // If created in a room, assign ownership to the Room Host
        if (roomId) {
            const room = await Room.findOne({ roomId });
            if (room && room.host && room.host.userId) {
                // Verify the creator is actually a participant or host of this room
                const isParticipant = room.participants.some(p => p.username === req.user.username);
                const isHost = room.host.username === req.user.username;

                if (isParticipant || isHost) {
                    console.log(`[Files] Assigning new file '${name}' to Host ${room.host.username} (Created by ${req.user.username})`);
                    userId = room.host.userId; // Override owner to be the Host
                }
            }
        }

        const sanitizedName = sanitizeString(name, 255);
        const sanitizedLanguage = sanitizeString(language || 'javascript', 50);
        const sanitizedFolder = sanitizeString(folder || '', 255);
        const sanitizedRoomId = sanitizeString(roomId || null, 100);
        const sanitizedContent = sanitizeString(content || '', 500000); // 500KB max

        const newFile = new File({
            userId: userId,
            name: sanitizedName,
            language: sanitizedLanguage,
            folder: sanitizedFolder,
            roomId: sanitizedRoomId,
            content: sanitizedContent
        });
        await newFile.save();
        res.json(newFile);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create file" });
    }
});

// PUT update file content (Autosave)
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid file ID" });
        }

        const { content, hostId } = req.body;
        const sanitizedContent = sanitizeString(content || '', 500000);

        // In collaboration mode, guests can edit host's files
        let targetUserId = req.user.id;
        if (hostId && isValidObjectId(hostId)) {
            // Guest is saving host's file in collaborative mode
            targetUserId = hostId;
            console.log(`[Files] Guest ${req.user.id} saving host ${hostId}'s file ${req.params.id}`);
        }

        // Find the file (owned by target user)
        const file = await File.findOne({ _id: req.params.id, userId: targetUserId });
        if (!file) {
            return res.status(404).json({ error: "File not found or access denied" });
        }

        file.content = sanitizedContent;
        file.updatedAt = Date.now();
        await file.save();

        res.json(file);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save file" });
    }
});

// DELETE file (supports collaboration via hostId query param)
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid file ID" });
        }

        const { hostId } = req.query;
        let targetUserId = req.user.id;
        
        // In collaboration mode, allow deleting host's files
        if (hostId && isValidObjectId(hostId)) {
            targetUserId = hostId;
        }

        const file = await File.findOneAndDelete({ _id: req.params.id, userId: targetUserId });
        if (!file) {
            return res.status(404).json({ error: "File not found or access denied" });
        }
        res.json({ message: "File deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete file" });
    }
});

// PATCH rename file
router.patch("/:id/rename", authMiddleware, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid file ID" });
        }

        const { name, hostId } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: "New file name is required" });
        }

        const sanitizedName = sanitizeString(name, 255);
        let targetUserId = req.user.id;

        // In collaboration mode, allow renaming host's files
        if (hostId && isValidObjectId(hostId)) {
            targetUserId = hostId;
        }

        const file = await File.findOneAndUpdate(
            { _id: req.params.id, userId: targetUserId },
            { name: sanitizedName, updatedAt: Date.now() },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: "File not found or access denied" });
        }

        res.json(file);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to rename file" });
    }
});

// PATCH move file to different folder
router.patch("/:id/move", authMiddleware, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid file ID" });
        }

        const { folder, hostId } = req.body;
        if (typeof folder !== 'string') {
            return res.status(400).json({ error: "Target folder path is required" });
        }

        const sanitizedFolder = sanitizeString(folder, 255) || "/";
        let targetUserId = req.user.id;

        if (hostId && isValidObjectId(hostId)) {
            targetUserId = hostId;
        }

        const file = await File.findOneAndUpdate(
            { _id: req.params.id, userId: targetUserId },
            { folder: sanitizedFolder, updatedAt: Date.now() },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: "File not found or access denied" });
        }

        res.json(file);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to move file" });
    }
});

// PATCH rename/move an entire folder (batch update all files in that folder)
router.patch("/folder/rename", authMiddleware, async (req, res) => {
    try {
        const { oldPath, newPath, hostId } = req.body;
        
        if (!oldPath || typeof oldPath !== 'string') {
            return res.status(400).json({ error: "Old folder path is required" });
        }
        if (!newPath || typeof newPath !== 'string') {
            return res.status(400).json({ error: "New folder path is required" });
        }

        const sanitizedOldPath = sanitizeString(oldPath, 255);
        const sanitizedNewPath = sanitizeString(newPath, 255);
        let targetUserId = req.user.id;

        if (hostId && isValidObjectId(hostId)) {
            targetUserId = hostId;
        }

        // Update all files that are in the old folder or subfolders
        const result = await File.updateMany(
            { 
                userId: targetUserId,
                $or: [
                    { folder: sanitizedOldPath },
                    { folder: { $regex: `^${sanitizedOldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/` } }
                ]
            },
            [{
                $set: {
                    folder: {
                        $replaceOne: {
                            input: "$folder",
                            find: sanitizedOldPath,
                            replacement: sanitizedNewPath
                        }
                    },
                    updatedAt: new Date()
                }
            }]
        );

        res.json({ message: "Folder renamed", modifiedCount: result.modifiedCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to rename folder" });
    }
});

export default router;
