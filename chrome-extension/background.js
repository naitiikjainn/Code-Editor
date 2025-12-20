// Background Service Worker
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

        return true; // Keep channel open for async response
    }
});
