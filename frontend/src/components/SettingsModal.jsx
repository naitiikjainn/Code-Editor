import { useState, useEffect } from "react";
import { X, Save, KeyRound, Radio } from "lucide-react"; // Import Radio icon

export default function SettingsModal({ isOpen, onClose }) {
  const [cppTemplate, setCppTemplate] = useState("");

  useEffect(() => {
    if (isOpen) {
      setCppTemplate(localStorage.getItem("user_cpp_template") || "");
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem("user_cpp_template", cppTemplate);
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
        width: "600px", padding: "24px", borderRadius: "16px",
        background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", maxHeight: "85vh"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "18px" }}>
            <KeyRound size={20} color="var(--accent-primary)" />
            <span>Settings</span>
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
                Define your custom boilerplate code for new problems.
            </p>
            
            <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "6px", color: "#60a5fa" }}>C++ Template (Codeforces / CP)</label>
                <textarea 
                    value={cppTemplate}
                    onChange={(e) => setCppTemplate(e.target.value)}
                    placeholder="#include <bits/stdc++.h>..."
                    style={{
                        width: "100%", height: "300px", padding: "12px", borderRadius: "6px",
                        background: "var(--bg-dark)", border: "1px solid var(--border-subtle)",
                        color: "#eee", fontFamily: "'Fira Code', monospace", fontSize: "13px", 
                        resize: "vertical", boxSizing: "border-box", lineHeight: "1.5"
                    }}
                    spellCheck="false"
                />
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
                    This template will be used for all new non-LeetCode C++ files.
                </div>
            </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px" }}>Cancel</button>
          <button onClick={handleSave} className="btn-primary" style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Save size={16} /> Save Settings
          </button>
        </div>

      </div>
    </div>
  );
}

