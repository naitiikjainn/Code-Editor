import express from "express";

const router = express.Router();

// Map your frontend language names to Piston API versions
const RUNTIMES = {
  cpp: { language: "c++", version: "10.2.0" },
  java: { language: "java", version: "15.0.2" },
  python: { language: "python", version: "3.10.0" },
  javascript: { language: "javascript", version: "18.15.0" },
};

// Input validation
const sanitizeCode = (code, maxLength = 100000) => {
  if (typeof code !== 'string') return '';
  return code.slice(0, maxLength);
};

router.post("/execute", async (req, res) => {
  // 1. Accept 'stdin' from the request
  const { language, code, stdin } = req.body;
  
  // Validate inputs
  if (!language || typeof language !== 'string') {
    return res.status(400).json({ error: "Language is required" });
  }
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: "Code is required" });
  }
  
  console.log(`🚀 Executing ${language} code...`);

  if (!RUNTIMES[language]) {
    return res.status(400).json({ error: "Unsupported Language" });
  }

  const runtime = RUNTIMES[language];
  const sanitizedCode = sanitizeCode(code);
  const sanitizedStdin = sanitizeCode(stdin || '', 10000); // 10KB max for stdin

  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{
          content: sanitizedCode,
          name: language === "cpp" ? "main.cpp" : (language === "java" ? "Main.java" : "main.py")
        }],
        stdin: sanitizedStdin,
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