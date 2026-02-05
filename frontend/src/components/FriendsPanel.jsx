import React, { useState, useEffect } from "react";
import { API_URL } from "../config";
import { 
    Users, UserPlus, Check, X, Search, 
    Loader2, ExternalLink, Clock, Target
} from "lucide-react";

export default function FriendsPanel({ isOpen, onClose }) {
    const [tab, setTab] = useState("friends"); // friends | requests | search
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [activity, setActivity] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState({
        friends: false, requests: false, search: false, activity: false
    });
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState("");

    // Use a function to always read fresh token
    const getToken = () => localStorage.getItem("codeplay_token");

    useEffect(() => {
        if (isOpen) {
            setError("");
            setSearchResults([]);
            fetchFriends();
            fetchRequests();
            fetchActivity();
        }
    }, [isOpen]);

    const fetchFriends = async () => {
        setLoading(prev => ({ ...prev, friends: true }));
        try {
            const res = await fetch(`${API_URL}/api/friends`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to load friends");
            const data = await res.json();
            setFriends(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(prev => ({ ...prev, friends: false }));
        }
    };

    const fetchRequests = async () => {
        setLoading(prev => ({ ...prev, requests: true }));
        try {
            const res = await fetch(`${API_URL}/api/friends/requests`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to load requests");
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Fetch requests error:", err);
        } finally {
            setLoading(prev => ({ ...prev, requests: false }));
        }
    };

    const fetchActivity = async () => {
        setLoading(prev => ({ ...prev, activity: true }));
        try {
            const res = await fetch(`${API_URL}/api/friends/activity`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to load activity");
            const data = await res.json();
            setActivity(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Fetch activity error:", err);
        } finally {
            setLoading(prev => ({ ...prev, activity: false }));
        }
    };

    const handleSearch = async () => {
        if (searchQuery.length < 2) return;
        setLoading(prev => ({ ...prev, search: true }));
        try {
            const res = await fetch(`${API_URL}/api/friends/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Search failed");
            const data = await res.json();
            setSearchResults(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(prev => ({ ...prev, search: false }));
        }
    };

    const sendRequest = async (userId) => {
        setActionLoading(prev => ({ ...prev, [userId]: true }));
        try {
            const res = await fetch(`${API_URL}/api/friends/request/${userId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to send request");
            const data = await res.json();
            if (data.status === "accepted") {
                fetchFriends();
            }
            setSearchResults(prev => prev.map(u => 
                u._id === userId ? { ...u, hasPendingRequest: true } : u
            ));
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: false }));
        }
    };

    const acceptRequest = async (userId) => {
        setActionLoading(prev => ({ ...prev, [userId]: true }));
        try {
            const res = await fetch(`${API_URL}/api/friends/accept/${userId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to accept request");
            fetchFriends();
            fetchRequests();
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: false }));
        }
    };

    const rejectRequest = async (userId) => {
        setActionLoading(prev => ({ ...prev, [userId]: true }));
        try {
            const res = await fetch(`${API_URL}/api/friends/reject/${userId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to reject request");
            fetchRequests();
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: false }));
        }
    };

    const removeFriend = async (userId) => {
        setActionLoading(prev => ({ ...prev, [userId]: true }));
        try {
            const res = await fetch(`${API_URL}/api/friends/${userId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to remove friend");
            fetchFriends();
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [userId]: false }));
        }
    };

    const timeAgo = (date) => {
        const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
        if (seconds < 60) return "just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeInScale 0.25s ease-out"
        }} onClick={onClose}>
            <div 
                onClick={e => e.stopPropagation()}
                style={{
                    width: "90%", maxWidth: "600px", maxHeight: "80vh",
                    background: "rgba(28,28,30,0.92)", borderRadius: "20px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", flexDirection: "column", overflow: "hidden",
                    backdropFilter: "blur(40px) saturate(180%)",
                    boxShadow: "0 24px 48px rgba(0,0,0,0.45)"
                }}
            >
                {/* Header */}
                <div style={{ 
                    padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Users size={18} color="var(--accent-primary)" />
                        <span style={{ fontSize: "16px", fontWeight: "600", color: "#fff", letterSpacing: "-0.01em" }}>Friends</span>
                        {requests.length > 0 && (
                            <span style={{
                                background: "#ef4444", color: "#fff", fontSize: "10px",
                                padding: "2px 7px", borderRadius: "8px", fontWeight: "600"
                            }}>{requests.length}</span>
                        )}
                    </div>
                    <button onClick={onClose} style={{
                        background: "rgba(255,255,255,0.06)", border: "none", color: "var(--text-muted)",
                        cursor: "pointer", padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center",
                        transition: "background 0.2s"
                    }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}><X size={16} /></button>
                </div>

                {/* Tabs */}
                <div style={{ 
                    display: "flex", gap: "4px", padding: "10px 24px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)"
                }}>
                    {[
                        { id: "friends", label: "Friends", count: friends.length },
                        { id: "requests", label: "Requests", count: requests.length },
                        { id: "search", label: "Find Users" },
                        { id: "activity", label: "Activity" }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                padding: "7px 14px", borderRadius: "8px", fontSize: "13px",
                                fontWeight: "500", border: "none", cursor: "pointer",
                                background: tab === t.id ? "rgba(124,92,252,0.12)" : "transparent",
                                color: tab === t.id ? "var(--accent-primary)" : "var(--text-muted)",
                                transition: "all 0.2s"
                            }}
                        >
                            {t.label} {t.count !== undefined && `(${t.count})`}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
                    
                    {/* Error Banner */}
                    {error && (
                        <div style={{
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                            color: "#fca5a5", padding: "10px 14px", borderRadius: "10px",
                            fontSize: "13px", marginBottom: "12px", display: "flex",
                            alignItems: "center", justifyContent: "space-between"
                        }}>
                            <span>⚠️ {error}</span>
                            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: "16px" }}>×</button>
                        </div>
                    )}
                    
                    {/* Friends List */}
                    {tab === "friends" && (
                        loading.friends ? (
                            <LoadingState />
                        ) : friends.length === 0 ? (
                            <EmptyState icon={<Users />} text="No friends yet. Search for users to add!" />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {friends.map(friend => (
                                    <UserCard 
                                        key={friend._id} 
                                        user={friend} 
                                        action={
                                            <button
                                                onClick={() => removeFriend(friend._id)}
                                                disabled={actionLoading[friend._id]}
                                                style={{
                                                    padding: "6px 12px", borderRadius: "6px",
                                                    background: "rgba(239,68,68,0.1)", border: "none",
                                                    color: "#ef4444", fontSize: "12px", cursor: "pointer"
                                                }}
                                            >
                                                {actionLoading[friend._id] ? <Loader2 size={12} className="spin" /> : "Remove"}
                                            </button>
                                        }
                                    />
                                ))}
                            </div>
                        )
                    )}

                    {/* Requests */}
                    {tab === "requests" && (
                        loading.requests ? (
                            <LoadingState />
                        ) : requests.length === 0 ? (
                            <EmptyState icon={<UserPlus />} text="No pending friend requests" />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {requests.map(user => (
                                    <UserCard 
                                        key={user._id} 
                                        user={user} 
                                        action={
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button
                                                    onClick={() => acceptRequest(user._id)}
                                                    disabled={actionLoading[user._id]}
                                                    style={{
                                                        padding: "6px 12px", borderRadius: "6px",
                                                        background: "#22c55e", border: "none",
                                                        color: "#fff", fontSize: "12px", cursor: "pointer",
                                                        display: "flex", alignItems: "center", gap: "4px"
                                                    }}
                                                >
                                                    <Check size={12} /> Accept
                                                </button>
                                                <button
                                                    onClick={() => rejectRequest(user._id)}
                                                    disabled={actionLoading[user._id]}
                                                    style={{
                                                        padding: "6px 12px", borderRadius: "6px",
                                                        background: "rgba(255,255,255,0.05)", border: "none",
                                                        color: "#71717a", fontSize: "12px", cursor: "pointer"
                                                    }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        }
                                    />
                                ))}
                            </div>
                        )
                    )}

                    {/* Search */}
                    {tab === "search" && (
                        <div>
                            <div style={{ 
                                display: "flex", gap: "8px", marginBottom: "16px"
                            }}>
                                <input
                                    type="text"
                                    placeholder="Search by username..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                                    style={{
                                        flex: 1, padding: "12px 16px", borderRadius: "8px",
                                        background: "#1c1c1e", border: "1px solid #27272a",
                                        color: "#e4e4e7", fontSize: "14px", outline: "none"
                                    }}
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={loading.search || searchQuery.length < 2}
                                    style={{
                                        padding: "12px 20px", borderRadius: "8px",
                                        background: "#3b82f6", border: "none",
                                        color: "#fff", cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: "6px"
                                    }}
                                >
                                    {loading.search ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                                </button>
                            </div>

                            {searchResults.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {searchResults.map(user => (
                                        <UserCard 
                                            key={user._id} 
                                            user={user} 
                                            action={
                                                user.isFriend ? (
                                                    <span style={{ color: "#22c55e", fontSize: "12px" }}>✓ Friends</span>
                                                ) : user.hasPendingRequest ? (
                                                    <span style={{ color: "#71717a", fontSize: "12px" }}>Pending</span>
                                                ) : (
                                                    <button
                                                        onClick={() => sendRequest(user._id)}
                                                        disabled={actionLoading[user._id]}
                                                        style={{
                                                            padding: "6px 12px", borderRadius: "6px",
                                                            background: "#3b82f6", border: "none",
                                                            color: "#fff", fontSize: "12px", cursor: "pointer",
                                                            display: "flex", alignItems: "center", gap: "4px"
                                                        }}
                                                    >
                                                        {actionLoading[user._id] ? <Loader2 size={12} className="spin" /> : <><UserPlus size={12} /> Add</>}
                                                    </button>
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Activity Feed */}
                    {tab === "activity" && (
                        loading.activity ? (
                            <LoadingState />
                        ) : activity.length === 0 ? (
                            <EmptyState icon={<Clock />} text="No recent activity from friends" />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {activity.map((act, i) => (
                                    <div key={i} style={{
                                        display: "flex", alignItems: "flex-start", gap: "12px",
                                        padding: "12px", background: "rgba(255,255,255,0.02)",
                                        borderRadius: "10px"
                                    }}>
                                        <div style={{
                                            width: "36px", height: "36px", borderRadius: "50%",
                                            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: "#fff", fontWeight: "600", fontSize: "14px", flexShrink: 0
                                        }}>
                                            {act.user?.username?.[0]?.toUpperCase() || "?"}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                                <span style={{ fontWeight: "600", color: "#e4e4e7", fontSize: "14px" }}>
                                                    {act.user?.username || "Unknown"}
                                                </span>
                                                <span style={{ color: "#52525b", fontSize: "12px" }}>
                                                    {timeAgo(act.createdAt)}
                                                </span>
                                            </div>
                                            <div style={{ color: "#a1a1aa", fontSize: "13px" }}>
                                                {act.type === "problem_solved" && (
                                                    <>
                                                        <span style={{ color: act.data?.verdict === "Accepted" ? "#22c55e" : "#ef4444" }}>
                                                            {act.data?.verdict}
                                                        </span>
                                                        {" "}{act.data?.problemName} on {act.data?.platform}
                                                    </>
                                                )}
                                                {act.type === "friend_added" && `Added ${act.data?.friendUsername} as friend`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

// Sub-components
const UserCard = ({ user, action }) => (
    <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px", background: "rgba(255,255,255,0.02)",
        borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)"
    }}>
        <div style={{
            width: "40px", height: "40px", borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: "600", fontSize: "16px", flexShrink: 0
        }}>
            {user.username?.[0]?.toUpperCase() || "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: "600", color: "#e4e4e7", fontSize: "14px" }}>
                {user.username}
            </div>
            {user.platforms?.codeforces && (
                <div style={{ color: "#52525b", fontSize: "12px" }}>
                    CF: {user.platforms.codeforces}
                </div>
            )}
        </div>
        {action}
    </div>
);

const LoadingState = () => (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px", color: "#52525b" }}>
        <Loader2 size={24} className="spin" />
    </div>
);

const EmptyState = ({ icon, text }) => (
    <div style={{ 
        display: "flex", flexDirection: "column", alignItems: "center", 
        padding: "40px", color: "#3f3f46", gap: "12px" 
    }}>
        {React.cloneElement(icon, { size: 32 })}
        <span style={{ fontSize: "14px" }}>{text}</span>
    </div>
);
