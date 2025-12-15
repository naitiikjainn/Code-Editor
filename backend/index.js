import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db.js";
import aiRoutes from "./routes/ai.js";
import codeRoutes from "./routes/code.js";
import shareRoutes from "./routes/share.js";
import authRoutes from "./routes/auth.js";
// 1. IMPORT SOCKET LIBRARIES
import http from "http"; 
import { Server } from "socket.io"; 

dotenv.config();
connectDB();

const app = express();
app.use(express.json());

// Allow requests from your Vercel frontend
app.use(cors({
  origin: "*", // Allow all origins for easier development
  methods: ["GET", "POST"],
  credentials: true
}));

// 2. CREATE HTTP SERVER & SOCKET SERVER
const server = http.createServer(app); // Wrap Express app
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all connections
    methods: ["GET", "POST"]
  }
});
// TRACK USERS: Map<socketId, username>
const userMap = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 1. JOIN ROOM with USERNAME
  socket.on("join_room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId; // <--- STORE ROOM ID
      socket.username = username; // <--- STORE USERNAME
    // Save username
    userMap.set(socket.id, username);
    console.log(`User ${username} (${socket.id}) joined room: ${roomId}`);

    // Get all users in this room
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const users = clients.map(clientId => userMap.get(clientId)).filter(name => name);

    // Tell everyone (including sender) who is in the room
    io.to(roomId).emit("room_users", users);
  });

  // 2. CODE CHANGE (Existing)
  socket.on("code_change", ({ roomId, code }) => {
    socket.to(roomId).emit("receive_code", code);
  });

  // 3. TYPING INDICATOR (New)
  socket.on("typing", ({ roomId, username }) => {
    socket.to(roomId).emit("user_typing", username);
  });
  socket.on("cursor_move", ({ roomId, username, position }) => {
    // position = { fileType: "cpp", lineNumber: 10, column: 5 }
    // Broadcast to everyone else in the room
    socket.to(roomId).emit("cursor_update", { username, position });
  });
  socket.on("sync_run_trigger", ({ roomId, username }) => {
    // Tell everyone else execution has started
    socket.to(roomId).emit("sync_run_start", { username });
  });

  // 6. SYNC RUN: COMPLETE
  socket.on("sync_run_result", ({ roomId, logs }) => {
    // Send the execution output to everyone else
    socket.to(roomId).emit("sync_run_complete", { logs });
  });
  // 4. DISCONNECT
socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // 1. Notify others that user left (to remove their cursor)
    if (socket.roomId && socket.username) {
        socket.to(socket.roomId).emit("user_left", { username: socket.username });
    }

    // 2. Clean up memory
    userMap.delete(socket.id);
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/share", shareRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

// 4. IMPORTANT: LISTEN WITH 'server', NOT 'app'
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});