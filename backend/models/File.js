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
        enum: ["web", "html", "css", "javascript", "cpp", "java", "python"],
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

const File = mongoose.model("File", fileSchema);
export default File;
