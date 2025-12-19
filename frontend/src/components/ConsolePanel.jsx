import React, { useRef, useEffect, useState } from "react";
import { X, Ban, Terminal } from "lucide-react";

export default function ConsolePanel({ logs, isOpen, onClose, onClear, input, setInput, height }) {
  const endRef = useRef(null);
  const [activeTab, setActiveTab] = useState("output"); // 'output' | 'input'

  useEffect(() => {
    if (activeTab === "output") {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        height: height || "250px",
        flexShrink: 0, // Prevent shrinking
        backgroundColor: "#000",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* TOOLBAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", backgroundColor: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)", height: "36px" }}>
        
        <div style={{ display: "flex", height: "100%", alignItems: "center", paddingLeft: "12px" }}>
            <span style={{ fontWeight: "700", fontSize: "12px", color: "var(--text-muted)", letterSpacing: "1px" }}>TERMINAL</span>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={onClear} title="Clear" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
            <Ban size={14} /> Clear
          </button>
          <button onClick={onClose} title="Close" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* CONTENT */}
      {/* CONTENT (SPLIT VIEW) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          
          {/* OUTPUT AREA */}
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "12px", borderRight: "1px solid var(--border-subtle)", color: "#d4d4d4", fontSize: "13px", lineHeight: "1.5" }}>
            <div style={{ position: "sticky", top: "-12px", padding: "4px 8px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", marginBottom: "8px", borderBottom: "1px solid #333", display: "inline-block", fontSize: "11px", fontWeight: "bold", color: "#888", borderRadius: "0 0 4px 0" }}>OUTPUT</div>
            {logs.length === 0 ?
              <div style={{ color: "#444", fontStyle: "italic", marginTop: "12px" }}>$ Ready to compile...</div> : 
              logs.map((log, i) => (
                <div key={i} style={{ padding: "2px 0", color: log.type === "error" ? "#ef5350" : (log.type === "info" ? "#4fc3f7" : "#d4d4d4"), display: "flex", alignItems: "flex-start" }}>
                  <span style={{ color: "#666", marginRight: "10px", userSelect: "none" }}>$</span>
                  <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{log.message}</span>
                </div>
              ))
            }
            <div ref={endRef} />
          </div>

          {/* INPUT AREA */}
          <div style={{ width: "300px", display: "flex", flexDirection: "column", borderLeft: "1px solid var(--border-subtle)" }}>
             <div style={{ padding: "4px 8px", background: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)", fontSize: "11px", fontWeight: "bold", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⌨️</span> INPUT (stdin)
             </div>
             <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter input here..."
                style={{ 
                    flex: 1, 
                    background: "#0d0d0d", 
                    border: "none", 
                    color: "#00ff9d", // Slight green tint for input
                    padding: "12px", 
                    fontFamily: "inherit", 
                    fontSize: "13px", 
                    resize: "none", 
                    outline: "none" 
                }}
             />
          </div>
      </div>
    </div>
  );
}