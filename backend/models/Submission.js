import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    problemId: { type: String, required: true }, // e.g. "1903A" or "two-sum"
    problemName: { type: String, required: true },
    platform: { type: String, required: true, enum: ["codeforces", "leetcode", "cses"] },

    code: { type: String, required: true },
    language: { type: String, required: true }, // "cpp", "python", "javascript"

    verdict: { type: String, required: true }, // "Accepted", "Wrong Answer", "Compilation Error"

    visibility: {
        type: String,
        enum: ["public", "friends", "private"],
        default: "public"
    },

    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Submission", SubmissionSchema);
