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
import socketHandler from "./socket/socketHandler.js";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { WebSocketServer } from 'ws';
import { createRequire } from 'module';
import Room from "./models/Room.js";

// Performance middleware imports
import { requestTiming, getMetrics } from "./middleware/performance.js";
import { rateLimiters } from "./middleware/rateLimiter.js";
import { cacheMiddleware } from "./middleware/cache.js";
import { getAllCircuitStates, resetCircuit } from "./middleware/circuitBreaker.js";
import { errorHandler, notFoundHandler, asyncHandler } from "./middleware/errorHandler.js";

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
// Check for inactive rooms every 10 minutes
setInterval(async () => {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const result = await Room.deleteMany({ lastActiveAt: { $lt: oneHourAgo } });
        if (result.deletedCount > 0) {
            console.log(`🧹 Cleanup: Deleted ${result.deletedCount} inactive rooms.`);
        }
    } catch (err) {
        console.error("❌ Room Cleanup Error:", err);
    }
}, 10 * 60 * 1000);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.includes("localhost") || origin.includes(".vercel.app") || origin.includes(".onrender.com")) {
      return callback(null, true);
    }
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
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

// --- MONITORING ENDPOINTS ---
// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Performance metrics endpoint
app.get("/api/metrics", (req, res) => {
    res.json({
        performance: getMetrics(),
        circuitBreakers: getAllCircuitStates(),
        timestamp: new Date().toISOString()
    });
});

// Reset circuit breaker endpoint
app.post("/api/circuits/:name/reset", (req, res) => {
    const { name } = req.params;
    if (resetCircuit(name)) {
        res.json({ success: true, message: `Circuit ${name} reset` });
    } else {
        res.status(404).json({ error: `Circuit ${name} not found` });
    }
});

app.get("/api/proxy/codechef/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    const response = await fetch(`https://codechef-api.vercel.app/handle/${handle}`);

    if (!response.ok) {
      // Return empty data instead of error - graceful degradation
      console.warn(`CodeChef API returned ${response.status} for handle ${handle}`);
      return res.json({ ratingData: [], success: false });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("CodeChef Proxy Error:", error.message);
    // Graceful degradation - return empty data
    res.json({ ratingData: [], success: false });
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

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT} (API + Collab)`);
  });
}

export { app };