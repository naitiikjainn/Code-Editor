/**
 * Unified Scraper Service
 * 
 * Multi-strategy scraping architecture for competitive programming problems
 * Handles: Codeforces, CSES, LeetCode, AtCoder, and more
 * 
 * Strategy Priority:
 * 1. Cache (Redis -> MongoDB)
 * 2. Direct API (if available)
 * 3. Server-side Scrape (with anti-detection)
 * 4. Proxy Rotation
 * 5. Extension Delegation (client-side fallback)
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";
import Problem from "../models/Problem.js";
import redis from "../config/redis.js";

// --- STATIC REPOSITORY CONFIGURATION ---
// Update this with your GitHub username after creating the repository
const STATIC_REPO_CONFIG = {
    // Primary: codewithsathya's repository (community resource)
    // You can override via env to point to your own repo.
    primary: {
        owner: process.env.GITHUB_PROBLEMS_OWNER || "codewithsathya",
        repo: process.env.GITHUB_PROBLEMS_REPO || "codeforces-problems",
        branch: process.env.GITHUB_PROBLEMS_BRANCH || "main"
    },
    // Fallback: optional secondary repo
    fallback: {
        owner: process.env.GITHUB_PROBLEMS_FALLBACK_OWNER || "naitiikjainn",
        repo: process.env.GITHUB_PROBLEMS_FALLBACK_REPO || "codeforces-problems",
        branch: process.env.GITHUB_PROBLEMS_FALLBACK_BRANCH || "main"
    }
};

// --- CONFIGURATION ---
const CONFIG = {
    requestTimeout: 15000,
    retryAttempts: 3,
    retryDelay: 1000,
    cacheRedisTTL: 172800, // 2 days
    rateLimitDelay: 500,   // Delay between requests to same domain
    userAgents: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ]
};

// --- REQUEST RATE LIMITER ---
const lastRequestTime = {};

const rateLimitedFetch = async (url, options = {}) => {
    const domain = new URL(url).hostname;
    const now = Date.now();
    const lastRequest = lastRequestTime[domain] || 0;
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest < CONFIG.rateLimitDelay) {
        await sleep(CONFIG.rateLimitDelay - timeSinceLastRequest);
    }

    lastRequestTime[domain] = Date.now();

    const userAgent = CONFIG.userAgents[Math.floor(Math.random() * CONFIG.userAgents.length)];

    const defaultHeaders = {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || CONFIG.requestTimeout);

    try {
        const response = await fetch(url, {
            ...options,
            headers: { ...defaultHeaders, ...options.headers },
            signal: controller.signal,
            redirect: 'follow'
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

// --- UTILITY FUNCTIONS ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Strip MathJax-rendered output from HTML, keeping only LaTeX source
 * MathJax creates spans like .mjx-chtml, .MJX_Assistive_MathML that duplicate content
 */
const stripMathJaxOutput = (html, $) => {
    if (!html || !$) return html;

    const $clone = $.load(html);

    const hasOriginalTex = $clone('script[type*="math/tex"], .tex-span, .tex-math, .tex-font-style-it, .tex-font-style-bf, .tex-font-style-tt').length > 0;

    const replaceWithText = (selector) => {
        $clone(selector).each((_, el) => {
            const text = $clone(el).text();
            if (text && text.trim().length > 0) {
                $clone(el).replaceWith(text);
            } else {
                $clone(el).remove();
            }
        });
    };

    if (hasOriginalTex) {
        // Convert MathJax source scripts into inline LaTeX before removing rendered output
        $clone('script[type*="math/tex"]').each((_, el) => {
            const tex = $clone(el).text();
            const type = ($clone(el).attr('type') || '').toLowerCase();
            if (!tex || !tex.trim()) {
                $clone(el).remove();
                return;
            }
            const isDisplay = type.includes('mode=display');
            $clone(el).replaceWith(isDisplay ? `$$${tex}$$` : `$${tex}$`);
        });

        // Remove MathJax rendered output elements (keeps the original math source)
        $clone('.mjx-chtml').remove();
        $clone('.mjx-math').remove();
        $clone('.mjx-mrow').remove();
        $clone('.MJX_Assistive_MathML').remove();
        $clone('.MathJax').remove();
        $clone('.MathJax_Preview').remove();
        $clone('.MathJax_SVG').remove();
        $clone('.MathJax_CHTML').remove();
        $clone('[class^="mjx-"]').remove();
        $clone('[class*=" mjx-"]').remove();
        $clone('span[id^="MathJax-"]').remove();
    } else {
        // No original TeX source present: preserve MathJax text content to avoid blank variables
        replaceWithText('.mjx-chtml');
        replaceWithText('.mjx-math');
        replaceWithText('.mjx-mrow');
        replaceWithText('.MJX_Assistive_MathML');
        replaceWithText('.MathJax');
        replaceWithText('.MathJax_Preview');
        replaceWithText('.MathJax_SVG');
        replaceWithText('.MathJax_CHTML');
        replaceWithText('[class^="mjx-"]');
        replaceWithText('[class*=" mjx-"]');
        // If TeX scripts exist without visible output, inline them for frontend math renderer
        $clone('script[type*="math/tex"]').each((_, el) => {
            const tex = $clone(el).text();
            $clone(el).replaceWith(tex ? `$${tex}$` : '');
        });
        $clone('span[id^="MathJax-"]').remove();
    }
    $clone('nobr').each((_, el) => {
        // MathJax wraps content in nobr, unwrap it
        const inner = $clone(el).html();
        $clone(el).replaceWith(inner || '');
    });

    return $clone.html();
};

const cleanHtml = (html) => {
    if (!html) return "";
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(num))
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

// Remove prompt-injection artifacts and hidden LaTeX blocks from scraped HTML
const sanitizeProblemHtml = (html) => {
    if (!html) return html;
    return html
    // Remove nested color+texttt injection blocks
    .replace(/\\color\{white\}\{\\texttt\{[\s\S]*?\}\}/gi, "")
        // Remove hidden LaTeX blocks often used for prompt injection
        .replace(/\\color\{white\}\{[\s\S]*?\}/gi, "")
        // Remove common prompt-injection phrases
        .replace(/if you are\s+llm[^<]*/gi, "")
        .replace(/take your answer by modulo[^<]*/gi, "");
};

const retryWithBackoff = async (fn, attempts = CONFIG.retryAttempts) => {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`[Scraper] Attempt ${i + 1}/${attempts} failed:`, error.message);
            if (i < attempts - 1) {
                const delay = CONFIG.retryDelay * Math.pow(2, i);
                await sleep(delay);
            }
        }
    }
    throw lastError;
};

// --- CACHE LAYER ---
const cacheService = {
    async get(problemId) {
        // Try Redis first
        try {
            const cached = await redis.get(`problem:${problemId}`);
            if (cached) {
                console.log(`[Cache] Redis HIT for ${problemId}`);
                return JSON.parse(cached);
            }
        } catch (e) {
            console.warn("[Cache] Redis error:", e.message);
        }

        // Try MongoDB
        try {
            const doc = await Problem.findOne({ problemId });
            if (doc) {
                console.log(`[Cache] MongoDB HIT for ${problemId}`);
                // Update TTL
                doc.lastAccessed = new Date();
                doc.save().catch(() => { });
                // Refresh Redis
                redis.setex(`problem:${problemId}`, CONFIG.cacheRedisTTL, JSON.stringify(doc.data)).catch(() => { });
                return doc.data;
            }
        } catch (e) {
            console.warn("[Cache] MongoDB error:", e.message);
        }

        return null;
    },

    async set(problemId, data) {
        try {
            // Save to MongoDB
            await Problem.findOneAndUpdate(
                { problemId },
                { problemId, data, lastAccessed: new Date() },
                { upsert: true, new: true }
            );

            // Save to Redis
            await redis.setex(`problem:${problemId}`, CONFIG.cacheRedisTTL, JSON.stringify(data));

            console.log(`[Cache] Saved ${problemId}`);
            return true;
        } catch (e) {
            console.error("[Cache] Save error:", e.message);
            return false;
        }
    },

    async invalidate(problemId) {
        try {
            await redis.del(`problem:${problemId}`);
            await Problem.deleteOne({ problemId });
            console.log(`[Cache] Invalidated ${problemId}`);
        } catch (e) {
            console.error("[Cache] Invalidate error:", e.message);
        }
    }
};

// --- CODEFORCES SCRAPER ---
const codeforcesScraper = {
    name: "codeforces",

    // Check if URL/ID belongs to Codeforces
    canHandle(provider) {
        return provider === "codeforces" || provider === "cf";
    },

    // Build problem URL
    buildUrl(contestId, index) {
        return `https://codeforces.com/contest/${contestId}/problem/${index}`;
    },

    // Static content sources (pre-scraped HTML) - try these first to bypass Cloudflare
    // Priority: Your repo first, then fallback to community repo
    // Supports both colon (:) and underscore (_) file naming conventions
    getStaticUrls(contestId, index) {
        const urls = [];

        // Build URL helpers for both naming conventions
        const buildGitHubRawUrl = (config, separator) =>
            `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/content/${contestId}${separator}${index}.html`;

        // 1. Primary: Your own repository (if configured)
        if (STATIC_REPO_CONFIG.primary.owner) {
            // Try underscore first (Windows-compatible), then colon
            urls.push(buildGitHubRawUrl(STATIC_REPO_CONFIG.primary, '_'));
            urls.push(buildGitHubRawUrl(STATIC_REPO_CONFIG.primary, ':'));
            urls.push(`https://raw.githubusercontent.com/${STATIC_REPO_CONFIG.primary.owner}/${STATIC_REPO_CONFIG.primary.repo}/${STATIC_REPO_CONFIG.primary.branch}/content/${contestId}%3A${index}.html`);
        }

        // 2. Fallback: Community repository (uses colon separator)
        if (STATIC_REPO_CONFIG.fallback.owner) {
            urls.push(buildGitHubRawUrl(STATIC_REPO_CONFIG.fallback, ':'));
            urls.push(`https://raw.githubusercontent.com/${STATIC_REPO_CONFIG.fallback.owner}/${STATIC_REPO_CONFIG.fallback.repo}/${STATIC_REPO_CONFIG.fallback.branch}/content/${contestId}%3A${index}.html`);
        }

        return urls;
    },

    // Alternate URLs for direct scraping fallback
    getAlternateUrls(contestId, index) {
        return [
            `https://codeforces.com/contest/${contestId}/problem/${index}`,
            `https://codeforces.com/problemset/problem/${contestId}/${index}`,
            `https://m.codeforces.com/contest/${contestId}/problem/${index}`, // Mobile version
        ];
    },

    // Check if response indicates anti-bot protection
    isBlocked(html) {
        const blockIndicators = [
            "Redirecting...",
            "Just a moment...",
            "security check",
            "cf-browser-verification",
            "Enable JavaScript and cookies",
            "Checking your browser",
            "DDoS protection",
            "Enter »", // Contest entry page
            "Access denied",
            "403 Forbidden"
        ];
        return blockIndicators.some(indicator => html.includes(indicator));
    },

    // Parse problem HTML using Cheerio (server-side DOM)
    parse(html, contestId, index, url) {
        const $ = cheerio.load(html);

        // --- TITLE ---
        let title = `${contestId}${index}`;
        const titleDiv = $(".problem-statement .header .title").first();
        if (titleDiv.length) {
            title = titleDiv.text().trim();
        } else {
            const pageTitle = $("title").text().replace(" - Codeforces", "").trim();
            if (pageTitle && pageTitle.length < 100) title = pageTitle;
        }

        // --- TIME & MEMORY LIMITS ---
        let timeLimit = "N/A";
        let memoryLimit = "N/A";
        const timeLimitNode = $(".time-limit");
        const memoryLimitNode = $(".memory-limit");

        if (timeLimitNode.length) {
            timeLimit = timeLimitNode.text().replace("time limit per test", "").trim();
        }
        if (memoryLimitNode.length) {
            memoryLimit = memoryLimitNode.text().replace("memory limit per test", "").trim();
        }

        // --- DESCRIPTION ---
        let description = "<p>No description available.</p>";
        const problemStatement = $(".problem-statement").first();

        if (problemStatement.length) {
            // Clone and clean
            const clone = problemStatement.clone();
            clone.find(".sample-tests").remove();
            clone.find(".header").remove(); // Remove header from description HTML

            // Extract and remove note from description to avoid duplication
            const noteNodeInClone = clone.find(".note");
            if (noteNodeInClone.length) {
                noteNodeInClone.remove();
            }

            // Fix relative URLs
            clone.find("img").each((_, img) => {
                const src = $(img).attr("src");
                if (src && src.startsWith("/")) {
                    $(img).attr("src", `https://codeforces.com${src}`);
                }
            });

            clone.find("a").each((_, a) => {
                const href = $(a).attr("href");
                if (href && href.startsWith("/")) {
                    $(a).attr("href", `https://codeforces.com${href}`);
                }
            });

            description = sanitizeProblemHtml(stripMathJaxOutput(clone.html(), cheerio)) || description;
        }

        // --- NOTE ---
        let note = null;
        const noteNode = $(".problem-statement .note");
        if (noteNode.length) {
            note = sanitizeProblemHtml(stripMathJaxOutput(noteNode.html(), cheerio));
        }

        // --- TEST CASES ---
        const testCases = [];
        const sampleTests = $(".sample-tests");

        if (sampleTests.length) {
            const inputs = sampleTests.find(".input pre");
            const outputs = sampleTests.find(".output pre");

            inputs.each((i, inputPre) => {
                const inputText = this.parsePreContent($(inputPre));
                const outputText = outputs[i] ? this.parsePreContent($(outputs[i])) : "";

                testCases.push({
                    input: inputText,
                    expectedOutput: outputText
                });
            });
        }

        // --- TUTORIAL URL ---
        let tutorialUrl = null;
        try {
            $(".sidebox").each((_, box) => {
                const caption = $(box).find(".caption");
                if (caption.text().includes("Contest materials")) {
                    $(box).find("li a").each((_, link) => {
                        const text = $(link).text().toLowerCase();
                        if (text.includes("tutorial") || text.includes("editorial")) {
                            const href = $(link).attr("href");
                            if (href) {
                                tutorialUrl = href.startsWith("http") ? href : `https://codeforces.com${href}`;
                            }
                        }
                    });
                }
            });
        } catch (e) { /* Ignore */ }

        return {
            provider: "codeforces",
            id: `${contestId}${index}`,
            contestId,
            index,
            title,
            timeLimit,
            memoryLimit,
            description,
            note,
            testCases,
            tutorialUrl,
            url: url || this.buildUrl(contestId, index),
            scrapedAt: new Date().toISOString()
        };
    },

    // Parse static pre-scraped HTML content (from GitHub raw)
    // The static content is a full Codeforces page, so we extract just the problem-statement
    parseStaticContent(html, contestId, index) {
        const $ = cheerio.load(html);

        let title = `${contestId}${index}`;
        let timeLimit = "N/A";
        let memoryLimit = "N/A";
        let description = "<p>No description available.</p>";
        let note = null;
        const testCases = [];

        // Extract the problem-statement div (the actual problem content)
        const problemStatement = $(".problem-statement").first();

        if (!problemStatement.length) {
            console.warn("[CF Scraper] No .problem-statement found in static content");
            return null;
        }

        // --- TITLE ---
        const titleDiv = problemStatement.find(".header .title").first();
        if (titleDiv.length) {
            title = titleDiv.text().trim();
        }

        // --- TIME & MEMORY LIMITS ---
        const timeLimitDiv = problemStatement.find(".time-limit");
        const memoryLimitDiv = problemStatement.find(".memory-limit");
        if (timeLimitDiv.length) {
            timeLimit = timeLimitDiv.text().replace("time limit per test", "").trim();
        }
        if (memoryLimitDiv.length) {
            memoryLimit = memoryLimitDiv.text().replace("memory limit per test", "").trim();
        }

        // --- DESCRIPTION (problem statement without test cases and header) ---
        const clone = problemStatement.clone();
        clone.find(".sample-tests").remove();
        clone.find(".header").remove();

        // Fix relative URLs
        clone.find("img").each((_, img) => {
            const src = $(img).attr("src");
            if (src && src.startsWith("/")) {
                $(img).attr("src", `https://codeforces.com${src}`);
            }
        });
        clone.find("a").each((_, a) => {
            const href = $(a).attr("href");
            if (href && href.startsWith("/")) {
                $(a).attr("href", `https://codeforces.com${href}`);
            }
        });

        // Remove note from description to avoid duplicate note rendering
        const noteInClone = clone.find(".note");
        if (noteInClone.length) noteInClone.remove();

        description = sanitizeProblemHtml(stripMathJaxOutput(clone.html(), cheerio)) || description;

        // --- NOTE ---
        const noteDiv = problemStatement.find(".note");
        if (noteDiv.length) {
            note = sanitizeProblemHtml(stripMathJaxOutput(noteDiv.html(), cheerio));
        }

        // --- TEST CASES ---
        const sampleTests = problemStatement.find(".sample-tests");
        if (sampleTests.length) {
            const inputs = sampleTests.find(".input pre");
            const outputs = sampleTests.find(".output pre");

            inputs.each((i, inputPre) => {
                const inputText = this.parsePreContent($(inputPre));
                const outputText = outputs[i] ? this.parsePreContent($(outputs[i])) : "";

                testCases.push({
                    input: inputText,
                    expectedOutput: outputText
                });
            });
        }

        return {
            provider: "codeforces",
            id: `${contestId}${index}`,
            contestId,
            index,
            title,
            timeLimit,
            memoryLimit,
            description,
            note,
            testCases,
            tutorialUrl: null,
            url: this.buildUrl(contestId, index),
            source: "static",
            scrapedAt: new Date().toISOString()
        };
    },

    // Parse <pre> content correctly (handles <div> line breaks in new CF format)
    parsePreContent($pre) {
        let result = "";

        const processNode = (node) => {
            if (node.type === "text") {
                result += node.data;
            } else if (node.type === "tag") {
                if (node.name === "br") {
                    result += "\n";
                } else if (["div", "p", "li", "tr"].includes(node.name)) {
                    if (result.length > 0 && !result.endsWith("\n")) {
                        result += "\n";
                    }
                    node.children?.forEach(processNode);
                    if (!result.endsWith("\n")) {
                        result += "\n";
                    }
                } else {
                    node.children?.forEach(processNode);
                }
            }
        };

        $pre.contents().each((_, node) => processNode(node));

        return result.replace(/\n{3,}/g, "\n\n").trim();
    },

    // Main fetch function
    async fetch(contestId, index) {
        const problemId = `${contestId}${index}`;

        // 1. Check Cache
        const cached = await cacheService.get(problemId);
        if (cached && cached.description && !cached.description.includes("No description available")) {
            return cached;
        }

        // 2. Try Codeforces API for problem metadata (doesn't include description but gives us title, tags, rating)
        let apiMetadata = null;
        try {
            const apiResponse = await rateLimitedFetch(`https://codeforces.com/api/problemset.problems?tags=`);
            if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                if (apiData.status === "OK" && apiData.result?.problems) {
                    apiMetadata = apiData.result.problems.find(
                        p => p.contestId == contestId && p.index === index
                    );
                }
            }
        } catch (e) {
            console.warn(`[CF Scraper] API metadata fetch failed:`, e.message);
        }

        // 3. Try static pre-scraped sources first (bypass Cloudflare)
        const staticUrls = this.getStaticUrls(contestId, index);
        for (const url of staticUrls) {
            try {
                console.log(`[CF Scraper] Trying static source ${url}...`);
                const response = await rateLimitedFetch(url, { timeout: 10000 });

                if (response.ok) {
                    const html = await response.text();

                    // Static content is the full CF page, we need to extract problem-statement
                    if (html && html.length > 100 && !html.includes("404") && !html.includes("Not Found")) {
                        console.log(`[CF Scraper] Static source HIT for ${problemId}`);

                        // Parse the static HTML
                        const problemData = this.parseStaticContent(html, contestId, index);

                        // If parsing failed, continue to next source
                        if (!problemData) {
                            console.warn(`[CF Scraper] Failed to parse static content for ${problemId}`);
                            continue;
                        }

                        // Merge with API metadata if available
                        if (apiMetadata) {
                            problemData.rating = apiMetadata.rating;
                            problemData.tags = apiMetadata.tags;
                            if (!problemData.title || problemData.title === `${contestId}${index}`) {
                                problemData.title = `${index}. ${apiMetadata.name}`;
                            }
                        }

                        // Mark source
                        problemData.source = "static";

                        // Cache the result
                        await cacheService.set(problemId, problemData);
                        return problemData;
                    }
                }
            } catch (e) {
                console.warn(`[CF Scraper] Static source failed:`, e.message);
            }
        }

        // 4. Try all alternate URLs for direct HTML scraping
        const urls = this.getAlternateUrls(contestId, index);
        let lastError = null;

        for (const url of urls) {
            try {
                console.log(`[CF Scraper] Trying ${url}...`);

                const response = await rateLimitedFetch(url);

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error(`Problem not found (404)`);
                    }
                    // On 403, we'll continue to try other URLs or return API metadata
                    if (response.status === 403) {
                        console.warn(`[CF Scraper] 403 Forbidden at ${url} (Cloudflare)`);
                        lastError = new Error("403 Forbidden (Cloudflare protection)");
                        continue;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const html = await response.text();

                // Check for anti-bot
                if (this.isBlocked(html)) {
                    console.warn(`[CF Scraper] Blocked at ${url}`);
                    lastError = new Error("Anti-Bot Protection Detected");
                    continue;
                }

                // Parse
                const problemData = this.parse(html, contestId, index, url);

                // Merge with API metadata if available
                if (apiMetadata) {
                    problemData.rating = apiMetadata.rating;
                    problemData.tags = apiMetadata.tags;
                    if (!problemData.title || problemData.title === `${contestId}${index}`) {
                        problemData.title = `${index}. ${apiMetadata.name}`;
                    }
                }

                // Validate
                if (!problemData.description || problemData.description.includes("No description available")) {
                    throw new Error("Failed to extract problem content");
                }

                // Cache successful result
                await cacheService.set(problemId, problemData);

                return problemData;

            } catch (error) {
                console.warn(`[CF Scraper] Failed at ${url}:`, error.message);
                lastError = error;
                await sleep(CONFIG.rateLimitDelay);
            }
        }

        // If we have API metadata but no HTML content, create a placeholder
        // This allows the frontend to show basic info and trigger extension fetch
        if (apiMetadata) {
            const placeholderData = {
                provider: "codeforces",
                id: problemId,
                contestId,
                index,
                title: `${index}. ${apiMetadata.name}`,
                rating: apiMetadata.rating,
                tags: apiMetadata.tags,
                timeLimit: "N/A",
                memoryLimit: "N/A",
                description: null, // Explicitly null to indicate missing
                testCases: [],
                url: this.buildUrl(contestId, index),
                requiresExtension: true,
                scrapedAt: new Date().toISOString()
            };

            // Don't cache placeholder data
            console.log(`[CF Scraper] Returning API metadata only for ${problemId} - needs extension for content`);

            // Create custom error with metadata attached
            const error = new Error(`Cloudflare blocked - extension needed`);
            error.requiresExtension = true;
            error.partialData = placeholderData;
            throw error;
        }

        // Create error with requiresExtension flag
        const error = new Error(`All scraping attempts failed: ${lastError?.message}`);
        error.requiresExtension = true;
        throw error;
    }
};

// --- CSES SCRAPER ---
const csesScraper = {
    name: "cses",

    canHandle(provider) {
        return provider === "cses";
    },

    buildUrl(taskId) {
        return `https://cses.fi/problemset/task/${taskId}`;
    },

    parse(html, taskId) {
        const $ = cheerio.load(html);

        // Title
        const titleBlock = $(".title-block h1").first();
        const title = titleBlock.length ? titleBlock.text().trim() : `CSES Task ${taskId}`;

        // Time/Memory Limits
        let timeLimit = "N/A";
        let memoryLimit = "N/A";

        const taskInfo = $(".task-info");
        if (taskInfo.length) {
            const text = taskInfo.text();
            const timeMatch = text.match(/Time limit:\s*([^\n]+)/);
            const memMatch = text.match(/Memory limit:\s*([^\n]+)/);
            if (timeMatch) timeLimit = timeMatch[1].trim();
            if (memMatch) memoryLimit = memMatch[1].trim();
        }

        // Description
        const content = $(".content").first();
        let description = "<p>No description available.</p>";

        if (content.length) {
            // Fix relative URLs
            content.find("img").each((_, img) => {
                const src = $(img).attr("src");
                if (src && src.startsWith("/")) {
                    $(img).attr("src", `https://cses.fi${src}`);
                }
            });

            description = content.html() || description;
        }

        // Test Cases
        const testCases = [];
        const pres = content.find("pre");
        const inputs = [];
        const outputs = [];

        pres.each((i, pre) => {
            const text = $(pre).text().trim();
            if (inputs.length === outputs.length) {
                inputs.push(text);
            } else {
                outputs.push(text);
            }
        });

        for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
            testCases.push({ input: inputs[i], expectedOutput: outputs[i] });
        }

        return {
            provider: "cses",
            id: taskId,
            title,
            timeLimit,
            memoryLimit,
            description,
            testCases,
            url: this.buildUrl(taskId),
            scrapedAt: new Date().toISOString()
        };
    },

    async fetch(taskId) {
        const problemId = `CSES${taskId}`;

        // Check cache
        const cached = await cacheService.get(problemId);
        if (cached) return cached;

        // Fetch
        const url = this.buildUrl(taskId);
        const response = await rateLimitedFetch(url);

        if (!response.ok) {
            throw new Error(`CSES fetch failed: HTTP ${response.status}`);
        }

        const html = await response.text();
        const problemData = this.parse(html, taskId);

        // Cache
        await cacheService.set(problemId, problemData);

        return problemData;
    }
};

// --- ATCODER SCRAPER ---
const atcoderScraper = {
    name: "atcoder",

    canHandle(provider) {
        return provider === "atcoder" || provider === "ac";
    },

    buildUrl(contestId, taskId) {
        return `https://atcoder.jp/contests/${contestId}/tasks/${taskId}`;
    },

    parse(html, contestId, taskId) {
        const $ = cheerio.load(html);

        // Title
        const title = $("title").text().replace(" - AtCoder", "").trim() || `${contestId}_${taskId}`;

        // Time/Memory from task-statement header
        let timeLimit = "N/A";
        let memoryLimit = "N/A";

        const timeLimitText = $("p:contains('Time Limit')").text();
        const memLimitText = $("p:contains('Memory Limit')").text();

        if (timeLimitText) {
            const match = timeLimitText.match(/(\d+)\s*sec/);
            if (match) timeLimit = `${match[1]} seconds`;
        }
        if (memLimitText) {
            const match = memLimitText.match(/(\d+)\s*MB/);
            if (match) memoryLimit = `${match[1]} MB`;
        }

        // Description (English or Japanese section)
        const langSection = $("#task-statement .lang-en").length
            ? $("#task-statement .lang-en")
            : $("#task-statement");

        let description = "<p>No description available.</p>";
        if (langSection.length) {
            description = langSection.html() || description;
        }

        // Test Cases
        const testCases = [];
        const sampleInputs = [];
        const sampleOutputs = [];

        $("pre").each((_, pre) => {
            const $pre = $(pre);
            const $section = $pre.closest("section");
            const header = $section.find("h3").text().toLowerCase();

            if (header.includes("sample input")) {
                sampleInputs.push($pre.text().trim());
            } else if (header.includes("sample output")) {
                sampleOutputs.push($pre.text().trim());
            }
        });

        for (let i = 0; i < Math.min(sampleInputs.length, sampleOutputs.length); i++) {
            testCases.push({ input: sampleInputs[i], expectedOutput: sampleOutputs[i] });
        }

        return {
            provider: "atcoder",
            id: `${contestId}_${taskId}`,
            contestId,
            taskId,
            title,
            timeLimit,
            memoryLimit,
            description,
            testCases,
            url: this.buildUrl(contestId, taskId),
            scrapedAt: new Date().toISOString()
        };
    },

    async fetch(contestId, taskId) {
        const problemId = `AC_${contestId}_${taskId}`;

        const cached = await cacheService.get(problemId);
        if (cached) return cached;

        const url = this.buildUrl(contestId, taskId);
        const response = await rateLimitedFetch(url);

        if (!response.ok) {
            throw new Error(`AtCoder fetch failed: HTTP ${response.status}`);
        }

        const html = await response.text();
        const problemData = this.parse(html, contestId, taskId);

        await cacheService.set(problemId, problemData);

        return problemData;
    }
};

// --- UNIFIED SCRAPER SERVICE ---
const scraperService = {
    scrapers: [codeforcesScraper, csesScraper, atcoderScraper],

    getScraper(provider) {
        return this.scrapers.find(s => s.canHandle(provider));
    },

    async fetchProblem(provider, ...args) {
        const scraper = this.getScraper(provider);
        if (!scraper) {
            throw new Error(`No scraper available for provider: ${provider}`);
        }
        return scraper.fetch(...args);
    },

    // Codeforces specific
    async fetchCodeforces(contestId, index) {
        return codeforcesScraper.fetch(contestId, index);
    },

    // CSES specific
    async fetchCSES(taskId) {
        return csesScraper.fetch(taskId);
    },

    // AtCoder specific
    async fetchAtCoder(contestId, taskId) {
        return atcoderScraper.fetch(contestId, taskId);
    },

    // Cache operations
    cache: cacheService,

    // Health check
    async healthCheck() {
        const results = {
            redis: false,
            mongodb: false,
            codeforces: false,
            cses: false
        };

        try {
            await redis.ping();
            results.redis = true;
        } catch (e) { /* Redis down */ }

        try {
            await Problem.findOne({}).limit(1);
            results.mongodb = true;
        } catch (e) { /* MongoDB down */ }

        try {
            const response = await rateLimitedFetch("https://codeforces.com/api/problemset.problems?tags=implementation&limit=1", { timeout: 5000 });
            results.codeforces = response.ok;
        } catch (e) { /* CF unreachable */ }

        try {
            const response = await rateLimitedFetch("https://cses.fi/problemset/", { timeout: 5000 });
            results.cses = response.ok;
        } catch (e) { /* CSES unreachable */ }

        return results;
    }
};

export default scraperService;
export { cacheService, codeforcesScraper, csesScraper, atcoderScraper, cleanHtml, retryWithBackoff };
