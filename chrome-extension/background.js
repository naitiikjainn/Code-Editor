// Background Service Worker

// 0. SETUP DYNAMIC RULES FOR HEADER SPOOFING (STEALTH MODE)
// We rewrite headers to look like a normal browser tab, bypassing "Extension" blocks.
chrome.runtime.onInstalled.addListener(() => {
    updateNetRules();
});
chrome.runtime.onStartup.addListener(() => {
    updateNetRules();
});

function updateNetRules() {
    if (chrome.declarativeNetRequest) {
        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [],
            removeRuleIds: [1, 2] // Clean up old rules
        });
        console.log("Stealth Mode Disabled (Clean Slate)");
    }
}


let creating; // A global promise to avoid concurrency issues
async function setupOffscreenDocument(path) {
    // Check if an offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [path]
    });

    if (existingContexts.length > 0) return;

    // Create if not exists
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['DOM_PARSER'],
            justification: 'To parse HTML for CSRF tokens and problem details',
        });
        await creating;
        creating = null;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CHECK_LOGIN_STATUS") {
        (async () => {
            const status = {
                codeforces: { loggedIn: false, user: null },
                leetcode: { loggedIn: false, user: null }
            };

            // 1. Check Codeforces
            try {
                const res = await fetch("https://codeforces.com", { credentials: 'include' });
                const html = await res.text();
                const match = html.match(/href="\/profile\/([^"]+)"[^>]*>[^<]+<\/a>\s*\|\s*<a[^>]*logout/i);
                if (match && match[1]) {
                    status.codeforces.loggedIn = true;
                    status.codeforces.user = match[1];
                }
            } catch (e) { console.error("CF Check Failed", e); }

            // 2. Check LeetCode
            try {
                const session = await chrome.cookies.get({ url: "https://leetcode.com", name: "LEETCODE_SESSION" });
                if (session) {
                    status.leetcode.loggedIn = true;
                    status.leetcode.user = "Session Active";
                }
            } catch (e) { console.error("LC Check Failed", e); }

            sendResponse(status);
        })();
        return true;
    }

    if (message.type === "GET_LEETCODE_COOKIES") {
        Promise.all([
            chrome.cookies.get({ url: "https://leetcode.com", name: "LEETCODE_SESSION" }),
            chrome.cookies.get({ url: "https://leetcode.com", name: "csrftoken" })
        ]).then(([sessionCookie, csrfCookie]) => {
            if (sessionCookie && csrfCookie) {
                sendResponse({
                    success: true,
                    cookie: sessionCookie.value,
                    csrfToken: csrfCookie.value
                });
            } else {
                sendResponse({ success: false, error: "Cookies not found. Please log in to LeetCode first." });
            }
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    if (message.type === "SUBMIT_CODEFORCES") {
        const { contestId, problemIndex, code, languageId } = message.payload;

        // First try to find an existing Codeforces tab
        (async () => {
            try {
                // Check if user is logged in first
                const loginCheck = await fetch("https://codeforces.com", { credentials: 'include' });
                const loginHtml = await loginCheck.text();
                if (!loginHtml.includes("/logout")) {
                    sendResponse({ success: false, error: "Not logged in to Codeforces. Please log in first." });
                    return;
                }

                // Extract handle for later polling
                const handleMatch = loginHtml.match(/href="\/profile\/([^"]+)"/);
                const handle = handleMatch ? handleMatch[1] : null;

                console.log(`[CodePlay] Logged in as: ${handle}`);
                console.log(`[CodePlay] Submitting ${contestId}${problemIndex}...`);

                // Try multiple submit URLs
                const submitUrls = [
                    `https://codeforces.com/contest/${contestId}/submit`,
                    `https://codeforces.com/problemset/submit`
                ];

                let tab = null;
                let submitSuccess = false;
                let hiddenWindow = null;

                // Create a minimized window to keep the tab hidden
                try {
                    hiddenWindow = await chrome.windows.create({
                        url: 'about:blank',
                        type: 'popup',
                        state: 'minimized',
                        width: 1,
                        height: 1,
                        left: -1000,
                        top: -1000,
                        focused: false
                    });
                } catch (e) {
                    console.log('[CodePlay] Could not create hidden window, using background tab');
                }

                for (const submitUrl of submitUrls) {
                    if (submitSuccess) break;

                    console.log(`[CodePlay] Opening: ${submitUrl}`);

                    // Create tab in hidden window or as background tab
                    if (hiddenWindow) {
                        tab = await chrome.tabs.create({ url: submitUrl, windowId: hiddenWindow.id, active: false });
                    } else {
                        tab = await chrome.tabs.create({ url: submitUrl, active: false });
                    }

                    // Wait for tab to load and get result
                    const result = await new Promise((resolve, reject) => {
                        let attempts = 0;
                        const maxAttempts = 60; // Retry for up to ~30s while waiting for content script
                        let timeoutId = null;
                        let retryTimeoutId = null;

                        const clearAll = () => {
                            if (timeoutId) {
                                clearTimeout(timeoutId);
                                timeoutId = null;
                            }
                            if (retryTimeoutId) {
                                clearTimeout(retryTimeoutId);
                                retryTimeoutId = null;
                            }
                            chrome.tabs.onUpdated.removeListener(onUpdated);
                        };

                        const scheduleRetry = () => {
                            if (retryTimeoutId) return;
                            retryTimeoutId = setTimeout(() => {
                                retryTimeoutId = null;
                                sendSubmissionRequest();
                            }, 500);
                        };

                        const sendSubmissionRequest = () => {
                            attempts++;
                            if (attempts > maxAttempts) {
                                clearAll();
                                reject(new Error("Content script not responding"));
                                return;
                            }

                            chrome.tabs.sendMessage(tab.id, {
                                type: "CODEPLAY_PERFORM_SUBMIT",
                                payload: { contestId, problemIndex, code, languageId }
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    const message = chrome.runtime.lastError.message || "";
                                    if (message.includes("Receiving end") || message.includes("No window with id")) {
                                        // Content script not ready yet, retry shortly
                                        scheduleRetry();
                                    } else {
                                        clearAll();
                                        reject(new Error(message));
                                    }
                                    return;
                                }

                                if (response) {
                                    clearAll();
                                    resolve(response);
                                }
                            });
                        };

                        const onUpdated = (tabId, changeInfo) => {
                            if (tabId === tab.id && changeInfo.status === "complete") {
                                chrome.tabs.onUpdated.removeListener(onUpdated);
                                sendSubmissionRequest();
                            }
                        };

                        chrome.tabs.onUpdated.addListener(onUpdated);

                        // Fallback in case the tab is already loaded
                        chrome.tabs.get(tab.id, (createdTab) => {
                            if (chrome.runtime.lastError) {
                                clearAll();
                                reject(new Error(chrome.runtime.lastError.message));
                                return;
                            }
                            if (createdTab.status === "complete") {
                                chrome.tabs.onUpdated.removeListener(onUpdated);
                                sendSubmissionRequest();
                            }
                        });

                        timeoutId = setTimeout(() => {
                            clearAll();
                            reject(new Error("Page load timeout"));
                        }, 60000);
                    });

                    // Close the tab
                    try { chrome.tabs.remove(tab.id); } catch (e) { }

                    // Close hidden window if this was the last URL or success
                    if (submitSuccess || submitUrl === submitUrls[submitUrls.length - 1]) {
                        if (hiddenWindow) {
                            try { chrome.windows.remove(hiddenWindow.id); } catch (e) { }
                            hiddenWindow = null;
                        }
                    }

                    if (result.success) {
                        submitSuccess = true;
                        sendResponse({ success: true, message: result.message, handle });

                        // Start polling for verdict
                        if (handle) {
                            pollVerdict(contestId, problemIndex, handle);
                        }
                        return;
                    } else if (result.error && !result.error.includes("All submit URLs failed")) {
                        // Got a specific error, return it
                        // Ensure hidden window is closed
                        if (hiddenWindow) {
                            try { chrome.windows.remove(hiddenWindow.id); } catch (e) { }
                        }
                        sendResponse(result);
                        return;
                    }
                    // Otherwise try next URL
                }

                // Ensure hidden window is closed
                if (hiddenWindow) {
                    try { chrome.windows.remove(hiddenWindow.id); } catch (e) { }
                }

                if (!submitSuccess) {
                    sendResponse({ success: false, error: "Failed to submit. Please try again or submit manually." });
                }

            } catch (err) {
                console.error("[CodePlay] Submit Error:", err);
                // Ensure hidden window is closed on error
                if (hiddenWindow) {
                    try { chrome.windows.remove(hiddenWindow.id); } catch (e) { }
                }
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    // POLL FUNCTION
    async function pollVerdict(contestId, index, handle) {
        if (!handle) {
            try {
                const res = await fetch("https://codeforces.com", { credentials: 'include' });
                const html = await res.text();
                const match = html.match(/href="\/profile\/([^"]+)"/);
                if (match) handle = match[1];
            } catch (e) { return; }
        }

        if (!handle) return;

        console.log(`[CodePlay] Polling verdict for ${handle} on ${contestId}${index}`);

        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts > 60) { // 3 mins
                clearInterval(interval);
                return;
            }

            try {
                const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10`);
                const data = await res.json();
                if (data.status === "OK") {
                    const submission = data.result.find(s =>
                        s.contestId == contestId && s.problem.index == index
                    );

                    if (submission && submission.verdict && submission.verdict !== "TESTING") {
                        clearInterval(interval);

                        // NOTIFY USER
                        const isAc = submission.verdict === "OK";
                        const icon = isAc ? "✅" : "❌";
                        const title = `${icon} ${isAc ? "Accepted" : submission.verdict}`;
                        const msg = `Problem ${contestId}${index}\nTests: ${submission.passedTestCount + (isAc ? 0 : 1)}\nTime: ${submission.timeConsumedMillis}ms\nMemory: ${Math.round(submission.memoryConsumedBytes / 1024)}KB`;

                        chrome.notifications.create({
                            type: "basic",
                            iconUrl: "icon128.png",
                            title: title,
                            message: msg,
                            priority: 2
                        });
                    }
                }
            } catch (e) {
                // ignore network errors during polling
            }
        }, 3000);
    }

    // CODEFORCES TAB SCRAPER (Reliable Bypass for Cloudflare 403)
    if (message.type === "FETCH_CODEFORCES_PROBLEM") {
        const { url } = message.payload;
        (async () => {
            let hiddenWindow = null;
            let tab = null;

            const cleanup = () => {
                if (tab) {
                    try { chrome.tabs.remove(tab.id); } catch (e) { }
                }
                if (hiddenWindow) {
                    try { chrome.windows.remove(hiddenWindow.id); } catch (e) { }
                }
            };

            try {
                console.log(`[CodePlay] Fetching problem: ${url}`);

                // 1. Check Cache first
                const cached = await new Promise(r => chrome.storage.local.get([url], r));
                if (cached[url]) {
                    console.log(`[CodePlay] Cache HIT for ${url}`);
                    sendResponse({ success: true, html: cached[url] });
                    return;
                }

                console.log(`[CodePlay] Cache MISS - Opening Tab for ${url}...`);

                // 2. Create hidden window for stealth scraping
                try {
                    hiddenWindow = await chrome.windows.create({
                        url: 'about:blank',
                        type: 'popup',
                        state: 'minimized',
                        width: 1,
                        height: 1,
                        left: -1000,
                        top: -1000,
                        focused: false
                    });
                    console.log(`[CodePlay] Created hidden window: ${hiddenWindow.id}`);
                } catch (e) {
                    console.log('[CodePlay] Could not create hidden window, using background tab');
                }

                // 3. Open Tab in hidden window or background
                if (hiddenWindow) {
                    tab = await chrome.tabs.create({ url: url, windowId: hiddenWindow.id, active: false });
                } else {
                    tab = await chrome.tabs.create({ url: url, active: false });
                }
                console.log(`[CodePlay] Created tab: ${tab.id}`);

                // 4. Wait for tab to complete loading first
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error("Tab load timeout"));
                    }, 30000);

                    const onUpdated = (tabId, changeInfo) => {
                        if (tabId === tab.id && changeInfo.status === "complete") {
                            chrome.tabs.onUpdated.removeListener(onUpdated);
                            clearTimeout(timeout);
                            resolve();
                        }
                    };

                    chrome.tabs.onUpdated.addListener(onUpdated);

                    // Check if already complete
                    chrome.tabs.get(tab.id, (t) => {
                        if (t && t.status === "complete") {
                            chrome.tabs.onUpdated.removeListener(onUpdated);
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                });

                console.log(`[CodePlay] Tab loaded, waiting for content script...`);

                // 5. Small delay to ensure content script is injected
                await new Promise(r => setTimeout(r, 500));

                // 6. Scrape with retries
                const scrapeResult = await new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 40; // 20 seconds max

                    const tryScape = () => {
                        attempts++;
                        if (attempts > maxAttempts) {
                            reject(new Error("Content script not responding after " + maxAttempts + " attempts"));
                            return;
                        }

                        chrome.tabs.sendMessage(tab.id, { type: "CODEPLAY_SCRAPE_CURRENT_TAB" }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.log(`[CodePlay] Scrape attempt ${attempts}: ${chrome.runtime.lastError.message}`);
                                setTimeout(tryScape, 500);
                                return;
                            }
                            if (response && response.success) {
                                console.log(`[CodePlay] Scrape SUCCESS on attempt ${attempts}`);
                                resolve(response.html);
                            } else {
                                setTimeout(tryScape, 500);
                            }
                        });
                    };

                    tryScape();
                });

                // 7. Cleanup
                cleanup();

                // 8. Verify & Cache
                const html = scrapeResult;
                if (html.length < 500 && !html.trim().startsWith('{')) {
                    throw new Error("Content Blocked (Cloudflare/Short Response)");
                }

                console.log(`[CodePlay] Successfully scraped ${url} (${html.length} bytes)`);
                chrome.storage.local.set({ [url]: html });
                sendResponse({ success: true, html });

            } catch (err) {
                console.error("[CodePlay] Tab Scrape Error:", err);
                cleanup();
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    if (message.type === "GET_CODEFORCES_HANDLE") {
        (async () => {
            try {
                const res = await fetch("https://codeforces.com");
                const html = await res.text();
                if (!html.includes("/logout")) throw new Error("Not logged in to Codeforces");
                const match = html.match(/href="\/profile\/([^"]+)"[^>]*>[^<]+<\/a>\s*\|\s*<a[^>]*logout/i);
                if (match && match[1]) {
                    sendResponse({ success: true, handle: match[1] });
                } else {
                    throw new Error("Could not find handle in header");
                }
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    if (message.type === "FETCH_LEETCODE_PROBLEM") {
        const { titleSlug } = message.payload;
        (async () => {
            try {
                const query = `
                    query getQuestionDetail($titleSlug: String!) {
                        question(titleSlug: $titleSlug) {
                            questionId
                            title
                            content
                            difficulty
                            exampleTestcases
                            topicTags { name }
                            codeSnippets { lang, code }
                        }
                    }
                `;

                const res = await fetch("https://leetcode.com/graphql", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        query,
                        variables: { titleSlug }
                    }),
                    credentials: 'include'
                });

                const data = await res.json();
                sendResponse({ success: true, data: data.data.question });
            } catch (err) {
                console.error("LC Fetch Error", err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    // --- INTEGRATING OFFSCREEN PARSING (Feature 1 & 3) ---
    if (message.type === "PARSE_HTML_OFFSCREEN") {
        (async () => {
            // CHECK: If chrome.offscreen is available (Chrome), use it.
            // If not (Firefox), try direct DOMParser (allowed in Firefox Background Scripts).
            if (chrome.offscreen) {
                await setupOffscreenDocument('offscreen.html');
                chrome.runtime.sendMessage({
                    type: 'PARSE_CODEFORCES_HTML',
                    target: 'offscreen',
                    data: message.payload
                }, (response) => {
                    sendResponse(response);
                });
            } else {
                // FALLBACK: Firefox Background Script (has DOM access)
                try {
                    const { html } = message.payload;
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // Robust CSRF extraction (Same logic as offscreen.js)
                    let csrfToken = null;
                    const metaCsrf = doc.querySelector('meta[name="csrf-token"]');
                    const inputCsrf = doc.querySelector('input[name="csrf_token"]');
                    const dataCsrf = doc.querySelector('[data-csrf]');

                    if (inputCsrf) csrfToken = inputCsrf.value;
                    else if (metaCsrf) csrfToken = metaCsrf.content;
                    else if (dataCsrf) csrfToken = dataCsrf.getAttribute('data-csrf');

                    sendResponse({
                        success: true,
                        csrfToken,
                        title: doc.title
                    });
                } catch (e) {
                    sendResponse({ success: false, error: "Direct Parsing Failed: " + e.message });
                }
            }
        })();
        return true;
    }
});


