import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
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
        required: true,
        default: "default"
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
