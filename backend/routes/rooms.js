import express from "express";
import Room from "../models/Room.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Input validation
const sanitizeRoomId = (id) => {
    if (typeof id !== 'string') return '';
    // Room IDs should be alphanumeric with dashes
    return id.slice(0, 50).replace(/[^a-zA-Z0-9-]/g, '');
};

const sanitizeUsername = (name) => {
    if (typeof name !== 'string') return 'Anonymous';
    return name.slice(0, 50).replace(/[<>]/g, '');
};

// 1. CREATE ROOM (Requires authentication)
router.post("/create", authMiddleware, async (req, res) => {
    try {
        const { roomId, username } = req.body;
        
        const sanitizedRoomId = sanitizeRoomId(roomId);
        const sanitizedUsername = sanitizeUsername(username || req.user.username);
        
        if (!sanitizedRoomId || sanitizedRoomId.length < 3) {
            return res.status(400).json({ error: "Room ID must be at least 3 characters (alphanumeric and dashes only)" });
        }
        
        // Check if room exists
        const existing = await Room.findOne({ roomId: sanitizedRoomId });
        if (existing) {
            return res.status(400).json({ error: "Room ID already taken" });
        }

        const newRoom = new Room({
            roomId: sanitizedRoomId,
            host: { 
                username: sanitizedUsername,
                userId: req.user.id  // Set host userId from authenticated user
            }
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
        const sanitizedRoomId = sanitizeRoomId(req.params.roomId);
        if (!sanitizedRoomId) {
            return res.status(400).json({ error: "Invalid room ID" });
        }
        
        const room = await Room.findOne({ roomId: sanitizedRoomId });
        if (!room) return res.status(404).json({ error: "Room not found" });

        res.json({ roomId: room.roomId, host: room.host });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
