import mongoose from "mongoose";

const problemSchema = new mongoose.Schema({
    problemId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    platform: {
        type: String,
        default: "codeforces"
    },
    data: {
        type: Object,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastAccessed: {
        type: Date,
        default: Date.now,
        expires: '30d' // TTL: Deletes if not accessed (updated) for 30 days
    }
});

export default mongoose.model("Problem", problemSchema);
