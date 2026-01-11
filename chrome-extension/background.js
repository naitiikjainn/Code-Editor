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
            addRules: [

                // RULE 2: Codeforces User-Agent Spoofing (Fixes Cloudflare/Description Block)
                {
                    "id": 2,
                    "priority": 1,
                    "action": {
                        "type": "modifyHeaders",
                        "requestHeaders": [
                            { "header": "User-Agent", "operation": "set", "value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
                        ]
                    },
                    "condition": {
                        "urlFilter": "codeforces.com",
                        "resourceTypes": ["xmlhttprequest"]
                    }
                }
            ],
            removeRuleIds: [1, 2] // Reset rules to avoid duplicates
        });
        console.log("Stealth Mode Rules Updated (CSES + Codeforces)");
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
        (async () => {
            // ... Codeforces logic (unchanged) ...
            try {
                const submitPageUrl = `https://codeforces.com/contest/${contestId}/submit`;
                const pageRes = await fetch(submitPageUrl);
                const pageText = await pageRes.text();
                const csrfMatch = pageText.match(/data-csrf='([^']+)'/);
                if (!csrfMatch) throw new Error("Could not find CSRF token. Are you logged in?");
                const csrfToken = csrfMatch[1];
                const formData = new FormData();
                formData.append("csrf_token", csrfToken);
                formData.append("ftaa", "");
                formData.append("bfaa", "");
                formData.append("action", "submitSolution");
                formData.append("contestId", contestId);
                formData.append("submittedProblemIndex", problemIndex);
                formData.append("programTypeId", languageId || "54");
                formData.append("source", code);
                formData.append("tabSize", "4");
                formData.append("_tta", "594");
                const submitRes = await fetch(`${submitPageUrl}?csrf_token=${csrfToken}`, {
                    method: "POST",
                    body: formData
                });
                if (submitRes.redirected && submitRes.url.includes("/my")) {
                    sendResponse({ success: true, message: "Submission queued!" });

                    // --- START BACKGROUND POLLING (Feature 1: Notifications) ---
                    pollVerdict(contestId, problemIndex, languageId);

                } else {
                    sendResponse({ success: false, error: "Submission failed. Check if you are logged in or already submitted." });
                }
            } catch (err) {
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

    // CODEFORCES DEBUG FETCH (Now w/ STEALTH HEADERS + CREDENTIALS)
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

                console.log(`[CodePlay] Cache MISS for ${url}. Fetching...`);
                const res = await fetch(url, {
                    credentials: 'include', // Send cookies to look like logged-in user
                    // User-Agent is handled by DeclarativeNetRequest Rule #2
                });

                if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
                const html = await res.text();

                // Verify content sanity
                if (html.length < 500) {
                    // Likely a block verification page (Cloudflare)
                    console.error("CodePlay: Content too short:", html);
                    throw new Error("Content Blocked (Cloudflare/Short Response)");
                }

                if (html.includes("Just a moment...") || html.includes("Checking your browser")) {
                    throw new Error("Cloudflare Blocked Request (Try opening CF in a tab first)");
                }

                // 2. Save to Cache
                chrome.storage.local.set({ [url]: html });
                sendResponse({ success: true, html });
            } catch (err) {
                console.error("[CodePlay] CF Fetch Error:", err);
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


