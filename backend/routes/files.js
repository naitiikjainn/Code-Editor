import express from "express";
import File from "../models/File.js";

const router = express.Router();

// Input validation helper
const sanitizeString = (str, maxLength = 1000) => {
    if (typeof str !== 'string') return '';
    return str.slice(0, maxLength).trim();
};

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

// GET all files for a room
router.get("/", async (req, res) => {
    try {
        const { roomId } = req.query;
        // Validate roomId to prevent injection
        const sanitizedRoomId = roomId ? sanitizeString(roomId, 100) : null;
        const query = sanitizedRoomId ? { roomId: sanitizedRoomId } : {};
        const files = await File.find(query).sort({ folder: 1, name: 1 }).limit(100);
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch files" });
    }
});

// POST create new file
router.post("/", async (req, res) => {
    try {
        const { name, language, folder, roomId, content } = req.body;
        
        // Validate required fields
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: "File name is required" });
        }
        
        const sanitizedName = sanitizeString(name, 255);
        const sanitizedLanguage = sanitizeString(language || 'javascript', 50);
        const sanitizedFolder = sanitizeString(folder || '', 255);
        const sanitizedRoomId = sanitizeString(roomId || 'default', 100);
        const sanitizedContent = sanitizeString(content || '', 500000); // 500KB max
        
        const newFile = new File({ 
            name: sanitizedName, 
            language: sanitizedLanguage, 
            folder: sanitizedFolder, 
            roomId: sanitizedRoomId, 
            content: sanitizedContent 
        });
        await newFile.save();
        res.json(newFile);
    } catch (err) {
        res.status(500).json({ error: "Failed to create file" });
    }
});

// PUT update file content (Autosave)
router.put("/:id", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid file ID" });
        }
        
        const { content } = req.body;
        const sanitizedContent = sanitizeString(content || '', 500000);
        
        const file = await File.findByIdAndUpdate(
            req.params.id,
            { content: sanitizedContent, updatedAt: Date.now() },
            { new: true }
        );
        
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }
        res.json(file);
    } catch (err) {
        res.status(500).json({ error: "Failed to save file" });
    }
});

// DELETE file
router.delete("/:id", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: "Invalid file ID" });
        }
        
        const file = await File.findByIdAndDelete(req.params.id);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }
        res.json({ message: "File deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete file" });
    }
});

export default router;
