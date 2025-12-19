import express from "express";
import File from "../models/File.js";

const router = express.Router();

// GET all files for a room
router.get("/", async (req, res) => {
    try {
        const { roomId } = req.query;
        // If roomId provide, filter. Else return global/default (or empty)
        const query = roomId ? { roomId } : {};
        const files = await File.find(query).sort({ folder: 1, name: 1 });
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch files" });
    }
});

// POST create new file
router.post("/", async (req, res) => {
    try {
        const { name, language, folder, roomId } = req.body;
        const newFile = new File({ name, language, folder, roomId: roomId || "default" });
        await newFile.save();
        res.json(newFile);
    } catch (err) {
        res.status(500).json({ error: "Failed to create file" });
    }
});

// PUT update file content (Autosave)
router.put("/:id", async (req, res) => {
    try {
        const { content } = req.body;
        const file = await File.findByIdAndUpdate(
            req.params.id,
            { content, updatedAt: Date.now() },
            { new: true }
        );
        res.json(file);
    } catch (err) {
        res.status(500).json({ error: "Failed to save file" });
    }
});

// DELETE file
router.delete("/:id", async (req, res) => {
    try {
        await File.findByIdAndDelete(req.params.id);
        res.json({ message: "File deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete file" });
    }
});

export default router;
