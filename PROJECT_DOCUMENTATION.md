# CodePlay — Complete Project Documentation

> **Version:** 2.0 &nbsp;|&nbsp; **Last Updated:** February 2026 &nbsp;|&nbsp; **Status:** Production-Ready

---

## Table of Contents

1. [What Is CodePlay?](#1-what-is-codeplay)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack — Why Each Choice?](#3-tech-stack--why-each-choice)
4. [Project Structure](#4-project-structure)
5. [Backend Deep Dive](#5-backend-deep-dive)
6. [Frontend Deep Dive](#6-frontend-deep-dive)
7. [Browser Extensions](#7-browser-extensions)
8. [Real-Time Collaboration System](#8-real-time-collaboration-system)
9. [Authentication & Security](#9-authentication--security)
10. [Database Design](#10-database-design)
11. [External Services & Integrations](#11-external-services--integrations)
12. [Deployment & Infrastructure](#12-deployment--infrastructure)
13. [Environment Variables](#13-environment-variables)
14. [How to Run Locally](#14-how-to-run-locally)
15. [Common Questions & Design Decisions](#15-common-questions--design-decisions)

---

## 1. What Is CodePlay?

CodePlay is a **real-time collaborative code editor** purpose-built for competitive programming. Think of it as "Google Docs meets LeetCode meets VS Code" — you get:

- **Live collaboration** — Multiple people edit the same file simultaneously with cursor tracking (like Google Docs)
- **Built-in problem browser** — Browse problems from Codeforces, LeetCode, CSES, GeeksforGeeks, and AtCoder without leaving the editor
- **Direct submissions** — Submit code to LeetCode and Codeforces directly from the editor via browser extension
- **Code execution** — Run C++, Python, Java, and JavaScript code with custom test cases
- **AI assistant** — Get hints, explanations, and code reviews powered by Google Gemini
- **Voice chat** — Talk with collaborators via LiveKit-powered voice rooms
- **Problem sheets** — Striver's A2Z DSA Sheet and CP-31 Sheet built-in with progress tracking
- **User profiles** — Track your competitive programming stats across platforms

### Who Is It For?

Competitive programmers who want to:
- Practice with friends in real-time
- Have all their problem-solving tools in one place
- Track progress across multiple platforms
- Get AI help when stuck

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
├──────────────┬──────────────────┬───────────────────────────┤
│   React SPA  │ Chrome Extension │   Firefox Extension       │
│  (Vite PWA)  │ (Manifest V3)   │   (Manifest V2/V3)        │
└──────┬───────┴────────┬─────────┴──────────┬────────────────┘
       │ HTTPS          │ window.postMessage  │
       ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVER LAYER                          │
│                    Express 5 + Node.js                      │
├──────────────┬──────────────────┬───────────────────────────┤
│  REST API    │  Socket.IO       │  Yjs WebSocket            │
│  (13 route   │  (Real-time      │  (CRDT-based              │
│   modules)   │   events)        │   text sync)              │
└──────┬───────┴────────┬─────────┴──────────┬────────────────┘
       │                │                     │
       ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                             │
├──────────────────┬──────────────────────────────────────────┤
│   MongoDB 6.0    │   Redis 7.2                              │
│   (Primary DB)   │   (Cache + Sessions)                     │
└──────────────────┴──────────────────────────────────────────┘
       │
       ▼  (External APIs)
┌─────────────────────────────────────────────────────────────┐
│  Piston API │ LeetCode GraphQL │ Codeforces API │ Gemini AI │
│  (Code exec)│ (Problems)       │ (Problems)     │ (AI)      │
│  LiveKit    │ CSES Scraper     │ GFG Scraper    │ Gmail     │
└─────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

**Q: Why a monolithic backend instead of microservices?**  
A: For a project of this scale (~65 API endpoints), microservices add operational complexity (service discovery, inter-service communication, distributed tracing) without meaningful benefit. A well-organized monolith with clear module separation is simpler to deploy, debug, and maintain. The modular route structure (`routes/`, `middleware/`, `models/`) means you can extract a service later if needed.

**Q: Why separate WebSocket servers (Socket.IO + Yjs)?**  
A: They solve different problems. **Socket.IO** handles discrete events (user joined, run result, chat messages) — it's a pub/sub system. **Yjs** handles continuous text synchronization via CRDTs (Conflict-free Replicated Data Types) — it's a data structure sync protocol. Combining them into one would be architecturally wrong because text sync needs CRDT guarantees that Socket.IO doesn't provide.

---

## 3. Tech Stack — Why Each Choice?

### Backend

| Technology | Version | Purpose | Why Not an Alternative? |
|---|---|---|---|
| **Node.js** | 20+ | Runtime | Non-blocking I/O is ideal for a real-time app with WebSockets. Python/Django would block on concurrent connections. Go would work but has a smaller ecosystem for our needs. |
| **Express** | 5.2.1 | HTTP framework | Industry standard. Express 5 adds async error handling and better routing. Fastify is faster but has a smaller middleware ecosystem. Koa is too minimal. |
| **MongoDB** | 6.0 | Primary database | Document-oriented model is natural for our varied data shapes (problems, submissions, user profiles). PostgreSQL would require rigid schemas and complex JOINs for our nested data. TTL indexes auto-cleanup expired rooms/sessions. |
| **Mongoose** | 9.x | ODM | Schema validation + virtuals + middleware hooks. The native MongoDB driver works but has no schema enforcement, which is risky for a multi-model app. |
| **Redis** | 7.2 | Cache + Sessions | Sub-millisecond lookups for problem cache, rate limiting, and OAuth state tokens. In-memory fallback ensures the app works without Redis (degraded performance). |
| **Socket.IO** | 4.8.1 | Real-time events | Auto-reconnection, room management, binary support, and fallback to long-polling. Raw WebSockets lack reconnection logic and room abstractions. |
| **Yjs** | 1.5.4 | Text collaboration | CRDT-based conflict resolution — the gold standard for collaborative editing. OT (Operational Transformation) like Google Docs uses is harder to implement correctly and doesn't work offline. ShareDB is OT-based and more complex. |
| **Helmet** | 8.x | Security headers | Sets CSP, HSTS, X-Frame-Options, etc. in one line. Doing it manually is error-prone. |
| **JWT** | 9.x | Authentication | Stateless auth tokens. Session-based auth would require sticky sessions and server-side session stores, which complicate horizontal scaling. |
| **bcryptjs** | 3.x | Password hashing | Deliberately slow hash function to prevent brute force. SHA-256/MD5 are fast (bad for passwords). Argon2 is stronger but bcrypt is proven and sufficient. |
| **Piston API** | External | Code execution | Sandboxed multi-language execution without running user code on our server. Judge0 is an alternative but requires self-hosting. Piston is free and handles sandboxing. |
| **Google Gemini** | 2.5 Flash | AI assistant | Free tier, fast responses, good code understanding. OpenAI GPT-4 costs more. Claude is good but the API is less accessible. Gemini Flash is optimized for speed. |
| **LiveKit** | 2.x | Voice chat | Open-source, low-latency WebRTC SFU. Twilio/Agora are proprietary and expensive. Jitsi is heavier to self-host. |

### Frontend

| Technology | Version | Purpose | Why Not an Alternative? |
|---|---|---|---|
| **React** | 18.3.1 | UI library | Component model is ideal for our complex, stateful UI. Vue is comparable but React's ecosystem (Monaco bindings, Yjs bindings) is richer. Svelte has fewer mature integrations for our needs. |
| **Vite** | 7.2.4 | Build tool | HMR is instant (ESBuild-based). Create React App is deprecated. Webpack is slower. Vite's chunk splitting gives us optimized bundles. |
| **Monaco Editor** | 0.55.1 | Code editor | The same editor that powers VS Code. CodeMirror 6 is lighter but lacks IntelliSense, multi-cursor, and the breadth of language support Monaco provides. Ace Editor is older and less maintained. |
| **TanStack Query** | 5.x | Data fetching | Automatic caching, background refetching, and stale-while-revalidate. SWR is simpler but TanStack gives us more control over cache invalidation and query dependencies. |
| **Lucide React** | 0.562 | Icons | Tree-shakeable, consistent design, good for dark themes. Heroicons has fewer icons. Font Awesome adds bundle weight. |
| **React Router** | 6.x | Routing | Standard for React SPAs. Next.js would give SSR but we don't need it — our app is entirely client-rendered (a code editor doesn't benefit from SEO). |
| **DOMPurify** | 3.x | XSS prevention | Sanitizes HTML from external sources (problem descriptions). Essential for security when rendering markdown/HTML from LeetCode/GFG. |

---

## 4. Project Structure

```
AI-Code-Editor/
├── .gitignore                  # Git ignore rules
├── .dockerignore               # Docker ignore rules
├── docker-compose.yml          # Full-stack Docker orchestration
│
├── backend/                    # Express.js API server
│   ├── index.js                # App entry — server setup, middleware, route mounting
│   ├── db.js                   # MongoDB connection with pool optimization
│   ├── package.json            # Dependencies & scripts
│   ├── Dockerfile              # Production Docker image
│   ├── .env.example            # Environment variable template
│   ├── .prettierrc             # Code formatting rules
│   ├── eslint.config.js        # Linting configuration
│   │
│   ├── config/
│   │   └── redis.js            # Redis client with in-memory fallback
│   │
│   ├── middleware/
│   │   ├── index.js            # Middleware barrel export
│   │   ├── authMiddleware.js   # JWT verification (Bearer + x-auth-token)
│   │   ├── rateLimiter.js      # Rate limiting (API, auth, AI, expensive ops)
│   │   ├── cache.js            # Response caching middleware
│   │   ├── circuitBreaker.js   # Circuit breaker for external API calls
│   │   ├── errorHandler.js     # Global error handler + 404 handler
│   │   └── performance.js      # Request timing & metrics collection
│   │
│   ├── models/                 # Mongoose schemas
│   │   ├── User.js             # User accounts (local + OAuth)
│   │   ├── Room.js             # Collaboration rooms (24h TTL)
│   │   ├── File.js             # User files (code, per-room)
│   │   ├── Submission.js       # Code submissions (CF, LC)
│   │   ├── SharedCode.js       # Shared code snippets (7-day TTL)
│   │   └── Problem.js          # Cached problem data (30-day TTL)
│   │
│   ├── routes/                 # API route handlers (13 modules)
│   │   ├── auth.js             # Register, login, password reset
│   │   ├── oauth.js            # Google & GitHub OAuth + token refresh
│   │   ├── code.js             # Code execution via Piston API
│   │   ├── files.js            # File CRUD + folder management
│   │   ├── rooms.js            # Room creation & lookup
│   │   ├── problems.js         # Problem fetching (LC, CF, CSES, GFG, AtCoder)
│   │   ├── leettools.js        # LeetCode submission proxy
│   │   ├── submissionRoutes.js # Submission history CRUD
│   │   ├── profile.js          # User profile management
│   │   ├── livekit.js          # Voice chat token generation
│   │   ├── ai.js               # AI assistant (Gemini)
│   │   ├── share.js            # Code sharing (short URLs)
│   │   └── friends.js          # Friend system & activity feed
│   │
│   ├── socket/
│   │   └── socketHandler.js    # Socket.IO event handlers
│   │
│   ├── utils/
│   │   ├── codeforcesScraper.js # CF problem scraping logic
│   │   ├── scraperService.js    # Multi-platform scraper (CSES, AtCoder)
│   │   ├── jobQueue.js          # BullMQ job queue setup
│   │   └── tokenHelpers.js      # JWT generation helpers
│   │
│   ├── scripts/                 # Offline data scripts (not part of runtime)
│   │   ├── scrape_codeforces_problems.js
│   │   ├── scrape_editorials.js
│   │   ├── seed_cache.js
│   │   └── ... (scraping & data processing utilities)
│   │
│   └── tests/
│       └── health.test.js       # API health check test
│
├── frontend/                    # React SPA
│   ├── index.html               # HTML entry point
│   ├── package.json             # Dependencies & scripts
│   ├── vite.config.js           # Vite build configuration
│   ├── Dockerfile               # Production Docker image (Nginx)
│   ├── nginx.conf               # Nginx config for SPA routing
│   ├── vercel.json              # Vercel deployment config
│   ├── eslint.config.js         # Linting configuration
│   │
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Root component + routing
│       ├── index.css            # Global design system (Apple-inspired)
│       ├── App.css              # App-level styles
│       ├── config.js            # API URL configuration
│       │
│       ├── components/          # All UI components
│       │   ├── Dashboard.jsx    # Landing page (hero, features, room join)
│       │   ├── Dashboard.css    # Dashboard-specific styles
│       │   ├── Workspace.jsx    # Main editor workspace (~2400 lines)
│       │   ├── CodeEditor.jsx   # Monaco Editor wrapper with Yjs binding
│       │   ├── Sidebar.jsx      # Navigation sidebar with platform icons
│       │   ├── ConsolePanel.jsx # Output console with stdin support
│       │   ├── TestPanel.jsx    # Custom test case runner
│       │   │
│       │   ├── ProblemBrowser.jsx   # Codeforces problem browser
│       │   ├── A2ZBrowser.jsx       # Striver's A2Z DSA Sheet
│       │   ├── CP31Browser.jsx      # CP-31 Sheet browser
│       │   ├── ProblemPreview.jsx   # Problem description renderer
│       │   ├── EditorialPanel.jsx   # Editorial viewer
│       │   │
│       │   ├── AIPanel.jsx      # AI chat assistant
│       │   ├── AIButton.jsx     # Floating AI trigger
│       │   ├── AIToolbar.jsx    # AI toolbar actions
│       │   │
│       │   ├── AuthModal.jsx    # Login/Register modal
│       │   ├── ShareModal.jsx   # Code sharing modal
│       │   ├── ConfirmModal.jsx # Confirmation dialog
│       │   ├── SettingsModal.jsx # Settings dialog
│       │   ├── FriendsPanel.jsx # Friends list & requests
│       │   │
│       │   ├── FileExplorer.jsx # File tree with folders
│       │   ├── ParticipantsPanel.jsx # Room participants
│       │   ├── VoicePanel.jsx   # Voice chat UI (LiveKit)
│       │   ├── Whiteboard.jsx   # Drawing whiteboard
│       │   ├── RecordingPanel.jsx # Screen recording
│       │   │
│       │   ├── ProfilePage.jsx  # User profile (stats, heatmap, charts)
│       │   ├── UserProfilePage.jsx # Public profile view
│       │   ├── SettingsPanel.jsx # Workspace settings
│       │   │
│       │   ├── ErrorBoundary.jsx # React error boundary
│       │   ├── OAuthCallback.jsx # OAuth redirect handler
│       │   ├── ResetPasswordPage.jsx
│       │   ├── UsernamePrompt.jsx
│       │   ├── VirtualizedList.jsx # Virtual scrolling
│       │   ├── HighlightedTextarea.jsx
│       │   ├── RecordingIndicator.jsx
│       │   ├── Editors.jsx      # Multi-editor layout
│       │   ├── Preview.jsx      # HTML preview (iframe)
│       │   │
│       │   ├── a2z.json         # A2Z sheet problem data
│       │   ├── a2z-cache.json   # A2Z problem cache
│       │   ├── a2z-full.json    # Full A2Z data
│       │   ├── cp31.json        # CP-31 sheet data
│       │   └── index.js         # Component barrel export
│       │
│       ├── context/
│       │   ├── AuthContext.jsx   # Authentication state management
│       │   ├── AppContext.jsx    # Global app state
│       │   └── index.js
│       │
│       ├── hooks/
│       │   ├── index.js          # Barrel export
│       │   ├── useApi.js         # API call hook with auth
│       │   ├── useDebounce.js    # Debounce hook
│       │   ├── usePerformance.js # Performance monitoring
│       │   ├── useScreenRecording.js # Screen capture
│       │   └── useVoiceChat.js   # LiveKit voice hook
│       │
│       ├── lib/
│       │   ├── apiClient.js     # Axios/fetch wrapper
│       │   ├── queryClient.js   # TanStack Query setup
│       │   ├── lazyLoad.jsx     # Lazy loading utilities
│       │   └── index.js
│       │
│       └── utils/
│           ├── execution.js     # Client-side JS execution (Web Worker)
│           ├── extension.js     # Extension communication bridge
│           ├── problemFetcher.js # Problem data fetching
│           ├── codeforces.js    # CF-specific utilities
│           ├── editorialService.js # Editorial fetching
│           ├── colors.js        # Color utilities
│           ├── cppRunner.js     # C++ execution helpers
│           ├── javaRunner.js    # Java execution helpers
│           └── pythonRunner.js  # Python execution helpers
│
├── chrome-extension/            # Chrome Extension (Manifest V3)
│   ├── manifest.json            # Extension manifest
│   ├── background.js            # Service worker (cookie access, CF submit)
│   ├── content.js               # Content script (page ↔ extension bridge)
│   ├── popup.html / popup.js    # Extension popup UI
│   ├── offscreen.html / .js     # Offscreen document for DOM operations
│   └── README.md                # Extension documentation
│
├── firefox-extension/           # Firefox Extension (Manifest V2/V3)
│   └── (same structure as chrome-extension with manifest differences)
│
├── codeforces-problems/         # Scraped CF problem data (git-tracked metadata only)
│   ├── README.md
│   └── scrape_progress.json
│
└── docker/
    └── nginx-gateway.conf       # Nginx reverse proxy config
```

---

## 5. Backend Deep Dive

### 5.1 Entry Point — `index.js`

The server bootstraps in this order:

1. **Environment validation** — Checks `MONGO_URI` and `JWT_SECRET` exist, exits if not
2. **Database connection** — `connectDB()` with connection pooling (50 max, 10 min)
3. **Security middleware** — Helmet (headers), CORS (whitelist), JSON body limit (1MB)
4. **Performance middleware** — Request timing, compression (Brotli/Gzip)
5. **Rate limiting** — Applied per-route (auth: 10/15min, AI: custom, code: expensive)
6. **Auth middleware** — Applied to `/api/code`, `/api/livekit`, `/api/leettools`
7. **Route mounting** — 13 route modules mounted under `/api/`
8. **WebSocket setup** — Socket.IO on `/socket.io/`, Yjs on `/codeplay-*`
9. **Background jobs** — Room cleanup every 30 minutes (supplements MongoDB TTL)
10. **Error handling** — 404 handler + global error handler (must be last)

### 5.2 Middleware Stack

| Middleware | File | Purpose |
|---|---|---|
| **authMiddleware** | `authMiddleware.js` | Verifies JWT from `Authorization: Bearer <token>` or `x-auth-token` header. Attaches `req.user = { id, username }`. |
| **rateLimiter** | `rateLimiter.js` | Four tiers: `api` (general), `auth` (login/register), `ai` (AI calls), `expensive` (code execution). In-memory store. |
| **cache** | `cache.js` | Response caching with Redis + in-memory fallback. Used for problem data. |
| **circuitBreaker** | `circuitBreaker.js` | Protects external API calls (Piston, LeetCode, CF). Opens circuit after N failures, half-opens after timeout. |
| **errorHandler** | `errorHandler.js` | Catches all unhandled errors. Returns consistent `{ error: "message" }` format. Strips stack traces in production. |
| **performance** | `performance.js` | Tracks request duration, response sizes. Exposes `/api/metrics` endpoint. |

### 5.3 Route Modules

The backend has **65 API endpoints** across 13 route modules. See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for the complete reference.

**Quick overview:**

| Module | Mount Point | Endpoints | Auth? | Purpose |
|---|---|---|---|---|
| auth | `/api/auth` | 6 | Partial | Register, login, password reset |
| oauth | `/api/oauth` | 9 | None* | Google/GitHub OAuth, token refresh |
| code | `/api/code` | 1 | **Yes** | Code execution (Piston) |
| files | `/api/files` | 7 | **Yes** | File CRUD + folders |
| rooms | `/api/rooms` | 2 | Partial | Room management |
| problems | `/api/problems` | 18 | None | Problem fetching (5 platforms) |
| leettools | `/api/leettools` | 1 | **Yes** | LeetCode submission |
| submissions | `/api/submissions` | 5 | Partial | Submission history |
| profile | `/api/profile` | 3 | Partial | User profiles |
| livekit | `/api/livekit` | 1 | None | Voice chat tokens |
| ai | `/api/ai` | 1 | None | AI assistant |
| share | `/api/share` | 2 | None | Code sharing |
| friends | `/api/friends` | 9 | **Yes** | Social features |

*OAuth routes verify JWT manually for some endpoints without using the `authMiddleware`.

### 5.4 Socket.IO Events

The Socket.IO server handles real-time room collaboration:

| Event | Direction | Purpose |
|---|---|---|
| `join_room` | Client → Server | Join a collaboration room |
| `leave_room` | Client → Server | Leave a room |
| `sync_code` | Bidirectional | Sync code changes (fallback for Yjs) |
| `sync_run_result` | Client → Server → Room | Broadcast code execution results |
| `sync_language` | Bidirectional | Sync language changes |
| `sync_file_created` | Client → Room | Notify about new files |
| `sync_file_deleted` | Client → Room | Notify about deleted files |
| `sync_open_file` | Client → Room | Sync which file is open |
| `sync_problem` | Client → Room | Sync which problem is loaded |
| `cursor_update` | Client → Room | Broadcast cursor positions |
| `typing` | Client → Room | Typing indicators |

### 5.5 Utils

| Utility | Purpose |
|---|---|
| `codeforcesScraper.js` | Puppeteer-based Codeforces problem scraper with retry logic |
| `scraperService.js` | Multi-platform scraper (CSES HTML parsing, AtCoder, GFG) |
| `jobQueue.js` | BullMQ queue for background scraping jobs |
| `tokenHelpers.js` | JWT access/refresh token generation with configurable expiry |

---

## 6. Frontend Deep Dive

### 6.1 Application Flow

```
main.jsx → App.jsx → AuthProvider → BrowserRouter → Routes
                                         │
                          ┌──────────────┼──────────────────┐
                          ▼              ▼                  ▼
                     Dashboard      Workspace         ProfilePage
                     (Landing)      (Editor)          (Stats)
```

### 6.2 Routing

| Route | Component | Purpose |
|---|---|---|
| `/` | `Dashboard` | Landing page with room creation/join |
| `/editor/:id` | `Workspace` | Main editor (room-based) |
| `/share/:id` | `Workspace` | Shared code viewer |
| `/profile` | `ProfilePage` | Current user's profile |
| `/user/:username` | `UserProfilePage` | Public profile |
| `/reset-password` | `ResetPasswordPage` | Password reset form |
| `/auth/callback` | `OAuthCallback` | OAuth redirect handler |

### 6.3 The Workspace — Heart of the App

`Workspace.jsx` (~2400 lines) is the most complex component. It orchestrates:

- **Monaco Editor** — Powered by `CodeEditor.jsx` with Yjs binding for real-time sync
- **Sidebar** — Problem browser, file explorer, tools, settings
- **Console** — Code output, stdin input, test results
- **Problem Panel** — Right-side problem description viewer
- **AI Panel** — Chat-based AI assistant
- **Voice Chat** — LiveKit-powered audio rooms
- **Whiteboard** — Drawing canvas for explanations
- **Recording** — Screen capture for solution recordings

**Key state management:**
- `activeFile` — Currently open file
- `activeCode` — Code in the editor (synced via Yjs)
- `rightPanel` — What's shown on the right (problem, editorial, AI)
- `testCases` — Custom test cases with expected/actual output
- `logs` — Console output history

### 6.4 State Management Architecture

**Q: Why Context + hooks instead of Redux or Zustand?**

A: The app has two types of state:

1. **Global auth state** → `AuthContext` (login status, user data, token management)
2. **Server state** → `TanStack Query` (problems, submissions, profiles — cached + auto-refetched)
3. **Local component state** → `useState` within `Workspace.jsx`

Redux would add boilerplate without benefit — we don't have complex cross-component state interactions. Zustand is lighter but we don't need a store when TanStack Query handles all server state. The React Context + hooks pattern is the simplest solution that works.

### 6.5 Design System

The frontend uses an **Apple-inspired dark theme** defined in `index.css`:

```css
/* Core palette */
--bg-dark: #000000;            /* True black background */
--accent-primary: #7c5cfc;     /* Refined purple */
--text-main: #f5f5f7;          /* Apple's signature text white */
--text-muted: #86868b;         /* Secondary text */

/* Glass morphism */
background: rgba(28, 28, 30, 0.9);
backdrop-filter: blur(40px) saturate(180%);

/* Font stack */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui;

/* Animation curves */
--ease-spring: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
```

**Why Apple-inspired?** Dark themes reduce eye strain during long coding sessions. Apple's design language (clear hierarchy, subtle animations, glass morphism) creates a premium feel without being distracting. The purple accent (#7c5cfc) was chosen for high contrast against black backgrounds while being easier on the eyes than pure blue.

### 6.6 Code Execution Flow

```
User clicks "Run"
       │
       ▼
  Is JavaScript?
  ├── YES → Web Worker (client-side, instant)
  └── NO  → POST /api/code/execute
                  │
                  ▼
            Piston API (sandboxed)
            Supported: C++ (10.2), Java (15), Python (3.10), JS (18)
                  │
                  ▼
            Response: { stdout, stderr, exitCode }
                  │
                  ▼
            ConsolePanel displays output
```

**Q: Why execute JavaScript in a Web Worker instead of the server?**  
A: Instant execution (no network latency), and JS is sandboxed in a Worker thread. Server-side execution would add 200-500ms network overhead for something the browser can do natively.

### 6.7 Key Utility Modules

| Module | Purpose |
|---|---|
| `execution.js` | Web Worker-based JavaScript execution with timeout handling |
| `extension.js` | `window.postMessage` bridge to communicate with browser extension |
| `problemFetcher.js` | Unified problem fetching from multiple platforms |
| `editorialService.js` | Editorial search and display |
| `codeforces.js` | Codeforces-specific problem/contest utilities |

---

## 7. Browser Extensions

### Why Do We Need Extensions?

Two critical features require browser extension access:

1. **LeetCode submission** — LeetCode requires authenticated session cookies (`LEETCODE_SESSION`, `csrftoken`) that can only be accessed from the browser's cookie store
2. **Codeforces submission** — CF requires CSRF tokens from the submit page, which means we need to open a tab, extract the token, and submit the form

The web app communicates with the extension via `window.postMessage`:

```
React App ←→ Content Script ←→ Background Script ←→ Browser APIs
(postMessage)  (content.js)     (background.js)     (cookies, tabs)
```

### Chrome Extension (Manifest V3)

- `background.js` — Service worker that handles cookie access, CF tab-based submission
- `content.js` — Content script injected into the CodePlay web app, bridges postMessage to chrome.runtime
- `popup.html/js` — Extension popup showing connection status
- `offscreen.html/js` — Offscreen document for DOM operations (MV3 requirement)

### Firefox Extension

Same architecture adapted for Firefox's Manifest V2/V3 differences (e.g., `browser.*` instead of `chrome.*`).

---

## 8. Real-Time Collaboration System

### How Multi-User Editing Works

```
User A types "hello"          User B types "world" at same position
       │                              │
       ▼                              ▼
  Yjs Document (CRDT)           Yjs Document (CRDT)
  Applies local operation       Applies local operation
       │                              │
       ▼                              ▼
  WebSocket broadcast ──────────────► Merge (CRDT)
       ◄────────────────────────────── WebSocket broadcast
       │                              │
       ▼                              ▼
  Result: "helloworld"          Result: "helloworld"
  (deterministic merge)         (deterministic merge)
```

**Q: What is a CRDT and why not Operational Transformation (OT)?**

A **CRDT** (Conflict-free Replicated Data Type) is a data structure that can be replicated across multiple nodes and merged without conflicts — mathematically guaranteed. **OT** (what Google Docs uses) requires a central server to resolve conflicts, which adds latency and complexity.

Yjs is the industry-leading CRDT library for text editing. It provides:
- Offline editing support (syncs when reconnected)
- Undo/redo that respects other users' changes
- Awareness protocol (cursor positions, user presence)

### Collaboration Architecture

| Layer | Technology | Purpose |
|---|---|---|
| **Editor** | Monaco Editor | Rich code editing (syntax, IntelliSense) |
| **Binding** | y-monaco | Bridges Yjs document ↔ Monaco model |
| **Document** | Yjs (Y.Doc) | CRDT document that holds the source of truth |
| **Network** | y-websocket | WebSocket transport for Yjs operations |
| **Server** | ws (WebSocketServer) | Yjs server that relays updates between clients |
| **Events** | Socket.IO | Non-text events (user presence, run results, file ops) |

### Room Lifecycle

1. **User creates room** → `POST /api/rooms/create` → MongoDB document with `roomId`, `host`
2. **User joins room** → Connects Socket.IO + Yjs WebSocket (path `/codeplay-<roomId>`)
3. **Editing happens** → Yjs syncs text, Socket.IO syncs events
4. **Room expires** → MongoDB TTL index deletes after 24h of inactivity

---

## 9. Authentication & Security

### Auth Flow

```
Register/Login                    OAuth (Google/GitHub)
     │                                  │
     ▼                                  ▼
  POST /api/auth/register          GET /api/oauth/google
  POST /api/auth/login                  │
     │                                  ▼
     ▼                            OAuth Provider
  JWT Access Token (24h)          Consent Screen
  JWT Refresh Token (30d)               │
     │                                  ▼
     ▼                            GET /api/oauth/google/callback
  localStorage: codeplay_token         │
                                       ▼
                                  Redirect to frontend with token
                                  Frontend stores in localStorage
```

### Security Measures

| Measure | Implementation | Why? |
|---|---|---|
| **Password hashing** | bcryptjs (salt rounds: 12) | Slow hash prevents brute force. 12 rounds = ~250ms per hash. |
| **JWT tokens** | Access (24h) + Refresh (30d) | Short access tokens limit damage from theft. Refresh tokens enable session persistence. |
| **Rate limiting** | Per-route limits | Prevents brute force (auth: 10/15min), DoS (API: general), and cost abuse (AI, code exec). |
| **Account lockout** | 5 failed attempts → 15min lock | Prevents credential stuffing. |
| **CORS** | Whitelist (localhost, vercel, render) | Prevents unauthorized origins from calling the API. |
| **Helmet** | Security headers (CSP, HSTS, etc.) | Prevents XSS, clickjacking, MIME sniffing. |
| **Input validation** | Size limits, regex patterns | JSON body ≤1MB, code ≤100KB, passwords must have letter+number. |
| **DOMPurify** | Frontend HTML sanitization | Prevents XSS when rendering problem descriptions from external sources. |
| **CSRF protection** | OAuth state tokens in Redis | Prevents CSRF attacks on OAuth flows. |

---

## 10. Database Design

### MongoDB Collections

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│    Users     │────▶│    Rooms     │────▶│     Files      │
│ (accounts)   │     │ (24h TTL)   │     │ (per-user/room)│
└──────┬───────┘     └──────────────┘     └────────────────┘
       │
       ├─────────────▶ Submissions (code history)
       │
       ├─────────────▶ Activities (30d TTL, feed)
       │
       └─────────────▶ Friends (bidirectional refs)

┌──────────────┐     ┌──────────────┐
│  SharedCode  │     │   Problems   │
│ (7-day TTL)  │     │ (30d cache)  │
└──────────────┘     └──────────────┘
```

### TTL Strategy

MongoDB's TTL indexes automatically delete expired documents — no cron jobs needed:

| Collection | TTL | Why? |
|---|---|---|
| Room | 24 hours (inactive) | Rooms are ephemeral — no one comes back after a day |
| SharedCode | 7 days | Shared snippets are temporary by nature |
| Problem (cache) | 30 days | Problem data rarely changes; 30d is a safe refresh cycle |
| Activity | 30 days | Activity feeds don't need infinite history |

**Q: Why MongoDB TTL instead of cron jobs?**  
A: TTL indexes are built into the database engine. They're atomic, don't require application-level code, and can't be forgotten if the server restarts. The supplementary 30-minute room cleanup in `index.js` is a safety net, not the primary mechanism.

### Indexing Strategy

Key indexes for query performance:
- `User.email` — unique, for login lookup
- `User.username` — unique, for profile lookup  
- `User.platformHandles.codeforces` — sparse, for CF handle linking
- `File.owner + roomId` — compound, for fetching user's files in a room
- `Submission.user + platform` — compound, for user's submission history
- `Room.lastActiveAt` — TTL index (24h)

---

## 11. External Services & Integrations

| Service | Purpose | Endpoint Used | Rate Limits | Fallback |
|---|---|---|---|---|
| **Piston API** | Code execution | `emkc.org/api/v2/piston/execute` | Reasonable use | Error message to user |
| **LeetCode GraphQL** | Problem data | `leetcode.com/graphql` | Aggressive anti-bot | Redis cache (1h) |
| **Codeforces API** | Problems, standings | `codeforces.com/api/*` | 1 req/2s | Mirror API, cached data |
| **CSES** | Problem scraping | `cses.fi/problemset` | No API, HTML scrape | Cached in MongoDB |
| **GeeksforGeeks** | Problem scraping | `geeksforgeeks.org/problems/*` | No API, HTML scrape | Cached |
| **AtCoder** | Problem scraping | `atcoder.jp/contests/*` | No API, HTML scrape | Cached |
| **Google Gemini** | AI assistant | Gemini 2.5 Flash API | 15 RPM free tier | Error message |
| **LiveKit** | Voice chat | Self-hosted or cloud | Configurable | Disabled gracefully |
| **Gmail SMTP** | Password reset emails | SMTP via nodemailer | 500/day | Error message |
| **Google OAuth** | Social login | OAuth 2.0 | Standard | Manual registration |
| **GitHub OAuth** | Social login | OAuth 2.0 | Standard | Manual registration |

---

## 12. Deployment & Infrastructure

### Docker Compose (Recommended for Production)

```bash
docker-compose up -d
```

This starts:
- **MongoDB 6.0** — Port 27017, 1GB memory limit, persistent volume
- **Redis 7.2** — Port 6379, 256MB LRU cache, persistent volume
- **Backend** — Port 5000, depends on healthy Mongo + Redis
- **Frontend** — Port 5173, Nginx serving static build
- **Nginx Gateway** — Reverse proxy routing (optional)

### Vercel Deployment (Frontend Only)

The frontend has a `vercel.json` with SPA rewrites:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Render/Railway (Backend)

Set environment variables and deploy the backend directory. The `Dockerfile` handles the build.

### Health Checks

- `GET /api/health` — Returns `{ status: "healthy" }` if the server is running
- `GET /api/metrics` — Performance metrics (auth required)
- `GET /api/problems/health` — Scraper subsystem health

---

## 13. Environment Variables

Create `backend/.env` from `backend/.env.example`:

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `FRONTEND_URL` | Recommended | For CORS and OAuth redirects |
| `BACKEND_URL` | Recommended | For OAuth callback URLs |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth |
| `EMAIL_USER` | Optional | Gmail address for password reset |
| `EMAIL_PASS` | Optional | Gmail app password |
| `GEMINI_API_KEY` | Optional | Google Gemini AI |
| `LIVEKIT_API_KEY` | Optional | LiveKit voice chat |
| `LIVEKIT_API_SECRET` | Optional | LiveKit voice chat |
| `LIVEKIT_URL` | Optional | LiveKit server URL |
| `REDIS_URL` | Optional | Redis connection (defaults to localhost) |
| `PORT` | Optional | Server port (default: 5000) |

---

## 14. How to Run Locally

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **MongoDB** 6.0+ (local or Atlas)
- **Redis** 7.x (optional — app falls back to in-memory cache)
- **Git**

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/AI-Code-Editor.git
cd AI-Code-Editor

# 2. Setup backend
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm install
npm run dev    # Starts on port 5000

# 3. Setup frontend (new terminal)
cd frontend
npm install
npm run dev    # Starts on port 5173

# 4. Open http://localhost:5173
```

### With Docker

```bash
# Edit backend/.env with your secrets, then:
docker-compose up -d

# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
# MongoDB:  localhost:27017
# Redis:    localhost:6379
```

---

## 15. Common Questions & Design Decisions

### Q: Why is Workspace.jsx so large (~2400 lines)?

It's the central orchestrator for the entire editor experience. Splitting it into many small components would create a "prop drilling" or "context explosion" problem where 20+ pieces of state need to flow between 15+ child components. The current approach keeps related logic together. The file is well-organized with clear sections (submission handling, problem loading, file management, etc.).

**Future improvement:** Extract into a custom `useWorkspace()` hook that manages state, with the JSX in a separate presentational component.

### Q: Why localStorage for auth instead of httpOnly cookies?

The browser extension needs to read the auth token to include it in API calls. `httpOnly` cookies are inaccessible from JavaScript (that's their security feature), but the extension communication bridge requires reading the token from the page context. The tradeoff is acknowledged — we mitigate it with short-lived tokens (24h) and refresh token rotation.

### Q: Why Piston for code execution instead of self-hosted?

Security. Running arbitrary user code on your own server requires sophisticated sandboxing (Docker-in-Docker, gVisor, seccomp profiles). Piston handles all of this. The tradeoff is network latency (~300ms), which is acceptable for competitive programming where correctness matters more than execution speed.

### Q: Why no SSR (Next.js)?

A code editor is a **client-heavy application**. There's no SEO benefit (editors are behind auth), no content to pre-render, and the critical path is loading Monaco Editor (a 2.5MB client-side library). SSR would add complexity without improving the user experience. Vite's fast HMR and efficient chunking give us a better developer experience.

### Q: How does the problem caching work?

```
Request for problem
       │
       ▼
  Check Redis (< 1ms)
  ├── HIT → Return cached
  └── MISS
       │
       ▼
  Check MongoDB (< 10ms)
  ├── HIT → Cache in Redis, return
  └── MISS
       │
       ▼
  Fetch from source (200-2000ms)
  (LeetCode GraphQL, CF API, scraper)
       │
       ▼
  Cache in Redis (2h TTL) + MongoDB (30d TTL)
       │
       ▼
  Return to client
```

This three-tier cache ensures fast responses even when external APIs are slow or rate-limited. Redis handles hot data, MongoDB handles warm data, and scrapers handle cold fetches.

### Q: Why both Socket.IO AND Yjs WebSocket?

They serve fundamentally different purposes:

- **Socket.IO** = Event bus. "User X joined", "Run result: Accepted", "File deleted". These are discrete, one-time events.
- **Yjs WebSocket** = State synchronization. Continuous, character-by-character text collaboration. Yjs needs its own protocol for CRDT sync, awareness (cursors), and state vectors.

Merging them would mean reimplementing Yjs's sync protocol on top of Socket.IO, which adds complexity for zero benefit.

---

*This documentation reflects the CodePlay codebase as of February 2026. For API-specific documentation including request/response examples for Postman testing, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md).*
