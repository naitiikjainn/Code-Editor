import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db.js";
import aiRoutes from "./routes/ai.js";
import codeRoutes from "./routes/code.js";
import shareRoutes from "./routes/share.js";
import authRoutes from "./routes/auth.js";
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
connectDB();

const app = express();
app.use(express.json());

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
  setupWSConnection(ws, req);
});

server.on('upgrade', (request, socket, head) => {
  const url = request.url;
  if (url.startsWith('/codeplay-')) {
    console.log(`➡️ Routing to Yjs: ${url}`);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }
  if (url.startsWith('/socket.io/')) {
    return;
  }
});

app.use("/api/auth", authRoutes);
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
      return res.status(response.status).json({ error: "CodeChef API Error", status: response.status });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ error: "Failed to connect to CodeChef API", details: error.message });
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
    global.roomProblems.set(roomId, problem);
    socket.to(roomId).emit("sync_problem", problem);
  });

  socket.on("request_problem_state", ({ roomId }) => {
    const problem = global.roomProblems.get(roomId);
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