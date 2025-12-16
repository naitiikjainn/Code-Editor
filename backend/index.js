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

// 2. SETUP SOCKET.IO (COMPLETELY DETACHED)
// We do NOT call .attach(). We handle the upgrade manually below.
const io = new SocketIOServer({
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: '/socket.io/'
});

// 3. SETUP YJS WEBSOCKET SERVER
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  console.log(" Yjs Connected:", req.url);
  setupWSConnection(ws, req);
});

// 4. THE SINGLE TRAFFIC COP (Handles ALL Upgrades)
server.on('upgrade', (request, socket, head) => {
  const url = request.url;
  
  // CASE A: Socket.io Traffic
  if (url.startsWith('/socket.io/')) {
    // Manually pass the request to Socket.io's engine
    io.engine.handleUpgrade(request, socket, head, (ws) => {
      io.engine.emit('connection', ws, request);
    });
    return;
  }

  // CASE B: Yjs (Code Collaboration)
  if (url.startsWith('/codeplay-')) {
    console.log(` Routing to Yjs: ${url}`);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  // CASE C: Unknown -> Destroy to prevent hanging
  socket.destroy();
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
  // Bind the socket to the io instance manually if needed, 
  // but usually io.on('connection') fires via the engine.emit above.
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