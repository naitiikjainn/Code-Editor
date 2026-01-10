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
                // RULE 1: CSES Origin Spoofing (Fixes 500 Error)
                {
                    "id": 1,
                    "priority": 1,
                    "action": {
                        "type": "modifyHeaders",
                        "requestHeaders": [
                            { "header": "Origin", "operation": "set", "value": "https://cses.fi" },
                            { "header": "Referer", "operation": "set", "value": "https://cses.fi/" }
                        ]
                    },
                    "condition": {
                        "urlFilter": "cses.fi",
                        "resourceTypes": ["xmlhttprequest"]
                    }
                },
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
                } else {
                    sendResponse({ success: false, error: "Submission failed. Check if you are logged in or already submitted." });
                }
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    // CODEFORCES DEBUG FETCH (Now w/ STEALTH HEADERS + CREDENTIALS)
    if (message.type === "FETCH_CODEFORCES_PROBLEM") {
        const { url } = message.payload;
        (async () => {
            try {
                console.log(`[CodePlay] Fetching Codeforces Problem: ${url}`);

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
    }

    // --- CSES SUBMISSION LOGIC (HEADLESS w/ STEALTH HEADERS) ---
    if (message.type === "CODEPLAY_SUBMIT_CSES") {
        const { problemId, code } = message.payload;
        (async () => {
            try {
                const submitPageUrl = `https://cses.fi/problemset/submit/${problemId}/`;
                const pageRes = await fetch(submitPageUrl, { credentials: 'include' });
                if (!pageRes.ok) throw new Error("Failed to fetch submit page (Check Connection/Login)");
                const pageText = await pageRes.text();

                // 1. ROBUST FORM FINDER
                const allForms = pageText.match(/<form[\s\S]+?<\/form>/gi) || [];
                let formContent = "";
                let actionUrl = "";

                // Find the specific task submission form
                for (const f of allForms) {
                    if (f.match(/name=["']task["']/i) && (f.includes('type="file"') || f.includes("type='file'"))) {
                        formContent = f;
                        const actionMatch = f.match(/action=["']([^"']+)["']/i);
                        if (actionMatch) actionUrl = actionMatch[1];
                        break;
                    }
                }

                if (!formContent) throw new Error("Could not find submission form content.");

                // Resolve Action URL
                let postUrl = submitPageUrl;
                if (actionUrl) {
                    postUrl = new URL(actionUrl, submitPageUrl).href;
                }

                const formData = new FormData();

                // 2. Scrape INPUTS
                const inputRegex = /<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"/gi;
                let match;
                while ((match = inputRegex.exec(formContent)) !== null) {
                    const name = match[1];
                    const value = match[2];
                    if (name !== 'file') {
                        formData.append(name, value);
                    }
                }

                // 3. MINING C++ VERSION FROM JS SOURCE
                let cppOptionVal = "C++20";
                let langVal = "C++";

                const looseArrayMatch = pageText.match(/\[[^\]]*"C\+\+[^"']*"[^\]]*\]/);
                if (looseArrayMatch) {
                    const params = looseArrayMatch[0];
                    if (params.includes("C++20")) cppOptionVal = "C++20";
                    else if (params.includes("C++17")) cppOptionVal = "C++17";
                    else if (params.includes("C++11")) cppOptionVal = "C++11";
                    else {
                        const first = params.match(/"([^"]+)"/);
                        if (first) cppOptionVal = first[1];
                    }
                }

                formData.append("lang", langVal);
                formData.append("option", cppOptionVal);

                // 4. File Input
                const fileInputMatch = formContent.match(/<input[^>]*type="file"[^>]*name="([^"]+)"/i);
                const fileInputName = fileInputMatch ? fileInputMatch[1] : "file";

                const file = new File([code], "solution.cpp", { type: "text/plain" });
                formData.append(fileInputName, file);

                // 5. Submit Button 
                const submitBtnMatch = formContent.match(/<(?:input|button)[^>]*type="submit"[^>]*name="([^"]+)"/i);
                if (submitBtnMatch) {
                    const btnName = submitBtnMatch[1];
                    formData.append(btnName, "Submit");
                } else {
                    formData.append("submit", "Submit");
                }

                // 6. CSRF
                if (!formData.has('csrf_token')) {
                    const csrfMatch = pageText.match(/name="csrf_token" value="([^"]+)"/);
                    if (csrfMatch) formData.append('csrf_token', csrfMatch[1]);
                }

                // Clean keys
                if (formData.has('type')) formData.delete('type');
                if (formData.has('target')) formData.delete('target');

                // 7. Submit 
                // Using credentials: 'include' + DeclarativeNetRequest spoofed headers
                const submitRes = await fetch(postUrl, {
                    method: "POST",
                    body: formData,
                    credentials: 'include'
                });

                if (submitRes.redirected || submitRes.ok) {
                    const resultUrl = submitRes.url;

                    // Polling Logic
                    let verdict = "Queued";
                    try {
                        const resultRes = await fetch(resultUrl, { credentials: 'include' });
                        const resultText = await resultRes.text();

                        if (resultText.includes("Compilation Error")) verdict = "Compilation Error";
                        else if (resultText.includes("ACCEPTED") || resultText.includes("class=\"accepted\"")) verdict = "ACCEPTED";
                        else if (resultText.includes("WRONG ANSWER")) verdict = "WRONG ANSWER";
                        else if (resultText.includes("TIME LIMIT")) verdict = "TLE";
                        else if (resultText.includes("TESTING")) verdict = "TESTING...";
                        else {
                            const statusMatch = resultText.match(/<span[^>]*class=["']task-score[^"']*["']>([^<]+)<\/span>/i);
                            if (statusMatch) verdict = statusMatch[1];
                        }
                    } catch (e) {
                        // ignore
                    }

                    sendResponse({
                        success: true,
                        message: `Submitted! Verdict: ${verdict}`,
                        verdict: verdict,
                        resultUrl: resultUrl
                    });
                } else {
                    const resText = await submitRes.text();
                    const errorMatch = resText.match(/<ul class="error"><li>(.*?)<\/li><\/ul>/s);
                    let errorMsg = errorMatch ? errorMatch[1].replace(/<[^>]+>/g, '').trim() : "";

                    if (!errorMsg) {
                        const titleMatch = resText.match(/<title>(.*?)<\/title>/);
                        const pageTitle = titleMatch ? titleMatch[1] : `Status: ${submitRes.status}`;
                        // Simple error summary
                        errorMsg = `CSES Blocked? Page: ${pageTitle} (Check Console)`;
                    }

                    console.error("[CodePlay] CSES Error:", errorMsg);
                    sendResponse({ success: false, error: errorMsg });
                }

            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }
});
