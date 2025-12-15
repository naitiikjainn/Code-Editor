import express from "express";
import cors from "cors";
import connectDB from "./db.js";
import shareRoutes from "./routes/share.js";
import dotenv from "dotenv";
dotenv.config();
import aiRoutes from "./routes/ai.js";
import codeRoutes from "./routes/code.js";


const app = express();
app.use(cors({
    origin: ["http://localhost:5173", "https://code-editor-33js86cj4-naitik-jains-projects.vercel.app/"], // Replace with your ACTUAL Vercel URL
    credentials: true
}));
app.use(express.json());
connectDB();
app.use("/api/ai", aiRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/share", shareRoutes);
app.get("/health", (_, res) => {
  res.send("Backend running");
});

app.listen(5000, () => {
  console.log("Backend running on http://localhost:5000");
});
console.log("GEMINI KEY LOADED:", !!process.env.GEMINI_API_KEY);

