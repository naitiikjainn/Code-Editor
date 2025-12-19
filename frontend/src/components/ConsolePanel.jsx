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
        
        {/* TABS */}
        <div style={{ display: "flex", height: "100%" }}>
            <div 
                onClick={() => setActiveTab("output")}
                style={{
                    display: "flex", gap: "8px", alignItems: "center", color: activeTab === "output" ? "#fff" : "var(--text-muted)", 
                    fontSize: "12px", fontWeight: "bold", letterSpacing: "1px", height: "100%", padding: "0 12px", cursor: "pointer",
                    borderBottom: activeTab === "output" ? "2px solid var(--accent-primary)" : "2px solid transparent",
                    background: activeTab === "output" ? "var(--bg-surface)" : "transparent"
                }}
            >
                <Terminal size={14} /> OUTPUT
            </div>
            
            <div 
                onClick={() => setActiveTab("input")}
                style={{
                    display: "flex", gap: "8px", alignItems: "center", color: activeTab === "input" ? "#fff" : "var(--text-muted)", 
                    fontSize: "12px", fontWeight: "bold", letterSpacing: "1px", height: "100%", padding: "0 12px", cursor: "pointer",
                    borderBottom: activeTab === "input" ? "2px solid var(--accent-primary)" : "2px solid transparent",
                    background: activeTab === "input" ? "var(--bg-surface)" : "transparent"
                }}
            >
                <span style={{ fontSize: "14px" }}>⌨️</span> INPUT
            </div>
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
      {activeTab === "output" ? (
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "12px", color: "#d4d4d4", fontSize: "13px", lineHeight: "1.5" }}>
            {logs.length === 0 ?
              <div style={{ color: "#444", fontStyle: "italic" }}>$ Ready to compile...</div> : 
              logs.map((log, i) => (
                <div key={i} style={{ padding: "2px 0", color: log.type === "error" ? "#ef5350" : (log.type === "info" ? "#4fc3f7" : "#d4d4d4"), display: "flex", alignItems: "flex-start" }}>
                  <span style={{ color: "#666", marginRight: "10px", userSelect: "none" }}>$</span>
                  <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{log.message}</span>
                </div>
              ))
            }
            <div ref={endRef} />
          </div>
      ) : (
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter standard input (stdin) for your program here..."
            style={{ 
                flex: 1, 
                background: "#0d0d0d", 
                border: "none", 
                color: "#d4d4d4", 
                padding: "12px", 
                fontFamily: "inherit", 
                fontSize: "13px", 
                resize: "none", 
                outline: "none" 
            }}
          />
      )}
    </div>
  );
}