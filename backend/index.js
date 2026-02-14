import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import connectDB from "./db.js";
import aiRoutes from "./routes/ai.js";
import codeRoutes from "./routes/code.js";
import shareRoutes from "./routes/share.js";
import authRoutes from "./routes/auth.js";
import oauthRoutes from "./routes/oauth.js";
import fileRoutes from "./routes/files.js";
import roomRoutes from "./routes/rooms.js";
import problemRoutes from "./routes/problems.js";
import leetRoutes from "./routes/leettools.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import profileRoutes from "./routes/profile.js";
import livekitRoutes from "./routes/livekit.js";
import friendsRoutes from "./routes/friends.js";
import csesRoutes from "./routes/cses.js";
import socketHandler from "./socket/socketHandler.js";
import { initCSESJudgeWorker, setIO as setJudgeIO } from "./workers/csesJudgeWorker.js";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { WebSocketServer } from 'ws';
import { createRequire } from 'module';
import Room from "./models/Room.js";
import * as cheerio from "cheerio";

// Performance middleware imports
import { requestTiming, getMetrics } from "./middleware/performance.js";
import { rateLimiters } from "./middleware/rateLimiter.js";
import { cacheMiddleware } from "./middleware/cache.js";
import { getAllCircuitStates, resetCircuit } from "./middleware/circuitBreaker.js";
import { errorHandler, notFoundHandler, asyncHandler } from "./middleware/errorHandler.js";
import authMiddleware from "./middleware/authMiddleware.js";

const require = createRequire(import.meta.url);
const { setupWSConnection } = require('y-websocket/bin/utils');

dotenv.config();

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Security: Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error(`❌ CRITICAL: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('   Please set these in your .env file before running the server.');
  process.exit(1);
}

connectDB();

const app = express();

// Security: Set secure HTTP headers
app.use(helmet());

// Performance: Request timing middleware (must be first)
app.use(requestTiming());

// Performance: Compress responses with Brotli/Gzip
app.use(compression({
  level: 6, // Balance between speed and compression
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't accept it
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Security: Limit JSON body size to prevent DoS
app.use(express.json({ limit: '1mb' }));

// ROOM CLEANUP JOB
// The Room model has a 24h TTL index on lastActiveAt.
// This supplementary cleanup removes rooms idle for >24h that TTL may have missed,
// running every 30 minutes instead of conflicting with the TTL.
setInterval(async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await Room.deleteMany({ lastActiveAt: { $lt: twentyFourHoursAgo } });
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleanup: Deleted ${result.deletedCount} expired rooms.`);
    }
  } catch (err) {
    console.error("❌ Room Cleanup Error:", err);
  }
}, 30 * 60 * 1000);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.includes("localhost") || origin.includes(".vercel.app") || origin.includes(".onrender.com") || origin.includes("cod-play.tech")) {
      return callback(null, true);
    }
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
  credentials: true
}));

// Handle preflight requests early (Express 5 safe pattern)
app.options(/.*/, cors());

// Global rate limiting for all API routes (after CORS)
app.use('/api/', rateLimiters.api);

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: '/socket.io/',
  destroyUpgrade: false,
  maxHttpBufferSize: 1e8 // 100 MB
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  console.log("✅ Yjs Connected:", req.url);

  ws.on('error', (err) => {
    console.error("❌ Yjs WebSocket Error:", err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`📤 Yjs Disconnected: ${req.url} (code: ${code})`);
  });

  setupWSConnection(ws, req);
});

server.on('upgrade', (request, socket, head) => {
  const url = request.url;

  // Handle Yjs connections (room collaboration)
  if (url.startsWith('/codeplay-')) {
    console.log(`➡️ Routing to Yjs: ${url}`);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  // Let Socket.IO handle its own upgrades
  if (url.startsWith('/socket.io/')) {
    return;
  }

  // Log unknown WebSocket upgrade requests
  console.warn(`⚠️ Unknown WebSocket upgrade request: ${url}`);
});

// Apply strict rate limiting to auth routes
app.use("/api/auth/login", rateLimiters.auth);
app.use("/api/auth/register", rateLimiters.auth);
app.use("/api/auth/forgot-password", rateLimiters.auth);

// Apply AI rate limiter
app.use("/api/ai", rateLimiters.ai);

// Require authentication for expensive/sensitive endpoints
app.use("/api/code", authMiddleware);
app.use("/api/livekit", authMiddleware);
app.use("/api/leettools", authMiddleware);
// Apply expensive operation rate limiting to code execution
app.use("/api/code", rateLimiters.codeExecution);

// Debug logging middleware
app.use((req, res, next) => {
  if (req.path.includes('editorial')) {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/oauth", oauthRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/leettools", leetRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/livekit", livekitRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/cses", csesRoutes);

// --- MONITORING ENDPOINTS ---
// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Performance metrics endpoint (admin only)
app.get("/api/metrics", authMiddleware, (req, res) => {
  res.json({
    performance: getMetrics(),
    circuitBreakers: getAllCircuitStates(),
    timestamp: new Date().toISOString()
  });
});

// Reset circuit breaker endpoint (admin only)
app.post("/api/circuits/:name/reset", authMiddleware, (req, res) => {
  const { name } = req.params;
  if (resetCircuit(name)) {
    res.json({ success: true, message: `Circuit ${name} reset` });
  } else {
    res.status(404).json({ error: `Circuit ${name} not found` });
  }
});

app.get("/api/proxy/codechef/:handle", cacheMiddleware({ ttl: 900 }), async (req, res) => {
  try {
    const { handle } = req.params;
    const response = await fetch(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      console.warn(`CodeChef scrape returned ${response.status} for handle ${handle}`);
      return res.json({ ratingData: [], success: false });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract current rating
    const ratingText = $('.rating-number').first().text().trim();
    const currentRating = parseInt(ratingText) || 0;

    // Derive stars from rating
    const starCount = currentRating >= 2500 ? 7 : currentRating >= 2200 ? 6 : currentRating >= 2000 ? 5 :
      currentRating >= 1800 ? 4 : currentRating >= 1600 ? 3 : currentRating >= 1400 ? 2 : 1;
    const stars = currentRating > 0 ? `${starCount}★` : '-';

    // Extract highest rating
    let highestRating = 0;
    $('small').each((_, el) => {
      const text = $(el).text();
      const match = text.match(/Highest Rating\s*(\d+)/i);
      if (match) highestRating = parseInt(match[1]);
    });
    if (!highestRating) {
      const bodyText = $('body').text();
      const hMatch = bodyText.match(/Highest Rating[:\s]*(\d+)/i);
      if (hMatch) highestRating = parseInt(hMatch[1]);
    }

    // Extract global rank
    let globalRank = '-';
    const bodyText = $('body').text();
    const globalMatch = bodyText.match(/Global Rank[:\s]*(\d+)/i);
    if (globalMatch) globalRank = parseInt(globalMatch[1]);

    // Extract country rank
    let countryRank = '-';
    const countryMatch = bodyText.match(/Country Rank[:\s]*(\d+)/i);
    if (countryMatch) countryRank = parseInt(countryMatch[1]);

    // Extract rating history from embedded JS
    let ratingData = [];
    const scriptTags = $('script').toArray();
    for (const script of scriptTags) {
      const content = $(script).html() || '';
      const ratingMatch = content.match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
      if (ratingMatch) {
        try { ratingData = JSON.parse(ratingMatch[1]); } catch (e) { /* ignore parse errors */ }
        break;
      }
    }

    res.json({
      success: true,
      currentRating,
      rating: currentRating,
      highestRating: highestRating || currentRating,
      stars,
      globalRank,
      countryRank,
      ratingData,
    });
  } catch (error) {
    console.error("CodeChef Scrape Error:", error.message);
    res.json({ ratingData: [], success: false });
  }
});

// GitHub API Proxy
app.get("/api/proxy/github/:username", cacheMiddleware({ ttl: 900 }), async (req, res) => {
  try {
    const { username } = req.params;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CodePlay-App'
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const userResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers });

    if (!userResponse.ok) {
      console.warn(`GitHub API returned ${userResponse.status} for user ${username}`);
      return res.json({ success: false });
    }

    const userData = await userResponse.json();

    // Fetch repos to compute total stars
    let totalStars = 0;
    try {
      const reposResponse = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=stargazers_count&direction=desc`,
        { headers }
      );
      if (reposResponse.ok) {
        const repos = await reposResponse.json();
        totalStars = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
      }
    } catch (e) {
      console.warn("GitHub stars fetch failed:", e.message);
    }

    res.json({
      success: true,
      public_repos: userData.public_repos || 0,
      followers: userData.followers || 0,
      following: userData.following || 0,
      totalStars,
    });
  } catch (error) {
    console.error("GitHub Proxy Error:", error.message);
    res.json({ success: false });
  }
});

// Codeforces API Proxy (to avoid CORS issues)
app.get("/api/proxy/codeforces/user/info/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    const response = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("CF User Info Proxy Error:", error.message);
    res.json({ status: "FAILED", comment: error.message });
  }
});

app.get("/api/proxy/codeforces/user/rating/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    const response = await fetch(`https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("CF Rating Proxy Error:", error.message);
    res.json({ status: "FAILED", comment: error.message });
  }
});

app.get("/api/proxy/codeforces/user/status/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    // Fetch more submissions to get accurate problem count and heatmap data
    const response = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&count=1000`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("CF Status Proxy Error:", error.message);
    res.json({ status: "FAILED", comment: error.message });
  }
});

// LeetCode API Proxy (to avoid CORS issues)
app.get("/api/proxy/leetcode/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://leetcode-stats-api.herokuapp.com/${encodeURIComponent(username)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("LeetCode Proxy Error:", error.message);
    res.json({ status: "error", message: error.message });
  }
});

app.get("/", (req, res) => res.send("API & Collaboration Server is running..."));

// --- ERROR HANDLING MIDDLEWARE (must be last) ---
// Handle 404 for unmatched routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Initialize Socket.IO logic
socketHandler(io);

// Set up Socket.IO user rooms for CSES judge notifications
io.on("connection", (socket) => {
  socket.on("join_user_room", ({ userId }) => {
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });
});

// Initialize CSES Judge Worker
setJudgeIO(io);
try {
  initCSESJudgeWorker();
  console.log("✅ CSES Judge Worker initialized");
} catch (err) {
  console.warn("⚠️ CSES Judge Worker initialization failed (Redis may be unavailable):", err.message);
}

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT} (API + Collab)`);
  });
}

export { app };