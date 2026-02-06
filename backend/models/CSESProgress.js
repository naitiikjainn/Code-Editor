import mongoose from "mongoose";

const CSESProgressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: String, required: true },
    status: { type: String, enum: ["solved", "attempted"], default: "attempted" },
    attempts: { type: Number, default: 0 },
    solvedAt: { type: Date, default: null },
    bestSubmission: { type: mongoose.Schema.Types.ObjectId, ref: "Submission", default: null },
    lastAttempt: { type: Date, default: Date.now },
});

// Compound unique index: one entry per user per task
CSESProgressSchema.index({ userId: 1, taskId: 1 }, { unique: true });
// Quick lookups for user progress
CSESProgressSchema.index({ userId: 1, status: 1 });

export default mongoose.model("CSESProgress", CSESProgressSchema);
