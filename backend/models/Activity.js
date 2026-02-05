import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ["problem_solved", "contest_joined", "friend_added", "profile_updated"],
        required: true
    },
    data: {
        problemName: String,
        problemId: String,
        platform: String,
        verdict: String,
        language: String,
        contestName: String,
        friendUsername: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// TTL index - activities expire after 30 days
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Compound index for friend activity queries
ActivitySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Activity", ActivitySchema);
