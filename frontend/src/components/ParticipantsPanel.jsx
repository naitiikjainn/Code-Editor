import React from "react";
import { Crown, User } from "lucide-react";

export default function ParticipantsPanel({ users }) {
  // users = [{ username, isHost }, ...]
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", color: "white" }}>
        
        {/* HEADER */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: "700", letterSpacing: "1px", color: "var(--text-muted)" }}>
            PARTICIPANTS ({users.length})
        </div>

        {/* LIST */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {users.map((u, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: "6px", marginBottom: "4px", background: "var(--bg-surface)" }}>
                    {/* Avatar */}
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: `hsl(${i * 60}, 70%, 50%)`, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold", marginRight: "10px" }}>
                        {u.username[0].toUpperCase()}
                    </div>
                    
                    {/* Name */}
                    <div style={{ flex: 1, fontSize: "13px", color: "var(--text-main)" }}>
                        {u.username} {u.isHost && <span style={{ fontSize: "10px", color: "gold", marginLeft: "4px" }}>(Host)</span>}
                    </div>

                    {/* Icon */}
                    {u.isHost ? <Crown size={14} color="gold" /> : <User size={14} color="#666" />}
                </div>
            ))}
        </div>
    </div>
  );
}
