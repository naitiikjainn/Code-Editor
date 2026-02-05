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
    const { prompt, code, problem } = req.body;

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

    // Build problem context section if available
    let problemSection = "";
    if (problem && typeof problem === 'object') {
      problemSection = `
CURRENT PROBLEM:
Title: ${problem.title || "Unknown"}
Provider: ${problem.provider || "Unknown"}
Difficulty: ${problem.difficulty || "Unknown"}
${problem.description ? `\nDescription:\n${typeof problem.description === 'string' ? problem.description.slice(0, 5000) : JSON.stringify(problem.description).slice(0, 5000)}` : ""}
${problem.examples ? `\nExamples:\n${JSON.stringify(problem.examples, null, 2).slice(0, 2000)}` : ""}
${problem.constraints ? `\nConstraints:\n${typeof problem.constraints === 'string' ? problem.constraints.slice(0, 1000) : JSON.stringify(problem.constraints).slice(0, 1000)}` : ""}
${problem.tags ? `\nTags: ${Array.isArray(problem.tags) ? problem.tags.map(t => t.name || t).join(", ") : problem.tags}` : ""}
`;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Use the reliable flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Construct a generic prompt that works for ANY language
    const fullPrompt = `
You are an expert coding assistant inside a code editor helping solve competitive programming problems.
${problemSection}
CONTEXT:
User is currently working in: ${Object.keys(sanitizedCode).join(", ").toUpperCase() || "CODE"} mode.

CODE SNIPPET:
${JSON.stringify(sanitizedCode, null, 2)}

USER QUESTION:
${sanitizedPrompt}

Provide a concise, helpful answer. If the question relates to the problem, use your knowledge of the problem to help. If providing code, use strictly formatted markdown blocks.
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