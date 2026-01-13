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
    extensionTimeout: 10000
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

// Helper: Wait for extension
const waitForExtension = (timeout = 2000) => {
    return new Promise((resolve) => {
        if (extensionReady) {
            resolve(true);
            return;
        }
        const start = Date.now();
        const check = () => {
            if (extensionReady) {
                resolve(true);
            } else if (Date.now() - start > timeout) {
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

    // All strategies failed - use partial data if available
    const fallbackData = partialData || {
        provider: "codeforces",
        id: problemId,
        contestId,
        index,
        title: `${contestId}${index}`,
        url,
        testCases: []
    };

    return {
        success: false,
        source: partialData ? "api-metadata" : null,
        error: "Failed to fetch problem description",
        data: {
            ...fallbackData,
            description: `<div class="fetch-error" style="padding: 24px; text-align: center;">
                <h3 style="color: #ef4444; margin-bottom: 12px;">Failed to Load Problem Content</h3>
                ${partialData ? `<p style="color: #4ade80; margin-bottom: 8px;">Title: ${partialData.title || problemId}</p>` : ''}
                <p style="color: #a1a1aa; margin-bottom: 16px;">
                    Codeforces is blocking automated requests (Cloudflare protection).<br/>
                    <strong>Solution:</strong> Install the CodePlay Helper extension or log into Codeforces.
                </p>
                <a href="${url}" target="_blank" 
                   style="display: inline-block; padding: 10px 20px; 
                          background: #3b82f6; color: white; 
                          border-radius: 6px; text-decoration: none;">
                    Open on Codeforces
                </a>
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
 * Fetch LeetCode Problem
 */
export const fetchLeetCodeProblem = async (slug) => {
    console.log(`[ProblemFetcher] Fetching LeetCode ${slug}...`);

    try {
        const response = await fetch(`${API_URL}/api/problems/leetcode/${slug}`);
        
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
        console.error(`[ProblemFetcher] LeetCode error: ${e.message}`);
        
        return {
            success: false,
            error: e.message
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
