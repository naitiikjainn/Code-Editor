import { useState, useEffect } from "react";
import { X, Save, KeyRound, Radio } from "lucide-react"; // Import Radio icon

export default function SettingsModal({ isOpen, onClose }) {
  const [cookie, setCookie] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [extensionDetected, setExtensionDetected] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCookie(localStorage.getItem("lc_session") || "");
      setCsrfToken(localStorage.getItem("lc_csrf") || "");

      // Sense Extension
      const handleExtensionReady = (event) => {
           if (event.data.type === "CODEPLAY_EXTENSION_READY") setExtensionDetected(true);
      };
      // Listen for initial announcement (might have missed it if already mounted, so we just retry via button?)
      // Actually, content script runs on load. 
      // Let's rely on user click to fetch, which will verify if it works.
      
      const handleCookies = (event) => {
        if (event.data.type === "CODEPLAY_COOKIES_RECEIVED") {
            const { success, cookie, csrfToken, error } = event.data.payload;
            if (success) {
                setCookie(cookie);
                setCsrfToken(csrfToken);
                alert("Credentials Auto-Fetched!");
            } else {
                alert(`Extension Error: ${error}`);
            }
        }
      };

      window.addEventListener("message", handleExtensionReady);
      window.addEventListener("message", handleCookies);
      return () => {
          window.removeEventListener("message", handleExtensionReady);
          window.removeEventListener("message", handleCookies);
      };
    }
  }, [isOpen]);

  const handleAutoFetch = () => {
       window.postMessage({ type: "CODEPLAY_FETCH_COOKIES" }, "*");
  };


  const handleSave = () => {
    localStorage.setItem("lc_session", cookie.trim());
    localStorage.setItem("lc_csrf", csrfToken.trim());
    onClose();
    // Optional: Toast notification
    alert("Settings Saved!");
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000
    }}>
      <div className="glass-panel" style={{
        width: "500px", padding: "24px", borderRadius: "16px",
        background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <KeyRound size={24} color="var(--accent-primary)" />
            <span>LeetCode Settings</span>
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
          To submit solutions, provide your LeetCode authentication cookies.
        </p>

        {/* Auto Fetch Button */}
        <div style={{ marginBottom: "24px", padding: "12px", background: "rgba(37, 99, 235, 0.1)", borderRadius: "8px", border: "1px solid rgba(37, 99, 235, 0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#60a5fa" }}>Have the Extension?</span>
                <button 
                  onClick={handleAutoFetch}
                  className="btn-primary" 
                  style={{ 
                      padding: "6px 12px", fontSize: "12px", background: "#2563eb", 
                      display: "flex", alignItems: "center", gap: "6px" 
                  }}
                >
                    <Radio size={14} /> Auto-Fetch Credentials
                </button>
            </div>
            <p style={{ fontSize: "11px", color: "#888", marginTop: "8px", marginBottom: 0 }}>
                Requires the "CodePlay Helper" Chrome Extension installed.
            </p>
        </div>

        {/* Inputs */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>LEETCODE_SESSION</label>
          <input 
            type="password" 
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="Paste your LEETCODE_SESSION cookie here..."
            style={{
              width: "100%", padding: "10px", borderRadius: "6px",
              background: "var(--bg-dark)", border: "1px solid var(--border-subtle)",
              color: "white", fontFamily: "monospace", fontSize: "12px"
            }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>csrftoken</label>
          <input 
            type="password" 
            value={csrfToken}
            onChange={(e) => setCsrfToken(e.target.value)}
            placeholder="Paste your csrftoken here..."
            style={{
              width: "100%", padding: "10px", borderRadius: "6px",
              background: "var(--bg-dark)", border: "1px solid var(--border-subtle)",
              color: "white", fontFamily: "monospace", fontSize: "12px"
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px" }}>Cancel</button>
          <button onClick={handleSave} className="btn-primary" style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Save size={16} /> Save Credentials
          </button>
        </div>

      </div>
    </div>
  );
}

