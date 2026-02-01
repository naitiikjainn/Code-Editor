import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    host: {
        username: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" } // Links to User model for file access
    },
    hostOnline: { type: Boolean, default: false }, // Track if host is currently connected
    participants: [
        {
            username: { type: String },
            addedAt: { type: Date, default: Date.now }
        }
    ],
    activeProblem: { type: Object, default: null }, // Stores the currently open problem
    activeFileId: { type: String, default: null }, // Stores the currently open file ID
    createdAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now } // Track activity for cleanup
});

// Indexes for common queries
RoomSchema.index({ "host.userId": 1 }); // Find rooms by host
RoomSchema.index({ "host.username": 1 }); // Find rooms by host username
RoomSchema.index({ hostOnline: 1, lastActiveAt: -1 }); // Active rooms
RoomSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 86400 }); // TTL: Auto-delete after 24h inactive
RoomSchema.index({ "participants.username": 1 }); // Find rooms by participant

export default mongoose.model("Room", RoomSchema);
