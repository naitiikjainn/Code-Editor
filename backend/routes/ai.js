import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Input validation
const sanitizePrompt = (prompt, maxLength = 5000) => {
  if (typeof prompt !== 'string') return '';
  return prompt.slice(0, maxLength).trim();
};

router.post("/assist", async (req, res) => {
  try {
    const { prompt, code } = req.body;
    
    // Validate inputs
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server missing API Key" });
    }

    const sanitizedPrompt = sanitizePrompt(prompt);
    
    // Sanitize code object
    const sanitizedCode = {};
    if (code && typeof code === 'object') {
      for (const [lang, content] of Object.entries(code)) {
        if (typeof content === 'string') {
          sanitizedCode[lang.slice(0, 20)] = content.slice(0, 50000);
        }
      }
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Use the reliable flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Construct a generic prompt that works for ANY language
    const fullPrompt = `
You are an expert coding assistant inside a code editor.

CONTEXT:
User is currently working in: ${Object.keys(sanitizedCode).join(", ").toUpperCase() || "CODE"} mode.

CODE SNIPPET:
${JSON.stringify(sanitizedCode, null, 2)}

USER QUESTION:
${sanitizedPrompt}

Provide a concise, helpful answer. If providing code, use strictly formatted markdown blocks.
    `;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({ result: text });
  } catch (err) {
    console.error("AI Error:", err.message);
    res.status(500).json({ error: "AI Failed", details: "An error occurred processing your request" });
  }
});

export default router;