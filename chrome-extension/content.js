console.log("[CodePlay Helper] Content Script Loaded on:", window.location.href);

window.postMessage({ type: "CODEPLAY_EXTENSION_READY" }, "*");

window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data.type && event.data.type.startsWith("CODEPLAY_")) {
        console.log("[CodePlay Helper] Received Message:", event.data);
    }

    if (event.data.type === "CODEPLAY_FETCH_COOKIES") {
        console.log("[CodePlay Helper] Fetching Cookies...");
        chrome.runtime.sendMessage({ type: "GET_LEETCODE_COOKIES" }, (response) => {
            console.log("[CodePlay Helper] Cookie Response:", response);
            window.postMessage({ type: "CODEPLAY_COOKIES_RECEIVED", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_SUBMIT_CODEFORCES") {
        console.log("[CodePlay Helper] Submitting to Codeforces...", event.data.payload);
        chrome.runtime.sendMessage({ type: "SUBMIT_CODEFORCES", payload: event.data.payload }, (response) => {
            console.log("[CodePlay Helper] Codeforces Result:", response);
            window.postMessage({ type: "CODEPLAY_SUBMIT_RESULT", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_FETCH_CF_HTML") {
        chrome.runtime.sendMessage({ type: "FETCH_CODEFORCES_PROBLEM", payload: event.data.payload }, (response) => {
            window.postMessage({ type: "CODEPLAY_CF_HTML_RESULT", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_FETCH_CF_HANDLE") {
        console.log("[CodePlay Helper] Fetching Codeforces Handle...");
        chrome.runtime.sendMessage({ type: "GET_CODEFORCES_HANDLE" }, (response) => {
            window.postMessage({ type: "CODEPLAY_CF_HANDLE_RESULT", payload: response }, "*");
        });
    }

    if (event.data.type === "CODEPLAY_SUBMIT_CSES") {
        console.log("[CodePlay Helper] Submitting to CSES...", event.data.payload);
        chrome.runtime.sendMessage({ type: "CODEPLAY_SUBMIT_CSES", payload: event.data.payload }, (response) => {
            console.log("[CodePlay Helper] CSES Result:", response);
            window.postMessage({ type: "CODEPLAY_CSES_SUBMIT_RESULT", payload: response }, "*");
        });
    }
});
