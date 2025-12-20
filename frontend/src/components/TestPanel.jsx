import React, { useState } from "react";
import { Play, X, FlaskConical, Plus, Trash2, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown } from "lucide-react";

export default function TestPanel({ 
    testCases, setTestCases, runTests, isRunningTests, onClose 
}) {
  
  // Helper to auto-expand textarea
  const handleInputResize = (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
  };

  const addTestCase = () => {
      const newCase = { 
          id: Date.now(), 
          input: "", 
          expectedOutput: "", 
          status: "idle", 
          actualOutput: "",
          expanded: true 
      };
      setTestCases([...testCases, newCase]);
  };

  const removeTestCase = (id) => {
      setTestCases(testCases.filter(t => t.id !== id));
  };

  const updateTestCase = (id, field, value) => {
      setTestCases(testCases.map(t => 
          t.id === id ? { ...t, [field]: value, status: field === "input" || field === "expectedOutput" ? "idle" : t.status, actualOutput: field === "input" || field === "expectedOutput" ? "" : t.actualOutput } : t
      ));
  };

  const toggleExpand = (id) => {
      setTestCases(testCases.map(t => t.id === id ? { ...t, expanded: !(t.expanded !== false) } : t));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0f0f0f", borderLeft: "1px solid #222", fontFamily: "'Inter', sans-serif" }}>
        
        {/* HEADER */}
        <div style={{ 
            height: "48px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", 
            background: "rgba(20,20,20,0.8)", backdropFilter: "blur(10px)" 
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "600", fontSize: "13px", color: "#eee" }}>
                <div style={{ background: "rgba(139, 92, 246, 0.1)", padding: "6px", borderRadius: "6px", display: "flex" }}>
                    <FlaskConical size={16} color="#8b5cf6" />
                </div>
                <span>Test Cases</span>
                <span style={{ background: "#222", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", color: "#888", fontWeight: "bold" }}>
                    {testCases.length}
                </span>
            </div>
            <button onClick={onClose} className="hover-btn" style={{ background: "none", border: "none", color: "#666", cursor: "pointer", transition: "color 0.2s" }}>
                <X size={16}/>
            </button>
        </div>

        {/* CONTENT */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", minHeight: 0 }}>
            
            {/* LIST OF CASES */}
            {testCases.map((test, i) => (
                <div key={test.id} style={{ 
                    background: "#161616", borderRadius: "8px", flexShrink: 0,
                    border: test.status === "accepted" ? "1px solid rgba(74, 222, 128, 0.3)" : (test.status === "wrong_answer" ? "1px solid rgba(239, 83, 80, 0.3)" : "1px solid #333"),
                    boxShadow: test.status === "accepted" ? "0 0 10px rgba(74, 222, 128, 0.05)" : "none"
                }}>
                    
                    {/* CASE HEADER (Click to Expand) */}
                    <div 
                        onClick={() => toggleExpand(test.id)}
                        style={{ 
                            padding: "10px 12px", background: "#1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center", 
                            borderBottom: (test.expanded !== false) ? "1px solid #262626" : "none", cursor: "pointer", userSelect: "none"
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ color: "#666", display: "flex", alignItems: "center" }}>
                                {(test.expanded !== false) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: "bold", color: "#888", fontFamily: "monospace" }}>CASE {i+1}</span>
                            
                            {/* STATUS BADGES */}
                            {test.status === "accepted" && <span style={{ fontSize: "11px", color: "#4ade80", background: "rgba(74, 222, 128, 0.1)", padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}><CheckCircle size={10}/> PASS</span>}
                            {test.status === "wrong_answer" && <span style={{ fontSize: "11px", color: "#ef5350", background: "rgba(239, 83, 80, 0.1)", padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}><AlertCircle size={10}/> FAIL</span>}
                            {test.status === "running" && <span style={{ fontSize: "11px", color: "#fbbf24", background: "rgba(251, 191, 36, 0.1)", padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}><Loader2 size={10} className="animate-spin"/> RUNNING</span>}
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); removeTestCase(test.id); }} 
                            style={{ color: "#444", background: "none", border: "none", cursor: "pointer", transition: "color 0.2s" }} 
                            title="Delete Case"
                        >
                            <Trash2 size={14} className="hover-text-red"/>
                        </button>
                    </div>

                    {/* CASE BODY (EDITABLE) */}
                    {(test.expanded !== false) && (
                    <div style={{ padding: "12px", fontSize: "12px" }}>
                        
                        {/* INPUT */}
                        <div style={{ marginBottom: "12px" }}>
                            <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px", fontWeight: "600", letterSpacing: "0.5px" }}>INPUT</div>
                            <textarea
                                value={test.input}
                                onChange={(e) => { 
                                    updateTestCase(test.id, "input", e.target.value); 
                                    handleInputResize(e); 
                                }}
                                placeholder="Stdin..."
                                style={{ 
                                    width: "100%", background: "#0a0a0a", border: "1px solid #222", color: "#ccc", padding: "8px", borderRadius: "4px", 
                                    fontSize: "12px", minHeight: "60px", maxHeight: "300px", overflowY: "auto", resize: "vertical", fontFamily: "'Fira Code', monospace", outline: "none",
                                    boxSizing: "border-box"
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#555"}
                                onBlur={(e) => e.target.style.borderColor = "#222"}
                            />
                        </div>

                        {/* EXPECTED OUTPUT */}
                        <div style={{ marginBottom: "12px" }}>
                            <div style={{ fontSize: "10px", color: "#666", marginBottom: "4px", fontWeight: "600", letterSpacing: "0.5px" }}>EXPECTED OUTPUT</div>
                            <textarea
                                value={test.expectedOutput}
                                onChange={(e) => { 
                                    updateTestCase(test.id, "expectedOutput", e.target.value); 
                                    handleInputResize(e); 
                                }}
                                placeholder="Stdout..."
                                style={{ 
                                    width: "100%", background: "#0a0a0a", border: "1px solid #222", color: "#ccc", padding: "8px", borderRadius: "4px", 
                                    fontSize: "12px", minHeight: "60px", maxHeight: "300px", overflowY: "auto", resize: "vertical", fontFamily: "'Fira Code', monospace", outline: "none",
                                    boxSizing: "border-box"
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#555"}
                                onBlur={(e) => e.target.style.borderColor = "#222"}
                            />
                        </div>
                        
                        {/* ACTUAL OUTPUT (Only if ran) */}
                        {test.status !== "idle" && (
                            <div>
                                <div style={{ 
                                    fontSize: "10px", 
                                    color: test.status === "wrong_answer" ? "#ef5350" : (test.status === "accepted" ? "#4ade80" : "#666"), 
                                    marginBottom: "4px", fontWeight: "600", letterSpacing: "0.5px" 
                                }}>
                                    ACTUAL OUTPUT
                                </div>
                                <div style={{ 
                                    background: test.status === "wrong_answer" ? "rgba(239, 83, 80, 0.05)" : (test.status === "accepted" ? "rgba(74, 222, 128, 0.05)" : "#0a0a0a"), 
                                    padding: "8px", borderRadius: "4px", 
                                    color: test.status === "wrong_answer" ? "#ef5350" : (test.status === "accepted" ? "#4ade80" : "#ccc"), 
                                    fontFamily: "'Fira Code', monospace", 
                                    border: test.status === "wrong_answer" ? "1px solid rgba(239, 83, 80, 0.2)" : (test.status === "accepted" ? "1px solid rgba(74, 222, 128, 0.2)" : "1px solid #222"), 
                                    whiteSpace: "pre-wrap", 
                                    minHeight: "40px",
                                    maxHeight: "300px",
                                    overflowY: "auto",
                                    width: "100%",
                                    boxSizing: "border-box"
                                }}>
                                    {test.actualOutput}
                                </div>
                            </div>
                        )}

                    </div>
                    )}
                </div>
            ))}

            {/* ADD BUTTON */}
            <button 
                onClick={addTestCase}
                style={{ 
                    width: "100%", padding: "12px", background: "#1a1a1a", border: "1px dashed #333", borderRadius: "8px", 
                    color: "#888", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    transition: "all 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#666"; e.currentTarget.style.color = "#ccc"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#888"; }}
            >
                <Plus size={14} /> Add Test Case
            </button>

        </div>

        {/* FOOTER ACTIONS */}
        <div style={{ padding: "16px", borderTop: "1px solid #222", background: "#0f0f0f" }}>
             <button 
                onClick={runTests}
                disabled={isRunningTests || testCases.length === 0}
                className={isRunningTests || testCases.length === 0 ? "disabled" : "btn-glow"}
                style={{ 
                    width: "100%",
                    background: isRunningTests || testCases.length === 0 ? "#222" : "linear-gradient(135deg, #8b5cf6, #6366f1)", // CPH Purple Gradient
                    color: isRunningTests || testCases.length === 0 ? "#555" : "white", 
                    border: "none", padding: "10px", borderRadius: "6px", fontWeight: "600", 
                    cursor: isRunningTests || testCases.length === 0 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13px",
                    boxShadow: isRunningTests || testCases.length === 0 ? "none" : "0 4px 12px rgba(139, 92, 246, 0.3)",
                    transition: "transform 0.1s"
                }}
                onMouseDown={(e) => !isRunningTests && (e.currentTarget.style.transform = "scale(0.98)")}
                onMouseUp={(e) => !isRunningTests && (e.currentTarget.style.transform = "scale(1)")}
              >
                  {isRunningTests ? <Loader2 size={16} className="animate-spin"/> : <Play size={16} fill="white"/>} 
                  {isRunningTests ? "Running Tests..." : "Run All Tests"}
              </button>
        </div>
        
        {/* INLINE STYLES */}
        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
            .hover-btn:hover { background: #222 !important; color: white !important; }
            .hover-text-red:hover { color: #ef5350 !important; }
        `}</style>
    </div>
  );
}
