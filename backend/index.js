import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db.js";
import aiRoutes from "./routes/ai.js";
import codeRoutes from "./routes/code.js";
import shareRoutes from "./routes/share.js";
import authRoutes from "./routes/auth.js";
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
  methods: ["GET", "POST"],
  credentials: true
}));

// 1. CREATE HTTP SERVER
const server = http.createServer(app);

// 2. SETUP SOCKET.IO (Detached Mode)
// We do NOT pass 'server' here. We handle upgrades manually below.
const io = new SocketIOServer({
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: '/socket.io/'
});

// Attach Socket.io to the HTTP server for standard polling, but handle WebSockets manually
io.attach(server, {
  destroyUpgrade: false // Important: Don't kill other non-socket.io upgrades
});

// 3. SETUP YJS WEBSOCKET SERVER
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  console.log("Yjs Connected:", req.url);
  setupWSConnection(ws, req);
});

// 4. THE ULTIMATE TRAFFIC COP
server.on('upgrade', (request, socket, head) => {
  const url = request.url;

  // ROUTE 1: Socket.io
  if (url.startsWith('/socket.io/')) {
    // Let the Socket.io engine handle it
    // Note: io.engine.handleUpgrade isn't exposed directly in v4 easily, 
    // but io.attach() above handles it. We just need to ignore it here 
    // or ensure we don't destroy it.
    // Since we used io.attach(server), Socket.io ALREADY handled this.
    // We just return to avoid double-handling.
    return;
  }

  // ROUTE 2: Yjs (Code Collaboration)
  if (url.startsWith('/codeplay-')) {
    console.log(`Routing to Yjs: ${url}`);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  // ROUTE 3: Unknown -> Destroy
  // Only destroy if it's clearly not meant for Socket.io (which might handle other paths)
  // socket.destroy(); 
});

// --- API ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/share", shareRoutes);

app.get("/", (req, res) => res.send("API & Collaboration Server is running..."));

// --- SOCKET.IO EVENTS ---
const userMap = new Map();
io.on("connection", (socket) => {
  console.log(" Chat Connected:", socket.id);

  socket.on("join_room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;
    userMap.set(socket.id, username);
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const users = clients.map(clientId => userMap.get(clientId)).filter(name => name);
    io.to(roomId).emit("room_users", users);
  });

  socket.on("typing", ({ roomId, username }) => socket.to(roomId).emit("user_typing", username));
  socket.on("sync_run_trigger", ({ roomId, username }) => socket.to(roomId).emit("sync_run_start", { username }));
  socket.on("sync_run_result", ({ roomId, logs }) => socket.to(roomId).emit("sync_run_complete", { logs }));

  socket.on("disconnect", () => {
    if (socket.roomId && socket.username) {
        socket.to(socket.roomId).emit("user_left", { username: socket.username });
    }
    userMap.delete(socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(` Server running on port ${PORT} (API + Collab)`);
});