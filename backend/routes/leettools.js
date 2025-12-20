import express from "express";
const router = express.Router();
// Use dynamic import for node-fetch if in ESM environment or stick to it if project is ESM
import fetch from "node-fetch";

// POST /api/leettools/submit
// Body: { slug, code, lang, cookie, csrfToken, questionId }
router.post("/submit", async (req, res) => {
    try {
        const { slug, code, lang, cookie, csrfToken, questionId } = req.body;

        if (!cookie || !csrfToken) {
            return res.status(400).json({ error: "Missing LeetCode credentials (cookie/csrf)." });
        }

        const submitUrl = `https://leetcode.com/problems/${slug}/submit/`;

        console.log(`[LeetTools] Submitting to ${slug}...`);

        const headers = {
            "Content-Type": "application/json",
            "Cookie": `LEETCODE_SESSION=${cookie}; csrftoken=${csrfToken}`,
            "x-csrftoken": csrfToken,
            "Referer": `https://leetcode.com/problems/${slug}/`,
            "Origin": "https://leetcode.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        };

        const body = JSON.stringify({
            lang: lang || "cpp",
            question_id: questionId,
            typed_code: code
        });

        // 1. Send Submission
        const submitRes = await fetch(submitUrl, { method: "POST", headers, body });

        if (!submitRes.ok) {
            const text = await submitRes.text();
            console.error(`[LeetTools] Submission Failed: ${submitRes.status}`, text);
            return res.status(submitRes.status).json({ error: "LeetCode submission failed.", details: text });
        }

        const submitData = await submitRes.json();
        const submissionId = submitData.submission_id;

        console.log(`[LeetTools] Submission ID: ${submissionId}`);

        // 2. Poll for Result
        // We will poll up to 10 times, every 2 seconds.
        let attempts = 0;
        let result = null;

        while (attempts < 10) {
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s
            attempts++;

            const checkUrl = `https://leetcode.com/submissions/detail/${submissionId}/check/`;
            const checkRes = await fetch(checkUrl, { headers });

            if (checkRes.ok) {
                const data = await checkRes.json();
                if (data.state === "SUCCESS") {
                    result = data;
                    break;
                }
                // If PENDING or STARTED, continue polling
            }
        }

        if (result) {
            res.json({ success: true, submissionId, result });
        } else {
            res.json({ success: false, error: "Submission timed out or is still processing.", submissionId });
        }

    } catch (err) {
        console.error("[LeetTools] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
