import Room from "../models/Room.js";

const userMap = new Map();
// Global maps (moved from index.js)
if (!global.whiteboardHistory) global.whiteboardHistory = new Map();
if (!global.roomProblems) global.roomProblems = new Map();

// --- VOICE CHAT SIGNALING (Mesh + State) ---
const voiceUsers = new Map(); // roomId -> Set<{ id, username }>

export default function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log("💬 Chat Connected:", socket.id);

    socket.on("join_room", async ({ roomId, username }) => {
      let room = await Room.findOne({ roomId });
      if (!room) {
        room = new Room({ roomId, host: { username } });
        await room.save();
        console.log(`🆕 New Room Created by ${username}`);
      }

      const isHost = room.host.username === username;
      const isParticipant = room.participants.some((p) => p.username === username);

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
        const users = clients.map((clientId) => userMap.get(clientId)).filter((u) => u);
        io.to(roomId).emit("room_users", users);

        if (room.activeProblem) {
          socket.emit("sync_problem_state", { problem: room.activeProblem });
        }
      } else {
        console.log(`👤 New Guest ${username} asking to join ${roomId}`);

        const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        const hostSocketId = clients.find((clientId) => {
          const user = userMap.get(clientId);
          return user && user.isHost;
        });

        if (hostSocketId) {
          userMap.set(socket.id, { username, isHost: false, status: "pending" });
          socket.roomId = roomId;
          io.to(hostSocketId).emit("request_entry", { username, socketId: socket.id });
          socket.emit("status_update", {
            status: "waiting",
            message: "Waiting for host approval...",
          });
        } else {
          socket.emit("status_update", {
            status: "waiting",
            message: "Waiting for host to join...",
          });
          socket.join(`${roomId}_waiting`);
          socket.roomId = roomId;
        }
      }
    });

    socket.on("grant_access", async ({ socketId }) => {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        const roomId = Array.from(socket.rooms).find((r) => r !== socket.id);
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

          io.to(roomId).emit(
            "room_users",
            Array.from(io.sockets.adapter.rooms.get(roomId) || [])
              .map((id) => userMap.get(id))
              .filter((u) => u)
          );
        }
      }
    });

    socket.on("deny_access", ({ socketId }) => {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        const roomId = Array.from(socket.rooms).find((r) => r !== socket.id);
        if (roomId) {
          targetSocket.leave(`${roomId}_waiting`);
          targetSocket.emit("access_denied");
          userMap.delete(socketId);
          console.log(`⛔ Access Denied for ${socketId}`);
        }
      }
    });

    socket.on("typing", ({ roomId, username }) => socket.to(roomId).emit("user_typing", username));
    socket.on("sync_run_trigger", ({ roomId, username }) =>
      socket.to(roomId).emit("sync_run_start", { username })
    );
    socket.on("sync_run_result", ({ roomId, logs }) =>
      socket.to(roomId).emit("sync_run_complete", { logs })
    );

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

    socket.on("sync_problem", ({ roomId, problem }) => {
      console.log(
        `📤 Syncing problem to room ${roomId}: ${problem?.title} (Desc: ${problem?.description?.length || 0} chars)`
      );
      global.roomProblems.set(roomId, problem);
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
      const currentVoiceUsers = Array.from(roomVoiceUsers).filter((u) => u.id !== socket.id);
      socket.emit("voice-existing-users", { users: currentVoiceUsers });
    });

    socket.on("voice-leave", ({ roomId }) => {
      if (voiceUsers.has(roomId)) {
        const roomUsers = voiceUsers.get(roomId);
        for (const u of roomUsers) {
          if (u.id === socket.id) {
            roomUsers.delete(u);
            // Notify others that this peer left voice
            socket.to(roomId).emit("voice-peer-left", { peerId: socket.id });
          }
        }
        if (roomUsers.size === 0) voiceUsers.delete(roomId);
      }
    });

    socket.on("voice-signal", ({ targetId, signal }) => {
      // Relay signal (Offer/Answer/ICE) directly to target
      io.to(targetId).emit("voice-signal", {
        signal,
        callerId: socket.id,
        callerUsername: socket.username, // Send name with signal too just in case
      });
    });

    socket.on("disconnect", () => {
      if (socket.roomId && socket.username) {
        socket.to(socket.roomId).emit("user_left", { username: socket.username });

        // Remove from Voice List and notify peers
        if (voiceUsers.has(socket.roomId)) {
          const roomUsers = voiceUsers.get(socket.roomId);
          for (const u of roomUsers) {
            if (u.id === socket.id) {
              roomUsers.delete(u);
              // Notify others that this peer left voice
              socket.to(socket.roomId).emit("voice-peer-left", { peerId: socket.id });
            }
          }
          if (roomUsers.size === 0) voiceUsers.delete(socket.roomId);
        }
      }

      if (socket.roomId) {
        socket.to(socket.roomId).emit("request_cancelled", { socketId: socket.id });
      }

      userMap.delete(socket.id);
    });
  });
}
