import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    host: {
        username: { type: String, required: true },
        userId: { type: String } // Optional if we want to link to User model later
    },
    participants: [
        {
            username: { type: String },
            addedAt: { type: Date, default: Date.now }
        }
    ],
    activeProblem: { type: Object, default: null }, // Stores the currently open problem
    createdAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now } // Track activity for cleanup
});

export default mongoose.model("Room", RoomSchema);
