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

// 3. SOCKET LOGIC (The "Chat Room" for Code)
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a specific "Room" (based on the Share ID)
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  // Listen for code changes and broadcast to others in the room
  socket.on("code_change", ({ roomId, code }) => {
    // Send to everyone in the room EXCEPT the sender
    socket.to(roomId).emit("receive_code", code);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
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