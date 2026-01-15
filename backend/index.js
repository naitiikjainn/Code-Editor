import express from "express";
import cors from "cors";
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
import Room from "./models/Room.js";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { WebSocketServer } from 'ws';
import { createRequire } from 'module';

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

// Security: Limit JSON body size to prevent DoS
app.use(express.json({ limit: '1mb' }));

// Security: Simple in-memory rate limiter for auth routes
const rateLimitMap = new Map();
const rateLimit = (windowMs, maxRequests) => (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }
    
    const requests = rateLimitMap.get(ip).filter(time => time > windowStart);
    requests.push(now);
    rateLimitMap.set(ip, requests);
    
    if (requests.length > maxRequests) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
};

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    for (const [ip, times] of rateLimitMap.entries()) {
        const filtered = times.filter(t => t > now - windowMs);
        if (filtered.length === 0) {
            rateLimitMap.delete(ip);
        } else {
            rateLimitMap.set(ip, filtered);
        }
    }
}, 5 * 60 * 1000);

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

// Apply rate limiting to auth routes (5 requests per minute for login/register)
const authRateLimiter = rateLimit(60 * 1000, 5);
app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/register", authRateLimiter);
app.use("/api/auth/forgot-password", authRateLimiter);

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

const userMap = new Map();
io.on("connection", (socket) => {
  console.log("💬 Chat Connected:", socket.id);

  socket.on("join_room", async ({ roomId, username }) => {
    let room = await Room.findOne({ roomId });
    if (!room) {
      room = new Room({ roomId, host: { username } });
      await room.save();
      console.log(`🆕 New Room Created by ${username}`);
    }

    const isHost = (room.host.username === username);
    const isParticipant = room.participants.some(p => p.username === username);

    if (isHost || isParticipant) {
      if (!isHost) console.log(`🔄 Familiar face ${username} re-joining ${roomId}`);
      else console.log(`👑 Host ${username} joined ${roomId}`);

      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = username;
      socket.isHost = isHost;
      userMap.set(socket.id, { username, isHost });

      socket.emit("access_granted");

      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const users = clients.map(clientId => userMap.get(clientId)).filter(u => u);
      io.to(roomId).emit("room_users", users);

      if (room.activeProblem) {
        socket.emit("sync_problem_state", { problem: room.activeProblem });
      }

    } else {
      console.log(`👤 New Guest ${username} asking to join ${roomId}`);

      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const hostSocketId = clients.find(clientId => {
        const user = userMap.get(clientId);
        return user && user.isHost;
      });

      if (hostSocketId) {
        userMap.set(socket.id, { username, isHost: false, status: "pending" });
        socket.roomId = roomId;
        io.to(hostSocketId).emit("request_entry", { username, socketId: socket.id });
        socket.emit("status_update", { status: "waiting", message: "Waiting for host approval..." });
      } else {
        socket.emit("status_update", { status: "waiting", message: "Waiting for host to join..." });
        socket.join(`${roomId}_waiting`);
        socket.roomId = roomId;
      }
    }
  });

  socket.on("grant_access", async ({ socketId }) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        targetSocket.leave(`${roomId}_waiting`);
        targetSocket.join(roomId);
        targetSocket.roomId = roomId;
        targetSocket.emit("access_granted");

        const guestUser = userMap.get(socketId);
        if (guestUser && guestUser.username) {
          await Room.updateOne(
            { roomId },
            { $addToSet: { participants: { username: guestUser.username } } }
          );
          console.log(`💾 Saved ${guestUser.username} to persistent allowed list.`);
          userMap.set(socketId, { ...guestUser, status: "active" });

          // IMPORTANT: Update socket object itself too
          targetSocket.username = guestUser.username;
        }

        io.to(roomId).emit("room_users", Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(id => userMap.get(id)).filter(u => u));
      }
    }
  });

  socket.on("deny_access", ({ socketId }) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        targetSocket.leave(`${roomId}_waiting`);
        targetSocket.emit("access_denied");
        userMap.delete(socketId);
        console.log(`⛔ Access Denied for ${socketId}`);
      }
    }
  });

  socket.on("typing", ({ roomId, username }) => socket.to(roomId).emit("user_typing", username));
  socket.on("sync_run_trigger", ({ roomId, username }) => socket.to(roomId).emit("sync_run_start", { username }));
  socket.on("sync_run_result", ({ roomId, logs }) => socket.to(roomId).emit("sync_run_complete", { logs }));

  if (!global.whiteboardHistory) global.whiteboardHistory = new Map();

  socket.on("draw_line", ({ roomId, prev, curr, color, width }) => {
    if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
    global.whiteboardHistory.get(roomId).push({ type: "line", prev, curr, color, width });
    socket.to(roomId).emit("draw_line", { prev, curr, color, width });
  });

  socket.on("clear_board", ({ roomId }) => {
    global.whiteboardHistory.set(roomId, []);
    socket.to(roomId).emit("clear_board");
  });

  socket.on("request_whiteboard_state", ({ roomId }) => {
    const history = global.whiteboardHistory.get(roomId) || [];
    socket.emit("whiteboard_state", history);
  });

  socket.on("draw_text", ({ roomId, x, y, text, color, fontSize }) => {
    if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
    global.whiteboardHistory.get(roomId).push({ type: "text", x, y, text, color, fontSize });
    socket.to(roomId).emit("draw_text", { x, y, text, color, fontSize });
  });

  socket.on("wb_view", ({ roomId, pan, scale }) => {
    socket.to(roomId).emit("wb_view", { pan, scale });
  });

  if (!global.roomProblems) global.roomProblems = new Map();

  socket.on("sync_problem", ({ roomId, problem }) => {
    console.log(`📤 Syncing problem to room ${roomId}: ${problem?.title} (Desc: ${problem?.description?.length || 0} chars)`);
    global.roomProblems.set(roomId, problem);
    socket.to(roomId).emit("sync_problem", problem);
  });

  socket.on("request_problem_state", ({ roomId }) => {
    const problem = global.roomProblems.get(roomId);
    console.log(`📥 Problem state requested for room ${roomId}: ${problem ? problem.title : 'NONE'}`);
    if (problem) {
      socket.emit("sync_problem", problem);
    }
  });

  socket.on("wb_cursor", ({ roomId, x, y, username, color }) => {
    socket.to(roomId).emit("wb_cursor", { x, y, username, color });
  });

  // --- VOICE CHAT SIGNALING (Mesh + State) ---
  const voiceUsers = new Map(); // roomId -> Set<{ id, username }>

  socket.on("voice-join-request", ({ roomId }) => {
    // console.log(`🎤 Voice Join: ${socket.id} (${socket.username}) in ${roomId}`);

    if (!voiceUsers.has(roomId)) voiceUsers.set(roomId, new Set());

    // Store metadata
    const roomVoiceUsers = voiceUsers.get(roomId);

    // Remove existing entry for this socket if any (to update username/prevent dups)
    for (const u of roomVoiceUsers) {
      if (u.id === socket.id) roomVoiceUsers.delete(u);
    }

    const userData = { id: socket.id, username: socket.username || "Guest" };
    roomVoiceUsers.add(userData);

    // Notify others with USERNAME
    socket.to(roomId).emit("voice-new-peer", { peerId: socket.id, username: userData.username });

    // Send the current list to the new joiner
    const currentVoiceUsers = Array.from(roomVoiceUsers).filter(u => u.id !== socket.id);
    socket.emit("voice-existing-users", { users: currentVoiceUsers });
  });

  socket.on("voice-leave", ({ roomId }) => {
    if (voiceUsers.has(roomId)) {
      const roomUsers = voiceUsers.get(roomId);
      for (const u of roomUsers) {
        if (u.id === socket.id) roomUsers.delete(u);
      }
      if (roomUsers.size === 0) voiceUsers.delete(roomId);
    }
  });

  socket.on("voice-signal", ({ targetId, signal }) => {
    // Relay signal (Offer/Answer/ICE) directly to target
    io.to(targetId).emit("voice-signal", {
      signal,
      callerId: socket.id,
      callerUsername: socket.username // Send name with signal too just in case
    });
  });

  socket.on("disconnect", () => {
    if (socket.roomId && socket.username) {
      socket.to(socket.roomId).emit("user_left", { username: socket.username });

      // Remove from Voice List
      if (voiceUsers.has(socket.roomId)) {
        const roomUsers = voiceUsers.get(socket.roomId);
        for (const u of roomUsers) {
          if (u.id === socket.id) roomUsers.delete(u);
        }
      }
    }

    if (socket.roomId) {
      socket.to(socket.roomId).emit("request_cancelled", { socketId: socket.id });
    }

    userMap.delete(socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} (API + Collab)`);
});