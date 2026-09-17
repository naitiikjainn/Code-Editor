<p align="center">
  <h1 align="center">CodePlay</h1>
  <p align="center">
    <strong>AI-Powered Collaborative Code Editor for Competitive Programming</strong>
  </p>
  <p align="center">
    <a href="https://cod-play.tech">Live Demo</a> · 
    <a href="#features">Features</a> · 
    <a href="#getting-started">Getting Started</a> · 
    <a href="#architecture">Architecture</a> · 
    <a href="#deployment">Deployment</a>
  </p>
</p>

---

## Overview

**CodePlay** is a full-stack, real-time collaborative code editor designed for competitive programmers. It combines the power of **Monaco Editor** with **AI assistance (Gemini)**, **real-time collaboration (Yjs + WebSocket)**, **voice chat (LiveKit)**, and a built-in **problem browser** for Codeforces, LeetCode, CSES, and more — all in one place.

Whether you're grinding DSA sheets, pair-programming with friends, or submitting solutions directly to competitive programming platforms, CodePlay has you covered.

---

## Features

### AI-Powered Coding Assistant
- Integrated **Google Gemini** AI for code generation, debugging, and explanations
- Context-aware suggestions within the editor
- Dedicated AI panel with markdown-rendered responses

### Professional Code Editor
- **Monaco Editor** (VS Code's engine) with full syntax highlighting
- Multi-language support: **C++, Python, Java, JavaScript**
- Multiple file tabs, file explorer, and project workspace
- Code sharing via shareable links
- Customizable editor settings (theme, font size, keybindings)

### Real-Time Collaboration
- **Yjs CRDT** powered real-time collaborative editing
- Live cursor tracking for all participants
- Room-based workspaces with auto-expiry (24h TTL)
- **Voice chat** via LiveKit integration
- Participants panel with online status

### Competitive Programming Suite
- **Problem Browser**: Browse & search problems from Codeforces, LeetCode, CSES
- **Striver's A2Z DSA Sheet** and **CP-31 Sheet** integration
- **Editorial Panel**: View problem editorials with LaTeX/KaTeX rendering
- **Test Case Runner**: Run code against custom and preset test cases
- **CSES Online Judge**: Docker-sandboxed code execution with BullMQ job queue
- **Direct Submission**: Submit solutions to Codeforces/LeetCode via the Chrome Extension
- **Submission History**: Track all your past submissions

### User Profiles & Social
- User profiles with linked platform handles (Codeforces, LeetCode, CodeChef, GitHub)
- **Rating graphs** and contest history scraped/proxied from platforms
- Activity heatmaps
- Friends system with online status tracking

### Session Recording
- Record your coding sessions with the built-in recording panel
- Whiteboard for visual explanations and diagramming

### Authentication & Security
- JWT-based authentication with secure password hashing (bcrypt)
- **OAuth 2.0**: Login with Google or GitHub
- Email-based password reset (Nodemailer)
- Rate limiting, circuit breakers, and Helmet security headers

---

## Architecture

```
AI-Code-Editor/
├── frontend/          # React + Vite SPA
├── backend/           # Express.js API + WebSocket server
├── chrome-extension/  # Chrome Extension for platform submissions
├── docker/            # Nginx gateway configuration
├── docker-compose.yml # Full-stack orchestration
└── .github/workflows/ # CI/CD (GitHub Actions → EC2)
```

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Monaco Editor, Yjs, React Router, TanStack Query, Socket.IO Client, LiveKit Client, Lucide Icons |
| **Backend** | Node.js, Express 5, Socket.IO, Yjs WebSocket, Mongoose, BullMQ, Helmet, Compression |
| **Database** | MongoDB (Mongoose ODM) |
| **Caching / Queue** | Redis (ioredis) + BullMQ for CSES judge jobs |
| **AI** | Google Gemini API (`@google/generative-ai`) |
| **Voice Chat** | LiveKit |
| **Real-Time Collab** | Yjs CRDT + y-websocket + y-monaco |
| **Auth** | JWT + bcryptjs + OAuth 2.0 (Google, GitHub) |
| **Code Execution** | Sandboxed Docker containers (C++, Python, Java, JS) |
| **Storage** | Cloudflare R2 (AWS S3 SDK) |
| **Deployment** | Docker Compose, Nginx reverse proxy, GitHub Actions → EC2 |
| **Chrome Extension** | Manifest V3, background service worker |

---

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **Redis** (optional, required for CSES judge queue)
- **Docker** (optional, required for sandboxed code execution)

### 1. Clone the Repository

```bash
git clone https://github.com/naitiikjaiin/Code-Editor.git
cd Code-Editor
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
MONGO_URI=mongodb://localhost:27017/codeplay
JWT_SECRET=your-super-secret-jwt-key

# Frontend/Backend URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000

# AI Assistant
GEMINI_API_KEY=your-gemini-api-key

# OAuth (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Email (Optional - for password reset)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Redis (Optional - for CSES judge)
# REDIS_URL=redis://localhost:6379
```

Start the backend:

```bash
# Development (with hot-reload)
npm run dev

# Production
npm start
```

The backend runs on **http://localhost:5000**.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend runs on **http://localhost:5173**.

### 4. Chrome Extension (Optional)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `chrome-extension/` folder
4. The extension enables direct problem submission to Codeforces and LeetCode

---

## Docker Deployment

Run the entire stack with a single command:

```bash
docker-compose up --build
```

This spins up:

| Service | Port | Description |
|---|---|---|
| **Gateway** (Nginx) | `80` | Reverse proxy routing |
| **Frontend** | `5173` → `80` | React SPA served via Nginx |
| **Backend** | `5000` | Express API + WebSocket |
| **MongoDB** | `27017` | Database |
| **Redis** | `6379` | Cache + Job Queue |

### Service Details

- **Nginx Gateway** routes `/api/*` and `/socket.io/*` to the backend, everything else to the frontend
- **Health checks** are configured for all services
- **Memory limits** are enforced per container
- **Volumes** persist MongoDB and Redis data across restarts

---

## API Routes

| Endpoint | Description |
|---|---|
| `POST /api/auth/*` | Authentication (register, login, forgot-password) |
| `POST /api/oauth/*` | OAuth flows (Google, GitHub) |
| `POST /api/ai/*` | AI assistant (Gemini) |
| `POST /api/code/*` | Code execution (authenticated) |
| `GET /api/problems/*` | Problem fetching (Codeforces, LeetCode, CSES) |
| `GET/POST /api/rooms/*` | Collaboration rooms |
| `GET/POST /api/files/*` | File management |
| `GET /api/share/:id` | Shared code snippets |
| `GET/POST /api/submissions/*` | Submission history |
| `GET/POST /api/friends/*` | Friends system |
| `GET /api/profile/*` | User profiles |
| `POST /api/livekit/*` | Voice chat tokens |
| `POST /api/cses/*` | CSES judge submissions |
| `GET /api/leettools/*` | LeetCode tooling |
| `GET /api/proxy/*` | CORS proxies (Codeforces, CodeChef, GitHub, LeetCode) |
| `GET /api/health` | Health check |
| `GET /api/metrics` | Performance metrics (admin) |

---

## Testing

```bash
cd backend

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

Tests use **Jest** with **mongodb-memory-server** for isolated database testing and **Supertest** for HTTP assertions.

---

## Deployment

### Production (EC2)

The project includes a **GitHub Actions** workflow (`.github/workflows/deploy.yml`) that auto-deploys the backend to an EC2 instance on pushes to `main`:

1. SSH into EC2
2. `git pull origin main`
3. `npm ci --production`
4. `pm2 restart all`

### Frontend (Vercel)

The frontend includes a `vercel.json` for deployment to **Vercel**. Simply connect the repo and set the root directory to `frontend/`.

---

## Project Structure

<details>
<summary><strong>Backend</strong></summary>

```
backend/
├── index.js              # Express app + Socket.IO + Yjs server
├── db.js                 # MongoDB connection
├── uploadToR2.js         # Cloudflare R2 file uploads
├── config/               # App configuration
├── middleware/
│   ├── authMiddleware.js  # JWT verification
│   ├── rateLimiter.js     # Rate limiting (API, Auth, AI, Code)
│   ├── cache.js           # Response caching
│   ├── circuitBreaker.js  # Circuit breaker pattern
│   ├── errorHandler.js    # Global error handling
│   └── performance.js     # Request timing & metrics
├── models/
│   ├── User.js            # User schema (profiles, OAuth, handles)
│   ├── Room.js            # Collaboration rooms (24h TTL)
│   ├── File.js            # File storage
│   ├── Problem.js         # Cached problems
│   ├── Submission.js      # Submission history
│   ├── SharedCode.js      # Shared snippets
│   ├── Activity.js        # User activity tracking
│   └── CSESProgress.js    # CSES problem progress
├── routes/                # 14 route modules
├── services/
│   ├── dockerJudge.js     # Sandboxed code execution
│   └── csesTestCaseService.js  # CSES test case fetching
├── workers/
│   └── csesJudgeWorker.js # BullMQ worker for CSES judging
├── socket/
│   └── socketHandler.js   # Socket.IO event handlers
├── tests/                 # Jest test suites
└── Dockerfile
```

</details>

<details>
<summary><strong>Frontend</strong></summary>

```
frontend/src/
├── main.jsx               # React entry point
├── App.jsx                # Router & auth shell
├── index.css              # Global styles
├── config.js              # API URL config
├── context/               # React Context (Auth, App state)
├── hooks/                 # Custom React hooks
├── lib/                   # TanStack Query client
├── utils/                 # Helper utilities
└── components/
    ├── Dashboard.jsx       # Landing page
    ├── Workspace.jsx       # Main editor workspace
    ├── CodeEditor.jsx      # Monaco editor wrapper
    ├── Editors.jsx         # Multi-tab editor
    ├── AIPanel.jsx         # AI assistant panel
    ├── ProblemBrowser.jsx  # Problem search & browse
    ├── ProblemPreview.jsx  # Problem statement viewer
    ├── EditorialPanel.jsx  # Editorial with LaTeX
    ├── TestPanel.jsx       # Test case runner
    ├── ConsolePanel.jsx    # Output console
    ├── FileExplorer.jsx    # File tree sidebar
    ├── Sidebar.jsx         # Navigation sidebar
    ├── ProfilePage.jsx     # User profile
    ├── FriendsPanel.jsx    # Friends & social
    ├── VoicePanel.jsx      # LiveKit voice chat
    ├── Whiteboard.jsx      # Drawing canvas
    ├── RecordingPanel.jsx  # Session recording
    ├── AuthModal.jsx       # Login/register modal
    ├── ShareModal.jsx      # Code sharing
    ├── SettingsPanel.jsx   # Editor preferences
    └── ...                 # 40+ components total
```

</details>

---

## Contributing

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

---

## License

This project is open source. See individual files for licensing details.

---

<p align="center">
  Built with love for the competitive programming community
</p>
