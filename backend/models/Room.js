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
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Room", RoomSchema);
