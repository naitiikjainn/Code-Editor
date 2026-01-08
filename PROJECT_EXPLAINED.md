# 📘 How "CodePlay" Works (The Easy Guide)

Welcome to the **AI Code Editor** project! This document explains how everything connects, like a map of a building.

---

## 🏗️ The Big Picture

Imagine this application has two main parts, like a restaurant:
1.  **The Frontend (The Dining Area)**: What you see and interact with (Buttons, Text Editor, Panels).
2.  **The Backend (The Kitchen)**: Where the heavy lifting happens (Saving files, Running code, Talking to LeetCode).

They talk to each other using **API Requests** (like a waiter taking orders).

---

## 🚀 1. The Frontend (Your Interface)
**Location:** `/frontend/src`

This is built with **React**. Think of it as a set of Lego blocks (Components) put together.

### Key Files:
*   **`App.jsx`**: The main entrance. It decides which page to show (Login, Dashboard, or the Code Editor).
*   **`components/Dashboard.jsx`**: The first screen you see. It lists your "Rooms" (projects). When you click one, it sends you to the Workspace.
*   **`components/Workspace.jsx`** (THE BIG ONE): This is the main screen. It holds everything together:
    *   **Left Panel**: File Explorer (`Sidebar.jsx`).
    *   **Middle**: The Code Editor (`Editors.jsx`).
    *   **Right**: Problem Preview (`ProblemPreview.jsx`).
    *   It manages the **State**: "Which file is open?", "Is the console open?", "What are the test cases?".
*   **`components/Editors.jsx`**: This is the actual text box where you type code. It uses the Monaco Editor (the same engine VS Code uses).
*   **`utils/cppRunner.js`**: The magic helper that writes the `int main()` function for you when you do LeetCode problems.

---

## ⚙️ 2. The Backend (The Brain)
**Location:** `/backend`

This is built with **Node.js** and **Express**. It listens for commands from the Frontend.

### Key Files:
*   **`index.js`**: The boss. It starts the server and says "I'm ready to listen on port 5000".
*   **`routes/files.js`**: Handles file operations.
    *   "Frontend says: Save this!" -> `files.js` writes it to the database.
    *   "Frontend says: Give me the list of files!" -> `files.js` reads from the database.
*   **`routes/code.js`**: The execution engine.
    *   When you click "Run", the code is sent here.
    *   This file saves your code to a temporary file (e.g., `temp.cpp`), runs a command (e.g., `g++ temp.cpp`), and sends the output back.
*   **`routes/leettools.js`**: The bridge to LeetCode.
    *   Since your browser can't talk to LeetCode directly (security rules), the Frontend asks this file to do it.
    *   It takes your `cookie`, sends your code to LeetCode, waits for the result, and tells you if you Passed.

---

## 🔄 3. How Data Flows (The Stories)

### Story A: "I type code and it saves."
1.  You type in **`Editors.jsx`**.
2.  **`Workspace.jsx`** notices the change.
3.  It waits 1 second (Auto-Save Debounce) to make sure you stopped typing.
4.  It sends a "PUT" request to the Backend (`/api/files/save`).
5.  **`routes/files.js`** updates the database.

### Story B: "I click 'Submit to LeetCode'."
1.  You click the button in **`ProblemPreview.jsx`**.
2.  **`Workspace.jsx`** grabs your code and your cookies (from Settings).
3.  It sends a "POST" request to **`routes/leettools.js`**.
4.  The Backend forwards your code to **leetcode.com**.
5.  LeetCode grades it and sends the result back to the Backend.
6.  The Backend sends the result to **`Workspace.jsx`**, which shows the "Accepted" alert.

### Story C: "I use the Chrome Extension."
1.  You click "Auto-Fetch" in Settings.
2.  **`SettingsModal.jsx`** shouts: *"Hey, is there an extension?"*
3.  The **Chrome Extension (`content.js`)** hears it and asks the Browser for cookies.
4.  The Browser gives the cookies.
5.  The Extension passes them back to **`SettingsModal.jsx`**, which fills the inputs.

---

## 🛠️ Summary of Folders
*   `/frontend`: The React App (User Interface).
*   `/backend`: The Server (API & Logic).
*   `/chrome-extension`: The Helper tool for cookies.

Now you know the flow! We can build new features by just adding new "waiters" (Routes) and "buttons" (Components). 🚀
