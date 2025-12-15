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
        position: "fixed",
        bottom: "100px",
        right: "24px",
        width: "450px", // Widen slightly for code blocks
        maxHeight: "600px",
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12)",
        padding: "20px",
        zIndex: 1000,
        fontFamily: "'Google Sans', Roboto, sans-serif",
        border: "1px solid #e0e0e0",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Gemini Gradient Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M16 9C16.5 6.5 19 4 19 4C19 4 16.5 1.5 16 -1C15.5 1.5 13 4 13 4C13 4 15.5 6.5 16 9Z" fill="url(#grad1)" />
            <path d="M8 22C9.5 15.5 15 11 15 11C15 11 9.5 6.5 8 0C6.5 6.5 1 11 1 11C1 11 6.5 15.5 8 22Z" fill="url(#grad1)" />
            <defs>
              <linearGradient id="grad1" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4E79FF" />
                <stop offset="0.5" stopColor="#9859FF" />
                <stop offset="1" stopColor="#FF5D5D" />
              </linearGradient>
            </defs>
          </svg>
          <span style={{ fontSize: "18px", fontWeight: "500", color: "#1f1f1f" }}>Gemini</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5f6368", fontSize: "20px" }}
        >
          ✕
        </button>
      </div>

      {/* RESULT AREA */}
      {(response || loading) && (
        <div
          style={{
            flex: 1,
            minHeight: "100px",
            maxHeight: "350px",
            overflowY: "auto",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            padding: "16px",
            fontSize: "14px",
            lineHeight: "1.6",
            color: "#3c4043",
            border: "1px solid #f1f3f4",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#4E79FF" }}>
              <span>✨ Thinking...</span>
            </div>
          ) : (
            <ReactMarkdown components={{ code: CodeBlock }}>
              {response}
            </ReactMarkdown>
          )}
        </div>
      )}

      {/* INPUT AREA */}
      <textarea
        placeholder="Ask AI to help with your code..."
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
          backgroundColor: "#f0f4f9",
          border: "none",
          borderRadius: "12px",
          padding: "14px",
          fontSize: "14px",
          color: "#1f1f1f",
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
          borderRadius: "20px",
          border: "none",
          background: loading || !prompt.trim() 
            ? "#e0e0e0" 
            : "linear-gradient(90deg, #4E79FF, #9859FF)",
          color: loading || !prompt.trim() ? "#9aa0a6" : "white",
          fontSize: "14px",
          fontWeight: "600",
          cursor: loading || !prompt.trim() ? "default" : "pointer",
          transition: "all 0.2s",
          boxShadow: loading ? "none" : "0 1px 2px rgba(0,0,0,0.1)",
        }}
      >
        {loading ? "Generating..." : "Ask Gemini"}
      </button>
    </div>
  );
}