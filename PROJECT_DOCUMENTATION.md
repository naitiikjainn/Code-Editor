# 🚀 AI Code Editor - Complete Project Documentation

A collaborative, real-time coding platform designed for competitive programmers. This document explains everything about how the project works.

---

## 📁 Project Structure Overview

```
AI-Code-Editor/
├── backend/           # Node.js + Express API Server
├── frontend/          # React (Vite) Web Application
└── chrome-extension/  # Browser extension for Codeforces scraping
```

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Code Editor  │  │   Problem    │  │  Whiteboard  │  │  AI Assistant    │  │
│  │   (Monaco)   │  │   Browser    │  │   (Canvas)   │  │    Panel         │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                                              │
│  Real-time Sync: Yjs (CRDT) + y-websocket                                   │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  REST API    │  │  Socket.IO   │  │  WebSocket   │
│  (Express)   │  │  (Chat/Room) │  │  (Yjs Sync)  │
└──────────────┘  └──────────────┘  └──────────────┘
          │               │               │
          └───────────────┼───────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js + Express)                          │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Auth     │  │   Problems  │  │    Code     │  │     AI      │        │
│  │   (JWT)     │  │  (Scrapers) │  │ (Execution) │  │  (Gemini)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Files    │  │    Rooms    │  │    Share    │  │  Profiles   │        │
│  │   (CRUD)    │  │ (Collab)    │  │  (Snippets) │  │   (Users)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   MongoDB    │      │    Redis     │      │ External APIs│
│  (Database)  │      │   (Cache)    │      │ (CF, LC, etc)│
└──────────────┘      └──────────────┘      └──────────────┘
```

---

## 🔌 Backend Components

### 1. Main Server (`backend/index.js`)

The entry point that sets up:
- **Express HTTP Server** on port 5000
- **Socket.IO Server** for real-time chat & room events
- **WebSocket Server (Yjs)** for real-time code synchronization
- **Global Error Handlers** to prevent crashes
- **Rate Limiting** on authentication routes
- **CORS Configuration** for allowed origins

```javascript
// Server handles 3 types of connections:
1. HTTP REST API calls      → Regular Express routes
2. Socket.IO connections    → Chat, room management, voice chat
3. WebSocket (Yjs)          → Real-time code collaboration
```

### 2. Database Connection (`backend/db.js`)

Connects to MongoDB using Mongoose. The connection string is in `.env`:
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### 3. Redis Cache (`backend/config/redis.js`)

Redis is used for caching problem data with a 2-day TTL (Time To Live):
```javascript
redis.setex(`problem:${problemId}`, 172800, JSON.stringify(data));
```

---

## 📡 API Routes Explained

### 🔐 Authentication (`/api/auth`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/register` | POST | Create new user account |
| `/login` | POST | Login & get JWT token |
| `/me` | GET | Get current user (requires token) |
| `/forgot-password` | POST | Send password reset email |
| `/reset-password` | POST | Reset password with token |

**How JWT Authentication Works:**
1. User logs in with email/password
2. Server validates credentials against MongoDB
3. Server generates JWT token (valid 7 days)
4. Client stores token in localStorage
5. Client sends token in `x-auth-token` header for protected routes

```javascript
// Token generation
const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '7d' });
```

---

### 🎯 Problems (`/api/problems`)

This is the most complex route, handling multiple competitive programming platforms:

#### Codeforces Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/codeforces/list` | GET | Get all 1100+ Codeforces problems |
| `/codeforces/:contestId/:index` | GET | Get specific problem (e.g., `/2184/F`) |
| `/codeforces/editorial/:contestId` | GET | Get contest editorial/tutorial |
| `/codeforces/user/:handle` | GET | Get user's solved problems |
| `/codeforces/status/:handle` | GET | Get user's submission history |
| `/codeforces/blog/:blogId` | GET | Proxy for blog API |

**Editorial Fetching Flow (The Complex Part):**

```
1. User requests editorial for contest 2184F
                    │
                    ▼
2. Get round number: contestId 2184 → Round 1072
   (via codeforces.com/api/contest.list)
                    │
                    ▼
3. Search for editorial blog:
   a) First try recentActions API (fast, last 100 actions)
   b) If not found, use Puppeteer to search Codeforces
                    │
                    ▼
4. Found blog ID 150033 ("Codeforces Round 1072 Editorial")
                    │
                    ▼
5. Scrape blog content with Puppeteer
   (Codeforces has Cloudflare protection)
                    │
                    ▼
6. Extract problem-specific section using regex:
   - Find <p><a href="/contest/2184/problem/F">
   - Extract until next problem section
                    │
                    ▼
7. Return both full content AND problemSection
```

#### LeetCode Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/leetcode/:slug` | GET | Get problem by slug or number |

**How it works:**
1. If slug is a number (e.g., "1"), first search for the actual slug ("two-sum")
2. Query LeetCode's GraphQL API
3. Return problem with all code snippets for different languages

#### CSES Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/cses/list` | GET | Get all problems grouped by category |
| `/cses/problem/:id` | GET | Get specific problem |

#### AtCoder Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/atcoder/:contestId/:taskId` | GET | Get specific problem |

---

### 💻 Code Execution (`/api/code`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/execute` | POST | Run code via Piston API |

**How Code Execution Works:**
1. Frontend sends code, language, and input
2. Backend maps language to Piston API format:
   - `cpp` → `c++` version `10.2.0`
   - `java` → `java` version `15.0.2`
   - `python` → `python` version `3.10.0`
   - `javascript` → `javascript` version `18.15.0`
3. Backend calls Piston API (https://emkc.org/api/v2/piston/execute)
4. Returns stdout/stderr output

```javascript
// Piston API Request
{
    language: "c++",
    version: "10.2.0",
    files: [{ content: userCode }],
    stdin: userInput
}
```

---

### 🤖 AI Assistant (`/api/ai`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/assist` | POST | Get AI coding help |

**How it works:**
1. Uses Google Gemini 2.0 Flash model
2. System prompt configures it as a competitive programming expert
3. User sends their code + question
4. AI responds with explanations, hints, or optimizations

```javascript
// System prompt sets the AI's personality
"You are an expert competitive programming assistant. 
Help with algorithm explanations, time complexity analysis, 
and code optimization. Give hints, not full solutions."
```

---

### 👥 Rooms & Collaboration (`/api/rooms`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/create` | POST | Create collaborative room |
| `/:roomId` | GET | Get room information |

**How Real-time Collaboration Works:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLLABORATION SYSTEM                         │
│                                                                 │
│  ┌─────────────┐    Code Sync    ┌─────────────┐               │
│  │   User A    │◄───────────────►│   User B    │               │
│  │  (Editor)   │                 │  (Editor)   │               │
│  └──────┬──────┘                 └──────┬──────┘               │
│         │                               │                       │
│         │     Yjs CRDT Documents        │                       │
│         └───────────┬───────────────────┘                       │
│                     │                                           │
│                     ▼                                           │
│         ┌───────────────────────┐                               │
│         │   y-websocket Server  │                               │
│         │   (Port 5000 /codeplay-*)                            │
│         └───────────────────────┘                               │
│                                                                 │
│  ┌─────────────┐   Chat/Voice    ┌─────────────┐               │
│  │   User A    │◄───────────────►│   User B    │               │
│  │  (Socket)   │                 │  (Socket)   │               │
│  └──────┬──────┘                 └──────┬──────┘               │
│         │                               │                       │
│         │     Socket.IO Events          │                       │
│         └───────────┬───────────────────┘                       │
│                     │                                           │
│                     ▼                                           │
│         ┌───────────────────────┐                               │
│         │   Socket.IO Server    │                               │
│         │   (Port 5000 /socket.io/)                            │
│         └───────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

**Two Separate Real-time Systems:**

1. **Yjs + y-websocket** (Code Synchronization)
   - Uses CRDT (Conflict-free Replicated Data Types)
   - Handles cursor positions, text changes
   - WebSocket URL: `ws://localhost:5000/codeplay-{roomId}`

2. **Socket.IO** (Chat & Room Management)
   - Handles join requests, access control
   - Whiteboard synchronization
   - Voice chat signaling (WebRTC)
   - Problem state synchronization

---

### 📁 Files (`/api/files`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Get all files for a room |
| `/` | POST | Create new file |
| `/:id` | PUT | Update file content |
| `/:id` | DELETE | Delete file |

Files are stored in MongoDB with roomId association.

---

### 🔗 Code Sharing (`/api/share`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generate` | POST | Save code, get unique ID |
| `/:id` | GET | Retrieve shared code |

Generates 8-character unique IDs using nanoid.

---

### 👤 Profiles (`/api/profile`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/me` | GET | Get my profile (auth required) |
| `/` | PUT | Update profile (auth required) |
| `/:username` | GET | Get public profile |

Stores competitive programming handles (Codeforces, LeetCode, GitHub, etc.)

---

### 📊 Submissions (`/api/submissions`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | Save submission |
| `/my` | GET | Get my submissions |
| `/user/:userId` | GET | Get user's submissions |
| `/:id` | GET | Get single submission |

---

## 🔄 Socket.IO Events

### Room Management Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_room` | Client→Server | Request to join a room |
| `access_granted` | Server→Client | Access approved |
| `access_denied` | Server→Client | Access denied |
| `request_entry` | Server→Host | New user wants to join |
| `grant_access` | Host→Server | Approve user |
| `deny_access` | Host→Server | Reject user |
| `room_users` | Server→All | Updated user list |

### Whiteboard Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `draw_line` | Bidirectional | Draw a line |
| `draw_text` | Bidirectional | Add text |
| `clear_board` | Bidirectional | Clear whiteboard |
| `wb_view` | Bidirectional | Sync pan/zoom |
| `wb_cursor` | Bidirectional | Share cursor position |

### Voice Chat Events (WebRTC Signaling)

| Event | Direction | Description |
|-------|-----------|-------------|
| `voice-join-request` | Client→Server | Join voice chat |
| `voice-new-peer` | Server→Others | New voice participant |
| `voice-existing-users` | Server→Client | Current voice users |
| `voice-signal` | Peer→Peer | WebRTC signaling |
| `voice-leave` | Client→Server | Leave voice chat |

### Problem Sync Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `sync_problem` | Bidirectional | Share currently viewed problem |
| `request_problem_state` | Client→Server | Request current problem |
| `sync_run_trigger` | Client→Server | Someone ran code |
| `sync_run_result` | Client→Server | Share code output |

---

## 🗄️ Database Models

### User Model
```javascript
{
    email: String,        // Unique
    username: String,     // Unique
    password: String,     // bcrypt hashed
    bio: String,
    handles: {
        codeforces: String,
        leetcode: String,
        github: String,
        linkedin: String,
        codechef: String
    },
    resetToken: String,
    resetTokenExpiry: Date
}
```

### Room Model
```javascript
{
    roomId: String,       // Unique identifier
    host: {
        username: String
    },
    participants: [{
        username: String
    }],
    activeProblem: Object // Currently synced problem
}
```

### File Model
```javascript
{
    roomId: String,
    name: String,
    content: String,
    language: String
}
```

### Problem Model (Cache)
```javascript
{
    problemId: String,    // e.g., "2184F"
    data: Object,         // Full problem data
    lastAccessed: Date    // TTL tracking
}
```

### SharedCode Model
```javascript
{
    uniqueId: String,     // 8-char ID
    code: String,
    language: String
}
```

### Submission Model
```javascript
{
    userId: ObjectId,
    problemId: String,
    problemName: String,
    platform: String,
    code: String,
    language: String,
    verdict: String,
    visibility: String,
    createdAt: Date
}
```

---

## 🌐 Frontend Components

### Main Components

| Component | Purpose |
|-----------|---------|
| `Workspace.jsx` | Main layout with panels |
| `CodeEditor.jsx` | Monaco editor with Yjs sync |
| `ProblemBrowser.jsx` | Browse/search problems |
| `ProblemPreview.jsx` | Display problem description |
| `CP31Browser.jsx` | Specialized Codeforces 3.1 sheet |
| `ConsolePanel.jsx` | Code output display |
| `TestPanel.jsx` | Run test cases |
| `Whiteboard.jsx` | Collaborative whiteboard |
| `AIPanel.jsx` | AI assistant interface |
| `FileExplorer.jsx` | File tree sidebar |
| `ParticipantsPanel.jsx` | Room users list |
| `Sidebar.jsx` | Navigation sidebar |

### Supporting Components

| Component | Purpose |
|-----------|---------|
| `AuthModal.jsx` | Login/Register popup |
| `SettingsModal.jsx` | User preferences |
| `ShareModal.jsx` | Code sharing dialog |
| `ProfilePage.jsx` | User profile view |
| `Dashboard.jsx` | Home dashboard |

---

## 🔒 Security Features

1. **Password Hashing**: bcrypt with salt rounds
2. **JWT Tokens**: 7-day expiry, stored in x-auth-token header
3. **Rate Limiting**: 5 requests/minute on auth routes
4. **Input Validation**: String sanitization, length limits
5. **CORS**: Restricted to trusted origins
6. **JSON Body Limit**: 1MB max to prevent DoS

---

## 🚀 Deployment

### Environment Variables (.env)

```env
# Required
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-super-secret-key

# Optional
PORT=5000
GEMINI_API_KEY=your-gemini-api-key
REDIS_URL=redis://...
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Running Locally

```bash
# Backend
cd backend
npm install
node index.js

# Frontend
cd frontend
npm install
npm run dev
```

### Production Deployment

- **Backend**: Render.com (Node.js)
- **Frontend**: Vercel (React/Vite)
- **Database**: MongoDB Atlas
- **Cache**: Redis Cloud (optional)

---

## 📚 External Services Used

| Service | Purpose | Rate Limits |
|---------|---------|-------------|
| Codeforces API | Problems, users, contests | ~5 req/sec |
| LeetCode GraphQL | Problem data | Varies |
| Piston API | Code execution | 200 req/min |
| Google Gemini | AI assistance | 60 req/min |
| CSES.fi | Problem scraping | Reasonable use |
| AtCoder | Problem scraping | Reasonable use |

---

## 🎯 User Flows

### Flow 1: Solving a Codeforces Problem

```
1. User opens Problem Browser
2. Selects Codeforces tab
3. Searches for problem (e.g., "2184F")
4. Frontend calls: GET /api/problems/codeforces/2184/F
5. Backend checks Redis cache
6. If not cached, scrapes from Codeforces
7. Returns problem with description, examples, constraints
8. User reads problem in ProblemPreview
9. Writes code in CodeEditor
10. Clicks "Run" → POST /api/code/execute
11. Sees output in ConsolePanel
12. Can click "Tutorial" → GET /api/problems/codeforces/editorial/2184?problem=F
13. Views tutorial in expandable spoilers
```

### Flow 2: Collaborative Coding Session

```
1. Host creates room (POST /api/rooms/create)
2. Host shares room URL: yoursite.com/room/my-room
3. Guest opens URL, connects via Socket.IO
4. Guest emits "join_room" event
5. Host receives "request_entry" event
6. Host clicks "Allow" → emits "grant_access"
7. Guest receives "access_granted"
8. Both connect to Yjs WebSocket (/codeplay-my-room)
9. Code changes sync automatically via CRDT
10. Whiteboard draws sync via Socket.IO
11. Voice chat uses WebRTC peer-to-peer
```

### Flow 3: Getting AI Help

```
1. User writes code in editor
2. Clicks AI button in toolbar
3. Opens AIPanel
4. Types question: "Why is this TLE?"
5. Clicks Send → POST /api/ai/assist
6. Backend calls Gemini API with:
   - System prompt (CP expert)
   - User's code
   - User's question
7. AI responds with optimization suggestions
8. User applies suggestions
```

---

## 🛠️ Chrome Extension

The extension scrapes Codeforces problems when Cloudflare blocks the backend:

```
1. Backend returns 404 for protected problem
2. Frontend sends message to extension
3. Extension opens offscreen page
4. Offscreen page fetches from Codeforces
5. Parses HTML, extracts problem data
6. Sends back to frontend
7. Frontend also caches via POST /api/problems/cache
```

---

## 📝 Postman Collection

Import `AI-Code-Editor.postman_collection.json` into Postman to test all APIs.

**Variables to set:**
- `baseUrl`: `http://localhost:5000`
- `authToken`: JWT token from login response

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test locally
5. Submit pull request

---

## 📄 License

MIT License - feel free to use and modify!

---

Made with ❤️ for competitive programmers
