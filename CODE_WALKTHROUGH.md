# 🧪 Deep Dive: Code Walkthrough
This document explains the **exact code** you are running, line-by-line (or block-by-block).

---

## 1. The Server Entry Point: `backend/index.js`
This file is the "Main" function of your backend. It starts the server, connects to the database, and sets up real-time communication.

### **Imports (Lines 1-22)**
```javascript
import express from "express";  // The web framework (handles URL routes).
import cors from "cors";        // Security: Allows the Frontend (port 5173) to talk to Backend (port 5000).
import dotenv from "dotenv";    // Loads secret keys (like DB passwords) from .env file.
import connectDB from "./db.js"; // Our custom function to connect to MongoDB.
import http from "http";        // Standard Node.js library to create a server.
import { Server as SocketIOServer } from "socket.io"; // Real-time chat/code sync engine.
import { WebSocketServer } from 'ws'; // Another real-time engine (specifically for Yjs collaboration).
import { createRequire } from 'module'; // Helper to use old "require" syntax for Y-websocket.
```

### **Setup (Lines 24-34)**
```javascript
dotenv.config(); // Reads the .env file.
connectDB();     // Connects to the database.

const app = express(); // Creates the Express App ("app").
app.use(express.json()); // Tells app to understand JSON data (e.g., { "name": "foo" }).
app.use(cors({ ... }));  // Enables CORS so the browser doesn't block requests.
```

### **Dual Server Setup (Lines 37-52)**
We need TWO types of real-time connections:
1.  **Socket.io**: For chat, room management, and code execution logs.
2.  **Yjs (WebSocket)**: For the "Google Docs" style real-time typing.

```javascript
const server = http.createServer(app); // Wraps Express in a standard HTTP server.

// 1. Socket.IO
const io = new SocketIOServer(server, { ... }); 

// 2. Yjs WebSocket
const wss = new WebSocketServer({ noServer: true }); 
// "noServer: true" means "Don't start yet, wait for us to traffic cop".
```

### **The "Traffic Cop" (Lines 55-77)**
When a browser tries to connect via WebSocket, this code decides who handles it.
```javascript
server.on('upgrade', (request, socket, head) => {
  const url = request.url;

  // If URL starts with "/codeplay-", it's a Collaboration session -> Send to Yjs.
  if (url.startsWith('/codeplay-')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
  // Otherwise, let Socket.io handle it automatically.
});
```

### **Routes (Lines 80-88)**
This maps URLs to specific files.
`app.use("/api/leettools", leetRoutes);` -> If URL is `/api/leettools`, go to `routes/leettools.js`.

---

## 2. The LeetCode Integration: `backend/routes/leettools.js`
This file allows us to submit code to LeetCode by acting as a "Proxy".

### **The Submit Route (Lines 8-81)**
`router.post("/submit", async (req, res) => { ... })`

#### **Step A: Validation (Lines 10-14)**
```javascript
const { slug, code, lang, cookie, csrfToken, questionId } = req.body;
// We check if the user provided cookies. If not, we stop.
if (!cookie || !csrfToken) return res.status(400)...
```

#### **Step B: Prepare Request (Lines 16-33)**
We pretend to be a real browser. LeetCode checks the `Referer` and `Origin` headers to prevent bots, so we fake them.
```javascript
const headers = {
    "Cookie": `LEETCODE_SESSION=${cookie}; csrftoken=${csrfToken}`,
    "Referer": `https://leetcode.com/problems/${slug}/`, // "I came from the problem page"
    // ...
};
```

#### **Step C: Send to LeetCode (Lines 36-46)**
```javascript
const submitRes = await fetch(submitUrl, ...); // Send the POST request.
const submitData = await submitRes.json();
const submissionId = submitData.submission_id; // Get the ID (e.g., 12345) to track status.
```

#### **Step D: Polling (Lines 54-69)**
LeetCode doesn't give the result immediately. It says "Pending". So we wait and check every 2 seconds.
```javascript
while (attempts < 10) {
    await new Promise(r => setTimeout(r, 2000)); // Sleep 2 seconds.
    const checkRes = await fetch(..., checkUrl); // Check status.
    if (data.state === "SUCCESS") { // If graded...
        result = data;
        break; // Stop waiting.
    }
}
```

---

## 3. The Frontend Core: `Workspace.jsx` (Summary)
This file is huge, but here is the logic flow:

### **State (Lines 40-84)**
We use `useState` to remember things:
*   `activeFile`: Which file is open?
*   `activeCode`: What is typed in the editor?
*   `testCases`: The list of inputs for testing.

```javascript
// Persistence Logic (Lines 47-57)
// When 'activeFile' changes, save it to localStorage so it stays after refresh.
useEffect(() => {
    localStorage.setItem("activeFileId", activeFile._id);
}, [activeFile]);
```

### **Auto-Runner Injection (Lines 278-287)**
When you click "Run", if it's a C++ LeetCode problem, we do magic:
```javascript
if (activeFile.language === "cpp" && code.includes("class Solution")) {
    // We call 'generateCppRunner' to wrap your class in a main() function.
    codeToRun = generateCppRunner(codeToRun, rightPanel.data);
}
```
This ensures `class Solution` can actually run locally!

---

## 4. The Chrome Extension: `content.js`
This script lives in your browser and bridges the gap.

```javascript
// Listen for messages from the React App (localhost:5173)
window.addEventListener("message", (event) => {
  if (event.data.type === "CODEPLAY_FETCH_COOKIES") {
    // If React asks for cookies, tell the Background Script to get them.
    chrome.runtime.sendMessage({ type: "GET_LEETCODE_COOKIES" }, ...);
  }
});
```

The **Background Script (`background.js`)** then calls `chrome.cookies.get(...)` because it has special permissions to read LeetCode.com cookies, and passes them back.
