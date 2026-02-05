import React, { useRef, useEffect, useState } from "react";
import { X, Ban, Terminal } from "lucide-react";

export default function ConsolePanel({ 
    logs, isOpen, onClose, onClear, input, setInput, height
}) {
  const endRef = useRef(null);

  useEffect(() => {
    // endRef.current?.scrollIntoView({ behavior: "smooth" }); // DEBUG: Disabled to prevent UI scroll hijacking
    if (endRef.current?.parentElement) {
        endRef.current.parentElement.scrollTop = endRef.current.parentElement.scrollHeight;
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        height: height || "250px",
        flexShrink: 0,
        backgroundColor: "rgba(0,0,0,0.95)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
      }}
    >
      {/* TOOLBAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", height: "34px", flexShrink: 0 }}>
        
        <div style={{ display: "flex", height: "100%", alignItems: "center", gap: "8px", paddingLeft: "4px" }}>
            <Terminal size={13} color="var(--text-muted)" />
            <span style={{ fontWeight: "600", fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.5px" }}>TERMINAL</span>
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          <button onClick={onClear} title="Clear" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", padding: "4px 8px", borderRadius: "6px", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Ban size={12} /> Clear
          </button>
          <button onClick={onClose} title="Close" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px 6px", borderRadius: "6px", display: "flex", alignItems: "center", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* CONTENT (SPLIT VIEW) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          
          {/* OUTPUT AREA */}
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "12px 16px", borderRight: "1px solid rgba(255,255,255,0.04)", color: "#d4d4d4", fontSize: "13px", lineHeight: "1.6" }}>
            {logs.length === 0 ?
              <div style={{ color: "rgba(255,255,255,0.15)", fontStyle: "italic", marginTop: "12px", fontSize: "12px" }}>$ Ready to compile...</div> : 
              logs.map((log, i) => (
                log && (
                <div key={i} style={{ padding: "1px 0", color: log.type === "error" ? "#ff6b6b" : log.type === "success" ? "#51cf66" : (log.type === "info" ? "#74c0fc" : "#d4d4d4"), display: "flex", alignItems: "flex-start" }}>
                  <span style={{ color: "rgba(255,255,255,0.15)", marginRight: "10px", userSelect: "none", fontSize: "12px" }}>$</span>
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {typeof log === "string"
                        ? log
                        : (typeof log.message === 'object' ? JSON.stringify(log.message) : String(log.message || ""))}
                  </div>
                </div>
                )
              ))
            }
            <div ref={endRef} />
          </div>

          {/* INPUT AREA */}
          <div style={{ width: "280px", display: "flex", flexDirection: "column" }}>
             <div style={{ padding: "6px 12px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", letterSpacing: "0.5px" }}>
                STDIN
             </div>
             <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter input here..."
                style={{ 
                    flex: 1, 
                    background: "rgba(0,0,0,0.5)", 
                    border: "none", 
                    color: "#00ff9d", 
                    padding: "12px", 
                    fontFamily: "inherit", 
                    fontSize: "13px", 
                    resize: "none", 
                    outline: "none",
                    lineHeight: "1.5"
                }}
             />
          </div>
      </div>
    </div>
  );
}