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

    if (message.type === "SUBMIT_CODEFORCES") {
        const { contestId, problemIndex, code, languageId } = message.payload;

        (async () => {
            try {
                // 1. Get CSRF Token from Submit Page
                const submitPageUrl = `https://codeforces.com/contest/${contestId}/submit`;
                const pageRes = await fetch(submitPageUrl);
                const pageText = await pageRes.text();

                const csrfMatch = pageText.match(/data-csrf='([^']+)'/);
                if (!csrfMatch) throw new Error("Could not find CSRF token. Are you logged in?");
                const csrfToken = csrfMatch[1];

                // 2. Submit
                const formData = new FormData();
                formData.append("csrf_token", csrfToken);
                formData.append("ftaa", ""); // Anti-bot?
                formData.append("bfaa", "");
                formData.append("action", "submitSolution");
                formData.append("contestId", contestId);
                formData.append("submittedProblemIndex", problemIndex);
                formData.append("programTypeId", languageId || "54"); // 54 = C++17
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
                    // Parse error from page?
                    sendResponse({ success: false, error: "Submission failed. Check if you are logged in or already submitted." });
                }

            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true;
    }
    if (message.type === "FETCH_CODEFORCES_PROBLEM") {
        const { url } = message.payload;
        (async () => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to fetch");
                const html = await res.text();
                sendResponse({ success: true, html });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }
});
