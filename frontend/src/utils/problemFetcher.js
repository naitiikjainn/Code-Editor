/**
 * Problem Fetcher Service
 * 
 * Client-side service for fetching competitive programming problems
 * with intelligent fallback strategies
 * 
 * Strategy:
 * 1. Try Backend API (uses Redis/MongoDB cache + server scraper)
 * 2. Fallback to Chrome Extension (bypasses Cloudflare)
 * 3. Cache successful extension results back to server
 */

import { API_URL } from "../config";
import { parseCodeforcesProblem, parseEditorial } from "./codeforces";

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 2,
    retryDelay: 1000,
    extensionTimeout: 20000  // Increased from 10s to 20s
};

// Check if extension is available
let extensionReady = false;

window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type === "CODEPLAY_EXTENSION_READY") {
        extensionReady = true;
        console.log("[ProblemFetcher] Extension detected");
    }
});

// Ping extension on load
setTimeout(() => {
    window.postMessage({ type: "CODEPLAY_PING_EXTENSION" }, "*");
}, 500);

// Helper: Wait for extension
const waitForExtension = (timeout = 5000) => {  // Increased from 2s to 5s
    return new Promise((resolve) => {
        if (extensionReady) {
            resolve(true);
            return;
        }

        // Also listen for any extension response as proof of life
        const handler = (event) => {
            if (event.source !== window) return;
            if (event.data.type?.startsWith("CODEPLAY_")) {
                extensionReady = true;
                window.removeEventListener("message", handler);
                resolve(true);
            }
        };
        window.addEventListener("message", handler);

        const start = Date.now();
        const check = () => {
            if (extensionReady) {
                window.removeEventListener("message", handler);
                resolve(true);
            } else if (Date.now() - start > timeout) {
                window.removeEventListener("message", handler);
                resolve(false);
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
};

// Helper: Fetch via extension
const fetchViaExtension = (url) => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            window.removeEventListener("message", handler);
            reject(new Error("Extension timeout - ensure CodePlay Helper is installed"));
        }, RETRY_CONFIG.extensionTimeout);

        const handler = (event) => {
            if (event.source !== window) return;
            if (event.data.type === "CODEPLAY_CF_HTML_RESULT") {
                clearTimeout(timeout);
                window.removeEventListener("message", handler);

                if (event.data.payload.success) {
                    resolve(event.data.payload.html);
                } else {
                    reject(new Error(event.data.payload.error || "Extension fetch failed"));
                }
            }
        };

        window.addEventListener("message", handler);
        window.postMessage({
            type: "CODEPLAY_FETCH_CF_HTML",
            payload: { url }
        }, "*");
    });
};

// Helper: Cache to backend
const cacheToBackend = async (problemId, data) => {
    try {
        // Validate data before caching
        if (!data.description ||
            data.description.includes("No description available") ||
            data.description.length < 100) {
            console.warn("[ProblemFetcher] Skipping cache - invalid data");
            return;
        }

        await fetch(`${API_URL}/api/problems/cache`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problemId, data })
        });

        console.log(`[ProblemFetcher] Cached ${problemId} to backend`);
    } catch (e) {
        console.error("[ProblemFetcher] Cache save failed:", e);
    }
};

/**
 * Fetch Codeforces Problem
 */
export const fetchCodeforcesProblem = async (contestId, index, options = {}) => {
    const problemId = `${contestId}${index}`;
    const url = `https://codeforces.com/contest/${contestId}/problem/${index}`;

    console.log(`[ProblemFetcher] Fetching ${problemId}...`);

    let partialData = null;

    // Strategy 1: Try Backend API
    try {
        const response = await fetch(`${API_URL}/api/problems/codeforces/${contestId}/${index}`);

        // Check for 206 Partial Content (has metadata but no description)
        if (response.status === 206) {
            const data = await response.json();
            console.log(`[ProblemFetcher] Backend returned partial data for ${problemId}`);
            partialData = data; // Save for fallback
        } else if (response.ok) {
            const data = await response.json();

            // Validate response
            if (data && data.description && !data.description.includes("No description available")) {
                console.log(`[ProblemFetcher] Backend HIT for ${problemId}`);
                return {
                    success: true,
                    source: "backend",
                    data
                };
            }
        }

        // Backend returned 404, 206, or invalid data - continue to extension
        console.log(`[ProblemFetcher] Backend needs extension for ${problemId}`);
    } catch (e) {
        console.warn(`[ProblemFetcher] Backend error: ${e.message}`);
    }

    // Strategy 2: Try Extension Fallback
    if (!options.skipExtension) {
        const hasExtension = await waitForExtension();

        if (hasExtension) {
            try {
                console.log(`[ProblemFetcher] Using extension for ${problemId}`);

                const html = await fetchViaExtension(url);
                const parsed = parseCodeforcesProblem(html, contestId, index);

                // Merge with partial data if available (has rating, tags from API)
                const data = {
                    provider: "codeforces",
                    id: problemId,
                    contestId,
                    index,
                    url,
                    ...(partialData || {}), // Include API metadata
                    ...parsed,              // Override with scraped content
                    scrapedAt: new Date().toISOString(),
                    scrapedVia: "extension"
                };

                // Validate
                if (data.description && !data.description.includes("No description available")) {
                    // Cache successful result
                    cacheToBackend(problemId, data);

                    return {
                        success: true,
                        source: "extension",
                        data
                    };
                }

                throw new Error("Extension returned invalid data");

            } catch (e) {
                console.error(`[ProblemFetcher] Extension error: ${e.message}`);
            }
        } else {
            console.warn("[ProblemFetcher] Extension not available");
        }
    }

    // All strategies failed - show "Open on Codeforces" link (iframe doesn't work due to X-Frame-Options)
    const fallbackData = partialData || {
        provider: "codeforces",
        id: problemId,
        contestId,
        index,
        title: `${contestId}${index}`,
        url,
        testCases: []
    };

    // Check if extension was available
    const extensionMissing = !extensionReady;

    return {
        success: false,
        source: partialData ? "api-metadata" : null,
        error: "Failed to fetch problem description",
        data: {
            ...fallbackData,
            description: `<div style="width: 100%; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(180deg, #0d1117 0%, #161b22 100%); border-radius: 12px; padding: 40px; box-sizing: border-box; text-align: center;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2)); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; border: 1px solid rgba(59, 130, 246, 0.3);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="13" width="5" height="9" rx="1" fill="#FFC107"/>
                        <rect x="9.5" y="6" width="5" height="16" rx="1" fill="#2196F3"/>
                        <rect x="17" y="10" width="5" height="12" rx="1" fill="#F44336"/>
                    </svg>
                </div>
                
                <h3 style="color: #e4e4e7; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">Problem ${contestId}${index}</h3>
                <p style="color: #71717a; font-size: 14px; margin: 0 0 24px 0; max-width: 400px; line-height: 1.5;">
                    ${extensionMissing
                    ? "The CodePlay extension is not detected. Install it to fetch problems directly, or view this problem on Codeforces."
                    : "This problem couldn't be loaded. The extension may need to be refreshed, or you can view it directly on Codeforces."}
                </p>
                
                <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
                    <a href="${url}" target="_blank" 
                       style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: transform 0.2s, box-shadow 0.2s;"
                       onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(59, 130, 246, 0.4)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.3)'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15,3 21,3 21,9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        Open on Codeforces
                    </a>
                    ${extensionMissing ? `
                    <a href="https://chromewebstore.google.com/detail/codeplay-helper/ldkpphfppokocibnlbdbkiohgocfgelb" target="_blank"
                       style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: rgba(139, 92, 246, 0.15); color: #a78bfa; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.3); transition: background 0.2s;"
                       onmouseover="this.style.background='rgba(139, 92, 246, 0.25)'" 
                       onmouseout="this.style.background='rgba(139, 92, 246, 0.15)'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                        Get Extension
                    </a>
                    ` : ''}
                </div>
                
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); color: #52525b; font-size: 12px;">
                    💡 <strong>Tip:</strong> Reload the extension or refresh the page if problems persist
                </div>
            </div>`
        }
    };
};

/**
 * Fetch CSES Problem
 */
export const fetchCSESProblem = async (taskId) => {
    console.log(`[ProblemFetcher] Fetching CSES ${taskId}...`);

    try {
        const response = await fetch(`${API_URL}/api/problems/cses/problem/${taskId}`);

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                source: "backend",
                data
            };
        }

        throw new Error(`HTTP ${response.status}`);
    } catch (e) {
        console.error(`[ProblemFetcher] CSES error: ${e.message}`);

        return {
            success: false,
            error: e.message,
            data: {
                provider: "cses",
                id: taskId,
                title: `CSES Task ${taskId}`,
                url: `https://cses.fi/problemset/task/${taskId}`,
                description: `<div style="padding: 24px; text-align: center; color: #a1a1aa;">
                    Failed to load CSES problem.<br/>
                    <a href="https://cses.fi/problemset/task/${taskId}" target="_blank" 
                       style="color: #60a5fa;">Open on CSES</a>
                </div>`,
                testCases: []
            }
        };
    }
};

/**
 * Fetch AtCoder Problem
 */
export const fetchAtCoderProblem = async (contestId, taskId) => {
    console.log(`[ProblemFetcher] Fetching AtCoder ${contestId}/${taskId}...`);

    try {
        const response = await fetch(`${API_URL}/api/problems/atcoder/${contestId}/${taskId}`);

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                source: "backend",
                data
            };
        }

        throw new Error(`HTTP ${response.status}`);
    } catch (e) {
        console.error(`[ProblemFetcher] AtCoder error: ${e.message}`);

        return {
            success: false,
            error: e.message,
            data: {
                provider: "atcoder",
                id: `${contestId}_${taskId}`,
                title: `AtCoder ${contestId} ${taskId}`,
                url: `https://atcoder.jp/contests/${contestId}/tasks/${taskId}`,
                description: `<div style="padding: 24px; text-align: center; color: #a1a1aa;">
                    Failed to load AtCoder problem.<br/>
                    <a href="https://atcoder.jp/contests/${contestId}/tasks/${taskId}" target="_blank" 
                       style="color: #60a5fa;">Open on AtCoder</a>
                </div>`,
                testCases: []
            }
        };
    }
};

/**
 * Fetch Codeforces Editorial
 */
export const fetchCodeforcesEditorial = async (tutorialUrl, problemData) => {
    if (!tutorialUrl) {
        return {
            success: false,
            error: "No tutorial URL"
        };
    }

    console.log(`[ProblemFetcher] Fetching editorial: ${tutorialUrl}`);

    // Try to get blog ID from URL
    const blogMatch = tutorialUrl.match(/\/blog\/entry\/(\d+)/);

    if (blogMatch) {
        try {
            const blogId = blogMatch[1];
            const response = await fetch(`${API_URL}/api/problems/codeforces/blog/${blogId}`);

            if (response.ok) {
                const blogData = await response.json();

                if (blogData.result?.content) {
                    const parsed = parseEditorial(blogData.result.content, problemData);
                    return {
                        success: true,
                        source: "api",
                        html: parsed
                    };
                }
            }
        } catch (e) {
            console.warn(`[ProblemFetcher] Blog API failed: ${e.message}`);
        }
    }

    // Fallback: Try extension
    const hasExtension = await waitForExtension();

    if (hasExtension) {
        try {
            const html = await fetchViaExtension(tutorialUrl);
            const parsed = parseEditorial(html, problemData);

            return {
                success: true,
                source: "extension",
                html: parsed
            };
        } catch (e) {
            console.error(`[ProblemFetcher] Editorial extension error: ${e.message}`);
        }
    }

    return {
        success: false,
        error: "Failed to fetch editorial"
    };
};

/**
 * Fetch LeetCode Problem
 * 
 * @param {string} titleSlug - LeetCode problem slug (e.g., "two-sum")
 * @returns {Promise<Object>} Problem result
 */
export const fetchLeetCodeProblem = async (titleSlug) => {
    console.log(`[ProblemFetcher] Fetching LeetCode: ${titleSlug}`);

    try {
        const response = await fetch(`${API_URL}/api/problems/leetcode/${titleSlug}`);

        if (!response.ok) {
            throw new Error(`LeetCode API returned ${response.status}`);
        }

        const data = await response.json();

        if (!data || !data.title) {
            throw new Error("Invalid response from LeetCode API");
        }

        // Extract test cases from description examples (Input/Output)
        const testCases = [];

        const extractFromDescription = (html) => {
            if (!html) return [];
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const pres = Array.from(doc.querySelectorAll("pre"));
                const cases = [];

                pres.forEach((pre) => {
                    const text = pre.textContent || "";
                    const inputMatch = text.match(/Input:\s*([\s\S]*?)(?:\n|\r|$)/i);
                    const outputMatch = text.match(/Output:\s*([\s\S]*?)(?:\n|\r|$)/i);
                    if (inputMatch || outputMatch) {
                        cases.push({
                            input: (inputMatch?.[1] || "").trim(),
                            expectedOutput: (outputMatch?.[1] || "").trim()
                        });
                    }
                });

                return cases.filter(c => c.input || c.expectedOutput);
            } catch (e) {
                return [];
            }
        };

        const parsedExamples = extractFromDescription(data.description);
        if (parsedExamples.length > 0) {
            testCases.push(...parsedExamples);
        } else if (data.examples) {
            const lines = data.examples.split('\n').filter(l => l.trim());
            for (let i = 0; i < lines.length; i++) {
                testCases.push({
                    input: lines[i],
                    expectedOutput: ""
                });
            }
        }

        return {
            success: true,
            source: "backend",
            data: {
                provider: "leetcode",
                id: data.id,
                questionId: data.questionId,
                title: data.title,
                titleSlug: data.titleSlug,
                description: data.description || "",
                difficulty: data.difficulty,
                examples: data.examples,
                snippets: data.snippets,
                testCases: testCases,
                url: `https://leetcode.com/problems/${titleSlug}/`
            }
        };

    } catch (e) {
        console.error(`[ProblemFetcher] LeetCode fetch failed: ${e.message}`);
        return {
            success: false,
            error: e.message,
            data: {
                provider: "leetcode",
                titleSlug: titleSlug,
                title: titleSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                url: `https://leetcode.com/problems/${titleSlug}/`,
                description: "",
                testCases: []
            }
        };
    }
};

/**
 * Check scraper health
 */
export const checkScraperHealth = async () => {
    try {
        const response = await fetch(`${API_URL}/api/problems/health`);
        return response.json();
    } catch (e) {
        return {
            status: "error",
            message: e.message
        };
    }
};

/**
 * Force refresh a problem (bypass cache)
 */
export const forceRefreshProblem = async (provider, contestId, index) => {
    try {
        const response = await fetch(`${API_URL}/api/problems/refresh/${provider}/${contestId}/${index}`);
        return response.json();
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
};

export default {
    fetchCodeforcesProblem,
    fetchCSESProblem,
    fetchAtCoderProblem,
    fetchLeetCodeProblem,
    fetchCodeforcesEditorial,
    checkScraperHealth,
    forceRefreshProblem
};
