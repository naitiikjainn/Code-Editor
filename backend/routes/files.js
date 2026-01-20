import express from "express";
import File from "../models/File.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Input validation helper
const sanitizeString = (str, maxLength = 1000) => {
    if (typeof str !== 'string') return '';
    return str.slice(0, maxLength).trim();
};

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

// GET all files for a user (contextual to roomId if provided, but ownership is paramount)
router.get("/", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        // We might want to filter by roomId if it's sent, but ultimately we only show what the user owns.
        // The user request said "when they create the room no one can see each other files".
        // So we strictly return `userId` owned files.
        // We can optionally filter by `roomId` if we want to support "Project-based" views later,
        // but for now, "files saved for user to code and can read them later" implies a personal list.
        // However, if the user works on files in different rooms, maybe they want to see them all?
        // Let's return all files for the user, sorted by recency.

        const query = { userId: userId };

        // Optional: If roomId is passed, maybe we tag new files with it, but for listing,
        // showing all files (or recently modified) is probably safer for "read them later".
        // But let's stick to the user's request: "files saved for user".

        const files = await File.find(query).sort({ updatedAt: -1, name: 1 }).limit(100);
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
        const userId = req.user.id;
        
        // Validate required fields
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: "File name is required" });
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
        
        const { content } = req.body;
        const sanitizedContent = sanitizeString(content || '', 500000);
        
        // Ensure user owns the file
        const file = await File.findOne({ _id: req.params.id, userId: req.user.id });
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

// DELETE file
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid file ID" });
        }
        
        const file = await File.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!file) {
            return res.status(404).json({ error: "File not found or access denied" });
        }
        res.json({ message: "File deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete file" });
    }
});

export default router;
