import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/assist", async (req, res) => {
  try {
    const { prompt, code } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server missing API Key" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Use the reliable flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Construct a generic prompt that works for ANY language
    const fullPrompt = `
You are an expert coding assistant inside a code editor.

CONTEXT:
User is currently working in: ${Object.keys(code).join(", ").toUpperCase()} mode.

CODE SNIPPET:
${JSON.stringify(code, null, 2)}

USER QUESTION:
${prompt}

Provide a concise, helpful answer. If providing code, use strictly formatted markdown blocks.
    `;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({ result: text });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "AI Failed", details: err.message });
  }
});

export default router;