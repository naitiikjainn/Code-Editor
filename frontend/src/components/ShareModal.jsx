import React, { useState, useEffect, useRef } from "react";

export default function ShareModal({ isOpen, onClose, url }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  // Reset "Copied" state when modal opens/closes and cleanup timer
  useEffect(() => {
    if (isOpen) setCopied(false);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0, color: "#fff", fontSize: "17px", fontWeight: 600, letterSpacing: "-0.02em" }}>Share Your Code</h3>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "16px", lineHeight: 1.5 }}>
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
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

      </div>
    </div>
  );
}

// --- STYLES ---
const overlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  backdropFilter: "blur(8px)",
  animation: "fadeInScale 0.25s ease-out"
};

const modalStyle = {
  background: "rgba(28, 28, 30, 0.9)",
  backdropFilter: "blur(40px)",
  padding: "28px",
  borderRadius: "16px",
  width: "420px",
  maxWidth: "90%",
  boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontFamily: "var(--font-main)"
};

const inputStyle = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  backgroundColor: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  outline: "none",
  transition: "border-color 0.2s"
};

const closeButtonStyle = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  fontSize: "18px",
  cursor: "pointer",
  padding: "4px 8px",
  borderRadius: "6px",
  transition: "all 0.2s"
};

const copyButtonStyle = (copied) => ({
  padding: "0 20px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: copied ? "#30d158" : "#fff",
  color: copied ? "#fff" : "#000",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.25s",
  minWidth: "80px"
});