import express from "express";
import SharedCode from "../models/SharedCode.js";

const router = express.Router();

// 1. SAVE CODE (POST /api/share)
router.post("/generate", async (req, res) => {
  try {
    const { language, code, stdin } = req.body;
    
    // Create new entry in DB
    const newShare = await SharedCode.create({ language, code, stdin });
    
    // Return the unique ID (_id)
    res.json({ id: newShare._id, message: "Code saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save code" });
  }
});

// 2. GET CODE (GET /api/share/:id)
router.get("/:id", async (req, res) => {
  try {
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