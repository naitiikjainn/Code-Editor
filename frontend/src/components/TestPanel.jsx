import React, { useState } from "react";
import { Play, X, FlaskConical, Plus, Trash2, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown, Zap, Copy, Check } from "lucide-react";

import HighlightedTextarea from "./HighlightedTextarea";

const TestPanel = ({ 
    testCases, setTestCases, runTests, runSingleTest, isRunningTests, onClose, language = "text"
}) => {
  
  const [copiedId, setCopiedId] = useState(null);
  
  // Helper to copy text to clipboard
  const copyToClipboard = (text, id) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
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

  // Get summary stats
  const passedCount = testCases.filter(t => t.status === "accepted").length;
  const failedCount = testCases.filter(t => t.status === "wrong_answer" || t.status === "error").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0a0a", borderLeft: "1px solid #1a1a1a", fontFamily: "'Inter', sans-serif" }}>
        
        {/* HEADER */}
        <div style={{ 
            height: "52px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", 
            background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)"
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ 
                    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2))", 
                    padding: "8px", 
                    borderRadius: "8px", 
                    display: "flex",
                    border: "1px solid rgba(139, 92, 246, 0.3)"
                }}>
                    <FlaskConical size={18} color="#a78bfa" />
                </div>
                <div>
                    <div style={{ fontWeight: "700", fontSize: "14px", color: "#fff", letterSpacing: "-0.3px" }}>Test Cases</div>
                    <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
                        {testCases.length} case{testCases.length !== 1 ? 's' : ''}
                        {passedCount > 0 && <span style={{ color: "#4ade80", marginLeft: "8px" }}>✓ {passedCount}</span>}
                        {failedCount > 0 && <span style={{ color: "#ef5350", marginLeft: "8px" }}>✗ {failedCount}</span>}
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose} 
                style={{ 
                    background: "rgba(255,255,255,0.05)", 
                    border: "none", 
                    color: "#666", 
                    cursor: "pointer", 
                    transition: "all 0.2s",
                    padding: "6px",
                    borderRadius: "6px"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#666"; }}
            >
                <X size={16}/>
            </button>
        </div>

        {/* CONTENT */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", minHeight: 0 }}>
            
            {/* EMPTY STATE */}
            {testCases.length === 0 && (
                <div style={{ 
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", 
                    height: "200px", color: "#444", textAlign: "center", gap: "12px" 
                }}>
                    <FlaskConical size={40} strokeWidth={1.5} />
                    <div>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "#888" }}>No Test Cases</div>
                        <div style={{ fontSize: "12px", marginTop: "4px" }}>Add test cases to verify your solution</div>
                    </div>
                </div>
            )}

            {/* LIST OF CASES */}
            {testCases.map((test, i) => (
                <div key={test.id} style={{ 
                    background: "#111", 
                    borderRadius: "10px", 
                    flexShrink: 0,
                    border: test.status === "accepted" 
                        ? "1px solid rgba(74, 222, 128, 0.4)" 
                        : test.status === "wrong_answer" || test.status === "error"
                            ? "1px solid rgba(239, 83, 80, 0.4)" 
                            : "1px solid #1a1a1a",
                    boxShadow: test.status === "accepted" 
                        ? "0 0 20px rgba(74, 222, 128, 0.1), inset 0 1px 0 rgba(74, 222, 128, 0.1)" 
                        : test.status === "wrong_answer" || test.status === "error"
                            ? "0 0 20px rgba(239, 83, 80, 0.1), inset 0 1px 0 rgba(239, 83, 80, 0.1)"
                            : "inset 0 1px 0 rgba(255,255,255,0.02)",
                    overflow: "hidden"
                }}>
                    
                    {/* CASE HEADER (Click to Expand) */}
                    <div 
                        onClick={() => toggleExpand(test.id)}
                        style={{ 
                            padding: "12px 14px", 
                            background: test.status === "accepted" 
                                ? "linear-gradient(90deg, rgba(74, 222, 128, 0.08), transparent)" 
                                : test.status === "wrong_answer" || test.status === "error"
                                    ? "linear-gradient(90deg, rgba(239, 83, 80, 0.08), transparent)"
                                    : "linear-gradient(90deg, rgba(255,255,255,0.02), transparent)", 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center", 
                            borderBottom: (test.expanded !== false) ? "1px solid rgba(255,255,255,0.05)" : "none", 
                            cursor: "pointer", 
                            userSelect: "none",
                            transition: "background 0.2s"
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ 
                                color: test.status === "accepted" ? "#4ade80" : test.status === "wrong_answer" || test.status === "error" ? "#ef5350" : "#555", 
                                display: "flex", 
                                alignItems: "center",
                                transition: "color 0.2s"
                            }}>
                                {(test.expanded !== false) ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                            </div>
                            <span style={{ 
                                fontSize: "13px", 
                                fontWeight: "700", 
                                color: test.status === "accepted" ? "#4ade80" : test.status === "wrong_answer" || test.status === "error" ? "#ef5350" : "#888", 
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                letterSpacing: "0.5px"
                            }}>
                                TEST {i+1}
                            </span>
                            
                            {/* STATUS BADGES - Enhanced */}
                            {test.status === "accepted" && (
                                <span style={{ 
                                    fontSize: "11px", 
                                    color: "#4ade80", 
                                    background: "rgba(74, 222, 128, 0.15)", 
                                    padding: "4px 10px", 
                                    borderRadius: "20px", 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "5px",
                                    fontWeight: "700",
                                    border: "1px solid rgba(74, 222, 128, 0.3)",
                                    textShadow: "0 0 10px rgba(74, 222, 128, 0.5)"
                                }}>
                                    <CheckCircle size={12}/> PASSED
                                </span>
                            )}
                            {(test.status === "wrong_answer" || test.status === "error") && (
                                <span style={{ 
                                    fontSize: "11px", 
                                    color: "#ef5350", 
                                    background: "rgba(239, 83, 80, 0.15)", 
                                    padding: "4px 10px", 
                                    borderRadius: "20px", 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "5px",
                                    fontWeight: "700",
                                    border: "1px solid rgba(239, 83, 80, 0.3)",
                                    textShadow: "0 0 10px rgba(239, 83, 80, 0.5)"
                                }}>
                                    <AlertCircle size={12}/> {test.status === "error" ? "ERROR" : "FAILED"}
                                </span>
                            )}
                            {test.status === "running" && (
                                <span style={{ 
                                    fontSize: "11px", 
                                    color: "#fbbf24", 
                                    background: "rgba(251, 191, 36, 0.15)", 
                                    padding: "4px 10px", 
                                    borderRadius: "20px", 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "5px",
                                    fontWeight: "700",
                                    border: "1px solid rgba(251, 191, 36, 0.3)",
                                    animation: "pulse 1.5s infinite"
                                }}>
                                    <Loader2 size={12} className="animate-spin"/> RUNNING
                                </span>
                            )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {/* Run Single Test Button - Enhanced */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); runSingleTest && runSingleTest(test.id); }} 
                                disabled={test.status === "running" || isRunningTests}
                                style={{ 
                                    color: test.status === "running" || isRunningTests ? "#333" : "#a78bfa", 
                                    background: test.status === "running" || isRunningTests ? "transparent" : "rgba(139, 92, 246, 0.1)", 
                                    border: test.status === "running" || isRunningTests ? "none" : "1px solid rgba(139, 92, 246, 0.2)", 
                                    cursor: test.status === "running" || isRunningTests ? "not-allowed" : "pointer", 
                                    transition: "all 0.2s",
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "11px",
                                    fontWeight: "600"
                                }} 
                                title="Run this test"
                                onMouseEnter={(e) => { 
                                    if (test.status !== "running" && !isRunningTests) {
                                        e.currentTarget.style.background = "rgba(139, 92, 246, 0.2)";
                                        e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
                                    }
                                }}
                                onMouseLeave={(e) => { 
                                    if (test.status !== "running" && !isRunningTests) {
                                        e.currentTarget.style.background = "rgba(139, 92, 246, 0.1)";
                                        e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.2)";
                                    }
                                }}
                            >
                                <Zap size={12} fill={test.status === "running" || isRunningTests ? "#333" : "#a78bfa"}/>
                                Run
                            </button>
                            
                            {/* Delete Button */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeTestCase(test.id); }} 
                                style={{ 
                                    color: "#444", 
                                    background: "none", 
                                    border: "none", 
                                    cursor: "pointer", 
                                    transition: "all 0.2s", 
                                    padding: "6px",
                                    borderRadius: "6px"
                                }} 
                                title="Delete Case"
                                onMouseEnter={(e) => { e.currentTarget.style.color = "#ef5350"; e.currentTarget.style.background = "rgba(239, 83, 80, 0.1)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "#444"; e.currentTarget.style.background = "none"; }}
                            >
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    </div>

                    {/* CASE BODY (EDITABLE) */}
                    {(test.expanded !== false) && (
                    <div style={{ padding: "14px", fontSize: "12px", background: "#0a0a0a" }}>
                        
                        {/* INPUT */}
                        <div style={{ marginBottom: "14px" }}>
                            <div style={{ 
                                fontSize: "11px", 
                                color: "#888", 
                                marginBottom: "6px", 
                                fontWeight: "700", 
                                letterSpacing: "0.8px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                            }}>
                                <span style={{ color: "#6366f1" }}>→</span> INPUT
                            </div>
                            <div style={{ 
                                resize: "vertical", 
                                overflow: "hidden", 
                                minHeight: "80px", 
                                borderRadius: "8px", 
                                border: "1px solid #1a1a1a",
                                background: "#0d0d0d"
                            }}>
                                <HighlightedTextarea
                                    value={test.input}
                                    onChange={(e) => updateTestCase(test.id, "input", e.target.value)}
                                    language={language}
                                    placeholder="Enter input here..."
                                    style={{ background: "transparent", fontSize: "13px" }}
                                />
                            </div>
                        </div>

                        {/* EXPECTED OUTPUT */}
                        <div style={{ marginBottom: "14px" }}>
                            <div style={{ 
                                fontSize: "11px", 
                                color: "#888", 
                                marginBottom: "6px", 
                                fontWeight: "700", 
                                letterSpacing: "0.8px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                            }}>
                                <span style={{ color: "#22c55e" }}>←</span> EXPECTED OUTPUT
                            </div>
                            <div style={{ 
                                resize: "vertical", 
                                overflow: "hidden", 
                                minHeight: "80px", 
                                borderRadius: "8px", 
                                border: "1px solid #1a1a1a",
                                background: "#0d0d0d"
                            }}>
                                <HighlightedTextarea
                                    value={test.expectedOutput}
                                    onChange={(e) => updateTestCase(test.id, "expectedOutput", e.target.value)}
                                    language={language}
                                    placeholder="Enter expected output here..."
                                    style={{ background: "transparent", fontSize: "13px" }}
                                />
                            </div>
                        </div>
                        
                        {/* ACTUAL OUTPUT (Only if ran) */}
                        {test.status !== "idle" && (
                            <div>
                                <div style={{ 
                                    fontSize: "11px", 
                                    color: test.status === "wrong_answer" || test.status === "error" ? "#ef5350" : (test.status === "accepted" ? "#4ade80" : "#888"), 
                                    marginBottom: "6px", 
                                    fontWeight: "700", 
                                    letterSpacing: "0.8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between"
                                }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ color: test.status === "accepted" ? "#4ade80" : "#ef5350" }}>◆</span> 
                                        YOUR OUTPUT
                                    </span>
                                    {test.actualOutput && (
                                        <button
                                            onClick={() => copyToClipboard(test.actualOutput, `output-${test.id}`)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: copiedId === `output-${test.id}` ? "#4ade80" : "#555",
                                                cursor: "pointer",
                                                padding: "2px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                fontSize: "10px"
                                            }}
                                        >
                                            {copiedId === `output-${test.id}` ? <Check size={12}/> : <Copy size={12}/>}
                                            {copiedId === `output-${test.id}` ? "Copied!" : "Copy"}
                                        </button>
                                    )}
                                </div>
                                <div style={{ 
                                    background: test.status === "wrong_answer" || test.status === "error"
                                        ? "linear-gradient(135deg, rgba(239, 83, 80, 0.08), rgba(239, 83, 80, 0.02))" 
                                        : test.status === "accepted" 
                                            ? "linear-gradient(135deg, rgba(74, 222, 128, 0.08), rgba(74, 222, 128, 0.02))" 
                                            : "#0d0d0d", 
                                    padding: "12px", 
                                    borderRadius: "8px", 
                                    color: test.status === "wrong_answer" || test.status === "error" ? "#ef5350" : (test.status === "accepted" ? "#4ade80" : "#ccc"), 
                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                    fontSize: "13px",
                                    border: test.status === "wrong_answer" || test.status === "error"
                                        ? "1px solid rgba(239, 83, 80, 0.3)" 
                                        : test.status === "accepted" 
                                            ? "1px solid rgba(74, 222, 128, 0.3)" 
                                            : "1px solid #1a1a1a", 
                                    whiteSpace: "pre-wrap", 
                                    minHeight: "50px",
                                    maxHeight: "300px",
                                    overflowY: "auto",
                                    width: "100%",
                                    boxSizing: "border-box",
                                    fontWeight: "500"
                                }}>
                                    {test.actualOutput || <span style={{ color: "#444", fontStyle: "italic" }}>No output</span>}
                                </div>
                                
                                {/* Show diff hint for failures */}
                                {test.status === "wrong_answer" && test.expectedOutput && test.actualOutput && (
                                    <div style={{ 
                                        marginTop: "10px", 
                                        padding: "10px", 
                                        background: "rgba(251, 191, 36, 0.05)", 
                                        border: "1px solid rgba(251, 191, 36, 0.2)",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        color: "#fbbf24"
                                    }}>
                                        💡 <strong>Hint:</strong> Compare your output with expected output above
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                    )}
                </div>
            ))}

            {/* ADD BUTTON - Enhanced */}
            <button 
                onClick={addTestCase}
                style={{ 
                    width: "100%", 
                    padding: "14px", 
                    background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))", 
                    border: "2px dashed #2a2a2a", 
                    borderRadius: "10px", 
                    color: "#666", 
                    fontSize: "13px", 
                    fontWeight: "600",
                    cursor: "pointer", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    gap: "8px",
                    transition: "all 0.3s"
                }}
                onMouseEnter={(e) => { 
                    e.currentTarget.style.borderColor = "#6366f1"; 
                    e.currentTarget.style.color = "#a78bfa"; 
                    e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)";
                }}
                onMouseLeave={(e) => { 
                    e.currentTarget.style.borderColor = "#2a2a2a"; 
                    e.currentTarget.style.color = "#666"; 
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))";
                }}
            >
                <Plus size={16} /> Add Test Case
            </button>

        </div>

        {/* FOOTER ACTIONS - Enhanced */}
        <div style={{ padding: "16px", borderTop: "1px solid #1a1a1a", background: "linear-gradient(180deg, #0d0d0d 0%, #0a0a0a 100%)" }}>
             <button 
                onClick={runTests}
                disabled={isRunningTests || testCases.length === 0}
                style={{ 
                    width: "100%",
                    backgroundColor: isRunningTests || testCases.length === 0 
                        ? "#1a1a1a" 
                        : "transparent",
                    backgroundImage: isRunningTests || testCases.length === 0
                        ? "none"
                        : "linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #8b5cf6 100%)",
                    backgroundSize: isRunningTests || testCases.length === 0 ? "auto" : "200% 100%",
                    color: isRunningTests || testCases.length === 0 ? "#444" : "white", 
                    border: isRunningTests || testCases.length === 0 ? "1px solid #222" : "none",
                    padding: "14px", 
                    borderRadius: "10px", 
                    fontWeight: "700", 
                    fontSize: "14px",
                    cursor: isRunningTests || testCases.length === 0 ? "not-allowed" : "pointer",
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    gap: "10px",
                    boxShadow: isRunningTests || testCases.length === 0 ? "none" : "0 4px 20px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                    transition: "all 0.3s",
                    letterSpacing: "0.5px",
                    textShadow: isRunningTests || testCases.length === 0 ? "none" : "0 1px 2px rgba(0,0,0,0.3)"
                }}
                onMouseEnter={(e) => { 
                    if (!isRunningTests && testCases.length > 0) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 6px 25px rgba(139, 92, 246, 0.5), inset 0 1px 0 rgba(255,255,255,0.15)";
                    }
                }}
                onMouseLeave={(e) => { 
                    if (!isRunningTests && testCases.length > 0) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 20px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)";
                    }
                }}
                onMouseDown={(e) => !isRunningTests && testCases.length > 0 && (e.currentTarget.style.transform = "translateY(0) scale(0.98)")}
                onMouseUp={(e) => !isRunningTests && testCases.length > 0 && (e.currentTarget.style.transform = "translateY(-1px) scale(1)")}
              >
                  {isRunningTests ? <Loader2 size={18} className="animate-spin"/> : <Play size={18} fill="white"/>} 
                  {isRunningTests ? "Running Tests..." : "Run All Tests"}
              </button>
        </div>
        
        {/* INLINE STYLES */}
        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 6px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `}</style>
    </div>
  );
};
export default React.memo(TestPanel);
