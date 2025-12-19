import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function AIPanel({ open, onClose, onAsk }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");

  async function handleAsk() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse(""); // Clear previous response
    
    const result = await onAsk(prompt);
    
    setResponse(result);
    setLoading(false);
  }

  // Custom renderer for Code Blocks to add Copy Button & Highlighting
  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    if (!inline && match) {
      return (
        <div style={{ position: "relative", margin: "10px 0", borderRadius: "8px", overflow: "hidden" }}>
          {/* Header with Copy Button */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            padding: "6px 12px", 
            background: "#2d2d2d", 
            color: "#ccc", 
            fontSize: "12px",
            borderBottom: "1px solid #444"
          }}>
            <span>{match[1].toUpperCase()}</span>
            <button 
              onClick={() => navigator.clipboard.writeText(codeString)}
              style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: "12px" }}
            >
              📋 Copy
            </button>
          </div>
          
          {/* The Syntax Highlighter */}
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            customStyle={{ margin: 0, padding: "12px", fontSize: "13px" }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    return (
      <code className={className} style={{ background: "#e0e0e0", padding: "2px 4px", borderRadius: "4px", color: "#d63384" }} {...props}>
        {children}
      </code>
    );
  };

  if (!open) return null;

  return (
    <div
      style={{
        display: open ? "flex" : "none",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: "var(--bg-panel)",
        color: "var(--text-main)",
        gap: "16px",
        padding: "16px",
        boxSizing: "border-box"
      }}
    >
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Gemini Gradient Icon - Synced with FAB */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 9C16.5 6.5 19 4 19 4C19 4 16.5 1.5 16 -1C15.5 1.5 13 4 13 4C13 4 15.5 6.5 16 9Z" fill="url(#geminiGrad)" />
            <path d="M8 22C9.5 15.5 15 11 15 11C15 11 9.5 6.5 8 0C6.5 6.5 1 11 1 11C1 11 6.5 15.5 8 22Z" fill="url(#geminiGrad)" />
            <defs>
              <linearGradient id="geminiGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4285f4" />
                <stop offset="0.5" stopColor="#9b72cb" />
                <stop offset="1" stopColor="#d96570" />
              </linearGradient>
            </defs>
          </svg>
          <span style={{ fontSize: "16px", fontWeight: "600", color: "#fff", letterSpacing: "0.5px" }}>Gemini AI</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "4px" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          ✕
        </button>
      </div>

      {/* RESULT AREA */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: response || loading ? "var(--bg-surface)" : "transparent",
          borderRadius: "12px",
          padding: response || loading ? "16px" : "0",
          fontSize: "14px",
          lineHeight: "1.6",
          color: "var(--text-main)",
          border: response || loading ? "1px solid var(--border-subtle)" : "none",
          display: "flex", flexDirection: "column"
        }}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#9b72cb", fontWeight: "500" }}>
             <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
             <span>Thinking...</span>
          </div>
        ) : (
          response ? (
            <ReactMarkdown components={{ code: CodeBlock }}>
              {response}
            </ReactMarkdown>
          ) : (
             /* EMPTY STATE */
             <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", opacity: 0.8 }}>
                 <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "linear-gradient(135deg, #4285f415, #d9657015)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#geminiGrad)" strokeWidth="2">
                        <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
                    </svg>
                 </div>
                 <p style={{ margin: 0, fontWeight: "500" }}>How can I help you code today?</p>
             </div>
          )
        )}
      </div>

      {/* INPUT AREA */}
      <textarea
        placeholder="Ask AI due code..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
             if(e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 handleAsk();
             }
        }}
        style={{
          width: "100%",
          height: "80px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "8px",
          padding: "14px",
          fontSize: "13px",
          color: "white",
          resize: "none",
          outline: "none",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />

      {/* ACTION BUTTON */}
      <button
        onClick={handleAsk}
        disabled={loading || !prompt.trim()}
        style={{
          width: "100%",
          padding: "12px 0",
          borderRadius: "12px",
          border: "none",
          background: loading || !prompt.trim() 
            ? "var(--bg-hover)" 
            : "linear-gradient(135deg, #4285f4, #9b72cb, #d96570)", // MATCH FAB
          color: loading || !prompt.trim() ? "var(--text-muted)" : "white",
          fontSize: "14px",
          fontWeight: "600",
          cursor: loading || !prompt.trim() ? "default" : "pointer",
          transition: "all 0.2s",
          boxShadow: loading ? "none" : "0 4px 12px rgba(0,0,0,0.1)",
          opacity: loading || !prompt.trim() ? 0.7 : 1
        }}
        onMouseEnter={e => { if(!loading && prompt.trim()) e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={e => { if(!loading && prompt.trim()) e.currentTarget.style.opacity = "1"; }}
      >
        {loading ? "Generating..." : "Ask Gemini"}
      </button>
    </div>
  );
}