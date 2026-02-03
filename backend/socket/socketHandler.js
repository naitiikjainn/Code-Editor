import Room from "../models/Room.js";
import User from "../models/User.js";

const userMap = new Map();
// Global maps (moved from index.js)
if (!global.whiteboardHistory) global.whiteboardHistory = new Map();
if (!global.roomProblems) global.roomProblems = new Map();

// --- VOICE CHAT SIGNALING (Mesh + State) ---
const voiceUsers = new Map(); // roomId -> Set<{ id, username }>

// --- PENDING ENTRY REQUESTS (persists across host refresh) ---
const pendingRequests = new Map(); // roomId -> Map<socketId, { username, socketId }>

// --- THROTTLING / BATCHING UTILITIES ---
const throttleMap = new Map(); // key -> { lastCall, pending }
const batchQueues = new Map(); // roomId -> { events: [], timer }

/**
 * Throttle function calls - useful for high-frequency events
 * @param {string} key - Unique key for this throttle
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Minimum delay between calls (ms)
 */
const throttle = (key, fn, delay = 50) => {
    const now = Date.now();
    const state = throttleMap.get(key) || { lastCall: 0, pending: null };
    
    if (now - state.lastCall >= delay) {
        state.lastCall = now;
        throttleMap.set(key, state);
        fn();
    } else if (!state.pending) {
        state.pending = setTimeout(() => {
            state.lastCall = Date.now();
            state.pending = null;
            throttleMap.set(key, state);
            fn();
        }, delay - (now - state.lastCall));
        throttleMap.set(key, state);
    }
};

/**
 * Batch multiple events and emit them together
 * @param {string} roomId - Room to batch events for
 * @param {string} eventType - Event type
 * @param {Object} data - Event data
 * @param {Object} io - Socket.IO instance
 * @param {number} delay - Batch window (ms)
 */
const batchEmit = (roomId, eventType, data, io, delay = 100) => {
    const key = `${roomId}:${eventType}`;
    if (!batchQueues.has(key)) {
        batchQueues.set(key, { events: [], timer: null });
    }
    
    const batch = batchQueues.get(key);
    batch.events.push(data);
    
    if (!batch.timer) {
        batch.timer = setTimeout(() => {
            if (batch.events.length > 0) {
                // Emit batched events
                io.to(roomId).emit(`${eventType}_batch`, batch.events);
                batch.events = [];
            }
            batch.timer = null;
        }, delay);
    }
};

/**
 * Debounce for database operations
 */
const dbDebounce = new Map();
const debounceDbUpdate = (key, fn, delay = 500) => {
    if (dbDebounce.has(key)) {
        clearTimeout(dbDebounce.get(key));
    }
    dbDebounce.set(key, setTimeout(() => {
        dbDebounce.delete(key);
        fn();
    }, delay));
};

// Cleanup throttle/batch state periodically
setInterval(() => {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, state] of throttleMap.entries()) {
        if (now - state.lastCall > maxAge) {
            if (state.pending) clearTimeout(state.pending);
            throttleMap.delete(key);
        }
    }
    
    for (const [key, batch] of batchQueues.entries()) {
        if (batch.events.length === 0 && !batch.timer) {
            batchQueues.delete(key);
        }
    }
}, 60 * 1000);

// Helper: Broadcast room state to all users in the room
const broadcastRoomState = async (io, roomId) => {
  const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  let users = clients.map((clientId) => userMap.get(clientId)).filter((u) => u && u.status === "active");

  try {
    const room = await Room.findOne({ roomId });
    let hostUserId = null;
    let hostOnline = false;

    if (room) {
      hostUserId = room.host.userId?.toString() || null;
      const correctHostUsername = room.host.username;

      // SANITIZE: Ensure only the real host is marked as host
      users = users.map(u => {
        const isRealHost = hostUserId
          ? (u.userId && u.userId.toString() === hostUserId)
          : u.username === correctHostUsername;
        // Update userMap if inconsistent (self-healing)
        if (u.isHost !== isRealHost) {
          console.log(`🔧 Correcting host status for ${u.username}: ${u.isHost} -> ${isRealHost}`);
          u.isHost = isRealHost;
        }
        return { ...u, isHost: isRealHost };
      });

      hostOnline = users.some(u => u.isHost);

      // Update hostOnline in DB
      if (room.hostOnline !== hostOnline) {
        room.hostOnline = hostOnline;
        await room.save();
      }
    } else {
      // Fallback if room not found (shouldn't happen often)
      hostOnline = users.some(u => u.isHost);
    }

    io.to(roomId).emit("room_state", {
      users,
      hostOnline,
      hostUserId,
      readOnly: !hostOnline // Read-only when host is offline
    });

  } catch (e) {
    console.error("Error updating room state:", e);
  }
};

export default function socketHandler(io) {
  io.on("connection", (socket) => {
    console.log("💬 Chat Connected:", socket.id);

    // --- JOIN ROOM ---
    socket.on("join_room", async ({ roomId, username, userId }) => {
      let room = await Room.findOneAndUpdate(
        { roomId },
        {
          $setOnInsert: {
            roomId,
            host: { username, userId: userId || null },
            hostOnline: true
          }
        },
        { upsert: true, new: true }
      );

      // If host.userId missing, try to resolve from username
      if (room?.host && !room.host.userId && room.host.username) {
        const hostUser = await User.findOne({ username: room.host.username }).select("_id");
        if (hostUser?._id) {
          room.host.userId = hostUser._id;
          await room.save();
          console.log(`💾 Resolved host userId for ${room.host.username}: ${hostUser._id}`);
        }
      }

      if (room?.isNew) {
        console.log(`🆕 New Room Created by ${username} (userId: ${userId || 'N/A'})`);
      }

      const hostUserId = room?.host?.userId?.toString() || null;
      const isHost = hostUserId
        ? (userId && hostUserId === userId)
        : room.host.username === username;
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

        // Update host.userId/username if this socket is the real host
        if (isHost) {
          if (userId && !room.host.userId) {
            room.host.userId = userId;
          }
          if (room.host.username !== username) {
            room.host.username = username;
          }
          room.hostOnline = true;
          await room.save();
          console.log(`💾 Synced host identity: ${username} (${room.host.userId || "no-id"})`);
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

          // Re-send any pending entry requests to host
          const roomPendingRequests = pendingRequests.get(roomId);
          if (roomPendingRequests && roomPendingRequests.size > 0) {
            console.log(`👑 Host rejoined, re-sending ${roomPendingRequests.size} pending requests`);
            for (const [, request] of roomPendingRequests) {
              socket.emit("request_entry", { username: request.username, socketId: request.socketId });
            }
          }
        }

        // Broadcast updated room state
        await broadcastRoomState(io, roomId);

        // Sync problem state if exists
        if (room.activeProblem) {
          console.log(`📤 Sending problem to new joiner: ${room.activeProblem.title}`);
          socket.emit("sync_problem", room.activeProblem);
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

          // Store pending request for persistence across host refresh
          if (!pendingRequests.has(roomId)) pendingRequests.set(roomId, new Map());
          pendingRequests.get(roomId).set(socket.id, { username, socketId: socket.id });

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
          // SECURITY CHECK: Verify requester is actually the host
          // We check DB to be absolutely sure, as session verification (socket.isHost) 
          // might be stale if the user was the 'False Host' from the bug.
          const roomCheck = await Room.findOne({ roomId });
          const hostId = roomCheck?.host?.userId?.toString() || null;
          const isRealHost = hostId
            ? (socket.userId && hostId === socket.userId)
            : roomCheck?.host?.username === socket.username;
          if (!roomCheck || !isRealHost) {
            console.warn(`⚠️ Security: Non-host ${socket.username} tried to grant access in ${roomId}`);
            socket.emit("status_update", { status: "error", message: "Only the host can grant access." });
            return;
          }

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

          // Clean up pending request
          const roomPendingRequests = pendingRequests.get(roomId);
          if (roomPendingRequests) roomPendingRequests.delete(socketId);
        }
      }
    });

    // --- DENY ACCESS ---
    socket.on("deny_access", async ({ socketId }) => {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        const roomId = socket.roomId;
        if (roomId) {
          // SECURITY CHECK
          const roomCheck = await Room.findOne({ roomId });
          const hostId = roomCheck?.host?.userId?.toString() || null;
          const isRealHost = hostId
            ? (socket.userId && hostId === socket.userId)
            : roomCheck?.host?.username === socket.username;
          if (!roomCheck || !isRealHost) {
            console.warn(`⚠️ Security: Non-host ${socket.username} tried to deny access.`);
            return;
          }

          targetSocket.leave(`${roomId}_waiting`);
          targetSocket.emit("access_denied");
          userMap.delete(socketId);
          console.log(`⛔ Access Denied for ${socketId}`);

          // Clean up pending request
          const roomPendingRequests = pendingRequests.get(roomId);
          if (roomPendingRequests) roomPendingRequests.delete(socketId);
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

    // --- TYPING INDICATOR (throttled) ---
    socket.on("typing", ({ roomId, username }) => {
      if (socket.roomId === roomId) {
        // Throttle typing indicators to max once per 100ms per user
        throttle(`typing:${roomId}:${username}`, () => {
          socket.to(roomId).emit("user_typing", username);
        }, 100);
      }
    });

    // --- SYNC RUN ---
    socket.on("sync_run_trigger", ({ roomId, username }) => {
      if (socket.roomId === roomId) socket.to(roomId).emit("sync_run_start", { username });
    });

    socket.on("sync_run_result", ({ roomId, logs }) => {
      if (socket.roomId === roomId) socket.to(roomId).emit("sync_run_complete", { logs });
    });

    // --- WHITEBOARD (throttled for high-frequency drawing) ---
    socket.on("draw_line", ({ roomId, prev, curr, color, width }) => {
      if (socket.roomId !== roomId) return;
      if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
      global.whiteboardHistory.get(roomId).push({ type: "line", prev, curr, color, width });
      
      // Throttle draw events to max 60fps (16ms)
      throttle(`draw:${roomId}:${socket.id}`, () => {
        socket.to(roomId).emit("draw_line", { prev, curr, color, width });
      }, 16);
    });

    socket.on("clear_board", ({ roomId }) => {
      if (socket.roomId !== roomId) return;
      global.whiteboardHistory.set(roomId, []);
      socket.to(roomId).emit("clear_board");
    });

    socket.on("request_whiteboard_state", ({ roomId }) => {
      if (socket.roomId !== roomId) return;
      const history = global.whiteboardHistory.get(roomId) || [];
      socket.emit("whiteboard_state", history);
    });

    socket.on("draw_text", ({ roomId, x, y, text, color, fontSize }) => {
      if (socket.roomId !== roomId) return;
      if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
      global.whiteboardHistory
        .get(roomId)
        .push({ type: "text", x, y, text, color, fontSize });
      socket.to(roomId).emit("draw_text", { x, y, text, color, fontSize });
    });

    socket.on("wb_view", ({ roomId, pan, scale }) => {
      if (socket.roomId === roomId) {
        // Throttle view sync to max 30fps (33ms)
        throttle(`wb_view:${roomId}:${socket.id}`, () => {
          socket.to(roomId).emit("wb_view", { pan, scale });
        }, 33);
      }
    });

    // --- CURSOR POSITION (throttled) ---
    socket.on("wb_cursor", ({ roomId, x, y, username, color }) => {
      if (socket.roomId === roomId) {
        // Throttle cursor updates to max 30fps
        throttle(`cursor:${roomId}:${socket.id}`, () => {
          socket.to(roomId).emit("wb_cursor", { x, y, username, color });
        }, 33);
      }
    });

    // --- PROBLEM SYNC ---
    socket.on("sync_problem", async ({ roomId, problem }) => {
      // Security: Ensure user is in the room
      if (socket.roomId !== roomId) {
        console.warn(`⚠️ Security: ${socket.username} tried to sync problem to ${roomId} but is in ${socket.roomId}`);
        return;
      }

      console.log(
        `📤 Syncing problem to room ${roomId}: ${problem?.title} (Desc: ${problem?.description?.length || 0} chars)`
      );
      global.roomProblems.set(roomId, problem);

      // Debounce DB update to avoid excessive writes
      debounceDbUpdate(`problem:${roomId}`, async () => {
        try {
          await Room.updateOne({ roomId }, { activeProblem: problem });
        } catch (e) {
          console.error("Error saving activeProblem:", e);
        }
      }, 1000);

      socket.to(roomId).emit("sync_problem", problem);
    });

    socket.on("request_problem_state", async ({ roomId }) => {
      // Allow request if waiting or joined
      if (socket.roomId !== roomId && !socket.rooms.has(`${roomId}_waiting`)) return;

      try {
        const room = await Room.findOne({ roomId });
        // Fallback to in-memory/cache if DB is empty but we have it in memory
        // This handles cases where DB save might be lagging or failed
        let problem = room?.activeProblem;

        if (!problem || !problem.title) {
          const cached = global.roomProblems?.get(roomId);
          if (cached) {
            console.log(`[Socket] Using cached problem for room ${roomId} (DB was empty)`);
            problem = cached;
          }
        }

        console.log(
          `📥 Problem state requested for room ${roomId}: ${problem?.title || "NONE"} (Desc Len: ${problem?.description?.length || 0})`
        );
        if (problem) {
          socket.emit("sync_problem", problem);
        }
      } catch (e) {
        console.error("Error fetching problem state:", e);
      }

    });

    // --- FILE SYNC ---
    socket.on("sync_file_created", ({ roomId, file }) => {
      if (socket.roomId !== roomId) return;
      console.log(`📁 File created in room ${roomId}: ${file?.name}`);
      socket.to(roomId).emit("sync_file_created", { file });
    });

    socket.on("sync_file_deleted", ({ roomId, fileId }) => {
      if (socket.roomId !== roomId) return;
      console.log(`🗑️ File deleted in room ${roomId}: ${fileId}`);
      socket.to(roomId).emit("sync_file_deleted", { fileId });
    });

    // --- ACTIVE FILE SYNC ---
    socket.on("sync_active_file", async ({ roomId, fileId }) => {
      if (socket.roomId !== roomId) return;
      console.log(`📂 Active file changed in room ${roomId}: ${fileId}`);
      try {
        await Room.updateOne({ roomId }, { activeFileId: fileId });
      } catch (e) {
        console.error("Error saving activeFileId:", e);
      }
      socket.to(roomId).emit("sync_active_file", { fileId });
    });

    socket.on("request_active_file", async ({ roomId }) => {
      if (socket.roomId !== roomId) return;
      try {
        const room = await Room.findOne({ roomId });
        const fileId = room?.activeFileId;
        console.log(`📂 Active file requested for room ${roomId}: ${fileId || "NONE"}`);
        if (fileId) {
          socket.emit("sync_active_file", { fileId });
        }
      } catch (e) {
        console.error("Error fetching activeFileId:", e);
      }
    });

    socket.on("wb_cursor", ({ roomId, x, y, username, color }) => {
      if (socket.roomId === roomId) socket.to(roomId).emit("wb_cursor", { x, y, username, color });
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

        // Clean up pending request if this was a pending guest
        const roomPendingRequests = pendingRequests.get(roomId);
        if (roomPendingRequests) roomPendingRequests.delete(socket.id);
      }

      userMap.delete(socket.id);
    });
  });
}
