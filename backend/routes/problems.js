import express from "express";
import Problem from "../models/Problem.js"; // Import Problem Model
import redis from "../config/redis.js"; // Import Redis Wrapper
import scraperService from "../utils/scraperService.js";
import puppeteer from "puppeteer";

const router = express.Router();

// In-memory fallback cache (used when Redis is unavailable)
const memoryCache = new Map();
const getMemoryCache = (key) => {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
};
const setMemoryCache = (key, value, ttlMs) => {
    memoryCache.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : null });
};

/**
 * Extract the section for a specific problem from the editorial HTML
 * Codeforces editorials typically have problem links like /contest/2184/problem/F
 * and each problem section starts with a link to the problem
 */
function extractProblemSection(htmlContent, contestId, problemIndex) {
    if (!htmlContent || !problemIndex) return null;

    const upperIndex = problemIndex.toUpperCase();
    const lowerIndex = problemIndex.toLowerCase();

    // Pattern 1: Look for problem link like /contest/2184/problem/F
    const problemLinkPattern = new RegExp(
        `<p[^>]*>\\s*<a[^>]*href=["'][^"']*\\/contest\\/${contestId}\\/problem\\/${upperIndex}["'][^>]*>.*?<\\/a>`,
        'i'
    );

    // Pattern 2: Look for text like "2184F - Problem Name" or "Problem F"
    const problemTitlePattern = new RegExp(
        `<p[^>]*>.*?(?:${contestId}${upperIndex}|Problem\\s*${upperIndex})\\s*[-–—:]`,
        'i'
    );

    // Find the start of this problem's section
    let startMatch = htmlContent.match(problemLinkPattern);
    let startIndex = startMatch ? htmlContent.indexOf(startMatch[0]) : -1;

    if (startIndex === -1) {
        startMatch = htmlContent.match(problemTitlePattern);
        startIndex = startMatch ? htmlContent.indexOf(startMatch[0]) : -1;
    }

    if (startIndex === -1) {
        // Try more flexible pattern: look for any paragraph starting with the problem reference
        const flexPattern = new RegExp(
            `<p[^>]*>\\s*<a[^>]*>\\s*${contestId}${upperIndex}`,
            'i'
        );
        startMatch = htmlContent.match(flexPattern);
        startIndex = startMatch ? htmlContent.indexOf(startMatch[0]) : -1;
    }

    if (startIndex === -1) return null;

    // Find the end - look for the next problem section
    // Problems are typically A, B, C, D, E, F, G, H in order
    const nextProblems = [];
    const currentCode = upperIndex.charCodeAt(0);

    // Add next letter problems
    for (let i = currentCode + 1; i <= 'H'.charCodeAt(0); i++) {
        nextProblems.push(String.fromCharCode(i));
    }
    // Also add previous letters in case the order is different
    for (let i = 'A'.charCodeAt(0); i < currentCode; i++) {
        nextProblems.push(String.fromCharCode(i));
    }

    let endIndex = htmlContent.length;

    for (const nextProblem of nextProblems) {
        // Look for next problem link
        const nextPattern = new RegExp(
            `<p[^>]*>\\s*<a[^>]*href=["'][^"']*\\/contest\\/${contestId}\\/problem\\/${nextProblem}["']`,
            'i'
        );
        const nextMatch = htmlContent.slice(startIndex + 100).match(nextPattern);

        if (nextMatch) {
            const potentialEnd = htmlContent.indexOf(nextMatch[0], startIndex + 100);
            if (potentialEnd > startIndex && potentialEnd < endIndex) {
                endIndex = potentialEnd;
            }
        }

        // Also try the title pattern
        const nextTitlePattern = new RegExp(
            `<p[^>]*>.*?(?:${contestId}${nextProblem}|Problem\\s*${nextProblem})\\s*[-–—:]`,
            'i'
        );
        const nextTitleMatch = htmlContent.slice(startIndex + 100).match(nextTitlePattern);

        if (nextTitleMatch) {
            const potentialEnd = htmlContent.indexOf(nextTitleMatch[0], startIndex + 100);
            if (potentialEnd > startIndex && potentialEnd < endIndex) {
                endIndex = potentialEnd;
            }
        }
    }

    // Extract the section
    let section = htmlContent.slice(startIndex, endIndex);

    // Clean up: make sure we don't cut in the middle of an HTML tag or spoiler
    // Find the last complete spoiler div
    const lastSpoilerEnd = section.lastIndexOf('</div></div>');
    if (lastSpoilerEnd > section.length * 0.5) {
        section = section.slice(0, lastSpoilerEnd + 12);
    }

    return section.trim();
}


// --- LEETCODE API ---

// LeetCode Daily Challenge (POTD)
router.get("/leetcode/daily", async (req, res) => {
    try {
        const cacheKey = "leetcode:daily";
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const memoryCached = getMemoryCache(cacheKey);
        if (memoryCached) {
            return res.json(memoryCached);
        }

        console.log("[LeetCode] Fetching daily challenge...");

        const query = `
            query questionOfToday {
                activeDailyCodingChallengeQuestion {
                    date
                    link
                    question {
                        questionId
                        questionFrontendId
                        title
                        titleSlug
                        difficulty
                        acRate
                        topicTags {
                            name
                        }
                        isPaidOnly
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
            body: JSON.stringify({ query }),
            signal: AbortSignal.timeout(240000)
        });

        const data = await response.json();
        const daily = data.data?.activeDailyCodingChallengeQuestion;

        if (!daily || !daily.question) {
            throw new Error("Invalid response from LeetCode daily challenge API");
        }

        const result = {
            date: daily.date,
            link: daily.link,
            id: daily.question.questionFrontendId,
            questionId: daily.question.questionId,
            title: daily.question.title,
            titleSlug: daily.question.titleSlug,
            difficulty: daily.question.difficulty,
            acceptanceRate: Math.round(daily.question.acRate * 10) / 10,
            tags: daily.question.topicTags.map(t => t.name),
            isPremium: daily.question.isPaidOnly
        };

        // Cache for 4 hours
        redis.setex(cacheKey, 14400, JSON.stringify(result)).catch(e => console.error("Redis cache error:", e));
        setMemoryCache(cacheKey, result, 14400 * 1000);

        res.json(result);

    } catch (err) {
        console.error("LeetCode Daily Error:", err);
        res.status(500).json({ error: "Failed to fetch LeetCode daily challenge" });
    }
});

// LeetCode Problem List with filters
router.get("/leetcode/list", async (req, res) => {
    try {
        const { difficulty, tag, search, skip = 0, limit = 100 } = req.query;

        // Check Redis cache first
        const cacheKey = `leetcode:list:${difficulty || 'all'}:${tag || 'all'}:${search || 'all'}:${skip}:${limit}`;
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) {
            console.log("[LeetCode] Cache HIT for list");
            return res.json(JSON.parse(cached));
        }

        // Fallback to in-memory cache when Redis is unavailable
        const memoryCached = getMemoryCache(cacheKey);
        if (memoryCached) {
            return res.json(memoryCached);
        }

        console.log(`[LeetCode] Fetching problem list (skip=${skip}, limit=${limit}, difficulty=${difficulty || 'all'}, tag=${tag || 'all'}, search=${search || 'none'})`);

        const query = `
            query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
                problemsetQuestionList: questionList(
                    categorySlug: $categorySlug
                    limit: $limit
                    skip: $skip
                    filters: $filters
                ) {
                    total: totalNum
                    questions: data {
                        questionId
                        questionFrontendId
                        title
                        titleSlug
                        difficulty
                        acRate
                        topicTags {
                            name
                            slug
                        }
                        status
                        paidOnly: isPaidOnly
                    }
                }
            }
        `;

        // Build filters
        const filters = {};
        if (difficulty) {
            filters.difficulty = difficulty.toUpperCase();
        }
        if (tag) {
            filters.tags = [tag];
        }
        if (search) {
            filters.searchKeywords = search;
        }

        const response = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com"
            },
            body: JSON.stringify({
                query,
                variables: {
                    categorySlug: "",
                    skip: parseInt(skip),
                    limit: parseInt(limit),
                    filters: Object.keys(filters).length > 0 ? filters : {}
                }
            }),
            signal: AbortSignal.timeout(240000) // 4 minute timeout
        });

        const data = await response.json();
        const result = data.data?.problemsetQuestionList;

        if (!result) {
            throw new Error("Invalid response from LeetCode");
        }

        // Format the response
        const formattedResult = {
            total: result.total,
            problems: result.questions.map(q => ({
                id: q.questionFrontendId,
                questionId: q.questionId,
                title: q.title,
                titleSlug: q.titleSlug,
                difficulty: q.difficulty,
                acceptanceRate: Math.round(q.acRate * 10) / 10,
                tags: q.topicTags.map(t => t.name),
                status: q.status,
                isPremium: q.paidOnly
            }))
        };

        // Cache for 1 hour
        redis.setex(cacheKey, 3600, JSON.stringify(formattedResult)).catch(e => console.error("Redis cache error:", e));
        setMemoryCache(cacheKey, formattedResult, 3600 * 1000);

        res.json(formattedResult);

    } catch (err) {
        console.error("LeetCode List Error:", err);
        res.status(500).json({ error: "Failed to fetch LeetCode problem list" });
    }
});

// LeetCode Topic Tags List
router.get("/leetcode/tags", async (req, res) => {
    try {
        // Check cache
        const cacheKey = "leetcode:tags";
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const memoryCached = getMemoryCache(cacheKey);
        if (memoryCached) {
            return res.json(memoryCached);
        }

        // Hardcoded tags since API introspection is disabled
        const tags = [
            { name: "Array", slug: "array" },
            { name: "String", slug: "string" },
            { name: "Hash Table", slug: "hash-table" },
            { name: "Dynamic Programming", slug: "dynamic-programming" },
            { name: "Math", slug: "math" },
            { name: "Sorting", slug: "sorting" },
            { name: "Greedy", slug: "greedy" },
            { name: "Depth-First Search", slug: "depth-first-search" },
            { name: "Binary Search", slug: "binary-search" },
            { name: "Database", slug: "database" },
            { name: "Breadth-First Search", slug: "breadth-first-search" },
            { name: "Tree", slug: "tree" },
            { name: "Matrix", slug: "matrix" },
            { name: "Two Pointers", slug: "two-pointers" },
            { name: "Bit Manipulation", slug: "bit-manipulation" },
            { name: "Stack", slug: "stack" },
            { name: "Design", slug: "design" },
            { name: "Heap (Priority Queue)", slug: "heap-priority-queue" },
            { name: "Graph", slug: "graph" },
            { name: "Simulation", slug: "simulation" },
            { name: "Prefix Sum", slug: "prefix-sum" },
            { name: "Counting", slug: "counting" },
            { name: "Backtracking", slug: "backtracking" },
            { name: "Sliding Window", slug: "sliding-window" },
            { name: "Union Find", slug: "union-find" },
            { name: "Linked List", slug: "linked-list" },
            { name: "Ordered Set", slug: "ordered-set" },
            { name: "Monotonic Stack", slug: "monotonic-stack" },
            { name: "Trie", slug: "trie" },
            { name: "Divide and Conquer", slug: "divide-and-conquer" },
            { name: "Recursion", slug: "recursion" },
            { name: "Bitmask", slug: "bitmask" },
            { name: "Queue", slug: "queue" },
            { name: "Binary Search Tree", slug: "binary-search-tree" },
            { name: "Segment Tree", slug: "segment-tree" },
            { name: "Memoization", slug: "memoization" },
            { name: "Geometry", slug: "geometry" },
            { name: "Topological Sort", slug: "topological-sort" },
            { name: "Binary Indexed Tree", slug: "binary-indexed-tree" },
            { name: "Hash Function", slug: "hash-function" },
            { name: "Game Theory", slug: "game-theory" },
            { name: "Combinatorics", slug: "combinatorics" },
            { name: "Shortest Path", slug: "shortest-path" }
        ];

        // Cache for 24 hours
        redis.setex(cacheKey, 86400, JSON.stringify(tags)).catch(() => { });
        setMemoryCache(cacheKey, tags, 86400 * 1000);

        res.json(tags);

    } catch (err) {
        console.error("LeetCode Tags Error:", err);
        res.status(500).json({ error: "Failed to fetch LeetCode tags" });
    }
});

// LeetCode Individual Problem (existing)
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

// --- GEEKSFORGEEKS API ---
router.get("/gfg/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        console.log(`[GFG] Fetching problem: ${slug}`);

        // Direct HTML scraping for GFG (their API is unreliable)
        const pageUrl = `https://www.geeksforgeeks.org/problems/${slug}/1`;
        const pageRes = await fetch(pageUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.geeksforgeeks.org/"
            },
            signal: AbortSignal.timeout(240000) // 4 minute timeout
        });

        if (!pageRes.ok) {
            throw new Error(`GFG returned ${pageRes.status}`);
        }

        const html = await pageRes.text();

        // Extract title
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        let title = titleMatch ? titleMatch[1].replace(" | Practice | GeeksforGeeks", "").replace(" - GeeksforGeeks", "").trim() : slug;

        // Try to get title from h3 header
        const h3Match = html.match(/<h3[^>]*>([^<]+)<\/h3>/);
        if (h3Match) title = h3Match[1].trim();

        // Extract problem description - GFG uses various class names
        let description = "";

        // Try multiple patterns for description extraction
        const descPatterns = [
            /<div[^>]*class="[^"]*problems_problem_content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*problems/i,
            /<div[^>]*class="[^"]*problem-statement[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*id="problemStatement"[^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*class="[^"]*problemInfo[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        ];

        for (const pattern of descPatterns) {
            const match = html.match(pattern);
            if (match && match[1] && match[1].length > 50) {
                description = match[1];
                break;
            }
        }

        // If still no description, try to extract from script tags (Next.js data)
        if (!description) {
            const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (scriptMatch) {
                try {
                    const nextData = JSON.parse(scriptMatch[1]);
                    const problemData = nextData?.props?.pageProps?.problem || nextData?.props?.pageProps?.data;
                    if (problemData) {
                        title = problemData.problem_name || problemData.title || title;
                        description = problemData.problem_statement || problemData.content || "";
                    }
                } catch (e) {
                    console.log("[GFG] Failed to parse Next.js data");
                }
            }
        }

        // Extract difficulty
        let difficulty = "Medium";
        const diffPatterns = [
            /difficulty['":\s]+(Easy|Medium|Hard|Basic|School)/i,
            /class="[^"]*difficulty[^"]*"[^>]*>(Easy|Medium|Hard|Basic|School)/i,
            /"difficulty"\s*:\s*"(Easy|Medium|Hard|Basic|School)"/i
        ];
        for (const pattern of diffPatterns) {
            const match = html.match(pattern);
            if (match) {
                difficulty = match[1];
                break;
            }
        }

        // Extract examples/test cases
        const examplesMatch = html.match(/<div[^>]*class="[^"]*example[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
        let examples = [];
        if (examplesMatch) {
            examples = examplesMatch.map(ex => ex.replace(/<[^>]*>/g, '').trim()).filter(e => e.length > 0);
        }

        // If description is still empty, create a fallback
        if (!description || description.length < 20) {
            description = `<div style="text-align: center; padding: 20px;">
                <p style="color: #a1a1aa;">Problem description could not be loaded.</p>
                <p style="color: #71717a; font-size: 14px;">GeeksforGeeks uses dynamic loading which makes scraping difficult.</p>
                <p style="margin-top: 16px;">
                    <a href="${pageUrl}" target="_blank" style="color: #22c55e; text-decoration: underline;">
                        Click here to view the problem on GeeksforGeeks →
                    </a>
                </p>
            </div>`;
        }

        res.json({
            provider: "geeksforgeeks",
            id: slug,
            title: title,
            slug: slug,
            description: description,
            difficulty: difficulty,
            tags: [],
            url: pageUrl,
            examples: examples.length > 0 ? examples : null
        });

    } catch (err) {
        console.error("GFG Error:", err);
        res.status(500).json({ error: "Failed to fetch GFG problem", message: err.message });
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



// --- CODEFORCES LIST ---
router.get("/codeforces/list", async (req, res) => {
    try {
        let response;
        try {
            // Increased timeouts significantly as the problem set JSON is very large (~5-10MB)
            response = await fetch("https://codeforces.com/api/problemset.problems", { signal: AbortSignal.timeout(240000) });
        } catch (e) {
            console.warn("[Backend] Main API failed, trying mirror...", e.message);
            // Mirror might be slower, give it more time
            response = await fetch("https://mirror.codeforces.com/api/problemset.problems", { signal: AbortSignal.timeout(240000) });
        }

        if (!response || !response.ok) {
            throw new Error(`API returned ${response?.status || 'network error'} ${response?.statusText || ''}`);
        }

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (data.status === "OK") {
                res.json(data.result);
            } else {
                res.status(500).json({ error: "Codeforces API Error: " + data.comment });
            }
        } catch (jsonErr) {
            throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
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

// --- CODEFORCES BLOG PROXY (NEW) ---
router.get("/codeforces/blog/:blogId", async (req, res) => {
    try {
        const { blogId } = req.params;
        // Fetch from Codeforces API server-side
        const response = await fetch(`https://codeforces.com/api/blogEntry.view?blogEntryId=${blogId}`, { signal: AbortSignal.timeout(240000) });
        const data = await response.json();

        if (data.status === "OK") {
            res.json(data);
        } else {
            res.status(400).json({ error: data.comment || "Codeforces API Error" });
        }
    } catch (e) {
        console.error("Blog Fetch Error", e);
        res.status(500).json({ error: "Failed to fetch blog via proxy" });
    }
});

// --- CODEFORCES EDITORIAL/TUTORIAL ENDPOINT ---
router.get("/codeforces/editorial/:contestId", async (req, res) => {
    try {
        const { contestId } = req.params;
        const problemIndex = req.query.problem || null;

        console.log(`[Editorial] Fetching editorial for contest ${contestId}${problemIndex ? ', problem ' + problemIndex : ''}`);

        // Step 1: Find the editorial blog ID
        let editorialBlogId = null;
        let editorialTitle = null;
        let editorialAuthor = null;
        let roundNumber = null;

        // First, get the round number from contest.list API (with smaller timeout)
        try {
            const contestInfoResponse = await fetch(`https://codeforces.com/api/contest.list?gym=false`, {
                signal: AbortSignal.timeout(240000)
            });
            const contestInfoData = await contestInfoResponse.json();

            if (contestInfoData.status === "OK") {
                const contest = contestInfoData.result.find(c => c.id === parseInt(contestId));
                if (contest) {
                    console.log(`[Editorial] Found contest: ${contest.name}`);
                    const roundMatch = contest.name.match(/Round\s*#?(\d+)/i);
                    if (roundMatch) {
                        roundNumber = roundMatch[1];
                        console.log(`[Editorial] Contest ${contestId} is Round ${roundNumber}`);
                    }
                }
            }
        } catch (e) {
            console.log(`[Editorial] Contest lookup failed: ${e.message}`);
        }

        // Step 1b: Try recentActions API first (fast, but only recent editorials)
        try {
            const recentResponse = await fetch(`https://codeforces.com/api/recentActions?maxCount=100`, {
                signal: AbortSignal.timeout(240000)
            });
            const recentData = await recentResponse.json();

            if (recentData.status === "OK" && recentData.result) {
                const searchPatterns = [contestId];
                if (roundNumber) searchPatterns.push(roundNumber);

                for (const action of recentData.result) {
                    if (action.blogEntry && action.blogEntry.title) {
                        const title = action.blogEntry.title.toLowerCase().replace(/<[^>]*>/g, '');
                        const isEditorial = title.includes('editorial') || title.includes('tutorial');

                        let matches = false;
                        for (const pattern of searchPatterns) {
                            if (title.includes(`round ${pattern}`) ||
                                title.includes(`#${pattern}`) ||
                                title.includes(` ${pattern} `) ||
                                title.match(new RegExp(`round\\s*#?${pattern}\\b`, 'i')) ||
                                title.match(new RegExp(`\\b${pattern}[a-g]\\b`, 'i'))) {
                                matches = true;
                                break;
                            }
                        }

                        if (isEditorial && matches) {
                            editorialBlogId = action.blogEntry.id;
                            editorialTitle = action.blogEntry.title.replace(/<[^>]*>/g, '');
                            editorialAuthor = action.blogEntry.authorHandle;
                            console.log(`[Editorial] Found via recentActions: ${editorialBlogId} - "${editorialTitle}"`);
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`[Editorial] recentActions search failed: ${e.message}`);
        }

        // Step 1c: If not in recent actions, use Puppeteer to search (for older editorials)
        if (!editorialBlogId) {
            let browser = null;
            try {
                const searchQuery = roundNumber ? `Round ${roundNumber} Editorial` : `${contestId} Editorial`;
                const searchUrl = `https://codeforces.com/search?query=${encodeURIComponent(searchQuery)}`;

                console.log(`[Editorial] Searching Codeforces: ${searchUrl}`);

                browser = await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                });

                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 240000 });

                // Wait for search results (shorter timeout)
                await page.waitForSelector('.datatable, .searchResultsList', { timeout: 240000 }).catch(() => { });

                // Extract blog links from search results
                const blogLinks = await page.evaluate((roundNum, contestNum) => {
                    const results = [];
                    const rows = document.querySelectorAll('.datatable tr, .searchResult');

                    for (const row of rows) {
                        const link = row.querySelector('a[href*="/blog/entry/"]');
                        if (link) {
                            const title = link.textContent.toLowerCase();
                            const href = link.getAttribute('href');

                            const isEditorial = title.includes('editorial') || title.includes('tutorial');

                            let matchesRound = false;
                            if (roundNum) {
                                matchesRound = title.includes(`round ${roundNum}`) ||
                                    title.includes(`round #${roundNum}`) ||
                                    title.includes(` ${roundNum} `);
                            }
                            const matchesContest = title.includes(contestNum);

                            if (isEditorial && (matchesRound || matchesContest)) {
                                const blogIdMatch = href.match(/\/blog\/entry\/(\d+)/);
                                if (blogIdMatch) {
                                    results.push({
                                        blogId: parseInt(blogIdMatch[1]),
                                        title: link.textContent.trim(),
                                        matchesRound: matchesRound
                                    });
                                }
                            }
                        }
                    }
                    return results;
                }, roundNumber, contestId);

                // Prefer matches by round number over contestId
                if (blogLinks.length > 0) {
                    const bestMatch = blogLinks.find(b => b.matchesRound) || blogLinks[0];
                    editorialBlogId = bestMatch.blogId;
                    editorialTitle = bestMatch.title;
                    console.log(`[Editorial] Found via search: ${editorialBlogId} - "${editorialTitle}"`);
                }

            } catch (e) {
                console.log(`[Editorial] Search failed: ${e.message}`);
            } finally {
                if (browser) {
                    await browser.close().catch(() => { });
                }
            }
        }

        // Step 2: Fetch the actual blog content using Puppeteer (scraping)
        let editorialContent = null;

        if (editorialBlogId) {
            let browser = null;
            try {
                const blogUrl = `https://codeforces.com/blog/entry/${editorialBlogId}`;

                console.log(`[Editorial] Launching Puppeteer to fetch: ${blogUrl}`);

                browser = await puppeteer.launch({
                    headless: 'new',
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                });

                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 240000 });

                // Wait for content to load
                await page.waitForSelector('.ttypography', { timeout: 240000 }).catch(() => { });

                // Extract the blog content
                const content = await page.evaluate(() => {
                    const contentDiv = document.querySelector('.ttypography');
                    return contentDiv ? contentDiv.innerHTML : null;
                });

                if (content) {
                    editorialContent = {
                        blogId: editorialBlogId,
                        title: editorialTitle,
                        content: content,
                        authorHandle: editorialAuthor,
                        url: blogUrl
                    };
                    console.log(`[Editorial] Successfully scraped content (${content.length} chars)`);
                }
            } catch (e) {
                console.log(`[Editorial] Puppeteer scraping failed: ${e.message}`);
            } finally {
                if (browser) {
                    await browser.close().catch(() => { });
                }
            }
        }

        if (editorialContent) {
            // Extract problem-specific section if problemIndex is provided
            let problemSection = null;
            if (problemIndex && editorialContent.content) {
                problemSection = extractProblemSection(editorialContent.content, contestId, problemIndex);
                console.log(`[Editorial] Problem section for ${problemIndex}: ${problemSection ? problemSection.length + ' chars' : 'not found'}`);
            }

            res.json({
                success: true,
                contestId,
                editorial: {
                    ...editorialContent,
                    problemSection: problemSection
                }
            });
        } else {
            res.status(404).json({
                error: "Editorial not found",
                contestId,
                message: "No official tutorial found for this contest. It may not be published yet or Cloudflare is blocking.",
                searchUrl: `https://codeforces.com/search?query=${contestId}+tutorial`
            });
        }

    } catch (e) {
        console.error("Editorial Fetch Error:", e);
        res.status(500).json({ error: "Failed to fetch editorial", message: e.message });
    }
});

// --- CODEFORCES API ---
router.get("/codeforces/:contestId/:index", async (req, res) => {
    const { contestId, index } = req.params;
    const problemId = `${contestId}${index}`;

    try {
        // Use unified scraper service (handles caching internally)
        const problemData = await scraperService.fetchCodeforces(contestId, index);

        if (problemData && problemData.description && !problemData.description.includes("No description available")) {
            console.log(`[Backend] Successfully fetched ${problemId}`);
            return res.json(problemData);
        }

        throw new Error("Invalid or empty problem data");
    } catch (scrapeErr) {
        console.warn(`[Backend] Scrape failed for ${problemId}: ${scrapeErr.message}`);

        // If we have partial data from API, return it with 206 Partial Content
        if (scrapeErr.partialData) {
            console.log(`[Backend] Returning partial data for ${problemId}`);
            return res.status(206).json({
                ...scrapeErr.partialData,
                partialData: true,
                requiresExtension: true
            });
        }

        // Return 404 to trigger extension fallback on frontend
        return res.status(404).json({
            error: "Not found in cache",
            message: scrapeErr.message,
            requiresExtension: scrapeErr.requiresExtension || true
        });
    }
});

// --- CSES API ---

// 1. Get Problem Object from Task ID (Scraper)
router.get("/cses/problem/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Use unified scraper service
        const problemData = await scraperService.fetchCSES(id);

        if (problemData) {
            return res.json(problemData);
        }

        throw new Error("Failed to fetch CSES problem");
    } catch (err) {
        console.error("CSES Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch CSES problem", message: err.message });
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

// --- ATCODER API ---
router.get("/atcoder/:contestId/:taskId", async (req, res) => {
    try {
        const { contestId, taskId } = req.params;

        const problemData = await scraperService.fetchAtCoder(contestId, taskId);

        if (problemData) {
            return res.json(problemData);
        }

        throw new Error("Failed to fetch AtCoder problem");
    } catch (err) {
        console.error("AtCoder Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch AtCoder problem", message: err.message });
    }
});

// --- SCRAPER HEALTH CHECK ---
router.get("/health", async (req, res) => {
    try {
        const health = await scraperService.healthCheck();
        const allHealthy = Object.values(health).every(v => v);

        res.status(allHealthy ? 200 : 503).json({
            status: allHealthy ? "healthy" : "degraded",
            services: health,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: "error",
            message: err.message
        });
    }
});

// --- CACHE INVALIDATION ---
router.delete("/cache/:problemId", async (req, res) => {
    try {
        const { problemId } = req.params;
        await scraperService.cache.invalidate(problemId);
        res.json({ success: true, message: `Cache cleared for ${problemId}` });
    } catch (err) {
        res.status(500).json({ error: "Failed to invalidate cache", message: err.message });
    }
});

// --- FORCE REFRESH (bypass cache) ---
router.get("/refresh/codeforces/:contestId/:index", async (req, res) => {
    try {
        const { contestId, index } = req.params;
        const problemId = `${contestId}${index}`;

        // Invalidate existing cache
        await scraperService.cache.invalidate(problemId);

        // Fetch fresh
        const problemData = await scraperService.fetchCodeforces(contestId, index);

        res.json({
            success: true,
            message: "Refreshed from source",
            data: problemData
        });
    } catch (err) {
        res.status(500).json({ error: "Refresh failed", message: err.message });
    }
});


export default router;
