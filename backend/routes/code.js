import express from "express";

const router = express.Router();

// Wandbox API compilers for each language
const COMPILERS = {
  cpp: { compiler: "gcc-13.2.0", options: "-std=c++17,-O2" },
  java: { compiler: "openjdk-jdk-22+36" },
  python: { compiler: "cpython-3.12.7" },
  javascript: { compiler: "nodejs-20.17.0" },
};

// Input validation
const sanitizeCode = (code, maxLength = 100000) => {
  if (typeof code !== 'string') return '';
  return code.slice(0, maxLength);
};

router.post("/execute", async (req, res) => {
  const { language, code, stdin } = req.body;

  // Validate inputs
  if (!language || typeof language !== 'string') {
    return res.status(400).json({ error: "Language is required" });
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: "Code is required" });
  }

  console.log(`🚀 Executing ${language} code...`);

  if (!COMPILERS[language]) {
    return res.status(400).json({ error: "Unsupported Language" });
  }

  const compilerConfig = COMPILERS[language];
  const sanitizedCode = sanitizeCode(code);
  const sanitizedStdin = sanitizeCode(stdin || '', 10000); // 10KB max for stdin

  try {
    const wandboxPayload = {
      compiler: compilerConfig.compiler,
      code: sanitizedCode,
      stdin: sanitizedStdin,
      ...(compilerConfig.options ? { options: compilerConfig.options } : {}),
    };

    // Retry logic for rate limits
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch("https://wandbox.org/api/compile.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wandboxPayload),
      });

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 1000;
          console.warn(`⚠️ Wandbox 429 - retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return res.status(429).json({ error: "Code execution service is busy. Please try again in a few seconds." });
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        console.error(`❌ Wandbox error (${response.status}):`, errText);
        return res.status(500).json({ error: `Execution service error (${response.status})` });
      }

      const data = await response.json();

      // Log for debugging
      console.log(`📋 Wandbox response for ${language}:`, JSON.stringify({
        status: data.status,
        compiler_error: data.compiler_error?.slice(0, 200) || "",
        program_output: data.program_output?.slice(0, 200) || "",
        program_error: data.program_error?.slice(0, 200) || "",
      }));

      // Translate Wandbox response to Piston-compatible format (frontend expects data.run.output)
      const hasCompileError = data.compiler_error && data.compiler_error.trim().length > 0;
      const output = hasCompileError
        ? data.compiler_error  // Show compile errors
        : (data.program_output || data.program_error || "");

      const normalizedResponse = {
        run: {
          output: output,
          stdout: data.program_output || "",
          stderr: data.program_error || "",
          code: data.status === "0" ? 0 : 1,
        },
        compile: {
          output: data.compiler_output || "",
          stderr: data.compiler_error || "",
          code: hasCompileError ? 1 : 0,
        },
      };

      return res.json(normalizedResponse);
    }

  } catch (error) {
    console.error("Execution Error:", error);
    res.status(500).json({ error: "Failed to execute code" });
  }
});

export default router;