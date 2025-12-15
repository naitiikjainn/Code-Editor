import express from "express";

const router = express.Router();

// Map your frontend language names to Piston API versions
const RUNTIMES = {
  cpp: { language: "c++", version: "10.2.0" },
  java: { language: "java", version: "15.0.2" },
  python: { language: "python", version: "3.10.0" },
};

router.post("/execute", async (req, res) => {
  // 1. Accept 'stdin' from the request
  const { language, code, stdin } = req.body;

  if (!RUNTIMES[language]) {
    return res.status(400).json({ error: "Unsupported Language" });
  }

  const runtime = RUNTIMES[language];

  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ content: code }],
        stdin: stdin || "", // 2. Pass the input to Piston (or empty string)
      }),
    });

    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error("Execution Error:", error);
    res.status(500).json({ error: "Failed to execute code" });
  }
});

export default router;