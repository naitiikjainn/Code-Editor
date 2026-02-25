import React, { useState } from "react";
import { Play, X, FlaskConical, Plus, Trash2, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown, Zap, Copy, Check, Lightbulb } from "lucide-react";

import HighlightedTextarea from "./HighlightedTextarea";

const TestPanel = ({
    testCases, setTestCases, runTests, runSingleTest, isRunningTests, handleCancel, onClose, language = "text"
}) => {

  const [copiedId, setCopiedId] = useState(null);

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

  const passedCount = testCases.filter(t => t.status === "accepted").length;
  const failedCount = testCases.filter(t => t.status === "wrong_answer" || t.status === "error").length;
  const isDisabled = isRunningTests || testCases.length === 0;

  const statusColor = (status) => {
      if (status === "accepted") return "#4ade80";
      if (status === "wrong_answer" || status === "error") return "#ef5350";
      return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#09090b", borderLeft: "1px solid rgba(255,255,255,0.06)", fontFamily: "'Inter', sans-serif" }}>

        {/* ─── HEADER ─── */}
        <div style={{
            height: "48px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
            background: "#0c0c0e"
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                    background: "rgba(139, 92, 246, 0.12)",
                    padding: "6px",
                    borderRadius: "8px",
                    display: "flex",
                    border: "1px solid rgba(139, 92, 246, 0.18)"
                }}>
                    <FlaskConical size={16} color="#a78bfa" />
                </div>
                <div>
                    <div style={{ fontWeight: "600", fontSize: "13px", color: "#f4f4f5", letterSpacing: "-0.2px" }}>Test Cases</div>
                    <div style={{ fontSize: "11px", color: "#52525b", marginTop: "1px" }}>
                        {testCases.length} case{testCases.length !== 1 ? 's' : ''}
                        {passedCount > 0 && <span style={{ color: "#4ade80", marginLeft: "6px" }}>&#10003; {passedCount}</span>}
                        {failedCount > 0 && <span style={{ color: "#ef5350", marginLeft: "6px" }}>&#10007; {failedCount}</span>}
                    </div>
                </div>
            </div>
            <button
                onClick={onClose}
                className="tp-close-btn"
                style={{
                    background: "transparent",
                    border: "none",
                    color: "#52525b",
                    cursor: "pointer",
                    padding: "6px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    transition: "all 0.15s"
                }}
            >
                <X size={15}/>
            </button>
        </div>

        {/* ─── CONTENT ─── */}
        <div className="tp-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", minHeight: 0 }}>

            {/* EMPTY STATE */}
            {testCases.length === 0 && (
                <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    height: "200px", color: "#3f3f46", textAlign: "center", gap: "12px"
                }}>
                    <div style={{
                        background: "rgba(139, 92, 246, 0.06)",
                        borderRadius: "16px",
                        padding: "16px",
                        border: "1px solid rgba(139, 92, 246, 0.08)"
                    }}>
                        <FlaskConical size={32} strokeWidth={1.5} color="#52525b" />
                    </div>
                    <div>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#71717a" }}>No Test Cases</div>
                        <div style={{ fontSize: "11.5px", marginTop: "4px", color: "#52525b" }}>Add test cases to verify your solution</div>
                    </div>
                </div>
            )}

            {/* ─── LIST OF CASES ─── */}
            {testCases.map((test, i) => {
                const sc = statusColor(test.status);
                const isExpanded = test.expanded !== false;
                const isActive = test.status !== "idle";

                return (
                <div key={test.id} className="tp-card" style={{
                    background: "#0f0f11",
                    borderRadius: "10px",
                    flexShrink: 0,
                    border: sc
                        ? `1px solid ${sc}33`
                        : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: sc
                        ? `0 0 16px ${sc}0d`
                        : "none",
                    overflow: "hidden",
                    transition: "border-color 0.2s, box-shadow 0.2s"
                }}>

                    {/* CASE HEADER */}
                    <div
                        onClick={() => toggleExpand(test.id)}
                        className="tp-card-header"
                        style={{
                            padding: "10px 12px",
                            background: sc
                                ? `linear-gradient(90deg, ${sc}08, transparent)`
                                : "transparent",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: isExpanded ? "1px solid rgba(255,255,255,0.04)" : "none",
                            cursor: "pointer",
                            userSelect: "none",
                            transition: "background 0.15s"
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                                color: sc || "#3f3f46",
                                display: "flex",
                                alignItems: "center",
                                transition: "transform 0.15s, color 0.15s",
                                transform: isExpanded ? "rotate(0)" : "rotate(0)"
                            }}>
                                {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            </div>
                            <span style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: sc || "#71717a",
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                letterSpacing: "0.5px",
                                transition: "color 0.15s"
                            }}>
                                TEST {i+1}
                            </span>

                            {/* STATUS BADGES */}
                            {test.status === "accepted" && (
                                <span className="tp-badge tp-badge-pass">
                                    <CheckCircle size={11}/> PASSED
                                </span>
                            )}
                            {(test.status === "wrong_answer" || test.status === "error") && (
                                <span className="tp-badge tp-badge-fail">
                                    <AlertCircle size={11}/> {test.status === "error" ? "ERROR" : "FAILED"}
                                </span>
                            )}
                            {test.status === "running" && (
                                <span className="tp-badge tp-badge-run">
                                    <Loader2 size={11} className="animate-spin"/> RUNNING
                                </span>
                            )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); runSingleTest && runSingleTest(test.id); }}
                                disabled={test.status === "running" || isRunningTests}
                                className="tp-run-btn"
                                style={{
                                    color: test.status === "running" || isRunningTests ? "#27272a" : "#a78bfa",
                                    background: test.status === "running" || isRunningTests ? "transparent" : "rgba(139, 92, 246, 0.08)",
                                    border: test.status === "running" || isRunningTests ? "1px solid transparent" : "1px solid rgba(139, 92, 246, 0.15)",
                                    cursor: test.status === "running" || isRunningTests ? "not-allowed" : "pointer",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    transition: "all 0.15s"
                                }}
                                title="Run this test"
                            >
                                <Zap size={11} fill={test.status === "running" || isRunningTests ? "#27272a" : "#a78bfa"}/>
                                Run
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); removeTestCase(test.id); }}
                                className="tp-del-btn"
                                style={{
                                    color: "#3f3f46",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "5px",
                                    borderRadius: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    transition: "all 0.15s"
                                }}
                                title="Delete Case"
                            >
                                <Trash2 size={13}/>
                            </button>
                        </div>
                    </div>

                    {/* CASE BODY */}
                    {isExpanded && (
                    <div style={{ padding: "12px", fontSize: "12px", background: "#0a0a0c" }}>

                        {/* INPUT */}
                        <div style={{ marginBottom: "12px" }}>
                            <div className="tp-label">
                                <span style={{ color: "#6366f1", fontSize: "10px" }}>&#9654;</span> INPUT
                            </div>
                            <div className="tp-textarea-wrap">
                                <HighlightedTextarea
                                    value={test.input}
                                    onChange={(e) => updateTestCase(test.id, "input", e.target.value)}
                                    language={language}
                                    placeholder="Enter input..."
                                    style={{ background: "transparent", fontSize: "12.5px" }}
                                />
                            </div>
                        </div>

                        {/* EXPECTED OUTPUT */}
                        <div style={{ marginBottom: isActive ? "12px" : 0 }}>
                            <div className="tp-label">
                                <span style={{ color: "#22c55e", fontSize: "10px" }}>&#9664;</span> EXPECTED OUTPUT
                            </div>
                            <div className="tp-textarea-wrap">
                                <HighlightedTextarea
                                    value={test.expectedOutput}
                                    onChange={(e) => updateTestCase(test.id, "expectedOutput", e.target.value)}
                                    language={language}
                                    placeholder="Enter expected output..."
                                    style={{ background: "transparent", fontSize: "12.5px" }}
                                />
                            </div>
                        </div>

                        {/* ACTUAL OUTPUT */}
                        {isActive && (
                            <div>
                                <div style={{
                                    fontSize: "10px",
                                    color: sc || "#71717a",
                                    marginBottom: "6px",
                                    fontWeight: "600",
                                    letterSpacing: "0.8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    textTransform: "uppercase"
                                }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ fontSize: "8px" }}>&#9670;</span>
                                        Your Output
                                    </span>
                                    {test.actualOutput && (
                                        <button
                                            onClick={() => copyToClipboard(test.actualOutput, `output-${test.id}`)}
                                            className="tp-copy-btn"
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: copiedId === `output-${test.id}` ? "#4ade80" : "#52525b",
                                                cursor: "pointer",
                                                padding: "2px 4px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "3px",
                                                fontSize: "10px",
                                                borderRadius: "4px",
                                                transition: "all 0.15s"
                                            }}
                                        >
                                            {copiedId === `output-${test.id}` ? <Check size={11}/> : <Copy size={11}/>}
                                            {copiedId === `output-${test.id}` ? "Copied" : "Copy"}
                                        </button>
                                    )}
                                </div>
                                <div style={{
                                    background: sc === "#4ade80"
                                        ? "rgba(74, 222, 128, 0.05)"
                                        : sc === "#ef5350"
                                            ? "rgba(239, 83, 80, 0.05)"
                                            : "#0d0d0f",
                                    padding: "10px 12px",
                                    borderRadius: "8px",
                                    color: sc || "#a1a1aa",
                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                    fontSize: "12.5px",
                                    lineHeight: "1.6",
                                    border: sc
                                        ? `1px solid ${sc}22`
                                        : "1px solid rgba(255,255,255,0.06)",
                                    whiteSpace: "pre-wrap",
                                    minHeight: "40px",
                                    maxHeight: "300px",
                                    overflowY: "auto",
                                    width: "100%",
                                    boxSizing: "border-box",
                                    transition: "border-color 0.2s, background 0.2s"
                                }}>
                                    {test.actualOutput || <span style={{ color: "#3f3f46", fontStyle: "italic", fontSize: "11.5px" }}>No output</span>}
                                </div>

                                {/* Diff hint */}
                                {test.status === "wrong_answer" && test.expectedOutput && test.actualOutput && (
                                    <div style={{
                                        marginTop: "8px",
                                        padding: "8px 10px",
                                        background: "rgba(251, 191, 36, 0.04)",
                                        border: "1px solid rgba(251, 191, 36, 0.12)",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        color: "#a3842a",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px"
                                    }}>
                                        <Lightbulb size={13} style={{ flexShrink: 0 }} />
                                        <span><strong>Hint:</strong> Compare your output with expected output above</span>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                    )}
                </div>
                );
            })}

            {/* ADD BUTTON */}
            <button
                onClick={addTestCase}
                className="tp-add-btn"
                style={{
                    width: "100%",
                    padding: "12px",
                    background: "transparent",
                    border: "1.5px dashed rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    color: "#52525b",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.2s"
                }}
            >
                <Plus size={15} /> Add Test Case
            </button>

        </div>

        {/* ─── FOOTER ─── */}
        <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0c0c0e" }}>
             {isRunningTests ? (
                 <button
                    onClick={handleCancel}
                    className="tp-run-all-btn"
                    style={{
                        width: "100%",
                        background: "#ef5350",
                        color: "white",
                        border: "none",
                        padding: "12px",
                        borderRadius: "10px",
                        fontWeight: "700",
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        boxShadow: "0 4px 16px rgba(239, 83, 80, 0.3)",
                        transition: "all 0.2s"
                    }}
                  >
                      <X size={16} color="white"/>
                      Stop Tests
                  </button>
             ) : (
                 <button
                    onClick={runTests}
                    disabled={isDisabled}
                    className="tp-run-all-btn"
                    style={{
                        width: "100%",
                        background: isDisabled
                            ? "#18181b"
                            : "linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #7c3aed 100%)",
                        backgroundSize: isDisabled ? "auto" : "200% 100%",
                        color: isDisabled ? "#3f3f46" : "white",
                        border: isDisabled ? "1px solid rgba(255,255,255,0.06)" : "none",
                        padding: "12px",
                        borderRadius: "10px",
                        fontWeight: "700",
                        fontSize: "13px",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        boxShadow: isDisabled ? "none" : "0 4px 16px rgba(124, 58, 237, 0.3)",
                        transition: "all 0.2s",
                        letterSpacing: "0.3px"
                    }}
                  >
                      <Play size={16} fill="white"/>
                      Run All Tests
                  </button>
             )}
        </div>

        {/* ─── STYLES ─── */}
        <style>{`
            .tp-scrollbar::-webkit-scrollbar { width: 5px; }
            .tp-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .tp-scrollbar::-webkit-scrollbar-thumb { background: #1e1e22; border-radius: 6px; }
            .tp-scrollbar::-webkit-scrollbar-thumb:hover { background: #2a2a2e; }

            .tp-close-btn:hover { background: rgba(255,255,255,0.06) !important; color: #a1a1aa !important; }

            .tp-card-header:hover { background: rgba(255,255,255,0.02) !important; }

            .tp-badge {
                font-size: 10px;
                padding: 2px 7px;
                border-radius: 20px;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-weight: 700;
                letter-spacing: 0.3px;
            }
            .tp-badge-pass {
                color: #4ade80;
                background: rgba(74, 222, 128, 0.1);
                border: 1px solid rgba(74, 222, 128, 0.2);
            }
            .tp-badge-fail {
                color: #ef5350;
                background: rgba(239, 83, 80, 0.1);
                border: 1px solid rgba(239, 83, 80, 0.2);
            }
            .tp-badge-run {
                color: #fbbf24;
                background: rgba(251, 191, 36, 0.1);
                border: 1px solid rgba(251, 191, 36, 0.2);
                animation: tp-pulse 1.5s infinite;
            }

            .tp-run-btn:not(:disabled):hover {
                background: rgba(139, 92, 246, 0.15) !important;
                border-color: rgba(139, 92, 246, 0.3) !important;
            }
            .tp-del-btn:hover { color: #ef5350 !important; background: rgba(239, 83, 80, 0.08) !important; }
            .tp-copy-btn:hover { color: #a1a1aa !important; background: rgba(255,255,255,0.04); }

            .tp-label {
                font-size: 10px;
                color: #52525b;
                margin-bottom: 6px;
                font-weight: 600;
                letter-spacing: 0.8px;
                display: flex;
                align-items: center;
                gap: 6px;
                text-transform: uppercase;
            }

            .tp-textarea-wrap {
                resize: vertical;
                overflow: hidden;
                min-height: 72px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.06);
                background: #0d0d0f;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .tp-textarea-wrap:focus-within {
                border-color: rgba(139, 92, 246, 0.4);
                box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
            }

            .tp-add-btn:hover {
                border-color: rgba(139, 92, 246, 0.3) !important;
                color: #a78bfa !important;
                background: rgba(139, 92, 246, 0.04) !important;
            }

            .tp-run-all-btn:not(:disabled):hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(124, 58, 237, 0.35) !important;
            }
            .tp-run-all-btn:not(:disabled):active {
                transform: translateY(0) scale(0.98);
            }

            @keyframes tp-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
        `}</style>
    </div>
  );
};
export default React.memo(TestPanel);
