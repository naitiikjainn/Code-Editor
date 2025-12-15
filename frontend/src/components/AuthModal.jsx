import React, { useState } from "react";
import { API_URL } from "../config";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login/Signup
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Something went wrong");

      if (isLogin) {
        // Success! Log the user in
        login(data.user, data.token);
        onClose(); // Close modal
      } else {
        // Registration success -> Switch to login view
        setIsLogin(true);
        setError("Account created! Please log in.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: "#fff", marginTop: 0 }}>{isLogin ? "Welcome Back" : "Join CodePlay"}</h2>
        
        {error && <div style={{ color: "#ff6b6b", marginBottom: "10px", fontSize: "14px" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {!isLogin && (
            <input 
              type="text" placeholder="Username" required
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
              style={inputStyle}
            />
          )}
          <input 
            type="email" placeholder="Email" required
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
            style={inputStyle}
          />
          <input 
            type="password" placeholder="Password" required
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
            style={inputStyle}
          />
          
          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Please wait..." : (isLogin ? "Log In" : "Sign Up")}
          </button>
        </form>

        <p style={{ color: "#888", fontSize: "13px", marginTop: "15px", textAlign: "center" }}>
          {isLogin ? "New here? " : "Already have an account? "}
          <span 
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            style={{ color: "#007acc", cursor: "pointer", fontWeight: "bold" }}
          >
            {isLogin ? "Create Account" : "Log In"}
          </span>
        </p>
      </div>
    </div>
  );
}

// Styles
const overlayStyle = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalStyle = { background: "#1e1e1e", padding: "30px", borderRadius: "10px", width: "320px", border: "1px solid #333", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" };
const inputStyle = { padding: "10px", borderRadius: "5px", border: "1px solid #444", background: "#252526", color: "#fff", outline: "none" };
const buttonStyle = { padding: "10px", background: "#007acc", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" };