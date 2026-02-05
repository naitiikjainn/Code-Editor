import React, { useState } from "react";
import { API_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import { X, Mail, Lock, User, ArrowRight, Github } from "lucide-react";

// Google Icon SVG (Lucide doesn't have Google icon)
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function AuthModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const [view, setView] = useState("login"); // login, register, forgot, reset
  const [formData, setFormData] = useState({ username: "", email: "", password: "", token: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'github' | null
  const [successMsg, setSuccessMsg] = useState("");

  // Reset form state when modal closes
  const handleClose = () => {
    setFormData({ username: "", email: "", password: "", identifier: "", token: "" });
    setError("");
    setSuccessMsg("");
    setView("login");
    onClose();
  };

  if (!isOpen) return null;

  // OAuth Login Handlers
  const handleOAuthLogin = async (provider) => {
    setOauthLoading(provider);
    setError("");
    
    try {
      // Save current location to return to after login
      localStorage.setItem("codeplay_return_to", window.location.pathname);
      
      const res = await fetch(`${API_URL}/api/oauth/${provider}/url`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || `${provider} login not available`);
      
      // Redirect to OAuth provider
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setOauthLoading(null);
    }
  };

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
        login(data.user, data.token, data.refreshToken);
        onClose();
      } else if (view === "register") {
        setView("login");
        setSuccessMsg("Account created! Please log in.");
      } else if (view === "forgot") {
        setView("reset");
        if (data.devLink) {
            setSuccessMsg(`Dev Mode: Token auto-filled.`);
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10001, animation: "fadeInScale 0.25s ease-out" }}>
      <div style={{ width: "380px", maxWidth: "90%", padding: "32px", borderRadius: "20px", position: "relative", background: "rgba(28,28,30,0.92)", backdropFilter: "blur(40px) saturate(180%)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 48px rgba(0,0,0,0.45)" }}>
        
        <button onClick={handleClose} style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.06)", border: "none", color: "var(--text-muted)", cursor: "pointer", width: "28px", height: "28px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>
            <X size={16} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h2 style={{ margin: 0, fontSize: "22px", color: "white", fontWeight: "600", letterSpacing: "-0.02em" }}>
                {view === "login" && "Welcome Back"}
                {view === "register" && "Create Account"}
                {view === "forgot" && "Reset Password"}
                {view === "reset" && "New Password"}
            </h2>
            <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.5" }}>
                {view === "login" && "Enter your details to continue."}
                {view === "register" && "Join thousands of developers."}
                {view === "forgot" && "Enter your email for a reset token."}
                {view === "reset" && "Set your new password below."}
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

        {/* OAuth Buttons (Login and Register only) */}
        {(view === "login" || view === "register") && (
          <>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              margin: "24px 0",
              gap: "12px"
            }}>
              <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
              <span style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase" }}>
                or continue with
              </span>
              <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              {/* Google Button */}
              <button
                type="button"
                onClick={() => handleOAuthLogin("google")}
                disabled={oauthLoading !== null}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: oauthLoading ? "not-allowed" : "pointer",
                  opacity: oauthLoading && oauthLoading !== "google" ? 0.5 : 1,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => !oauthLoading && (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              >
                {oauthLoading === "google" ? (
                  <div className="spinner" style={{ width: 18, height: 18 }} />
                ) : (
                  <GoogleIcon />
                )}
                Google
              </button>

              {/* GitHub Button */}
              <button
                type="button"
                onClick={() => handleOAuthLogin("github")}
                disabled={oauthLoading !== null}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: oauthLoading ? "not-allowed" : "pointer",
                  opacity: oauthLoading && oauthLoading !== "github" ? 0.5 : 1,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => !oauthLoading && (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              >
                {oauthLoading === "github" ? (
                  <div className="spinner" style={{ width: 18, height: 18 }} />
                ) : (
                  <Github size={18} />
                )}
                GitHub
              </button>
            </div>
          </>
        )}

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
    width: "100%", padding: "12px 12px 12px 40px", borderRadius: "12px", 
    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", 
    color: "white", outline: "none", fontSize: "14px", boxSizing: "border-box",
    transition: "border-color 0.2s, background 0.2s",
    fontFamily: "var(--font-main)"
};