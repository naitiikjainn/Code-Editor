console.log("[CodePlay Helper] Content Script Loaded on:", window.location.href);

// Broadcast ready signal multiple times to ensure detection
window.postMessage({ type: "CODEPLAY_EXTENSION_READY" }, "*");
setTimeout(() => window.postMessage({ type: "CODEPLAY_EXTENSION_READY" }, "*"), 100);
setTimeout(() => window.postMessage({ type: "CODEPLAY_EXTENSION_READY" }, "*"), 500);

// Helper to safely send messages
function safelySendMessage(message, responseCallback) {
    try {
        if (!chrome.runtime?.id) {
            throw new Error("Extension context invalidated. Please refresh the page.");
        }
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error("[CodePlay Helper] Runtime Error:", chrome.runtime.lastError.message);
                if (chrome.runtime.lastError.message.includes("Extension context invalidated")) {
                    alert("CodePlay Extension Updated! Please refresh this page.");
                }
                responseCallback({ success: false, error: chrome.runtime.lastError.message });
            } else {
                responseCallback(response);
            }
        });
    } catch (e) {
        console.error("[CodePlay Helper] Context Error:", e.message);
        alert("CodePlay Extension Updated! Please refresh this page to reconnect.");
        responseCallback({ success: false, error: e.message });
    }
}

window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data.type && event.data.type.startsWith("CODEPLAY_")) {
        console.log("[CodePlay Helper] Received Message:", event.data);
    }

    // Handle ping - respond immediately to confirm extension is alive
    if (event.data.type === "CODEPLAY_PING_EXTENSION") {
        window.postMessage({ type: "CODEPLAY_EXTENSION_READY" }, "*");
        return;
    }

    if (event.data.type === "CODEPLAY_FETCH_COOKIES") {
        console.log("[CodePlay Helper] Fetching Cookies...");
        safelySendMessage({ type: "GET_LEETCODE_COOKIES" }, (response) => {
            console.log("[CodePlay Helper] Cookie Response:", response);
            window.postMessage({ type: "CODEPLAY_COOKIES_RECEIVED", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_SUBMIT_CODEFORCES") {
        const payload = event.data.payload;
        console.log("[CodePlay Helper] Submitting to Codeforces...");
        console.log("[CodePlay Helper] Code length:", payload.code?.length);
        console.log("[CodePlay Helper] Code preview:", payload.code?.substring(0, 100));
        safelySendMessage({ type: "SUBMIT_CODEFORCES", payload: payload }, (response) => {
            console.log("[CodePlay Helper] Codeforces Result:", response);
            window.postMessage({ type: "CODEPLAY_SUBMIT_RESULT", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_FETCH_CF_HTML") {
        console.log("[CodePlay Helper] Fetching CF HTML for:", event.data.payload?.url);
        safelySendMessage({ type: "FETCH_CODEFORCES_PROBLEM", payload: event.data.payload }, (response) => {
            console.log("[CodePlay Helper] CF HTML Result received, success:", response?.success);
            window.postMessage({ type: "CODEPLAY_CF_HTML_RESULT", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_FETCH_CF_HANDLE") {
        console.log("[CodePlay Helper] Fetching Codeforces Handle...");
        safelySendMessage({ type: "GET_CODEFORCES_HANDLE" }, (response) => {
            window.postMessage({ type: "CODEPLAY_CF_HANDLE_RESULT", payload: response }, "*");
        });
    }

    // NEW: Check login status
    if (event.data.type === "CODEPLAY_CHECK_CF_LOGIN") {
        console.log("[CodePlay Helper] Checking Codeforces Login...");
        safelySendMessage({ type: "CHECK_CF_LOGIN" }, (response) => {
            window.postMessage({ type: "CODEPLAY_CF_LOGIN_STATUS", payload: response }, "*");
        });
    }
});

// --- CODEFORCES TAB HANDLING ---
if (window.location.hostname.includes("codeforces.com")) {

    // Scrape/Submit Listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

        // 1. Scrape HTML (For Problem Parsing)
        if (request.type === "CODEPLAY_SCRAPE_CURRENT_TAB") {
            console.log("[CodePlay Helper] Scraping requested by Background...");
            const html = document.documentElement.outerHTML;
            sendResponse({ success: true, html: html });
            return true;
        }

        // 2. Perform Submit (For Submission)
        if (request.type === "CODEPLAY_PERFORM_SUBMIT") {
            console.log("[CodePlay Helper] Performing Tab-based Submission...");
            const { contestId, problemIndex, code, languageId } = request.payload;

            // Find CSRF Token using multiple methods
            let csrfToken = "";

            // Method 1: Meta tag
            const meta = document.querySelector('meta[name="X-Csrf-Token"]');
            if (meta) {
                csrfToken = meta.content;
                console.log("[CodePlay] Found CSRF via meta tag");
            }

            // Method 2: Window.Codeforces object
            if (!csrfToken && typeof window.Codeforces !== 'undefined' && window.Codeforces.getCsrfToken) {
                try {
                    csrfToken = window.Codeforces.getCsrfToken();
                    console.log("[CodePlay] Found CSRF via Codeforces object");
                } catch (e) { }
            }

            // Method 3: Data attribute in body/script
            if (!csrfToken) {
                const patterns = [
                    /data-csrf=['"]([^'"]+)['"]/,
                    /csrf_token['"]?\s*[:=]\s*['"]([^'"]+)['"]/,
                    /"X-Csrf-Token"\s*:\s*"([^"]+)"/
                ];
                for (const pattern of patterns) {
                    const match = document.body.innerHTML.match(pattern);
                    if (match) {
                        csrfToken = match[1];
                        console.log("[CodePlay] Found CSRF via pattern");
                        break;
                    }
                }
            }

            // Method 4: Hidden input field
            if (!csrfToken) {
                const hiddenInput = document.querySelector('input[name="csrf_token"]');
                if (hiddenInput) {
                    csrfToken = hiddenInput.value;
                    console.log("[CodePlay] Found CSRF via hidden input");
                }
            }

            if (!csrfToken) {
                console.error("[CodePlay] CSRF token not found!");
                sendResponse({ success: false, error: "Could not find CSRF token. Make sure you're logged in to Codeforces." });
                return true;
            }

            console.log("[CodePlay] Using CSRF token:", csrfToken.substring(0, 10) + "...");

            // Generate fingerprints (required by Codeforces)
            const generateFingerprint = () => {
                const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
                let result = '';
                for (let i = 0; i < 32; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            };

            // Add a unique timestamp comment to prevent duplicate detection
            // This ensures each submission is treated as unique by Codeforces
            const timestamp = Date.now();
            let uniqueCode = code;

            // Add language-appropriate comment at the end
            const langId = languageId || "54";
            if (["54", "52", "50", "43", "61", "65"].includes(langId)) {
                // C/C++/Java - use // comment
                uniqueCode = code.trimEnd() + `\n// CodePlay ${timestamp}\n`;
            } else if (["31", "40", "41", "7", "70"].includes(langId)) {
                // Python - use # comment  
                uniqueCode = code.trimEnd() + `\n# CodePlay ${timestamp}\n`;
            } else if (["34"].includes(langId)) {
                // JavaScript - use // comment
                uniqueCode = code.trimEnd() + `\n// CodePlay ${timestamp}\n`;
            } else {
                // Generic - try // comment
                uniqueCode = code.trimEnd() + `\n// CodePlay ${timestamp}\n`;
            }

            console.log("[CodePlay] Added timestamp:", timestamp);

            // Prepare FormData
            const formData = new FormData();
            formData.append("csrf_token", csrfToken);
            formData.append("ftaa", generateFingerprint());
            formData.append("bfaa", generateFingerprint());
            formData.append("action", "submitSolution");
            formData.append("contestId", contestId);
            formData.append("submittedProblemIndex", problemIndex);
            formData.append("programTypeId", languageId || "54");
            formData.append("source", uniqueCode);
            formData.append("tabSize", "4");
            formData.append("_tta", Math.floor(Math.random() * 1000).toString());
            formData.append("sourceCodeConfirmed", "true");

            // Try contest submit URL first, then problemset
            const submitUrls = [
                `https://codeforces.com/contest/${contestId}/submit`,
                `https://codeforces.com/problemset/submit`
            ];

            const trySubmit = async (urlIndex) => {
                if (urlIndex >= submitUrls.length) {
                    sendResponse({ success: false, error: "All submit URLs failed" });
                    return;
                }

                const url = submitUrls[urlIndex];
                console.log(`[CodePlay] Trying submit to: ${url}`);

                try {
                    const res = await fetch(url, {
                        method: "POST",
                        body: formData,
                        credentials: 'include',
                        redirect: 'follow'
                    });

                    const responseUrl = res.url;
                    const responseText = await res.text();

                    console.log("[CodePlay] Submit response URL:", responseUrl);
                    console.log("[CodePlay] Submit response status:", res.status);

                    // Check for success indicators
                    if (responseUrl.includes("/my") || responseUrl.includes("/status")) {
                        sendResponse({ success: true, message: "Submission queued successfully!" });
                        return;
                    }

                    // Check response text for errors
                    if (responseText.includes("You have submitted exactly the same code before")) {
                        sendResponse({ success: false, error: "Duplicate submission: You've submitted this exact code before." });
                        return;
                    }

                    if (responseText.includes("Submit interval is too small")) {
                        sendResponse({ success: false, error: "Please wait before submitting again (rate limited)." });
                        return;
                    }

                    if (responseText.includes("You are not allowed")) {
                        sendResponse({ success: false, error: "You are not registered for this contest. Please register first." });
                        return;
                    }

                    if (responseText.includes("You must be logged in")) {
                        sendResponse({ success: false, error: "Not logged in to Codeforces. Please log in first." });
                        return;
                    }

                    // Check if we ended up on the problem page (submission may have failed)
                    if (responseText.includes("problem-statement") && !responseUrl.includes("/my")) {
                        trySubmit(urlIndex + 1);
                        return;
                    }

                    // If we see the submit form again, it means submission failed
                    if (responseText.includes('name="submitSolution"') || responseText.includes('programTypeId')) {
                        const errorMatch = responseText.match(/<span class="error[^"]*">([^<]+)<\/span>/);
                        if (errorMatch) {
                            sendResponse({ success: false, error: errorMatch[1] });
                            return;
                        }
                        trySubmit(urlIndex + 1);
                        return;
                    }

                    // Default: assume success if no obvious error
                    sendResponse({ success: true, message: "Submission sent (check Codeforces for status)" });

                } catch (err) {
                    console.error("[CodePlay] Submit fetch error:", err);
                    trySubmit(urlIndex + 1);
                }
            };

            trySubmit(0);
            return true; // Keep channel open for async response
        }

        // 3. Check if logged in
        if (request.type === "CODEPLAY_CHECK_LOGIN") {
            const isLoggedIn = document.body.innerHTML.includes("/logout") ||
                document.querySelector('a[href*="/logout"]') !== null;
            const handleMatch = document.body.innerHTML.match(/href="\/profile\/([^"]+)"/);
            sendResponse({
                success: true,
                loggedIn: isLoggedIn,
                handle: handleMatch ? handleMatch[1] : null
            });
            return true;
        }
    });
}
