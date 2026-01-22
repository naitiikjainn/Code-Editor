import Room from "../models/Room.js";

const userMap = new Map();
// Global maps (moved from index.js)
if (!global.whiteboardHistory) global.whiteboardHistory = new Map();
if (!global.roomProblems) global.roomProblems = new Map();

// --- VOICE CHAT SIGNALING (Mesh + State) ---
const voiceUsers = new Map(); // roomId -> Set<{ id, username }>

// Helper: Broadcast room state to all users in the room
const broadcastRoomState = async (io, roomId) => {
  const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  const users = clients.map((clientId) => userMap.get(clientId)).filter((u) => u && u.status === "active");

  // Check if host is online
  const hostOnline = users.some(u => u.isHost);

  // Get host info from room
  let hostUserId = null;
  try {
    const room = await Room.findOne({ roomId });
    if (room) {
      hostUserId = room.host.userId?.toString() || null;
      // Update hostOnline in DB
      if (room.hostOnline !== hostOnline) {
        room.hostOnline = hostOnline;
        await room.save();
      }
    }
  } catch (e) {
    console.error("Error updating room state:", e);
  }

  io.to(roomId).emit("room_state", {
    users,
    hostOnline,
    hostUserId,
    readOnly: !hostOnline // Read-only when host is offline
  });
};

export default function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log("💬 Chat Connected:", socket.id);

    // --- JOIN ROOM ---
    socket.on("join_room", async ({ roomId, username, userId }) => {
      let room = await Room.findOne({ roomId });

      if (!room) {
        // Create new room - this user becomes host
        room = new Room({
          roomId,
          host: { username, userId: userId || null },
          hostOnline: true
        });
        await room.save();
        console.log(`🆕 New Room Created by ${username} (userId: ${userId || 'N/A'})`);
      }

      const isHost = room.host.username === username;
      const isParticipant = room.participants.some((p) => p.username === username);

      if (isHost || isParticipant) {
        // Host or previously approved participant
        if (!isHost) console.log(`🔄 Familiar face ${username} re-joining ${roomId}`);
        else console.log(`👑 Host ${username} joined ${roomId}`);

        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = username;
        socket.userId = userId;
        socket.isHost = isHost;
        userMap.set(socket.id, { username, isHost, status: "active", userId });

        // Update host.userId if host and not set
        if (isHost && userId && !room.host.userId) {
          room.host.userId = userId;
          room.hostOnline = true;
          await room.save();
          console.log(`💾 Updated host userId: ${userId}`);
        }

        // If host rejoining, update hostOnline
        if (isHost) {
          room.hostOnline = true;
          await room.save();
        }

        socket.emit("access_granted", {
          isHost,
          hostUserId: room.host.userId?.toString() || null
        });

        // If host rejoined, notify others
        if (isHost) {
          socket.to(roomId).emit("host_rejoined", { username });
        }

        // Broadcast updated room state
        await broadcastRoomState(io, roomId);

        // Sync problem state if exists
        if (room.activeProblem) {
          socket.emit("sync_problem_state", { problem: room.activeProblem });
        }
      } else {
        // New guest - needs host approval
        console.log(`👤 New Guest ${username} asking to join ${roomId}`);

        const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        const hostSocketId = clients.find((clientId) => {
          const user = userMap.get(clientId);
          return user && user.isHost;
        });

        if (hostSocketId) {
          // Host is online - request permission
          userMap.set(socket.id, { username, isHost: false, status: "pending", userId });
          socket.roomId = roomId;
          socket.username = username;
          socket.userId = userId;

          io.to(hostSocketId).emit("request_entry", { username, socketId: socket.id });
          socket.emit("status_update", {
            status: "waiting",
            message: "Waiting for host approval...",
          });
        } else {
          // Host is offline - cannot join
          socket.emit("status_update", {
            status: "host_offline",
            message: "Host is offline. Please wait for host to join.",
          });
          socket.join(`${roomId}_waiting`);
          socket.roomId = roomId;
          socket.username = username;
          socket.userId = userId;
        }
      }
    });

    // --- GRANT ACCESS ---
    socket.on("grant_access", async ({ socketId }) => {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        const roomId = socket.roomId;
        if (roomId) {
          targetSocket.leave(`${roomId}_waiting`);
          targetSocket.join(roomId);
          targetSocket.roomId = roomId;

          const guestUser = userMap.get(socketId);
          if (guestUser && guestUser.username) {
            await Room.updateOne(
              { roomId },
              { $addToSet: { participants: { username: guestUser.username } } }
            );
            console.log(`💾 Saved ${guestUser.username} to persistent allowed list.`);
            userMap.set(socketId, { ...guestUser, status: "active" });
            targetSocket.username = guestUser.username;
          }

          // Get room to send hostUserId
          const room = await Room.findOne({ roomId });
          targetSocket.emit("access_granted", {
            isHost: false,
            hostUserId: room?.host.userId?.toString() || null
          });

          // Broadcast updated room state
          await broadcastRoomState(io, roomId);
        }
      }
    });

    // --- DENY ACCESS ---
    socket.on("deny_access", ({ socketId }) => {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        const roomId = socket.roomId;
        if (roomId) {
          targetSocket.leave(`${roomId}_waiting`);
          targetSocket.emit("access_denied");
          userMap.delete(socketId);
          console.log(`⛔ Access Denied for ${socketId}`);
        }
      }
    });

    // --- LEAVE ROOM (Explicit) ---
    socket.on("leave_room", async () => {
      const roomId = socket.roomId;
      const username = socket.username;
      const isHost = socket.isHost;

      if (!roomId) return;

      console.log(`🚪 ${username} is leaving room ${roomId}${isHost ? " (HOST)" : ""}`);

      // Leave the socket room
      socket.leave(roomId);
      socket.leave(`${roomId}_waiting`);

      // Clean up voice
      if (voiceUsers.has(roomId)) {
        const roomUsers = voiceUsers.get(roomId);
        for (const u of roomUsers) {
          if (u.id === socket.id) {
            roomUsers.delete(u);
            socket.to(roomId).emit("voice-peer-left", { peerId: socket.id });
          }
        }
        if (roomUsers.size === 0) voiceUsers.delete(roomId);
      }

      // Notify others
      socket.to(roomId).emit("user_left", { username, isHost });

      // Remove user from participants so they need approval again
      if (!isHost && username) {
        try {
          await Room.updateOne(
            { roomId },
            { $pull: { participants: { username: username } } }
          );
          console.log(`🗑️ Removed ${username} from participants - will need approval to rejoin`);
        } catch (e) {
          console.error("Error removing participant:", e);
        }
      }

      if (isHost) {
        // Host left - update room and notify for read-only mode
        try {
          await Room.updateOne({ roomId }, { hostOnline: false });
        } catch (e) {
          console.error("Error updating hostOnline:", e);
        }
        socket.to(roomId).emit("host_left", { username });
      }

      // Broadcast updated room state
      await broadcastRoomState(io, roomId);

      // Clean up socket state
      userMap.delete(socket.id);
      socket.roomId = null;
      socket.username = null;
      socket.isHost = false;

      socket.emit("left_room");
    });

    // --- TYPING INDICATOR ---
    socket.on("typing", ({ roomId, username }) => socket.to(roomId).emit("user_typing", username));

    // --- SYNC RUN ---
    socket.on("sync_run_trigger", ({ roomId, username }) =>
      socket.to(roomId).emit("sync_run_start", { username })
    );
    socket.on("sync_run_result", ({ roomId, logs }) =>
      socket.to(roomId).emit("sync_run_complete", { logs })
    );

    // --- WHITEBOARD ---
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
      global.whiteboardHistory
        .get(roomId)
        .push({ type: "text", x, y, text, color, fontSize });
      socket.to(roomId).emit("draw_text", { x, y, text, color, fontSize });
    });

    socket.on("wb_view", ({ roomId, pan, scale }) => {
      socket.to(roomId).emit("wb_view", { pan, scale });
    });

    // --- PROBLEM SYNC ---
    socket.on("sync_problem", async ({ roomId, problem }) => {
      console.log(
        `📤 Syncing problem to room ${roomId}: ${problem?.title} (Desc: ${problem?.description?.length || 0} chars)`
      );
      global.roomProblems.set(roomId, problem);

      // Also save to DB for persistence
      try {
        await Room.updateOne({ roomId }, { activeProblem: problem });
      } catch (e) {
        console.error("Error saving activeProblem:", e);
      }

      socket.to(roomId).emit("sync_problem", problem);
    });

    socket.on("request_problem_state", ({ roomId }) => {
      const problem = global.roomProblems.get(roomId);
      console.log(
        `📥 Problem state requested for room ${roomId}: ${problem ? problem.title : "NONE"}`
      );
      if (problem) {
        socket.emit("sync_problem", problem);
      }
    });

    socket.on("wb_cursor", ({ roomId, x, y, username, color }) => {
      socket.to(roomId).emit("wb_cursor", { x, y, username, color });
    });

    // --- VOICE CHAT ---
    socket.on("voice-join-request", ({ roomId }) => {
      if (!voiceUsers.has(roomId)) voiceUsers.set(roomId, new Set());

      const roomVoiceUsers = voiceUsers.get(roomId);

      // Remove existing entry for this socket if any
      for (const u of roomVoiceUsers) {
        if (u.id === socket.id) roomVoiceUsers.delete(u);
      }

      const userData = { id: socket.id, username: socket.username || "Guest" };
      roomVoiceUsers.add(userData);

      // Notify others with USERNAME
      socket.to(roomId).emit("voice-new-peer", { peerId: socket.id, username: userData.username });

      // Send the current list to the new joiner
      const currentVoiceUsers = Array.from(roomVoiceUsers).filter((u) => u.id !== socket.id);
      socket.emit("voice-existing-users", { users: currentVoiceUsers });
    });

    socket.on("voice-leave", ({ roomId }) => {
      if (voiceUsers.has(roomId)) {
        const roomUsers = voiceUsers.get(roomId);
        for (const u of roomUsers) {
          if (u.id === socket.id) {
            roomUsers.delete(u);
            socket.to(roomId).emit("voice-peer-left", { peerId: socket.id });
          }
        }
        if (roomUsers.size === 0) voiceUsers.delete(roomId);
      }
    });

    socket.on("voice-signal", ({ targetId, signal }) => {
      io.to(targetId).emit("voice-signal", {
        signal,
        callerId: socket.id,
        callerUsername: socket.username,
      });
    });

    // --- DISCONNECT (Tab close, network loss, etc.) ---
    socket.on("disconnect", async () => {
      const roomId = socket.roomId;
      const username = socket.username;
      const isHost = socket.isHost;

      if (roomId && username) {
        console.log(`👋 ${username} disconnected from ${roomId}${isHost ? " (HOST)" : ""}`);

        socket.to(roomId).emit("user_left", { username, isHost });

        // Clean up voice
        if (voiceUsers.has(roomId)) {
          const roomUsers = voiceUsers.get(roomId);
          for (const u of roomUsers) {
            if (u.id === socket.id) {
              roomUsers.delete(u);
              socket.to(roomId).emit("voice-peer-left", { peerId: socket.id });
            }
          }
          if (roomUsers.size === 0) voiceUsers.delete(roomId);
        }

        // Remove user from participants so they need approval again
        if (!isHost) {
          try {
            await Room.updateOne(
              { roomId },
              { $pull: { participants: { username: username } } }
            );
            console.log(`🗑️ Removed ${username} from participants on disconnect`);
          } catch (e) {
            console.error("Error removing participant on disconnect:", e);
          }
        }

        if (isHost) {
          // Host disconnected - enable read-only for others
          try {
            await Room.updateOne({ roomId }, { hostOnline: false });
          } catch (e) {
            console.error("Error updating hostOnline on disconnect:", e);
          }
          socket.to(roomId).emit("host_left", { username });
        }

        // Broadcast updated room state
        await broadcastRoomState(io, roomId);
      }

      if (roomId) {
        socket.to(roomId).emit("request_cancelled", { socketId: socket.id });
      }

      userMap.delete(socket.id);
    });
  });
}
