import Room from "../models/Room.js";
import User from "../models/User.js";

const userMap = new Map();
// Global maps (moved from index.js)
if (!global.whiteboardHistory) global.whiteboardHistory = new Map();
if (!global.roomProblems) global.roomProblems = new Map();

// --- VOICE CHAT SIGNALING (Mesh + State) ---
const voiceUsers = new Map(); // roomId -> Set<{ id, username }>

// --- PENDING ENTRY REQUESTS (persists across host refresh) ---
const pendingRequests = new Map(); // roomId -> Map<socketId, { username, socketId, timestamp }>
const MAX_PENDING_PER_ROOM = 20; // Limit pending requests per room

// --- PARTICIPANT GRACE PERIOD (prevents re-approval on refresh) ---
const disconnectedParticipants = new Map(); // roomId -> Map<username, { userId, disconnectTime }>
const PARTICIPANT_GRACE_PERIOD = 5 * 60 * 1000; // 5 minutes grace period

// --- WHITEBOARD LIMITS ---
const MAX_WHITEBOARD_ITEMS = 5000; // Max items per room whiteboard

// --- WAITING GUESTS (for host offline scenario) ---
const waitingGuests = new Map(); // roomId -> Set<socketId>

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

/**
 * Safe Set removal (avoids modifying Set during iteration)
 */
const safeSetRemove = (set, predicate) => {
  const toRemove = [];
  for (const item of set) {
    if (predicate(item)) toRemove.push(item);
  }
  toRemove.forEach(item => set.delete(item));
  return toRemove.length;
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

  // Clean up expired grace period entries
  for (const [roomId, participants] of disconnectedParticipants.entries()) {
    for (const [username, data] of participants.entries()) {
      if (now - data.disconnectTime > PARTICIPANT_GRACE_PERIOD) {
        participants.delete(username);
        console.log(`⏰ Grace period expired for ${username} in room ${roomId}`);
      }
    }
    if (participants.size === 0) {
      disconnectedParticipants.delete(roomId);
    }
  }

  // Clean up stale pending requests (older than 30 minutes)
  for (const [roomId, requests] of pendingRequests.entries()) {
    for (const [socketId, data] of requests.entries()) {
      if (data.timestamp && now - data.timestamp > 30 * 60 * 1000) {
        requests.delete(socketId);
      }
    }
    if (requests.size === 0) {
      pendingRequests.delete(roomId);
    }
  }

  // Clean up orphan userMap entries (sockets without rooms)
  for (const [socketId, userData] of userMap.entries()) {
    if (userData.orphanedAt && now - userData.orphanedAt > 5 * 60 * 1000) {
      userMap.delete(socketId);
      console.log(`🧹 Cleaned orphan userMap entry: ${socketId}`);
    }
  }
}, 60 * 1000);

// Track last activity for memory cleanup
const roomLastActivity = new Map(); // roomId -> timestamp

// Record room activity (call this when room has events)
const recordRoomActivity = (roomId) => {
  roomLastActivity.set(roomId, Date.now());
};

// Cleanup stale room data every 30 minutes
setInterval(() => {
  const now = Date.now();
  const maxInactiveTime = 2 * 60 * 60 * 1000; // 2 hours of inactivity

  for (const [roomId, lastActive] of roomLastActivity.entries()) {
    if (now - lastActive > maxInactiveTime) {
      // Clean up room data
      if (global.whiteboardHistory?.has(roomId)) {
        console.log(`🧹 Cleaning up whiteboard history for inactive room: ${roomId}`);
        global.whiteboardHistory.delete(roomId);
      }
      if (global.roomProblems?.has(roomId)) {
        console.log(`🧹 Cleaning up problem cache for inactive room: ${roomId}`);
        global.roomProblems.delete(roomId);
      }
      if (pendingRequests.has(roomId)) {
        pendingRequests.delete(roomId);
      }
      if (voiceUsers.has(roomId)) {
        voiceUsers.delete(roomId);
      }
      if (disconnectedParticipants.has(roomId)) {
        disconnectedParticipants.delete(roomId);
      }
      if (waitingGuests.has(roomId)) {
        waitingGuests.delete(roomId);
      }
      roomLastActivity.delete(roomId);
    }
  }

  // Log memory usage periodically
  const memUsage = process.memoryUsage();
  console.log(`📊 Memory: Heap ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, ` +
    `Rooms tracked: ${roomLastActivity.size}, WB histories: ${global.whiteboardHistory?.size || 0}`);
}, 30 * 60 * 1000);

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
      // First, try to find the existing room
      let room = await Room.findOne({ roomId });

      if (!room) {
        // Room doesn't exist — only allow creation if the user has a userId (authenticated)
        if (!userId) {
          console.warn(`⚠️ Guest ${username} tried to join non-existent room ${roomId}`);
          socket.emit("room_error", { message: "Room not found. Only authenticated users can create rooms." });
          return;
        }
        // Create a new room with this user as host
        room = await Room.create({
          roomId,
          host: { username, userId },
          hostOnline: true
        });
        console.log(`🆕 New Room Created by ${username} (userId: ${userId})`);
      }

      // If host.userId missing, try to resolve from username
      if (room?.host && !room.host.userId && room.host.username) {
        const hostUser = await User.findOne({ username: room.host.username }).select("_id");
        if (hostUser?._id) {
          room.host.userId = hostUser._id;
          await room.save();
          console.log(`💾 Resolved host userId for ${room.host.username}: ${hostUser._id}`);
        }
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
        recordRoomActivity(roomId); // Track activity for memory cleanup

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

        // If host rejoined, notify waiting guests
        if (isHost && waitingGuests.has(roomId)) {
          const waiting = waitingGuests.get(roomId);
          if (waiting.size > 0) {
            console.log(`👑 Host online, notifying ${waiting.size} waiting guest(s)`);
            for (const waitingSocketId of waiting) {
              const waitingSocket = io.sockets.sockets.get(waitingSocketId);
              if (waitingSocket) {
                waitingSocket.emit("status_update", {
                  status: "host_online",
                  message: "Host is now online! Requesting access..."
                });
                // Auto-create entry request
                if (!pendingRequests.has(roomId)) pendingRequests.set(roomId, new Map());
                const roomRequests = pendingRequests.get(roomId);
                if (roomRequests.size < MAX_PENDING_PER_ROOM) {
                  roomRequests.set(waitingSocketId, {
                    username: waitingSocket.username,
                    socketId: waitingSocketId,
                    timestamp: Date.now()
                  });
                  socket.emit("request_entry", { username: waitingSocket.username, socketId: waitingSocketId });
                }
              }
            }
            waitingGuests.delete(roomId);
          }
        }
      } else {
        // Check if user is within grace period (recently disconnected)
        const roomGrace = disconnectedParticipants.get(roomId);
        const graceEntry = roomGrace?.get(username);
        const withinGracePeriod = graceEntry && (Date.now() - graceEntry.disconnectTime < PARTICIPANT_GRACE_PERIOD);

        if (withinGracePeriod) {
          // User is reconnecting within grace period - auto-approve
          console.log(`🔄 ${username} reconnecting within grace period`);

          socket.join(roomId);
          socket.roomId = roomId;
          socket.username = username;
          socket.userId = userId;
          socket.isHost = false;
          userMap.set(socket.id, { username, isHost: false, status: "active", userId });
          recordRoomActivity(roomId);

          // Remove from grace period tracking
          roomGrace.delete(username);
          if (roomGrace.size === 0) disconnectedParticipants.delete(roomId);

          // Re-add to participants
          await Room.updateOne(
            { roomId },
            { $addToSet: { participants: { username } } }
          );

          socket.emit("access_granted", {
            isHost: false,
            hostUserId: room.host.userId?.toString() || null
          });

          await broadcastRoomState(io, roomId);

          if (room.activeProblem) {
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

            // Store pending request with limit check
            if (!pendingRequests.has(roomId)) pendingRequests.set(roomId, new Map());
            const roomRequests = pendingRequests.get(roomId);

            if (roomRequests.size >= MAX_PENDING_PER_ROOM) {
              socket.emit("status_update", {
                status: "error",
                message: "Too many pending requests. Please try again later.",
              });
              return;
            }

            roomRequests.set(socket.id, { username, socketId: socket.id, timestamp: Date.now() });

            io.to(hostSocketId).emit("request_entry", { username, socketId: socket.id });
            socket.emit("status_update", {
              status: "waiting",
              message: "Waiting for host approval...",
            });
          } else {
            // Host is offline - add to waiting list
            socket.emit("status_update", {
              status: "host_offline",
              message: "Host is offline. You'll be notified when they join.",
            });
            socket.join(`${roomId}_waiting`);
            socket.roomId = roomId;
            socket.username = username;
            socket.userId = userId;

            // Track waiting guests for notification when host joins
            if (!waitingGuests.has(roomId)) waitingGuests.set(roomId, new Set());
            waitingGuests.get(roomId).add(socket.id);
          }
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
      const userId = socket.userId;
      const isHost = socket.isHost;

      if (!roomId) return;

      console.log(`🚪 ${username} is leaving room ${roomId}${isHost ? " (HOST)" : ""}`);

      // Leave the socket room
      socket.leave(roomId);
      socket.leave(`${roomId}_waiting`);

      // Clean up voice using safe iteration
      if (voiceUsers.has(roomId)) {
        const roomUsers = voiceUsers.get(roomId);
        const removed = safeSetRemove(roomUsers, u => u.id === socket.id);
        if (removed > 0) {
          socket.to(roomId).emit("voice-peer-left", { peerId: socket.id });
        }
        if (roomUsers.size === 0) voiceUsers.delete(roomId);
      }

      // Remove from waiting guests if applicable
      if (waitingGuests.has(roomId)) {
        waitingGuests.get(roomId).delete(socket.id);
      }

      // Notify others
      socket.to(roomId).emit("user_left", { username, isHost });

      // For explicit leave, remove immediately (no grace period)
      // Grace period is only for accidental disconnects
      if (!isHost && username) {
        try {
          await Room.updateOne(
            { roomId },
            { $pull: { participants: { username: username } } }
          );
          console.log(`🗑️ Removed ${username} from participants - explicit leave`);
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
    socket.on("draw_line", ({ roomId, type, prev, curr, color, width }) => {
      if (socket.roomId !== roomId) return;

      // Input validation: ensure required fields are present and valid
      if (!prev || !curr || typeof prev.x !== 'number' || typeof prev.y !== 'number' ||
        typeof curr.x !== 'number' || typeof curr.y !== 'number') {
        console.warn(`⚠️ Invalid draw_line data from ${socket.username}`);
        return;
      }

      // Sanitize width to prevent extreme values
      const safeWidth = Math.max(1, Math.min(width || 3, 100));

      if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
      const history = global.whiteboardHistory.get(roomId);

      // Enforce whiteboard size limit
      if (history.length >= MAX_WHITEBOARD_ITEMS) {
        // Remove oldest 10% of items when limit reached
        const removeCount = Math.floor(MAX_WHITEBOARD_ITEMS * 0.1);
        history.splice(0, removeCount);
        console.log(`📋 Whiteboard limit reached for ${roomId}, removed ${removeCount} oldest items`);
      }

      const itemType = type || "line"; // Support "line" or "highlighter"
      history.push({ type: itemType, prev, curr, color, width: safeWidth });
      recordRoomActivity(roomId);

      // Throttle draw events to max 60fps (16ms)
      throttle(`draw:${roomId}:${socket.id}`, () => {
        socket.to(roomId).emit("draw_line", { type: itemType, prev, curr, color, width: safeWidth });
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

    socket.on("draw_text", ({ roomId, x, y, text, color, fontSize, bold, italic }) => {
      if (socket.roomId !== roomId) return;
      if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
      const item = { type: "text", x, y, text, color, fontSize, bold, italic };
      global.whiteboardHistory.get(roomId).push(item);
      socket.to(roomId).emit("draw_text", item);
    });

    // --- SHAPE DRAWING (rectangle, ellipse, line, arrow) ---
    socket.on("draw_shape", ({ roomId, ...shapeData }) => {
      if (socket.roomId !== roomId) return;
      if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
      global.whiteboardHistory.get(roomId).push(shapeData);
      socket.to(roomId).emit("draw_shape", shapeData);
    });

    // --- STICKY NOTES ---
    socket.on("draw_sticky", ({ roomId, ...stickyData }) => {
      if (socket.roomId !== roomId) return;
      if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
      global.whiteboardHistory.get(roomId).push(stickyData);
      socket.to(roomId).emit("draw_sticky", stickyData);
    });

    // --- UNDO/REDO ---
    socket.on("wb_undo", ({ roomId }) => {
      if (socket.roomId !== roomId) return;
      const history = global.whiteboardHistory.get(roomId);
      if (history && history.length > 0) {
        history.pop();
      }
      socket.to(roomId).emit("wb_undo");
    });

    socket.on("wb_redo", ({ roomId, item }) => {
      if (socket.roomId !== roomId) return;
      if (item) {
        if (!global.whiteboardHistory.has(roomId)) global.whiteboardHistory.set(roomId, []);
        global.whiteboardHistory.get(roomId).push(item);
        socket.to(roomId).emit("wb_redo", { item });
      }
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

      // Input validation: problem should be an object with at least a title
      if (problem && typeof problem !== 'object') {
        console.warn(`⚠️ Invalid problem data type from ${socket.username}`);
        return;
      }

      console.log(
        `📤 Syncing problem to room ${roomId}: ${problem?.title} (Desc: ${problem?.description?.length || 0} chars)`
      );
      global.roomProblems.set(roomId, problem);
      recordRoomActivity(roomId);

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

    // --- VOICE CHAT ---
    socket.on("voice-join-request", ({ roomId }) => {
      if (!voiceUsers.has(roomId)) voiceUsers.set(roomId, new Set());

      const roomVoiceUsers = voiceUsers.get(roomId);

      // Remove existing entry for this socket if any (using safe iteration)
      safeSetRemove(roomVoiceUsers, u => u.id === socket.id);

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
        const removed = safeSetRemove(roomUsers, u => u.id === socket.id);
        if (removed > 0) {
          socket.to(roomId).emit("voice-peer-left", { peerId: socket.id });
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
      const userId = socket.userId;
      const isHost = socket.isHost;

      if (roomId && username) {
        console.log(`👋 ${username} disconnected from ${roomId}${isHost ? " (HOST)" : ""}`);

        socket.to(roomId).emit("user_left", { username, isHost });

        // Clean up voice using safe iteration
        if (voiceUsers.has(roomId)) {
          const roomUsers = voiceUsers.get(roomId);
          const removed = safeSetRemove(roomUsers, u => u.id === socket.id);
          if (removed > 0) {
            socket.to(roomId).emit("voice-peer-left", { peerId: socket.id });
          }
          if (roomUsers.size === 0) voiceUsers.delete(roomId);
        }

        // Clean up waiting guests tracking
        if (waitingGuests.has(roomId)) {
          waitingGuests.get(roomId).delete(socket.id);
        }

        // For accidental disconnect, add to grace period instead of immediate removal
        // This allows users to reconnect within 5 minutes without needing re-approval
        if (!isHost && username) {
          // Add to grace period tracking
          if (!disconnectedParticipants.has(roomId)) {
            disconnectedParticipants.set(roomId, new Map());
          }
          disconnectedParticipants.get(roomId).set(username, {
            userId: userId,
            disconnectTime: Date.now()
          });
          console.log(`⏱️ ${username} added to grace period (5 min to reconnect)`);

          // Note: We still remove from DB, but grace period will auto-approve on reconnect
          try {
            await Room.updateOne(
              { roomId },
              { $pull: { participants: { username: username } } }
            );
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
