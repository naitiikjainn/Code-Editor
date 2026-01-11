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
