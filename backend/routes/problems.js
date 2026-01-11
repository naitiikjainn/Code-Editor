import express from "express";
import Problem from "../models/Problem.js"; // Import Problem Model
import redis from "../config/redis.js"; // Import Redis Wrapper

const router = express.Router();


// --- LEETCODE API ---
router.get("/leetcode/:slug", async (req, res) => {
    try {
        let { slug } = req.params;

        // If slug is a number, look it up first
        if (!isNaN(slug)) {
            const searchQuery = `
                query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
                    problemsetQuestionList: questionList(
                        categorySlug: $categorySlug
                        limit: $limit
                        skip: $skip
                        filters: $filters
                    ) {
                        data {
                            questionFrontendId
                            titleSlug
                        }
                    }
                }
            `;

            const searchRes = await fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Referer": "https://leetcode.com" },
                body: JSON.stringify({
                    query: searchQuery,
                    variables: {
                        categorySlug: "",
                        skip: 0,
                        limit: 1,
                        filters: { searchKeywords: slug }
                    }
                })
            });
            const searchData = await searchRes.json();
            const found = searchData.data?.problemsetQuestionList?.data?.find(q => q.questionFrontendId === slug);

            if (found) {
                slug = found.titleSlug;
            } else {
                return res.status(404).json({ error: "Problem ID not found on LeetCode" });
            }
        }

        const query = `
            query getQuestionDetail($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionId
                    questionFrontendId
                    title
                    titleSlug
                    content
                    difficulty
                    exampleTestcases
                    codeSnippets {
                        lang
                        langSlug
                        code
                    }
                }
            }
        `;

        const response = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com"
            },
            body: JSON.stringify({
                query,
                variables: { titleSlug: slug }
            })
        });

        const data = await response.json();
        const question = data.data?.question;

        if (!question) {
            return res.status(404).json({ error: "Problem not found" });
        }

        res.json({
            provider: "leetcode",
            id: question.questionFrontendId,
            questionId: question.questionId,
            title: question.title,
            titleSlug: question.titleSlug,
            description: question.content,
            difficulty: question.difficulty,
            examples: question.exampleTestcases,
            snippets: question.codeSnippets
        });

    } catch (err) {
        console.error("LeetCode Error:", err);
        res.status(500).json({ error: "Failed to fetch LeetCode problem" });
    }
});

// --- CODEFORCES STATUS PROXY (Must be before generic /:contestId/:index) ---
router.get("/codeforces/status/:handle", async (req, res) => {
    try {
        const { handle } = req.params;
        console.log(`[Proxy] Fetching status for ${handle}`);
        const response = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=5000`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("CF Status Proxy Error:", err);
        res.status(500).json({ error: "Failed to fetch status" });
    }
});

// --- MANUAL CACHE ENDPOINT (For Extension Pipeline) ---
router.post("/cache", async (req, res) => {
    try {
        const { problemId, data } = req.body;
        if (!problemId || !data) return res.status(400).json({ error: "Missing data" });

        console.log(`[Cache] Manual update for ${problemId}`);

        // 1. Save to Mongo
        await Problem.findOneAndUpdate(
            { problemId },
            {
                problemId,
                data,
                lastAccessed: new Date() // Reset TTL
            },
            { upsert: true, new: true }
        );

        // 2. Save to Redis (TTL 2 Days)
        redis.setex(`problem:${problemId}`, 172800, JSON.stringify(data)).catch(e => console.error("Redis Save Error", e));

        res.json({ success: true });
    } catch (e) {
        console.error("Manual Cache Error:", e);
        res.status(500).json({ error: "Failed to cache" });
    }
});

// --- CLEAR CACHE ENDPOINT ---
router.delete("/cache", async (req, res) => {
    try {
        console.log("[Cache] Clearing Codeforces cache...");

        // 1. Clear Redis Keys (pattern: problem:*)
        const keys = await redis.keys("problem:*");
        if (keys.length > 0) {
            await redis.del(keys);
            console.log(`[Redis] Deleted ${keys.length} keys`);
        }

        // 2. Clear MongoDB (Provider: Codeforces or all)
        // Assuming data structure has provider inside data or we just wipe all for now as 'cp31' implies all relevant CF problems.
        // But let's be safe and only delete if problemId looks like CF or we can filter if the schema allows.
        // For now, wiping 'Problem' collection is effectively what is asked since mostly it stores fetched problems.
        await Problem.deleteMany({});
        console.log("[Mongo] Cleared Problem collection");

        res.json({ success: true, message: "Cache cleared" });
    } catch (e) {
        console.error("Clear Cache Error:", e);
        res.status(500).json({ error: "Failed to clear cache" });
    }
});

// --- CODEFORCES API ---
router.get("/codeforces/:contestId/:index", async (req, res) => {
    const { contestId, index } = req.params;
    const problemId = `${contestId}${index}`;

    // 1. Check Redis Cache (Fastest)
    try {
        const cachedParams = await redis.get(`problem:${problemId}`);
        if (cachedParams) {
            console.log(`[Redis] Hit for ${problemId}`);
            return res.json(JSON.parse(cachedParams));
        }
    } catch (e) {
        console.warn("Redis Check Failed:", e.message);
    }

    // 2. Check DB Cache (Fast)
    try {
        const cached = await Problem.findOne({ problemId });
        if (cached) {
            console.log(`[Mongo] Hit for ${problemId}`);

            // Sliding TTL: Update lastAccessed to keep it alive
            cached.lastAccessed = new Date();
            cached.save().catch(e => console.error("TTL Update Error:", e));

            // Save to Redis for next time (TTL: 2 Days = 172800s)
            redis.setex(`problem:${problemId}`, 172800, JSON.stringify(cached.data)).catch(e => console.error("Redis Save Error", e));
            return res.json(cached.data);
        }
    } catch (e) {
        console.error("Cache Check Error:", e);
    }

    // 3. If Cache Miss, Return 404 (Force Extension Fetch)
    console.log(`[Backend] Cache miss for ${problemId}. Delegating to Extension.`);
    return res.status(404).json({ error: "Not found in cache", requiresExtension: true });
});

// --- CODEFORCES LIST ---
router.get("/codeforces/list", async (req, res) => {
    try {
        const response = await fetch("https://codeforces.com/api/problemset.problems");
        const data = await response.json();

        if (data.status === "OK") {
            // Filter/Map if needed to reduce payload? 
            // Sending all might be heavy (~5MB). Let's send it all for now, client can cache.
            res.json(data.result);
        } else {
            res.status(500).json({ error: "Codeforces API Error: " + data.comment });
        }
    } catch (err) {
        console.error("CF List Error:", err);
        res.status(500).json({ error: "Failed to fetch problem list" });
    }
});

// --- CODEFORCES USER ---
router.get("/codeforces/user/:handle", async (req, res) => {
    try {
        const { handle } = req.params;
        const response = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
        const data = await response.json();

        if (data.status === "OK") {
            // We only need solved problems to mark them green
            const solved = new Set();
            data.result.forEach(sub => {
                if (sub.verdict === "OK") {
                    solved.add(`${sub.problem.contestId}${sub.problem.index}`);
                }
            });
            res.json({ solved: Array.from(solved) });
        } else {
            res.status(404).json({ error: "User not found or API error" });
        }
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch user stats" });
    }
});

// --- CODEFORCES API ---
router.get("/codeforces/:contestId/:index", async (req, res) => {
    const { contestId, index } = req.params;
    const problemId = `${contestId}${index}`;

    // 1. Check Redis Cache (Fastest)
    try {
        const cachedParams = await redis.get(`problem:${problemId}`);
        if (cachedParams) {
            console.log(`[Redis] Hit for ${problemId}`);
            return res.json(JSON.parse(cachedParams));
        }
    } catch (e) {
        console.warn("Redis Check Failed:", e.message);
    }

    // 2. Check DB Cache (Fast)
    try {
        const cached = await Problem.findOne({ problemId });
        if (cached) {
            console.log(`[Mongo] Hit for ${problemId}`);

            // Sliding TTL: Update lastAccessed to keep it alive
            cached.lastAccessed = new Date();
            cached.save().catch(e => console.error("TTL Update Error:", e));

            // Save to Redis for next time (TTL: 2 Days = 172800s)
            redis.setex(`problem:${problemId}`, 172800, JSON.stringify(cached.data)).catch(e => console.error("Redis Save Error", e));
            return res.json(cached.data);
        }
    } catch (e) {
        console.error("Cache Check Error:", e);
    }

    // 3. If Cache Miss, Return 404 (Force Extension Fetch)
    console.log(`[Backend] Cache miss for ${problemId}. Delegating to Extension.`);
    return res.status(404).json({ error: "Not found in cache", requiresExtension: true });
});

// --- CSES API ---

// 1. Get Problem Object from Task ID (Scraper)
router.get("/cses/problem/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const problemId = `CSES${id}`; // Unique ID for Cache

        // 1. Check Redis
        try {
            const cachedParams = await redis.get(`problem:${problemId}`);
            if (cachedParams) {
                return res.json(JSON.parse(cachedParams));
            }
        } catch (e) {
            console.warn("Redis Check Failed:", e.message);
        }

        // 2. Check Mongo
        try {
            const cached = await Problem.findOne({ problemId });
            if (cached) {
                redis.setex(`problem:${problemId}`, 172800, JSON.stringify(cached.data)).catch(e => console.error("Redis Save Error", e));
                return res.json(cached.data);
            }
        } catch (e) {
            console.error("Cache Check Error:", e);
        }

        const url = `https://cses.fi/problemset/task/${id}`;

        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" }
        });
        if (!response.ok) throw new Error("Problem not found");

        const text = await response.text();

        // --- PARSE ---
        // Title: <div class="title-block"><h1>Problem Name</h1>...
        // Content: <div class="content">...</div>

        const titleMatch = text.match(/<div class="title-block">\s*<h1>(.*?)<\/h1>/);
        const title = titleMatch ? titleMatch[1].trim() : `CSES Problem ${id}`;

        // Extract content
        const contentStart = '<div class="content">';
        const contentEnd = '<div class="footer-block">'; // Assuming footer follows content

        let description = "";
        const idxStart = text.indexOf(contentStart);
        if (idxStart !== -1) {
            const idxEnd = text.indexOf('</div>', text.lastIndexOf('<p class="copyright">')); // Rough guess, or scan stack?
            // Actually, the content div wraps everything. Let's find end of content div.
            // Simple hack: Take substring until finding the specific footer or nav marker.

            // Better: CSES structure is simple. 
            // <div class="content"> ... </div> <div class="nav sidebar">
            const idxEndCandidate = text.indexOf('<div class="nav sidebar">');
            if (idxEndCandidate !== -1) {
                description = text.substring(idxStart, idxEndCandidate);
            } else {
                description = text.substring(idxStart, idxStart + 5000) + "</div>";
            }
        }

        // Fix relative images or links if any
        description = description.replace(/src="\//g, 'src="https://cses.fi/');

        // Extract Test Cases (Inputs/Outputs)
        // Format: <code>Input:</code><pre>...</pre>
        // Or just <pre>...</pre> blocks.
        // Usually: <div class="md"><p>Input:</p><pre>...</pre><p>Output:</p><pre>...</pre></div>

        const testCases = [];
        const inputs = [];
        const outputs = [];

        const codeBlockRegex = /<pre>([\s\S]*?)<\/pre>/g;
        let match;
        while ((match = codeBlockRegex.exec(description)) !== null) {
            // Alternating input/output usually
            if (inputs.length === outputs.length) {
                inputs.push(match[1].trim());
            } else {
                outputs.push(match[1].trim());
            }
        }

        for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
            testCases.push({ input: inputs[i], expectedOutput: outputs[i] });
        }


        const problemData = {
            provider: "cses",
            id: id,
            title: title,
            url: url,
            description: description,
            testCases: testCases
        };

        // Save to Cache
        try {
            await Problem.create({ problemId, data: problemData });
            redis.setex(`problem:${problemId}`, 172800, JSON.stringify(problemData)).catch(e => console.error("Redis Save Error", e));
        } catch (e) {
            console.error("CSES Cache Save Error:", e.message);
        }

        res.json(problemData);

    } catch (err) {
        console.error("CSES Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch CSES problem" });
    }
});

// 2. Get List (Scraper) - Grouped by Category
router.get("/cses/list", async (req, res) => {
    try {
        const response = await fetch("https://cses.fi/problemset/");
        const text = await response.text();

        // Structure: <h2>Category Name</h2> <ul class="task-list">...</ul>
        const categories = [];

        // Split by <h2> tags to get sections
        // Note: The first split might be empty or irrelevant content
        const sections = text.split("<h2>");

        sections.forEach((section, index) => {
            if (index === 0) return; // Skip header content

            // Extract Category Name
            const titleEnd = section.indexOf("</h2>");
            if (titleEnd === -1) return;
            const categoryName = section.substring(0, titleEnd).trim();

            // Extract Problems in this section
            const problemRegex = /<a href="\/problemset\/task\/(\d+)">([^<]+)<\/a>/g;
            let match;
            const problems = [];

            while ((match = problemRegex.exec(section)) !== null) {
                problems.push({
                    contestId: "CSES",
                    index: match[1],
                    name: match[2],
                    tags: [categoryName]
                });
            }

            if (problems.length > 0) {
                categories.push({
                    name: categoryName,
                    problems: problems
                });
            }
        });

        res.json({ categories });

    } catch (err) {
        console.error("CSES List Error:", err);
        res.status(500).json({ error: "Failed to fetch CSES list" });
    }
});


export default router;
