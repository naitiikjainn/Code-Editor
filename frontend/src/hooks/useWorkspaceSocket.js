import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";
import { API_URL } from "../config";
import { useNavigate } from "react-router-dom";

// Singleton socket instance
let socketInstance = null;
export const getSocket = () => {
    if (!socketInstance) {
        socketInstance = io(API_URL, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling']
        });
    }
    return socketInstance;
};

export function useWorkspaceSocket({ id, user, authLoading, setAuthModalOpen, setLogs }) {
    const navigate = useNavigate();
    const socket = getSocket();

    // Socket State
    const [accessStatus, setAccessStatus] = useState("loading"); // loading, waiting, granted, denied, login_required
    const [waitMessage, setWaitMessage] = useState("Connecting to room...");

    // Room details
    const [activeUsers, setActiveUsers] = useState([]);
    const [pendingGuests, setPendingGuests] = useState([]);
    const [hostUserId, setHostUserId] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [hostOnline, setHostOnline] = useState(true);
    const [isReadOnly, setIsReadOnly] = useState(false);

    // Dedup refs
    const recentEventsRef = useRef(new Map());

    useEffect(() => {
        if (!id || authLoading) return;

        if (!user) {
            setAccessStatus("login_required");
            setWaitMessage("Please sign in to join this room.");
            setAuthModalOpen(true);
            return;
        }

        if (accessStatus === "login_required") {
            setAccessStatus("loading");
        }

        const joinRoom = () => {
            console.log("Joining room:", id, "as", user.username, "userId:", user.id);
            socket.emit("join_room", { roomId: id, username: user.username, userId: user.id });
        };

        joinRoom();
        socket.on("connect", joinRoom);

        // Room state
        socket.on("room_state", ({ users, hostOnline: isHostOnline, hostUserId: hostId, readOnly }) => {
            setActiveUsers(users);
            setHostOnline(isHostOnline);
            setHostUserId(hostId);
            setIsReadOnly(readOnly);
            console.log(`[Room] State updated - hostOnline: ${isHostOnline}, readOnly: ${readOnly}`);
        });

        socket.on("room_users", (users) => setActiveUsers(users));

        socket.on("status_update", ({ status, message }) => {
            setAccessStatus(status);
            setWaitMessage(message);
        });

        socket.on("access_granted", ({ isHost: amHost, hostUserId: hostId }) => {
            setAccessStatus("granted");
            setWaitMessage("");
            setIsHost(amHost);
            if (hostId) setHostUserId(hostId);
            console.log(`[Room] Access granted - isHost: ${amHost}, hostId: ${hostId}`);
        });

        socket.on("access_denied", () => {
            setAccessStatus("denied");
            setWaitMessage("The host has declined your request to join this room.");
        });

        // Host presence events
        const isDuplicateEvent = (key) => {
            const lastTime = recentEventsRef.current.get(key);
            const now = Date.now();
            if (lastTime && now - lastTime < 5000) return true;
            recentEventsRef.current.set(key, now);
            return false;
        };

        socket.on("host_left", ({ username }) => {
            if (isDuplicateEvent(`host_left:${username}`)) return;
            setHostOnline(false);
            setIsReadOnly(true);
            setLogs?.(prev => [...prev, { type: "warning", message: `⚠️ Host ${username} has left. Files are now read-only.` }]);
        });

        socket.on("host_rejoined", ({ username }) => {
            recentEventsRef.current.delete(`host_left:${username}`);
            recentEventsRef.current.delete(`user_left:${username}`);
            setHostOnline(true);
            setIsReadOnly(false);
            setLogs?.(prev => [...prev, { type: "success", message: `✅ Host ${username} is back. Editing enabled.` }]);
        });

        socket.on("user_left", ({ username, isHost }) => {
            if (isDuplicateEvent(`user_left:${username}`)) return;
            setLogs?.(prev => [...prev, { type: "info", message: `👋 ${username}${isHost ? " (Host)" : ""} has left the room.` }]);
        });

        socket.on("left_room", () => {
            navigate("/dashboard");
        });

        // Guest handling
        socket.on("request_entry", ({ username, socketId }) => {
            setPendingGuests(prev => {
                if (prev.find(p => p.socketId === socketId)) return prev;
                return [...prev, { username, socketId }];
            });
        });

        socket.on("request_cancelled", ({ socketId }) => {
            setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
        });

        const handleBeforeUnload = () => socket.emit("leave_room");
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            socket.off("connect", joinRoom);
            socket.off("room_state");
            socket.off("room_users");
            socket.off("status_update");
            socket.off("access_granted");
            socket.off("access_denied");
            socket.off("request_entry");
            socket.off("request_cancelled");
            socket.off("host_left");
            socket.off("host_rejoined");
            socket.off("user_left");
            socket.off("left_room");
        };
    }, [user, id, navigate, authLoading, accessStatus]);

    const handleGrant = useCallback((socketId) => {
        socket.emit("grant_access", { socketId });
        setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
    }, [socket]);

    const handleDeny = useCallback((socketId) => {
        socket.emit("deny_access", { socketId });
        setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
    }, [socket]);

    const handleLeaveRoom = useCallback(() => {
        console.log("[Room] Leaving room...");
        socket.emit("leave_room");
    }, [socket]);

    return {
        socket,
        accessStatus,
        setAccessStatus,
        waitMessage,
        setWaitMessage,
        activeUsers,
        pendingGuests,
        hostUserId,
        isHost,
        hostOnline,
        isReadOnly,
        handleGrant,
        handleDeny,
        handleLeaveRoom
    };
}
