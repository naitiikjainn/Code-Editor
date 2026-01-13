export const fetchViaExtension = (url) => {
    return new Promise((resolve, reject) => {
        // We communicate with the Content Script via window.postMessage
        // The Content Script then talks to the Background script.

        const handler = (event) => {
            // Check for response from Content Script
            if (event.data && event.data.type === "CODEPLAY_CF_HTML_RESULT") {
                // Determine if this response corresponds to OUR request? 
                // Currently the protocol is global, so we might receive responses for other inputs if concurrent.
                // But for now, we assume sequential or we can check the URL if the response includes it.
                // Looking at CP31Browser: it just checks the type.

                // Ideally we should match an ID, but let's stick to the existing working pattern.
                // Note: The screenshot error happened because we tried chrome.runtime. 
                // Now we are safely using window events.

                window.removeEventListener("message", handler);

                if (event.data.payload && event.data.payload.success) {
                    resolve(event.data.payload.html);
                } else {
                    reject(new Error(event.data.payload?.error || "Extension returned error"));
                }
            }
        };

        window.addEventListener("message", handler);

        // Timeout safety
        const timeoutId = setTimeout(() => {
            window.removeEventListener("message", handler);
            reject(new Error("Timeout: Extension did not respond. Make sure you are on a page where the extension is active (or localhost)."));
        }, 10000);

        // Send request to Content Script
        window.postMessage({
            type: "CODEPLAY_FETCH_CF_HTML",
            payload: { url: url }
        }, "*");
    });
};
