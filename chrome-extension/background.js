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
        const submitUrl = `https://codeforces.com/contest/${contestId}/submit`;

        (async () => {
            try {
                // 1. Open Tab (Inactive)
                console.log(`[CodePlay] Opening Submit Tab for ${contestId}${problemIndex}...`);
                const tab = await chrome.tabs.create({ url: submitUrl, active: false });

                // 2. Wait for Load & Submit
                const submitResult = await new Promise((resolve, reject) => {
                    let attempts = 0;
                    const interval = setInterval(() => {
                        attempts++;
                        if (attempts > 40) { // 20s
                            clearInterval(interval);
                            reject(new Error("Submit Page Timeout"));
                            return;
                        }

                        // Send "PERFORM_SUBMIT"
                        chrome.tabs.sendMessage(tab.id, {
                            type: "CODEPLAY_PERFORM_SUBMIT",
                            payload: { contestId, problemIndex, code, languageId }
                        }, (response) => {
                            if (chrome.runtime.lastError) return; // Script not ready

                            if (response) {
                                clearInterval(interval);
                                resolve(response);
                            }
                        });
                    }, 500);
                });

                // 3. Close Tab
                chrome.tabs.remove(tab.id);

                // 4. Handle Result
                if (submitResult.success) {
                    sendResponse({ success: true, message: "Submission queued!" });
                    // Start Polling (Feature 1)
                    pollVerdict(contestId, problemIndex, languageId);
                } else {
                    sendResponse({ success: false, error: submitResult.error });
                }

            } catch (err) {
                console.error("[CodePlay] Submit Error:", err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    // POLL FUNCTION (Outside listener scope or helper)
    async function pollVerdict(contestId, index, langId) {
        // 1. Get Handle
        let handle = "";
        try {
            const res = await fetch("https://codeforces.com");
            const html = await res.text();
            const match = html.match(/href="\/profile\/([^"]+)"/);
            if (match) handle = match[1];
        } catch (e) { return; }

        if (!handle) return;

        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts > 40) clearInterval(interval); // Stop after 2 mins

            try {
                const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=5`);
                const data = await res.json();
                if (data.status === "OK") {
                    const submission = data.result.find(s => s.contestId == contestId && s.problem.index == index);

                    if (submission && submission.verdict !== "TESTING") {
                        clearInterval(interval);

                        // NOTIFY USER
                        const icon = submission.verdict === "OK" ? "✅" : "❌";
                        const title = `${icon} ${submission.verdict === "OK" ? "Accepted" : submission.verdict}`;
                        const msg = `Problem ${contestId}${index} on test ${submission.passedTestCount + 1}\nTime: ${submission.timeConsumedMillis}ms`;

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
                // ignore network errors
            }
        }, 3000);
    }

    // CODEFORCES TAB SCRAPER (Reliable Bypass for Cloudflare 403)
    if (message.type === "FETCH_CODEFORCES_PROBLEM") {
        const { url } = message.payload;
        (async () => {
            try {
                // 1. Check Cache
                const cached = await new Promise(r => chrome.storage.local.get([url], r));
                if (cached[url]) {
                    console.log(`[CodePlay] Cache HIT for ${url}`);
                    sendResponse({ success: true, html: cached[url] });
                    return;
                }

                console.log(`[CodePlay] Opening Tab for ${url}...`);

                // 2. Open Tab (Inactive/Minimized)
                const tab = await chrome.tabs.create({ url: url, active: false });

                // 3. Wait for Load & Scrape
                const scrapeResult = await new Promise((resolve, reject) => {
                    let attempts = 0;

                    const interval = setInterval(() => {
                        attempts++;
                        if (attempts > 30) {
                            clearInterval(interval);
                            reject(new Error("Tab Load Timeout"));
                            return;
                        }

                        chrome.tabs.sendMessage(tab.id, { type: "CODEPLAY_SCRAPE_CURRENT_TAB" }, (response) => {
                            if (chrome.runtime.lastError) return;
                            if (response && response.success) {
                                clearInterval(interval);
                                resolve(response.html);
                            }
                        });
                    }, 500);
                });

                // 4. Close Tab
                chrome.tabs.remove(tab.id);

                // 5. Verify & Cache
                const html = scrapeResult;
                if (html.length < 500 && !html.trim().startsWith('{')) {
                    throw new Error("Content Blocked (Cloudflare/Short Response)");
                }

                chrome.storage.local.set({ [url]: html });
                sendResponse({ success: true, html });

            } catch (err) {
                console.error("[CodePlay] Tab Scrape Error:", err);
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
            await setupOffscreenDocument('offscreen.html');
            chrome.runtime.sendMessage({
                type: 'PARSE_CODEFORCES_HTML',
                target: 'offscreen',
                data: message.payload
            }, (response) => {
                sendResponse(response);
            });
        })();
        return true;
    }
});


