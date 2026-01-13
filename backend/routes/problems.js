import express from "express";
import Problem from "../models/Problem.js"; // Import Problem Model
import redis from "../config/redis.js"; // Import Redis Wrapper
import scraperService from "../utils/scraperService.js";
import puppeteer from "puppeteer";

const router = express.Router();

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



// --- CODEFORCES LIST ---
router.get("/codeforces/list", async (req, res) => {
    try {
        let response;
        try {
            // Increased timeouts significantly as the problem set JSON is very large (~5-10MB)
            response = await fetch("https://codeforces.com/api/problemset.problems", { signal: AbortSignal.timeout(15000) });
        } catch (e) {
            console.warn("[Backend] Main API failed, trying mirror...", e.message);
            // Mirror might be slower, give it more time
            response = await fetch("https://mirror.codeforces.com/api/problemset.problems", { signal: AbortSignal.timeout(30000) });
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
        const response = await fetch(`https://codeforces.com/api/blogEntry.view?blogEntryId=${blogId}`, { signal: AbortSignal.timeout(10000) });
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
                signal: AbortSignal.timeout(10000)
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
                signal: AbortSignal.timeout(10000)
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
                
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                
                // Wait for search results (shorter timeout)
                await page.waitForSelector('.datatable, .searchResultsList', { timeout: 5000 }).catch(() => {});
                
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
                    await browser.close().catch(() => {});
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
                
                await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
                
                // Wait for content to load
                await page.waitForSelector('.ttypography', { timeout: 8000 }).catch(() => {});
                
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
                    await browser.close().catch(() => {});
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
