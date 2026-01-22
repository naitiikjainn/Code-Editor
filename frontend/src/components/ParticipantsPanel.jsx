import { memo } from "react";
import { Crown, User, LogOut, WifiOff, Wifi } from "lucide-react";

const ParticipantsPanel = memo(function ParticipantsPanel({ 
    users, 
    hostOnline = true, 
    isReadOnly = false, 
    onLeaveRoom,
    currentUsername 
}) {
    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", color: "white" }}>
            
            {/* HEADER */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", color: "var(--text-muted)" }}>
                PARTICIPANTS ({users.length})
            </div>

            {/* HOST STATUS BANNER */}
            {!hostOnline && (
                <div style={{ 
                    padding: "10px 16px", 
                    background: "linear-gradient(135deg, #44403c44, #78350f44)",
                    borderBottom: "1px solid #78350f",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                }}>
                    <WifiOff size={14} color="#fbbf24" />
                    <span style={{ fontSize: "12px", color: "#fbbf24" }}>
                        Host offline - Read-only mode
                    </span>
                </div>
            )}

            {/* LIST */}
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                {users.map((u, i) => (
                    <div key={i} style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        padding: "8px 12px", 
                        borderRadius: "6px", 
                        marginBottom: "4px", 
                        background: u.username === currentUsername ? "var(--accent-dim)" : "var(--bg-surface)",
                        border: u.username === currentUsername ? "1px solid var(--accent)" : "1px solid transparent"
                    }}>
                        {/* Avatar */}
                        <div style={{ 
                            width: "24px", 
                            height: "24px", 
                            borderRadius: "50%", 
                            background: `hsl(${i * 60}, 70%, 50%)`, 
                            color: "white", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            fontSize: "12px", 
                            fontWeight: "bold", 
                            marginRight: "10px",
                            position: "relative"
                        }}>
                            {u.username[0]?.toUpperCase() || "?"}
                            {/* Online indicator */}
                            <div style={{
                                position: "absolute",
                                bottom: "-2px",
                                right: "-2px",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: u.isHost && !hostOnline ? "#fbbf24" : "#22c55e",
                                border: "2px solid var(--bg-surface)"
                            }} />
                        </div>
                        
                        {/* Name */}
                        <div style={{ flex: 1, fontSize: "13px", color: "var(--text-main)" }}>
                            {u.username} 
                            {u.isHost && <span style={{ fontSize: "10px", color: "gold", marginLeft: "4px" }}>(Host)</span>}
                            {u.username === currentUsername && <span style={{ fontSize: "10px", color: "var(--accent)", marginLeft: "4px" }}>(You)</span>}
                        </div>

                        {/* Icon */}
                        {u.isHost ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <Crown size={14} color="gold" />
                                {hostOnline ? <Wifi size={10} color="#22c55e" /> : <WifiOff size={10} color="#fbbf24" />}
                            </div>
                        ) : (
                            <User size={14} color="#666" />
                        )}
                    </div>
                ))}
            </div>

            {/* LEAVE ROOM BUTTON */}
            <div style={{ padding: "12px", borderTop: "1px solid var(--border-subtle)" }}>
                <button
                    onClick={onLeaveRoom}
                    style={{
                        width: "100%",
                        padding: "10px 16px",
                        background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                        border: "none",
                        borderRadius: "8px",
                        color: "white",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.transform = "scale(1.02)";
                        e.target.style.boxShadow = "0 4px 12px rgba(220, 38, 38, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.transform = "scale(1)";
                        e.target.style.boxShadow = "none";
                    }}
                >
                    <LogOut size={16} />
                    Leave Room
                </button>
            </div>
        </div>
    );
});

export default ParticipantsPanel;
