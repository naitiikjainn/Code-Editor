import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, User, Check } from "lucide-react";

export default function UsernamePrompt({ open }) {
  const { setUsername, logout } = useAuth();
  const [username, setUsernameValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await setUsername(username.trim());
    } catch (err) {
      setError(err.message || "Failed to set username");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10002
    }}>
      <div style={{
        width: "380px",
        background: "#0b0b0f",
        border: "1px solid #27272a",
        borderRadius: "16px",
        padding: "28px",
        color: "#e4e4e7",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        position: "relative"
      }}>
        <button
          onClick={logout}
          title="Logout"
          style={{
            position: "absolute",
            right: "16px",
            top: "16px",
            background: "transparent",
            border: "none",
            color: "#a1a1aa",
            cursor: "pointer"
          }}
        >
          <X size={18} />
        </button>

        <h3 style={{ margin: 0, fontSize: "20px", color: "#fff" }}>Choose a username</h3>
        <p style={{ margin: "8px 0 20px 0", color: "#a1a1aa", fontSize: "13px" }}>
          Your account needs a unique username to continue.
        </p>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid #ef4444",
            color: "#fca5a5",
            padding: "8px 10px",
            borderRadius: "8px",
            marginBottom: "14px",
            fontSize: "12px"
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <User size={16} style={{ position: "absolute", left: "10px", top: "12px", color: "#71717a" }} />
            <input
              type="text"
              placeholder="Username (3-20, letters/numbers/_ )"
              value={username}
              onChange={(e) => setUsernameValue(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 10px 10px 34px",
                borderRadius: "10px",
                border: "1px solid #27272a",
                background: "#0f0f12",
                color: "#e4e4e7",
                outline: "none"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg,#8b5cf6,#6366f1)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            {loading ? "Saving..." : (
              <>
                <Check size={16} /> Save Username
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
