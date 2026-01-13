// Check if extension is available
export const isExtensionReady = () => {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 2000);
        
        const handler = (event) => {
            if (event.data.type === "CODEPLAY_EXTENSION_READY") {
                clearTimeout(timeout);
                window.removeEventListener("message", handler);
                resolve(true);
            }
        };
        
        window.addEventListener("message", handler);
        
        // Also check if we already received the ready signal
        if (window.__CODEPLAY_EXTENSION_READY) {
            clearTimeout(timeout);
            resolve(true);
        }
    });
};

// Mark extension as ready when message received
window.addEventListener("message", (event) => {
    if (event.data.type === "CODEPLAY_EXTENSION_READY") {
        window.__CODEPLAY_EXTENSION_READY = true;
    }
});

// Submit to Codeforces via extension
export const submitToCodeforces = (contestId, problemIndex, code, languageId) => {
    return new Promise((resolve, reject) => {
        const handler = (event) => {
            if (event.data.type === "CODEPLAY_SUBMIT_RESULT") {
                window.removeEventListener("message", handler);
                clearTimeout(timeoutId);
                
                if (event.data.payload?.success) {
                    resolve(event.data.payload);
                } else {
                    reject(new Error(event.data.payload?.error || "Submission failed"));
                }
            }
        };
        
        window.addEventListener("message", handler);
        
        const timeoutId = setTimeout(() => {
            window.removeEventListener("message", handler);
            reject(new Error("Submission timeout. Make sure CodePlay extension is installed and enabled."));
        }, 60000); // 60 second timeout for submission
        
        window.postMessage({
            type: "CODEPLAY_SUBMIT_CODEFORCES",
            payload: { contestId, problemIndex, code, languageId }
        }, "*");
    });
};

// Check Codeforces login status
export const checkCodeforcesLogin = () => {
    return new Promise((resolve, reject) => {
        const handler = (event) => {
            if (event.data.type === "CODEPLAY_CF_LOGIN_STATUS") {
                window.removeEventListener("message", handler);
                clearTimeout(timeoutId);
                resolve(event.data.payload);
            }
        };
        
        window.addEventListener("message", handler);
        
        const timeoutId = setTimeout(() => {
            window.removeEventListener("message", handler);
            reject(new Error("Login check timeout"));
        }, 10000);
        
        window.postMessage({ type: "CODEPLAY_CHECK_CF_LOGIN" }, "*");
    });
};

// Get Codeforces handle
export const getCodeforcesHandle = () => {
    return new Promise((resolve, reject) => {
        const handler = (event) => {
            if (event.data.type === "CODEPLAY_CF_HANDLE_RESULT") {
                window.removeEventListener("message", handler);
                clearTimeout(timeoutId);
                
                if (event.data.payload?.success) {
                    resolve(event.data.payload.handle);
                } else {
                    reject(new Error(event.data.payload?.error || "Could not get handle"));
                }
            }
        };
        
        window.addEventListener("message", handler);
        
        const timeoutId = setTimeout(() => {
            window.removeEventListener("message", handler);
            reject(new Error("Handle fetch timeout"));
        }, 10000);
        
        window.postMessage({ type: "CODEPLAY_FETCH_CF_HANDLE" }, "*");
    });
};

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
