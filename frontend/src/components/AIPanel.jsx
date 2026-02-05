import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

// Session key for chat history
const CHAT_HISTORY_KEY = "gemini_chat_history";

export default function AIPanel({ open, onClose, onAsk, currentProblem }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(() => {
    // Load from sessionStorage on mount
    try {
      const saved = sessionStorage.getItem(CHAT_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const messagesEndRef = useRef(null);

  // Save to sessionStorage whenever messages change
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn("Failed to save chat history:", e);
    }
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleAsk() {
    if (!prompt.trim()) return;
    
    const userMessage = { role: "user", content: prompt, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setLoading(true);
    
    const result = await onAsk(prompt);
    
    const aiMessage = { role: "assistant", content: result, timestamp: Date.now() };
    setMessages(prev => [...prev, aiMessage]);
    setLoading(false);
  }

  function clearHistory() {
    setMessages([]);
    sessionStorage.removeItem(CHAT_HISTORY_KEY);
  }

  // Custom renderer for Code Blocks to add Copy Button & Highlighting
  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    if (!inline && match) {
      return (
        <div style={{ position: "relative", margin: "10px 0", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ 
            display: "flex", justifyContent: "space-between", alignItems: "center", 
            padding: "6px 12px", background: "#2d2d2d", color: "#ccc", fontSize: "12px",
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
          <div style={{ margin: 0, padding: "12px", background: "#1e1e1e", color: "#d4d4d8", overflowX: "auto", fontSize: "13px", fontFamily: "Consolas, monospace" }}>
             <pre style={{ margin: 0 }}>{codeString}</pre>
          </div>
        </div>
      );
    }

    return (
      <code className={className} style={{ background: "#3a3a3a", padding: "2px 6px", borderRadius: "4px", color: "#e8b4b8" }} {...props}>
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
        boxSizing: "border-box"
      }}
    >
      {/* HEADER */}
      <div style={{ 
        display: "flex", alignItems: "center", justifyContent: "space-between", 
        padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ 
            width: "36px", height: "36px", borderRadius: "10px", 
            background: "linear-gradient(135deg, #4285f415, #d9657020)", 
            display: "flex", alignItems: "center", justifyContent: "center" 
          }}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" fill="url(#geminiGrad)"/>
              <defs>
                <linearGradient id="geminiGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#1C7DFF"/>
                  <stop offset="0.52" stopColor="#A87FFE"/>
                  <stop offset="1" stopColor="#D96570"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#fff", display: "block" }}>Gemini AI</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {currentProblem ? (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: "#4ade80" }}>●</span> {currentProblem.slice(0, 30)}{currentProblem.length > 30 ? "..." : ""}
                </span>
              ) : (
                messages.length > 0 ? `${messages.length} messages` : "Your coding assistant"
              )}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear chat"
              style={{ 
                background: "transparent", border: "none", cursor: "pointer", 
                color: "var(--text-muted)", fontSize: "12px", padding: "6px 10px",
                borderRadius: "6px", transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "#ff6b6b"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              🗑️ Clear
            </button>
          )}
          <button
            onClick={onClose}
            style={{ 
              background: "transparent", border: "none", cursor: "pointer", 
              color: "var(--text-muted)", fontSize: "18px", display: "flex", 
              alignItems: "center", justifyContent: "center", width: "32px", height: "32px", 
              borderRadius: "8px", transition: "all 0.2s" 
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* CHAT MESSAGES AREA */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}
      >
        {messages.length === 0 && !loading ? (
          /* EMPTY STATE */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", opacity: 0.8 }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "linear-gradient(135deg, #4285f415, #d9657015)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#geminiGrad)" strokeWidth="2">
                <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
              </svg>
            </div>
            <p style={{ margin: 0, fontWeight: "500" }}>How can I help you code today?</p>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Ask about debugging, algorithms, or code review</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start"
              }}>
                {/* Role Label */}
                <span style={{ 
                  fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px",
                  display: "flex", alignItems: "center", gap: "4px"
                }}>
                  {msg.role === "user" ? "You" : "✨ Gemini"}
                </span>
                
                {/* Message Bubble */}
                <div style={{
                  maxWidth: "90%",
                  padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: msg.role === "user" 
                    ? "linear-gradient(135deg, #4285f4, #5a9cf4)"
                    : "var(--bg-surface)",
                  color: msg.role === "user" ? "#fff" : "var(--text-main)",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  border: msg.role === "assistant" ? "1px solid var(--border-subtle)" : "none"
                }}>
                  {msg.role === "user" ? (
                    <span>{msg.content}</span>
                  ) : (
                    <ReactMarkdown components={{ code: CodeBlock }}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>✨ Gemini</span>
                <div style={{
                  padding: "12px 16px",
                  borderRadius: "16px 16px 16px 4px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", gap: "8px", color: "#9b72cb"
                }}>
                  <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                  </svg>
                  <span style={{ fontSize: "14px" }}>Thinking...</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <textarea
            placeholder="Ask about code, debugging, algorithms..."
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
              minHeight: "80px",
              maxHeight: "150px",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "12px",
              padding: "14px",
              paddingRight: "100px",
              fontSize: "14px",
              color: "white",
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
              lineHeight: "1.5",
            }}
          />
          
          {/* Send Button - Inline */}
          <button
            onClick={handleAsk}
            disabled={loading || !prompt.trim()}
            style={{
              position: "absolute",
              bottom: "12px",
              right: "12px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              background: loading || !prompt.trim() 
                ? "var(--bg-hover)" 
                : "linear-gradient(135deg, #4285f4, #9b72cb, #d96570)",
              color: loading || !prompt.trim() ? "var(--text-muted)" : "white",
              fontSize: "13px",
              fontWeight: "600",
              cursor: loading || !prompt.trim() ? "default" : "pointer",
              transition: "all 0.2s",
              opacity: loading || !prompt.trim() ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
            onMouseEnter={e => { if(!loading && prompt.trim()) e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={e => { if(!loading && prompt.trim()) e.currentTarget.style.opacity = "1"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
            Send
          </button>
        </div>
        <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)", opacity: 0.5, textAlign: "center" }}>
          ⏎ Enter to send • Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}