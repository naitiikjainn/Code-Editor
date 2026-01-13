import express from "express";
import SharedCode from "../models/SharedCode.js";

const router = express.Router();

// Input validation
const sanitizeString = (str, maxLength) => {
    if (typeof str !== 'string') return '';
    return str.slice(0, maxLength);
};

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

// 1. SAVE CODE (POST /api/share)
router.post("/generate", async (req, res) => {
  try {
    const { language, code, stdin } = req.body;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "Code is required" });
    }
    
    // Create new entry in DB with sanitized inputs
    const newShare = await SharedCode.create({ 
      language: sanitizeString(language || 'javascript', 50), 
      code: sanitizeString(code, 100000), // 100KB max
      stdin: sanitizeString(stdin || '', 10000) // 10KB max for stdin
    });
    
    // Return the unique ID (_id)
    res.json({ id: newShare._id, message: "Code saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save code" });
  }
});

// 2. GET CODE (GET /api/share/:id)
router.get("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid share ID" });
    }
    
    const sharedData = await SharedCode.findById(req.params.id);
    
    if (!sharedData) {
      return res.status(404).json({ error: "Code not found" });
    }
    
    res.json(sharedData);
  } catch (error) {
    res.status(500).json({ error: "Invalid ID" });
  }
});

export default router;