import express from "express";
const router = express.Router();
// Use dynamic import for node-fetch if in ESM environment or stick to it if project is ESM
import fetch from "node-fetch";

// POST /api/leettools/solved
// Body: { cookie, csrfToken, username? }
// Fetches ALL accepted problem slugs from LeetCode GraphQL API
// Uses problemsetQuestionList with status filter (most reliable for full solved list)
router.post("/solved", async (req, res) => {
    try {
        const { cookie, csrfToken } = req.body;
        let { username } = req.body;

        if (!cookie || !csrfToken) {
            return res.status(400).json({ error: "Missing LeetCode credentials (cookie/csrf)." });
        }

        const headers = {
            "Content-Type": "application/json",
            "Cookie": `LEETCODE_SESSION=${cookie}; csrftoken=${csrfToken}`,
            "x-csrftoken": csrfToken,
            "Referer": "https://leetcode.com/",
            "Origin": "https://leetcode.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };

        // Auto-detect username from LeetCode session if not provided
        if (!username) {
            try {
                const meRes = await fetch("https://leetcode.com/graphql", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        query: `query { userStatus { username } }`,
                        variables: {}
                    })
                });
                const meData = await meRes.json();
                username = meData?.data?.userStatus?.username;
                if (username) {
                    console.log(`[LeetTools] Auto-detected username: ${username}`);
                }
            } catch (e) {
                console.warn("[LeetTools] Failed to auto-detect username:", e.message);
            }
        }

        if (!username) {
            return res.status(400).json({ error: "Could not determine LeetCode username. Please set it in your profile." });
        }

        console.log(`[LeetTools] Fetching ALL solved problems for: ${username}`);

        // Strategy 1: Use problemsetQuestionList with AC status filter (gets ALL solved)
        // This is the most reliable way to get the complete solved list
        const solvedSlugs = [];
        let totalSolved = 0;
        let skip = 0;
        const batchSize = 100;
        let usedStrategy = "questionList";

        try {
            const questionListQuery = `
                query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
                    problemsetQuestionList: questionList(
                        categorySlug: $categorySlug
                        limit: $limit
                        skip: $skip
                        filters: $filters
                    ) {
                        total: totalNum
                        questions: data {
                            titleSlug
                        }
                    }
                }
            `;

            // First batch to get total count
            const firstRes = await fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    query: questionListQuery,
                    variables: { 
                        categorySlug: "", 
                        limit: batchSize, 
                        skip: 0, 
                        filters: { status: "AC" } 
                    }
                })
            });

            if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
            const firstData = await firstRes.json();
            
            if (firstData.errors) throw new Error(JSON.stringify(firstData.errors));

            const firstBatch = firstData.data?.problemsetQuestionList;
            if (!firstBatch) throw new Error("No problemsetQuestionList in response");

            totalSolved = firstBatch.total || 0;
            const firstQuestions = firstBatch.questions || [];
            firstQuestions.forEach(q => { if (q.titleSlug) solvedSlugs.push(q.titleSlug); });

            console.log(`[LeetTools] Strategy 1: Total solved = ${totalSolved}, first batch = ${firstQuestions.length}`);

            // Fetch remaining batches in parallel (max 5 concurrent)
            if (totalSolved > batchSize) {
                const remaining = totalSolved - batchSize;
                const batches = Math.ceil(remaining / batchSize);
                
                // Process in chunks of 5 parallel requests
                for (let chunk = 0; chunk < batches; chunk += 5) {
                    const chunkBatches = [];
                    for (let i = chunk; i < Math.min(chunk + 5, batches); i++) {
                        const batchSkip = (i + 1) * batchSize;
                        chunkBatches.push(
                            fetch("https://leetcode.com/graphql", {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    query: questionListQuery,
                                    variables: { 
                                        categorySlug: "", 
                                        limit: batchSize, 
                                        skip: batchSkip, 
                                        filters: { status: "AC" } 
                                    }
                                })
                            }).then(r => r.json()).catch(() => null)
                        );
                    }

                    const results = await Promise.all(chunkBatches);
                    results.forEach(data => {
                        if (data?.data?.problemsetQuestionList?.questions) {
                            data.data.problemsetQuestionList.questions.forEach(q => {
                                if (q.titleSlug) solvedSlugs.push(q.titleSlug);
                            });
                        }
                    });
                }
            }
        } catch (strategyErr) {
            console.warn(`[LeetTools] Strategy 1 (questionList) failed:`, strategyErr.message);
            
            // Strategy 2: Fallback to recentAcSubmissionList (gets recent ~20)
            usedStrategy = "recentAc";
            try {
                const recentAcQuery = `
                    query recentAcSubmissions($username: String!, $limit: Int!) {
                        recentAcSubmissionList(username: $username, limit: $limit) {
                            titleSlug
                        }
                    }
                `;

                const acRes = await fetch("https://leetcode.com/graphql", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        query: recentAcQuery,
                        variables: { username, limit: 5000 }
                    })
                });

                if (acRes.ok) {
                    const acData = await acRes.json();
                    const submissions = acData.data?.recentAcSubmissionList || [];
                    submissions.forEach(s => { if (s.titleSlug) solvedSlugs.push(s.titleSlug); });
                }
            } catch (e) {
                console.warn("[LeetTools] Strategy 2 also failed:", e.message);
            }
        }

        // Also fetch user stats (total solved count by difficulty)
        let stats = null;
        try {
            const statsQuery = `
                query userProblemsSolved($username: String!) {
                    matchedUser(username: $username) {
                        submitStatsGlobal {
                            acSubmissionNum {
                                difficulty
                                count
                            }
                        }
                    }
                }
            `;
            const statsRes = await fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    query: statsQuery,
                    variables: { username }
                })
            });
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                const acNums = statsData?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum;
                if (acNums) {
                    stats = {};
                    acNums.forEach(item => {
                        stats[item.difficulty.toLowerCase()] = item.count;
                    });
                    // "All" difficulty gives the total
                    console.log(`[LeetTools] User stats:`, stats);
                }
            }
        } catch (e) {
            console.warn("[LeetTools] Stats fetch failed:", e.message);
        }

        // Deduplicate
        const uniqueSlugs = [...new Set(solvedSlugs)];

        console.log(`[LeetTools] Final: ${uniqueSlugs.length} unique solved problems for ${username} (strategy: ${usedStrategy})`);
        
        res.json({ 
            success: true, 
            solved: uniqueSlugs,
            total: uniqueSlugs.length,
            username,
            stats,
            strategy: usedStrategy
        });

    } catch (err) {
        console.error("[LeetTools] Solved Error:", err);
        res.status(500).json({ error: err.message });
    }
});

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
