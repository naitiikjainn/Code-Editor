
// Listening for messages from background.js
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message, sender, sendResponse) {
    if (message.target !== 'offscreen') return;

    if (message.type === 'PARSE_CODEFORCES_HTML') {
        const { html } = message.data;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Robust CSRF extraction
            let csrfToken = null;
            const metaCsrf = doc.querySelector('meta[name="csrf-token"]');
            const inputCsrf = doc.querySelector('input[name="csrf_token"]');
            const dataCsrf = doc.querySelector('[data-csrf]');

            if (inputCsrf) csrfToken = inputCsrf.value;
            else if (metaCsrf) csrfToken = metaCsrf.content;
            else if (dataCsrf) csrfToken = dataCsrf.getAttribute('data-csrf');

            // Send back parsed data
            sendResponse({
                success: true,
                csrfToken,
                title: doc.title
            });
        } catch (e) {
            sendResponse({ success: false, error: e.message });
        }
        return true;
    }
}
