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

export default router;
