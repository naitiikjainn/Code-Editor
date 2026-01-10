import express from "express";
const router = express.Router();

// Helper to clean Codeforces HTML inputs
const cleanCFText = (html) => {
    return html
        .replace(/<br>/g, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim();
};

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

// --- CODEFORCES API ---
router.get("/codeforces/:contestId/:index", async (req, res) => {
    const { contestId, index } = req.params;

    const urls = [
        `https://codeforces.com/contest/${contestId}/problem/${index}`,
        `https://codeforces.com/problemset/problem/${contestId}/${index}`,
        `https://mirror.codeforces.com/contest/${contestId}/problem/${index}`,
        `https://m1.codeforces.com/contest/${contestId}/problem/${index}`
    ];

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    };

    let lastError = null;

    for (const url of urls) {
        try {
            console.log(`[CF] Trying ${url}...`);
            if (urls.indexOf(url) > 0) await new Promise(r => setTimeout(r, 500));

            const response = await fetch(url, { headers });

            if (!response.ok) {
                if (response.status === 404) throw new Error("Problem not found (404)");
                throw new Error(`Status ${response.status}`);
            }

            const text = await response.text();

            if (text.includes("Redirecting") || text.includes("Just a moment") || text.includes("security check")) {
                throw new Error("Anti-Bot Protection");
            }

            // --- URL FIX ---
            // Codeforces uses relative URLs for images (e.g. src="/predownloaded/...")
            // We need to replace them with absolute URLs to make them visible
            // Also MathJax might be broken, but we can't fix that easily without client-side scripts.
            const baseUrl = new URL(url).origin;
            const fixedText = text.replace(/src="\//g, `src="${baseUrl}/`);

            // --- TITLE ---
            let title = `${contestId}${index}`;
            const titleDivMatch = fixedText.match(/<div class="title">([^<]*)<\/div>/);
            const titleTagMatch = fixedText.match(/<title>(.*?)<\/title>/);

            if (titleDivMatch) {
                title = titleDivMatch[1].trim();
            } else if (titleTagMatch) {
                title = titleTagMatch[1].replace(" - Codeforces", "").trim();
            }

            // --- DESCRIPTION SCRAPING ---
            // Look for <div class="problem-statement"> ... <div class="sample-tests">
            // This captures Header + Legend + Input Spec + Output Spec
            let description = "<p>No description available.</p>";

            const startMarker = '<div class="problem-statement">';
            const endMarker = '<div class="sample-tests">';

            const startIndex = fixedText.indexOf(startMarker);
            if (startIndex !== -1) {
                const endIndex = fixedText.indexOf(endMarker, startIndex);
                if (endIndex !== -1) {
                    description = fixedText.substring(startIndex, endIndex) + "</div>"; // Close the div implicitly or close specific tags? 
                    // Actually, cutting off at sample-tests leaves open divs.
                    // But browser HTML parsers (innerHTML) are usually forgiving. 
                    // Let's try to include the end div of problem-statement? No, that's at the very end.
                    // We'll just wrap it in a div just in case.
                    description = `<div>${description}</div>`;
                } else {
                    // Maybe no sample tests? Just take a chunk or look for another marker like "output-specification" + some buffer?
                    // Fallback: Take everything from problem-statement start for 5000 chars?
                    // Better: look for Note?
                    const noteIndex = fixedText.indexOf('<div class="note">', startIndex);
                    if (noteIndex !== -1) {
                        description = fixedText.substring(startIndex, noteIndex) + "</div>";
                    } else {
                        // Just take reasonable amount
                        description = fixedText.substring(startIndex, startIndex + 6000) + "...</div>";
                    }
                }
            }

            // --- INPUTS/OUTPUTS ---
            const inputs = [];
            const outputs = [];

            const inputRegex = /<div class="input">[\s\S]*?<pre>([\s\S]*?)<\/pre>/g;
            const outputRegex = /<div class="output">[\s\S]*?<pre>([\s\S]*?)<\/pre>/g;

            let match;
            while ((match = inputRegex.exec(fixedText)) !== null) {
                inputs.push(cleanCFText(match[1]));
            }
            while ((match = outputRegex.exec(fixedText)) !== null) {
                outputs.push(cleanCFText(match[1]));
            }

            const testCases = inputs.map((inp, i) => ({
                input: inp,
                expectedOutput: outputs[i] || ""
            }));

            return res.json({
                provider: "codeforces",
                id: `${contestId}${index}`,
                title: title,
                url: url,
                description: description, // <--- ADDED
                testCases: testCases
            });

        } catch (err) {
            console.warn(`[CF] Failed ${url}: ${err.message}`);
            lastError = err;
        }
    }

    res.status(500).json({ error: `Failed to fetch Codeforces problem. Last error: ${lastError?.message}` });
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

// --- CSES API ---

// 1. Get Problem Object from Task ID (Scraper)
router.get("/cses/problem/:id", async (req, res) => {
    try {
        const { id } = req.params;
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


        res.json({
            provider: "cses",
            id: id,
            title: title,
            url: url,
            description: description,
            testCases: testCases
        });

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
