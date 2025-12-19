import React, { useState } from "react";
import { API_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import { X, Mail, Lock, User, ArrowRight } from "lucide-react";

export default function AuthModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const [view, setView] = useState("login"); // login, register, forgot, reset
  const [formData, setFormData] = useState({ username: "", email: "", password: "", token: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    let endpoint = "";
    let body = {};

    if (view === "login") {
        endpoint = "/api/auth/login";
        body = { identifier: formData.identifier, password: formData.password };
    } else if (view === "register") {
        endpoint = "/api/auth/register";
        body = { username: formData.username, email: formData.email, password: formData.password };
    } else if (view === "forgot") {
        endpoint = "/api/auth/forgot-password";
        body = { email: formData.email };
    } else if (view === "reset") {
        endpoint = "/api/auth/reset-password";
        body = { token: formData.token, newPassword: formData.password };
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      if (view === "login") {
        login(data.user, data.token);
        onClose();
      } else if (view === "register") {
        setView("login");
        setSuccessMsg("Account created! Please log in.");
      } else if (view === "forgot") {
        setView("reset");
        if (data.devLink) {
            setSuccessMsg(`Dev Mode: Token auto-filled. Check terminal for link.`);
            console.log("RESET LINK:", data.devLink);
        } else {
            setSuccessMsg(data.message);
        }
        // Pre-fill token if provided (Dev mode)
        if (data.token) {
            setFormData({ ...formData, token: data.token, password: "" });
        }
      } else if (view === "reset") {
        setView("login");
        setSuccessMsg("Password updated! Please log in.");
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
            <h2 style={{ margin: 0, fontSize: "24px", color: "white" }}>
                {view === "login" && "Welcome Back"}
                {view === "register" && "Create Account"}
                {view === "forgot" && "Reset Password"}
                {view === "reset" && "New Password"}
            </h2>
            <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)", fontSize: "14px" }}>
                {view === "login" && "Enter your details to access your workspace."}
                {view === "register" && "Join thousands of developers coding together."}
                {view === "forgot" && "Enter your email to receive a reset token."}
                {view === "reset" && "Enter the token and your new password."}
            </p>
        </div>
        
        {error && <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--accent-danger)", color: "#fca5a5", padding: "10px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>⚠️ {error}</div>}
        {successMsg && <div style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid #22c55e", color: "#86efac", padding: "10px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>✅ {successMsg}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* USERNAME (Register Only) */}
          {view === "register" && (
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
          
          {/* EMAIL / IDENTIFIER */}
          {(view === "login" || view === "register" || view === "forgot") && (
             <div style={{ position: "relative" }}>
                <Mail size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
                <input 
                   type="text" 
                   placeholder={view === "login" ? "Email or Username" : "Email Address"} 
                   required
                   value={view === "login" ? (formData.identifier || "") : formData.email}
                   onChange={e => {
                       if (view === "login") setFormData({...formData, identifier: e.target.value});
                       else setFormData({...formData, email: e.target.value});
                   }}
                   style={inputStyle}
                />
             </div>
          )}

           {/* TOKEN (Reset Only) */}
           {view === "reset" && (
            <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
                <input 
                  type="text" placeholder="Reset Token" required
                  value={formData.token}
                  onChange={e => setFormData({...formData, token: e.target.value})}
                  style={inputStyle}
                />
            </div>
          )}

          {/* PASSWORD */}
          {(view === "login" || view === "register" || view === "reset") && (
            <div style={{ position: "relative" }}>
                 <Lock size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
                 <input 
                    type="password" placeholder={view === "reset" ? "New Password" : "Password"} required
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    style={inputStyle}
                 />
            </div>
           )}

          {/* FORGOT LINK */}
          {view === "login" && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-12px", marginBottom: "8px" }}>
                <button 
                    type="button"
                    onClick={() => { setView("forgot"); setError(""); setSuccessMsg(""); }}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer" }}
                >
                    Forgot Password?
                </button>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: "8px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
            {loading ? "Processing..." : (
                <>
                    {view === "login" && "Log In"}
                    {view === "register" && "Sign Up"}
                    {view === "forgot" && "Send Reset Link"}
                    {view === "reset" && "Update Password"}
                    <ArrowRight size={16} />
                </>
            )}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--text-muted)" }}>
          {view === "login" ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => { 
                setView(view === "login" ? "register" : "login"); 
                setError(""); 
                setSuccessMsg("");
                setFormData({ username: "", email: "", password: "", identifier: "", token: "" }); 
            }}
            style={{ background: "none", border: "none", color: "var(--accent-secondary)", fontWeight: "600", cursor: "pointer", textDecoration: "underline" }}
          >
            {view === "login" ? "Sign up" : "Log in"}
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