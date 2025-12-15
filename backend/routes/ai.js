import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

router.post("/assist", async (req, res) => {
  try {
    const { prompt, code } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("Error: GEMINI_API_KEY is missing in .env");
      return res.status(500).json({ error: "Server API Key configuration missing" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // FIX 1: Use the correct model name
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest", 
    });
    const fullPrompt = `
You are an AI assistant inside a web code editor.
HTML: ${code?.html || ""}
CSS: ${code?.css || ""}
JS: ${code?.js || ""}
User request: ${prompt}
    `;

    const result = await model.generateContent(fullPrompt);
    
    // FIX 2: Correct way to extract text in the latest SDK
    const response = await result.response;
    const text = response.text();

    res.json({ result: text });

  } catch (err) {
    // This logs the ACTUAL error to your VS Code terminal
    console.error("GEMINI API ERROR DETAILS:", err);
    
    // Send a more descriptive error to the frontend if possible
    res.status(500).json({ 
        error: "AI Generation failed", 
        details: err.message || "Unknown error" 
    });
  }
});

export default router;