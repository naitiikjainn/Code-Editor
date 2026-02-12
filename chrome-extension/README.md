# CodePlay Helper - Chrome Extension

This extension enables the CodePlay Editor to:
1.  **Sync LeetCode Sessions**: Solves problems as "You".
2.  **Submit to Codeforces/CSES**: Bridges the editor with competitive programming platforms.
3.  **Bypass CORS**: Fetches problem statements that are normally blocked.

## 📦 How to Publish (for Developer)
1.  **Zip the Folder**: Compress the contents of this `chrome-extension` folder (including `manifest.json`, `background.js`, `content.js`, `popup.html`, `icon128.png`) into a `.zip` file.
2.  **Chrome Web Store**:
    - Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/dev/dashboard).
    - Click "New Item".
    - Upload the `.zip` file.
    - Fill in the Store Listing (Title, Description, Screenshots).
3.  **Privacy Policy**: Paste the link to `PRIVACY.md` (host it on GitHub or a Gist) in the privacy field.

## 🛠️ How to Install (Manual/Developer Mode)
1.  Open Chrome and go to `chrome://extensions`.
2.  Enable **Developer mode** (top right).
3.  Click **Load unpacked**.
4.  Select this `chrome-extension` folder.
