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

export default mongoose.model("Room", RoomSchema);
