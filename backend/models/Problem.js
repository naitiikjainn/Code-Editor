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
        default: "codeforces",
        index: true
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

// Compound indexes for efficient queries
problemSchema.index({ platform: 1, problemId: 1 });
problemSchema.index({ platform: 1, createdAt: -1 });
// Note: lastAccessed already has TTL index from schema expires option

export default mongoose.model("Problem", problemSchema);
