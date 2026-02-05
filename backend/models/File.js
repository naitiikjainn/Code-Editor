import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    name: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        default: "",
    },
    roomId: {
        type: String,
        default: null // Room is now optional/contextual
    },
    language: {
        type: String,
        required: true,
        enum: [
            "web", "html", "css", "javascript", "typescript",
            "cpp", "c", "java", "python", "rust", "go", "ruby",
            "csharp", "php", "swift", "kotlin", "scala",
            "sql", "json", "yaml", "xml", "markdown",
            "bash", "shell", "plaintext"
        ],
        default: "javascript"
    },
    folder: {
        type: String,
        default: "/",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// Compound indexes for common queries
fileSchema.index({ userId: 1, folder: 1 }); // User's files in folder
fileSchema.index({ userId: 1, language: 1 }); // User's files by language
fileSchema.index({ roomId: 1 }, { sparse: true }); // Room files
fileSchema.index({ userId: 1, updatedAt: -1 }); // Recent files
fileSchema.index({ userId: 1, name: 1 }); // File lookup by name

const File = mongoose.model("File", fileSchema);
export default File;
