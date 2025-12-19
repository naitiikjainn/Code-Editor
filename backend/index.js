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
import Room from "./models/Room.js"; // <--- NEW
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import { WebSocketServer } from 'ws';
import { createRequire } from 'module';

// Load Y-Websocket Utils
const require = createRequire(import.meta.url);
const { setupWSConnection } = require('y-websocket/bin/utils');

dotenv.config();
connectDB();

const app = express();
app.use(express.json());

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PUT"],
  credentials: true
}));

// 1. CREATE HTTP SERVER
const server = http.createServer(app);

// 2. SETUP SOCKET.IO (Attached in Non-Destructive Mode)
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: '/socket.io/',
  destroyUpgrade: false // <--- CRITICAL: Lets other WebSockets (Yjs) pass through
});

// 3. SETUP YJS WEBSOCKET SERVER
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  console.log("✅ Yjs Connected:", req.url);
  setupWSConnection(ws, req);
});

// 4. THE TRAFFIC COP (Handle Upgrades Manually)
server.on('upgrade', (request, socket, head) => {
  const url = request.url;

  // CASE A: Yjs (Code Collaboration)
  // We grab this FIRST.
  if (url.startsWith('/codeplay-')) {
    console.log(`➡️ Routing to Yjs: ${url}`);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  // CASE B: Socket.io
  // We do NOTHING here. Since we used io.attach(server), 
  // Socket.io has its own listener that will handle this automatically.
  if (url.startsWith('/socket.io/')) {
    return;
  }

  // CASE C: Unknown -> Destroy to prevent hanging
  // socket.destroy();
});

// --- API ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/rooms", roomRoutes); // <--- NEW


app.get("/", (req, res) => res.send("API & Collaboration Server is running..."));

// --- SOCKET.IO EVENTS ---
const userMap = new Map();
io.on("connection", (socket) => {
  console.log("💬 Chat Connected:", socket.id);

  socket.on("join_room", async ({ roomId, username }) => {
    // 1. Check who is the host
    let room = await Room.findOne({ roomId });

    // AUTO-CREATE if fresh room (First user becomes Host)
    if (!room) {
      room = new Room({ roomId, host: { username } });
      await room.save();
      console.log(`🆕 New Room Created by ${username}`);
    }

    const isHost = (room.host.username === username);

    // Check if user is already a participant (PERSISTENCE CHECK)
    const isParticipant = room.participants.some(p => p.username === username);

    if (isHost || isParticipant) {
      if (!isHost) console.log(`🔄 Familiar face ${username} re-joining ${roomId}`);
      else console.log(`👑 Host ${username} joined ${roomId}`);

      // AUTO-JOIN
      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = username;
      socket.isHost = isHost;
      userMap.set(socket.id, { username, isHost });

      socket.emit("access_granted"); // <--- UNBLOCK

      // Broadcast full list
      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const users = clients.map(clientId => userMap.get(clientId)).filter(u => u);
      io.to(roomId).emit("room_users", users);

    } else {
      // GUEST JOINING (New)
      console.log(`👤 New Guest ${username} asking to join ${roomId}`);

      // Find if host is in the room
      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      const hostSocketId = clients.find(clientId => {
        const user = userMap.get(clientId);
        return user && user.isHost;
      });

      if (hostSocketId) {
        // Host is online, ask for permission
        userMap.set(socket.id, { username, isHost: false, status: "pending" });
        socket.roomId = roomId; // <--- Track room for disconnect cleanup

        io.to(hostSocketId).emit("request_entry", { username, socketId: socket.id });
        socket.emit("status_update", { status: "waiting", message: "Waiting for host approval..." });
      } else {
        // Host offline
        socket.emit("status_update", { status: "waiting", message: "Waiting for host to join..." });
        socket.join(`${roomId}_waiting`);
        socket.roomId = roomId; // <--- Track room for disconnect cleanup
      }
    }
  });

  // HOST DECISION
  socket.on("grant_access", async ({ socketId }) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id); // Get host's room

      if (roomId) {
        targetSocket.leave(`${roomId}_waiting`); // Leave waiting room
        targetSocket.join(roomId);
        targetSocket.roomId = roomId;

        // Retrieve guest username from the temporary request payload or trust client re-sync?
        // Simpler: The targetSocket.username MIGHT be missing if we didn't set it in join_room (guest path). 
        // We know we emitted 'request_entry' with username. 
        // Let's assume we can get it from a pending map or just set a default if missing.
        // Actually, in the current flow, we can just clear the waiting status.
        // The Guest component will stay mounted.

        targetSocket.emit("access_granted");

        // PERSIST TO DB (So they can re-join later without asking)
        // We need the guest's username. 
        // We stored it in userMap as "pending".
        const guestUser = userMap.get(socketId);
        if (guestUser && guestUser.username) {
          await Room.updateOne(
            { roomId },
            { $addToSet: { participants: { username: guestUser.username } } }
          );
          console.log(`💾 Saved ${guestUser.username} to persistent allowed list.`);

          // Update userMap to be active
          userMap.set(socketId, { ...guestUser, status: "active" });
        }

        io.to(roomId).emit("room_users", Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(id => userMap.get(id)).filter(u => u));
      }
    }
  });

  // HOST DENY
  socket.on("deny_access", ({ socketId }) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        targetSocket.leave(`${roomId}_waiting`); // Leave waiting room
        // Emit denied event to guest
        targetSocket.emit("access_denied");

        // Remove from userMap/Pending List logic
        // Since we added them as "pending" in userMap, we should ideally remove them?
        // Or just leave them unconnected. 
        // Let's remove them from userMap so they don't show up in any list.
        userMap.delete(socketId);

        console.log(`⛔ Access Denied for ${socketId}`);
      }
    }
  });

  socket.on("typing", ({ roomId, username }) => socket.to(roomId).emit("user_typing", username));
  socket.on("sync_run_trigger", ({ roomId, username }) => socket.to(roomId).emit("sync_run_start", { username }));
  socket.on("sync_run_result", ({ roomId, logs }) => socket.to(roomId).emit("sync_run_complete", { logs }));

  socket.on("disconnect", () => {
    if (socket.roomId && socket.username) {
      socket.to(socket.roomId).emit("user_left", { username: socket.username });
    }

    // Cleanup Pending Requests on Host
    if (socket.roomId) {
      // Just tell the room (Host will pick it up) that this socket is gone
      socket.to(socket.roomId).emit("request_cancelled", { socketId: socket.id });
    }

    userMap.delete(socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} (API + Collab)`);
});