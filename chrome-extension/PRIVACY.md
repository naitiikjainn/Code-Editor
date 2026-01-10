# Privacy Policy for CodePlay Helper

**Last Updated:** January 10, 2026

## 1. Data Collection
CodePlay Helper ("the Extension") does **not** collect, store, or transmit any personal user data to external servers managed by the Extension developers, except as described below for functionality.

## 2. Permissions & Usage
The Extension requires specific permissions to function:
- **Cookies**: Accessed only for `leetcode.com` to retrieve your session token (`LEETCODE_SESSION`) and CSRF token. These are sent **only** to the CodePlay Editor application (running locally or at `code-editor-phi-two.vercel.app`) to enable solving problems. They are never sent to third parties.
- **Header Modification**: Used solely to bypass CORS restrictions for `cses.fi` and spoof User-Agent for `codeforces.com` to enable problem fetching.
- **ActiveTab/Scripting**: Used to communicate with the CodePlay Editor web page.

## 3. Data Storage
All data (such as cookies) is processed in your browser's memory and passed directly to your CodePlay Editor instance. The Extension itself does not persist personal data.

## 4. Third-Party Services
The Extension interacts with:
- **Codeforces**: To fetch problems and submit solutions.
- **LeetCode**: To sync session data.
- **CSES**: To submit solutions.
Your interactions with these platforms are subject to their respective privacy policies.

## 5. Contact
For questions, please contact the developer via the GitHub repository.
