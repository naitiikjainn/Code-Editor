# How to Upload "CodePlay Helper" to Firefox

## 1. Prepare Your Extension
Firefox requires a specific `manifest.json`. We have created a `manifest-firefox.json` for you.

1.  Open the `chrome-extension` folder.
2.  **Rename** `manifest.json` to something else (e.g., `manifest-chrome.json`).
3.  **Rename** `manifest-firefox.json` to `manifest.json`.
    *   *Note: When you want to use Chrome again, swap these names back.*

## 2. Test Locally in Firefox
Before uploading, verify it works:
1.  Open Firefox and type `about:debugging` in the address bar.
2.  Click **"This Firefox"** on the left sidebar.
3.  Click **"Load Temporary Add-on..."**.
4.  Navigate to your `chrome-extension` folder and select the `manifest.json` file.
5.  The extension should try to load. Test the features (Logging in, fetching problems).

## 3. Package the Extension
Firefox requires a `.zip` file containing your extension files.

1.  Select **all files** inside the `chrome-extension` folder:
    *   `manifest.json` (The Firefox one!)
    *   `background.js`
    *   `content.js`
    *   `popup.html`, `popup.js`
    *   `offscreen.html`, `offscreen.js` (Even if unused, keep them to avoid errors if referenced, or exclude them)
    *   `icon128.png`
2.  Right-click -> **Send to** -> **Compressed (zipped) folder**.
3.  Name it `codeplay-firefox.zip`.

## 4. Upload to Firefox Add-ons (AMO)
1.  Go to the [Firefox Developer Hub](https://addons.mozilla.org/en-US/developers/).
2.  Log in with a Firefox Account.
3.  Click **"Submit a New Add-on"**.
4.  **Distribution**: Choose "On this site" (for public listing) or "On your own" (if you just want a signed file to distribute yourself). usually "On this site".
5.  **Upload Version**: Upload your `codeplay-firefox.zip`.
    *   Firefox will run an automated validation.
    *   *If valid*: Click Continue.
    *   *If warnings*: Review them. Most warnings are okay. Errors must be fixed.
6.  **Source Code**: You usually don't need to submit source code unless you are using minified code (e.g., webpack). Your extension uses plain JS, so verify that if asked.
7.  **Metadata**: Fill in the Description, Category, etc.
8.  **Review**: Submit for review. It may take a few hours to a few days.

## Troubleshooting
- **"Manifest is not valid"**: Make sure you renamed `manifest-firefox.json` to `manifest.json`.
- **Background Script Errors**: Open the extension debugger in `about:debugging` to see logs.
