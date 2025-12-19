import React, { useState } from "react";
import { API_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import { X, Mail, Lock, User, ArrowRight } from "lucide-react";

export default function AuthModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      if (isLogin) {
        login(data.user, data.token);
        onClose();
      } else {
        setIsLogin(true);
        setError("Account created! Please log in.");
      }
    } catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
      <div className="glass-panel" style={{ width: "360px", padding: "32px", borderRadius: "16px", position: "relative", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
        
        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={20} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h2 style={{ margin: 0, fontSize: "24px", color: "white" }}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
            <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)", fontSize: "14px" }}>
                {isLogin ? "Enter your details to access your workspace." : "Join thousands of developers coding together."}
            </p>
        </div>
        
        {error && <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--accent-danger)", color: "#fca5a5", padding: "10px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {!isLogin && (
            <div style={{ position: "relative" }}>
                <User size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
                <input 
                  type="text" placeholder="Username" required
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  style={inputStyle}
                />
            </div>
          )}
          
          <div style={{ position: "relative" }}>
             <Mail size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
             <input 
                type="email" placeholder="Email Address" required
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                style={inputStyle}
             />
          </div>

          <div style={{ position: "relative" }}>
             <Lock size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
             <input 
                type="password" placeholder="Password" required
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                style={inputStyle}
             />
          </div>
          
          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: "8px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
            {loading ? "Processing..." : (isLogin ? <>Log In <ArrowRight size={16} /></> : "Sign Up")}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--text-muted)" }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--accent-secondary)", fontWeight: "600", cursor: "pointer", textDecoration: "underline" }}
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
    width: "100%", padding: "10px 10px 10px 40px", borderRadius: "8px", 
    border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", 
    color: "white", outline: "none", fontSize: "14px", boxSizing: "border-box",
    transition: "border-color 0.2s"
};