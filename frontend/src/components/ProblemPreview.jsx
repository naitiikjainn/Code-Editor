import React from "react";
import { Play, Clock, Database, Tag, ShieldCheck, List } from "lucide-react";

export default function ProblemPreview({ problem, onCodeNow }) {
    if (!problem) return null;

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-dark)", color: "#eee", fontFamily: "'Inter', sans-serif", overflowY: "auto" }}>
            
            {/* HEADER / TITLE BLOCK */}
            <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-panel)" }}>
                <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "12px", color: "white", display: "flex", alignItems: "center", gap: "10px" }}>
                    {problem.title}
                </h1>
                
                {/* METADATA TAGS */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px", color: "#aaa" }}>
                    {problem.id && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Tag size={14} /> <span>ID: {problem.id}</span>
                        </div>
                    )}
                     <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={14} /> <span>Time: 2.0s</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Database size={14} /> <span>Memory: 256MB</span>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, padding: "32px", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
                
                {/* DESCRIPTION (HTML) */}
                <div 
                    className="problem-description"
                    style={{ lineHeight: "1.6", fontSize: "15px", color: "#ddd" }}
                    dangerouslySetInnerHTML={{ __html: problem.description || "<p>No description available.</p>" }}
                />

                {/* EXAMPLES SECTION (If parsed separately or explicitly shown) */}
                {/* Note: CF description HTML usually includes Input/Output, but we can also show our parsed cases if we want. 
                    For now, let's rely on the HTML for the "Story" and "Example" text, but display parsed cases below as a summary. */}
                
                {problem.testCases && problem.testCases.length > 0 && (
                    <div style={{ marginTop: "40px" }}>
                        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <List size={18}/> Parsed Examples
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {problem.testCases.map((tc, i) => (
                                <div key={i} style={{ background: "#222", borderRadius: "8px", border: "1px solid #333", overflow: "hidden" }}>
                                    <div style={{ display: "flex" }}>
                                        <div style={{ flex: 1, padding: "12px", borderRight: "1px solid #333" }}>
                                            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#888", marginBottom: "4px", textTransform: "uppercase" }}>Input</div>
                                            <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "13px", whiteSpace: "pre-wrap" }}>{tc.input}</pre>
                                        </div>
                                        <div style={{ flex: 1, padding: "12px" }}>
                                            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#888", marginBottom: "4px", textTransform: "uppercase" }}>Output</div>
                                            <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "13px", whiteSpace: "pre-wrap" }}>{tc.expectedOutput}</pre>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ACTION BAR (Sticky Bottom) */}
            <div style={{ 
                padding: "16px 32px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-panel)", 
                display: "flex", justifyContent: "flex-end", position: "sticky", bottom: 0 
            }}>
                <button 
                    onClick={() => onCodeNow(problem)}
                    className="btn-primary"
                    style={{ 
                        padding: "10px 24px", fontSize: "14px", fontWeight: "600", 
                        background: "#2563eb", color: "white", borderRadius: "6px", border: "none",
                        display: "flex", alignItems: "center", gap: "8px",
                        boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)", cursor: "pointer"
                    }}
                >
                    <Play size={16} fill="white" /> Code Now
                </button>
            </div>
        </div>
    );
}
