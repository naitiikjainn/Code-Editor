import express from "express";
import Room from "../models/Room.js";

const router = express.Router();

// 1. CREATE ROOM
router.post("/create", async (req, res) => {
    try {
        const { roomId, username } = req.body;
        // Check if room exists
        const existing = await Room.findOne({ roomId });
        if (existing) {
            return res.status(400).json({ error: "Room ID already taken" });
        }

        const newRoom = new Room({
            roomId,
            host: { username }
        });
        await newRoom.save();
        res.status(201).json({ message: "Room created", room: newRoom });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error creating room" });
    }
});

// 2. GET ROOM INFO (Check if exists + Who is host)
router.get("/:roomId", async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId });
        if (!room) return res.status(404).json({ error: "Room not found" });

        res.json({ roomId: room.roomId, host: room.host });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
