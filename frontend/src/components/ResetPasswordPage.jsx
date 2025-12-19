import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { Code2, Lock, ArrowRight } from "lucide-react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        setStatus("error");
        setMsg("Passwords do not match");
        return;
    }
    
    setStatus("loading");
    try {
        const res = await fetch(`${API_URL}/api/auth/reset-password`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, newPassword: password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to reset");

        setStatus("success");
        setMsg("Password reset successfully! Redirecting...");
        setTimeout(() => navigate("/"), 3000);
    } catch (err) {
        setStatus("error");
        setMsg(err.message);
    }
  };

  if (!token) {
      return (
          <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b", color: "white" }}>
              <h2>Invalid Link: No token found.</h2>
          </div>
      );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#09090b", color: "white" }}>
        <div className="glass-panel" style={{ width: "380px", padding: "32px", borderRadius: "16px", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{ display: "inline-flex", padding: "12px", borderRadius: "50%", background: "var(--bg-hover)", marginBottom: "16px" }}>
                    <Lock size={32} color="var(--accent-primary)" />
                </div>
                <h2 style={{ margin: "0 0 8px 0", fontSize: "24px" }}>Set New Password</h2>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>Enter your new password below.</p>
            </div>

            {status === "error" && <div style={{ background: "#451a1a", color: "#fca5a5", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>⚠️ {msg}</div>}
            {status === "success" && <div style={{ background: "#1a4520", color: "#86efac", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>✅ {msg}</div>}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <input 
                    type="password" placeholder="New Password" required minLength={6}
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={inputStyle}
                />
                 <input 
                    type="password" placeholder="Confirm Password" required minLength={6}
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    style={inputStyle}
                />
                <button type="submit" disabled={status === "loading" || status === "success"} className="btn-primary" style={{ marginTop: "8px", display: "flex", justifyContent: "center", gap: "8px" }}>
                    {status === "loading" ? "Resetting..." : <>Reset Password <ArrowRight size={18} /></>}
                </button>
            </form>
        </div>
    </div>
  );
}

const inputStyle = {
    width: "100%", padding: "12px", borderRadius: "8px", 
    border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", 
    color: "white", outline: "none", fontSize: "14px", boxSizing: "border-box"
};
