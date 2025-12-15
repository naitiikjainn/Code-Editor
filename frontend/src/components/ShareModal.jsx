import React, { useState, useEffect } from "react";

export default function ShareModal({ isOpen, onClose, url }) {
  const [copied, setCopied] = useState(false);

  // Reset "Copied" state when modal opens/closes
  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset text after 2 seconds
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      {/* Stop click propagation so clicking inside doesn't close modal */}
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#fff" }}>🚀 Share Your Code</h3>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <p style={{ color: "#ccc", fontSize: "14px", marginBottom: "12px" }}>
          Anyone with this link can view your code:
        </p>

        {/* Link Input & Copy Button */}
        <div style={{ display: "flex", gap: "10px" }}>
          <input 
            type="text" 
            readOnly 
            value={url} 
            style={inputStyle}
            onClick={(e) => e.target.select()} // Auto-select text on click
          />
          <button onClick={handleCopy} style={copyButtonStyle(copied)}>
            {copied ? "✅ Copied!" : "📋 Copy"}
          </button>
        </div>

      </div>
    </div>
  );
}

// --- STYLES ---
const overlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.7)", // Dimmed background
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  backdropFilter: "blur(2px)" // Blur effect
};

const modalStyle = {
  backgroundColor: "#1e1e1e",
  padding: "24px",
  borderRadius: "12px",
  width: "400px",
  maxWidth: "90%",
  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
  border: "1px solid #333",
  fontFamily: "sans-serif"
};

const inputStyle = {
  flex: 1,
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #444",
  backgroundColor: "#252526",
  color: "#fff",
  fontFamily: "'Fira Code', monospace",
  fontSize: "13px",
  outline: "none"
};

const closeButtonStyle = {
  background: "none",
  border: "none",
  color: "#888",
  fontSize: "18px",
  cursor: "pointer",
  padding: "4px"
};

const copyButtonStyle = (copied) => ({
  padding: "0 16px",
  borderRadius: "6px",
  border: "none",
  backgroundColor: copied ? "#238636" : "#007acc", // Green if copied, Blue otherwise
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "background 0.2s"
});