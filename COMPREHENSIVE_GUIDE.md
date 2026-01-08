# 📚 The Ultimate CodePlay Documentation
**Author:** Antigravity AI  
**Version:** 1.0  

This document explains **every single file** in the project, deeply and clearly. It is designed for someone who wants to understand the entire codebase from scratch.

---

# 🏗️ Part 1: Project Structure
The project is split into three distinct parts:
1.  **Backend (`/backend`)**: The "Brain". Runs on Node.js (Port 5000). Handles database, code execution, and LeetCode.
2.  **Frontend (`/frontend`)**: The "Face". Runs on React (Port 5173). The interface you see.
3.  **Chrome Extension (`/chrome-extension`)**: The "Bridge". A tiny tool to get cookies from LeetCode.com.

---

# 🧠 Part 2: The Backend (`/backend`)

## 1. `index.js` (The Entry Point)
This is the **Main Server File**. It starts everything.
*   **Lines 1-22 (Imports):** We import `express` (web server), `socket.io` (chat), `ws` (collaboration), and `mongoose` (database).
*   **Lines 37-44 (Dual Server):** We modify the standard HTTP server to support TWO real-time protocols at once:
    *   `Socket.io`: Used for chatrooms, running tests, and logs.
    *   `WebSocketServer (ws)`: Used specifically for **Yjs**, which is the library that powers the "Google Docs" style collaborative typing.
*   **Lines 55-77 (The "Traffic Cop"):** This `server.on('upgrade')` block allows both protocols to coexist.
    *   If the URL starts with `/codeplay-`, it sends traffic to Yjs.
    *   Otherwise, it lets Socket.io handle it.
*   **lines 80-88 (Routes):** We tell the app: "If a request starts with `/api/auth`, go look at `routes/auth.js`". This organizes our code.
*   **Lines 95-237 (Socket.io Logic):** This handles the "Rooms":
    *   `join_room`: Adds a user to a room. Checks if they are the Host or a Guest.
    *   `grant_access` / `deny_access`: The Host's remote control for guests.
    *   `sync_run_trigger`: When one user clicks Run, it tells everyone else "Hey, I'm running code!".

## 2. `db.js` (Database Connection)
A simple helper file.
*   **Function `connectDB()`**: Uses `mongoose.connect(process.env.MONGO_URI)` to dial the MongoDB database. It prints "MongoDB Connected" if successful.

## 3. `models/` (Database Schemas)
These define what our data looks like.
*   **`User.js`**: `username`, `email`, `password` (hashed).
*   **`File.js`**: `name`, `content`, `language`, `roomId` (who owns it).
*   **`Room.js`**: `roomId`, `host`, `participants` (list of allowed users).

## 4. `routes/` (The API Endpoints)

### A. `routes/auth.js` (Authentication)
*   **POST `/register`**: Checks if email exists -> Hashes password (bcrypt) -> Saves new User.
*   **POST `/login`**: Finds user -> Checks password -> Generates a **JWT Token** (a digital ID card).
*   **POST `/forgot-password`**: Generates a random token -> Saves it to user -> Sends email via `nodemailer` (Gmail).

### B. `routes/files.js` (File Manager)
*   **GET `/`**: Finds all files with `roomId` matching the query.
*   **POST `/`**: Creates a new file (e.g., `main.cpp`).
*   **PUT `/:id`**: **Autosave**. Updates the `content` of a file. Called every time you stop typing for 1 second.
*   **DELETE `/:id`**: permanently deletes a file.

### C. `routes/code.js` (The Runner)
*   **POST `/execute`**:
    *   Accepts `{ language, code, stdin }`.
    *   It sends this data to an external API called **Piston** (`emkc.org`).
    *   Piston runs the code safely (in a sandbox) and returns the output.
    *   **Why Piston?** Running C++ locally on your server is dangerous (someone could delete your files!). Piston handles the safety.

### D. `routes/leettools.js` (LeetCode Proxy)
*   **POST `/submit`**:
    *   Accepts `{ code, slug, cookie, csrfToken }`.
    *   **Crucial Step:** It creates a fake request headers (`Referer: leetcode.com`) to trick LeetCode into thinking it's a browser.
    *   It sends the submission.
    *   **Polling Loop:** LeetCode says "Pending" at first. This file waits 2 seconds, checks again, waits 2 seconds... until it gets "Accepted" or "Wrong Answer".

### E. `routes/problems.js` (Problem Fetcher)
*   **GET `/leetcode/:slug`**: Uses a **GraphQL** query to fetch problem details (Description, Examples, Snippets) from LeetCode.
*   **GET `/codeforces/:contest/:id`**: **Scrapes** the HTML of Codeforces.com.
    *   It looks for `<div class="input"><pre>...</pre>` to extract test cases.
    *   It cleans up the HTML text to be readable.

---

# 💻 Part 3: The Frontend (`/frontend`)

## 1. `App.jsx` (The Router)
*   It sets up the URL paths:
    *   `/` -> `Dashboard.jsx` (The selection screen).
    *   `/editor/:id` -> `Workspace.jsx` (The main app).
    *   `/reset-password` -> `ResetPasswordPage.jsx`.

## 2. `components/Workspace.jsx` (The Core)
This is the biggest file (900+ lines). It connects everything.

### **State (The Memory)**
*   `activeFile`: The file currently open in the editor.
*   `activeCode`: The text inside the editor.
*   `testCases`: The list of inputs (for CP/LeetCode).
*   `rightPanel`: Logic for the split-screen (Problem Preview).

### **Key Functions**
*   **`fetchFiles()`**: Asks backend for file list. Automatically restores the last open file from `localStorage`.
*   **`handleRun()`**:
    *   If it's C++, checks for `class Solution`.
    *   If found, calls **`generateCppRunner`** to inject the `main()` function.
    *   Sends code to `/api/code/execute`.
*   **`handleCodeNow(problem)`**:
    *   Gets the problem details.
    *   Finds the C++ snippet (`class Solution ...`).
    *   Parses the **Examples** to create Test Cases automatically.
    *   Opens the problem in the Right Panel.

## 3. `components/Editors.jsx` (The Text Editor)
*   Wrapper around `@monaco-editor/react`.
*   Connects to **Yjs** (via `y-monaco`) to allow multiple people to type at the same time.

## 4. `utils/cppRunner.js` (The Auto-Runner)
*   **`generateCppRunner(userCode, problem)`**:
    *   This is a string manipulation function.
    *   It looks at your function: `vector<int> twoSum(...)`.
    *   It generates a corresponding `int main()` that:
        1. Reads input from `cin`.
        2. Parses it (e.g. `[1,2,3]` -> `vector<int>`).
        3. Calls `twoSum`.
        4. Prints the result.
    *   This is why you don't need to write `main()` yourself!

---

# 🌉 Part 4: The Chrome Extension (`/chrome-extension`)

## 1. `manifest.json`
*   The ID card of the extension.
*   **Permissions**: Requests access to `cookies` and `leetcode.com`.
*   **Host Permissions**: Allows it to talk to `localhost:5173`.

## 2. `content.js`
*   Runs on your website (`localhost:5173`).
*   Listens for a message: `"CODEPLAY_FETCH_COOKIES"`.
*   When heard, it forwards the request to the backend script.

## 3. `background.js`
*   Runs in the background of Chrome.
*   Receives the request from `content.js`.
*   Calls `chrome.cookies.get({ url: "https://leetcode.com", name: "LEETCODE_SESSION" })`.
*   Sends the cookie back to `content.js`, which gives it to your React App.

---

# 🚀 Flow Summary (How it all connects)

1.  **You open the app**: `App.jsx` loads `Dashboard`.
2.  **You join a room**: `Workspace.jsx` loads. Socket connects to `index.js`.
3.  **You pick a problem**: `ProblemBrowser` fetches it via `routes/problems.js`.
4.  **You click "Code Now"**:
    *   `Workspace` parses the snippet.
    *   Creates a file via `routes/files.js`.
    *   Sets up test cases.
5.  **You type code**:
    *   `Editors.jsx` syncs keystrokes via Yjs (`index.js`).
    *   `useDebounce` triggers Autosave to `routes/files.js`.
6.  **You click Run**:
    *   `cppRunner.js` wraps your code.
    *   `routes/code.js` sends it to Piston.
    *   Result is shown in `ConsolePanel`.
7.  **You click Submit**:
    *   Chrome Extension fetches cookies.
    *   `routes/leettools.js` proxies the submission to LeetCode.

This is CodePlay. Every file has a specific purpose, working together like a clock! 🕰️
