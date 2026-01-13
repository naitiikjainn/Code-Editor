console.log("[CodePlay Helper] Content Script Loaded on:", window.location.href);

window.postMessage({ type: "CODEPLAY_EXTENSION_READY" }, "*");

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

    if (event.data.type === "CODEPLAY_FETCH_COOKIES") {
        console.log("[CodePlay Helper] Fetching Cookies...");
        safelySendMessage({ type: "GET_LEETCODE_COOKIES" }, (response) => {
            console.log("[CodePlay Helper] Cookie Response:", response);
            window.postMessage({ type: "CODEPLAY_COOKIES_RECEIVED", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_SUBMIT_CODEFORCES") {
        console.log("[CodePlay Helper] Submitting to Codeforces...", event.data.payload);
        safelySendMessage({ type: "SUBMIT_CODEFORCES", payload: event.data.payload }, (response) => {
            console.log("[CodePlay Helper] Codeforces Result:", response);
            window.postMessage({ type: "CODEPLAY_SUBMIT_RESULT", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_FETCH_CF_HTML") {
        safelySendMessage({ type: "FETCH_CODEFORCES_PROBLEM", payload: event.data.payload }, (response) => {
            window.postMessage({ type: "CODEPLAY_CF_HTML_RESULT", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_FETCH_CF_HANDLE") {
        console.log("[CodePlay Helper] Fetching Codeforces Handle...");
        safelySendMessage({ type: "GET_CODEFORCES_HANDLE" }, (response) => {
            window.postMessage({ type: "CODEPLAY_CF_HANDLE_RESULT", payload: response }, "*");
        });
    }
});

// --- NEW: DIRECT SCRAPING & SUBMIT FOR CODEFORCES TAB ---
if (window.location.hostname.includes("codeforces.com")) {

    // Scrape/Submit Listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

        // 1. Scrape HTML (For Problem Parsing)
        if (request.type === "CODEPLAY_SCRAPE_CURRENT_TAB") {
            console.log("[CodePlay Helper] Scraping requested by Background...");
            const html = document.documentElement.outerHTML;
            sendResponse({ success: true, html: html });
        }

        // 2. Perform Submit (For Submission)
        if (request.type === "CODEPLAY_PERFORM_SUBMIT") {
            console.log("[CodePlay Helper] Performing Tab-based Submission...");
            const { contestId, problemIndex, code, languageId } = request.payload;

            // Find CSRF Token (try meta first, then data-csrf)
            let csrfToken = "";
            const meta = document.querySelector('meta[name="X-Csrf-Token"]');
            if (meta) csrfToken = meta.content;

            if (!csrfToken) {
                const match = document.body.innerHTML.match(/data-csrf='([^']+)'/);
                if (match) csrfToken = match[1];
            }

            if (!csrfToken) {
                sendResponse({ success: false, error: "Could not find CSRF token. Are you logged in?" });
                return true; // async
            }

            // Prepare FormData
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

            fetch(`https://codeforces.com/contest/${contestId}/submit?csrf_token=${csrfToken}`, {
                method: "POST",
                body: formData
            })
                .then(res => {
                    if (res.redirected && res.url.includes("/my")) {
                        sendResponse({ success: true, message: "Submission queued!" });
                    } else {
                        sendResponse({ success: false, error: "Submission failed. Check if you are logged in or already submitted." });
                    }
                })
                .catch(err => {
                    sendResponse({ success: false, error: err.message });
                });

            return true; // Keep channel open
        }
    });
}
