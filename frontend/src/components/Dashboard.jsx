import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";
import { Plus, Code2, LogIn, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [roomId, setRoomId] = useState("");

  const handleCreateRoom = async () => {
    if (!user) { setAuthOpen(true); return; }
    // Call API to create room (mocked for now, just random ID)
    const randomId = Math.random().toString(36).substring(7);
    navigate(`/editor/${randomId}`);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomId.trim()) navigate(`/editor/${roomId}`);
  };

  return (
    <div className="dashboard-container">
      {/* NAVBAR */}
      <nav className="glass-panel" style={{ display: "flex", justifyContent: "space-between", padding: "16px 32px", alignItems: "center", position: "fixed", width: "100%", boxSizing: "border-box", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Code2 size={28} color="#8b5cf6" />
            <span style={{ fontSize: "20px", fontWeight: "700", letterSpacing: "-0.5px" }}>CodePlay</span>
        </div>
        <div>
            {user ? (
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Hello, <span style={{ color: "white" }}>{user.username}</span></span>
                    <button onClick={logout} className="btn-secondary">Logout</button>
                </div>
            ) : (
                <button onClick={() => setAuthOpen(true)} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <LogIn size={16} /> Sign In
                </button>
            )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <main style={{ height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "radial-gradient(circle at 50% 10%, #1e1b4b 0%, #09090b 60%)" }}>
        <div className="animate-fade-in" style={{ textAlign: "center", maxWidth: "800px", padding: "20px" }}>
            <h1 style={{ fontSize: "64px", margin: "0 0 20px 0", lineHeight: "1.1" }}>
                Code Together, <br/>
                <span className="gradient-text">In Real Time.</span>
            </h1>
            <p style={{ fontSize: "20px", color: "var(--text-muted)", marginBottom: "40px" }}>
                The ultimate collaborative IDE for web and software development. <br/> 
                Code with friends, build projects, and unleash creativity.
            </p>

            <div style={{ display: "flex", gap: "20px", justifyContent: "center", alignItems: "center" }}>
                <button onClick={handleCreateRoom} className="btn-primary" style={{ fontSize: "18px", padding: "16px 32px", display: "flex", gap: "10px" }}>
                    <Plus /> New Project
                </button>
                
                <form onSubmit={handleJoin} className="glass-panel" style={{ padding: "8px", borderRadius: "10px", display: "flex" }}>
                    <input 
                        type="text" 
                        placeholder="Enter Room ID..." 
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        style={{ background: "transparent", border: "none", color: "white", padding: "0 12px", outline: "none", width: "150px" }}
                    />
                    <button type="submit" style={{ background: "var(--bg-surface)", border: "none", borderRadius: "6px", padding: "8px", color: "white", cursor: "pointer" }}>
                        <ArrowRight size={18} />
                    </button>
                </form>
            </div>
        </div>
        
        {/* FEATURES GRID */}
        <div style={{ marginTop: "100px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", width: "100%", maxWidth: "1000px", padding: "0 20px" }}>
            <FeatureCard icon={<Code2 color="#06b6d4" />} title="Multi-Language" desc="Support for Web, C++, Java, Python." />
            <FeatureCard icon={<ArrowRight color="#8b5cf6" />} title="Real-Time Sync" desc="Typing shows up instantly for everyone." />
            <FeatureCard icon={<Plus color="#ef4444" />} title="AI Assistant" desc="Built-in Gemini AI to help you code." />
        </div>
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div className="glass-panel" style={{ padding: "24px", borderRadius: "16px", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ marginBottom: "16px" }}>{icon}</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>{title}</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>{desc}</p>
        </div>
    );
}
