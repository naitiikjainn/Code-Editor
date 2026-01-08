// Content Script - Runs on localhost:5173
console.log("[CodePlay Helper] Extension active.");

// 1. Announce presence to the web app
window.postMessage({ type: "CODEPLAY_EXTENSION_READY" }, "*");

// 2. Listen for requests from the React App
window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data.type === "CODEPLAY_FETCH_COOKIES") {
        console.log("[CodePlay Helper] Received fetch request...");

        // Ask Background Script to get cookies
        chrome.runtime.sendMessage({ type: "GET_LEETCODE_COOKIES" }, (response) => {
            console.log("[CodePlay Helper] Got response from background:", response);

            // Send response back to React App
            window.postMessage({
                type: "CODEPLAY_COOKIES_RECEIVED",
                payload: response
            }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_SUBMIT_CODEFORCES") {
        console.log("[CodePlay Helper] Received CF Submit request...");
        chrome.runtime.sendMessage({
            type: "SUBMIT_CODEFORCES",
            payload: event.data.payload
        }, (response) => {
            window.postMessage({
                type: "CODEPLAY_SUBMIT_RESULT",
                payload: response
            }, "*");
        });
    }
    if (event.data.type === "CODEPLAY_FETCH_CF_HTML") {
        chrome.runtime.sendMessage({
            type: "FETCH_CODEFORCES_PROBLEM",
            payload: event.data.payload
        }, (response) => {
            window.postMessage({
                type: "CODEPLAY_CF_HTML_RESULT",
                payload: response
            }, "*");
        });
    }
});
