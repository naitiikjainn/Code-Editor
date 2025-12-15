import React, { useRef, useEffect } from "react";

// Added 'style' prop here
export default function ConsolePanel({ logs, isOpen, onClose, onClear, style }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, isOpen]); // Added isOpen to scroll when opened

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "relative",
        height: "200px", // Default height (overridden by style prop)
        flexShrink: 0,
        backgroundColor: "#1e1e1e",
        borderTop: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Fira Code', monospace",
        zIndex: 10,
        ...style // <--- ALLOWS OVERRIDES
      }}
    >
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", backgroundColor: "#252526", borderBottom: "1px solid #333" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "white", fontWeight: "bold" }}>OUTPUT</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClear} title="Clear" style={{ background: "transparent", border: "none", color: "#ccc", cursor: "pointer" }}>🚫</button>
          <button onClick={onClose} title="Close" style={{ background: "transparent", border: "none", color: "#ccc", cursor: "pointer" }}>✕</button>
        </div>
      </div>

      {/* LOGS */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px", color: "#d4d4d4", fontSize: "13px" }}>
        {logs.length === 0 ?
          <div style={{ color: "#555", fontStyle: "italic" }}>No output...</div> : 
          logs.map((log, i) => (
            <div key={i} style={{ borderBottom: "1px solid #2a2a2a", padding: "4px 0", color: log.type === "error" ? "#f87171" : "#d4d4d4", display: "flex" }}>
              <span style={{ color: "#569cd6", marginRight: "8px" }}>›</span>
              <span style={{ whiteSpace: "pre-wrap" }}>{log.message}</span>
            </div>
          ))
        }
        <div ref={endRef} />
      </div>
    </div>
  );
}