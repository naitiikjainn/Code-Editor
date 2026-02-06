import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    problemId: { type: String, required: true }, // e.g. "1903A" or "two-sum"
    problemName: { type: String, default: "Untitled Problem" }, // Not required - fallback if missing
    platform: { type: String, required: true, enum: ["codeforces", "leetcode", "cses"] },

    code: { type: String, required: true },
    language: { type: String, required: true }, // "cpp", "python", "javascript"

    verdict: { type: String, required: true }, // "Accepted", "Wrong Answer", "Compilation Error", "Judging"

    // CSES judge detailed results
    judgeResult: {
        totalTests: { type: Number },
        passedTests: { type: Number },
        firstFailedTest: { type: Number, default: null },
        firstFailedInput: { type: String, default: null },     // truncated to 500 chars
        firstFailedExpected: { type: String, default: null },   // truncated to 500 chars
        firstFailedActual: { type: String, default: null },     // truncated to 500 chars
        executionTime: { type: Number },                        // max across all tests (ms)
        memoryUsed: { type: Number },                           // max across all tests (KB)
        testResults: [{
            testNumber: { type: Number },
            verdict: { type: String },                          // AC|WA|TLE|MLE|RE|CE
            time: { type: Number },
        }]
    },

    visibility: {
        type: String,
        enum: ["public", "private"],
        default: "public"
    },

    createdAt: { type: Date, default: Date.now }
});

// Compound indexes for common queries
SubmissionSchema.index({ userId: 1, createdAt: -1 }); // User's recent submissions
SubmissionSchema.index({ userId: 1, platform: 1 }); // User submissions by platform
SubmissionSchema.index({ userId: 1, problemId: 1 }); // User submissions for problem
SubmissionSchema.index({ problemId: 1, visibility: 1 }); // Public submissions for problem
SubmissionSchema.index({ platform: 1, verdict: 1, createdAt: -1 }); // Leaderboard queries
SubmissionSchema.index({ visibility: 1, createdAt: -1 }); // Recent public submissions

export default mongoose.model("Submission", SubmissionSchema);
