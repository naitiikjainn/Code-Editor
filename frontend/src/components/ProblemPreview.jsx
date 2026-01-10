import React, { useState } from "react";
import { Play, Clock, Database, Tag, Copy, Check, Globe } from "lucide-react";
import "katex/dist/katex.min.css";
import katex from "katex";

// --- MATH RENDERER ---
const renderMath = (html) => {
    if (!html) return "";
    return html.replace(/\$\$\$(.*?)\$\$\$/g, (match, tex) => {
        try {
            const decodedTex = tex.replace(/&lt;/g, "<")
                                  .replace(/&gt;/g, ">")
                                  .replace(/&amp;/g, "&")
                                  .replace(/&nbsp;/g, " ");
            return katex.renderToString(decodedTex, { throwOnError: false });
        } catch (e) { return match; }
    });
};

const CopyButton = ({ text }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
         navigator.clipboard.writeText(text);
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button 
            onClick={handleCopy}
            style={{ 
                background: copied ? "rgba(34, 197, 94, 0.2)" : "rgba(255,255,255,0.05)", 
                border: "1px solid",
                borderColor: copied ? "rgba(34, 197, 94, 0.4)" : "rgba(255,255,255,0.1)",
                color: copied ? "#4ade80" : "#a1a1aa", 
                padding: "4px 8px", borderRadius: "6px", fontSize: "10px", 
                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                transition: "all 0.2s"
            }}
        >
            {copied ? <Check size={10}/> : <Copy size={10}/>}
            {copied ? "Copied" : "Copy"}
        </button>
    );
};

export default function ProblemPreview({ problem, onCodeNow }) {
    if (!problem) return <div style={{ padding: "24px", color: "#666" }}>Select a problem to view details.</div>;

    const processedDescription = React.useMemo(() => renderMath(problem.description), [problem.description]);
    const processedNote = React.useMemo(() => renderMath(problem.note), [problem.note]);

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#09090b", color: "#e4e4e7", fontFamily: "'Inter', sans-serif" }}>
            
            {/* CONTENT SCROLL AREA */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                
                {/* 1. HEADER (Gradient Overlay) */}
                <div style={{ 
                    padding: "32px 40px", 
                    background: "linear-gradient(180deg, rgba(30, 27, 75, 0.3) 0%, transparent 100%)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    position: "relative" // For absolute badge positioning
                }}>
                    {problem.isSolved && (
                        <div style={{
                            position: "absolute", top: "32px", right: "40px",
                            display: "flex", alignItems: "center", gap: "6px",
                            background: "rgba(34, 197, 94, 0.1)", color: "#4ade80",
                            padding: "6px 12px", borderRadius: "20px",
                            fontSize: "12px", fontWeight: "600", border: "1px solid rgba(34, 197, 94, 0.2)"
                        }}>
                            <Check size={14} strokeWidth={3} /> Solved
                        </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", opacity: 0.8 }}>
                         <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "#a1a1aa", padding: "4px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                             {problem.contestId}{problem.index}
                         </span>
                         {problem.rating && (
                             <span style={{ fontSize: "12px", fontWeight: "bold", color: problem.rating >= 2000 ? "#ef4444" : (problem.rating >= 1400 ? "#3b82f6" : "#22c55e") }}>
                                 {problem.rating}
                             </span>
                         )}
                    </div>
                    
                    <h1 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "20px", color: "white", letterSpacing: "-0.5px" }}>
                        {problem.title}
                    </h1>
                    
                    <div style={{ display: "flex", gap: "24px", fontSize: "13px", color: "#a1a1aa" }}>
                        {problem.timeLimit && <div style={{ display:"flex", alignItems:"center", gap:"6px" }}><Clock size={14}/> {problem.timeLimit}</div>}
                        {problem.memoryLimit && <div style={{ display:"flex", alignItems:"center", gap:"6px" }}><Database size={14}/> {problem.memoryLimit}</div>}
                        {problem.tags && problem.tags.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Tag size={14}/>
                                {problem.tags.slice(0,3).join(", ")}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. DESCRIPTION BODY */}
                <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                    <style>
                        {`
                        .problem-content { 
                            width: 100%; 
                            overflow-x: hidden; 
                            word-wrap: break-word; 
                            overflow-wrap: break-word;
                        }
                        .problem-content * {
                            max-width: 100%;
                            box-sizing: border-box;
                        }
                        .problem-content p, .problem-content div, .problem-content li {
                            white-space: normal !important;
                            word-break: break-word;
                        }
                        .problem-content pre { 
                            white-space: pre-wrap !important; 
                            word-wrap: break-word; 
                            overflow-x: auto;
                            background: rgba(255,255,255,0.05); 
                            padding: 10px; 
                            border-radius: 6px; 
                        }
                        .problem-content img { max-width: 100%; height: auto; }
                        `}
                    </style>
                    <div 
                        className="problem-content"
                        style={{ lineHeight: "1.7", fontSize: "15px", color: "#d4d4d8" }}
                        dangerouslySetInnerHTML={{ __html: processedDescription || "<p style='opacity:0.5'>No description content.</p>" }}
                    />

                    {/* 3. TEST CASES (Cards) */}
                    {problem.testCases && problem.testCases.length > 0 && (
                         <div style={{ marginTop: "48px" }}>
                             <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "20px", color: "#fff", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.7 }}>Test Cases</h3>
                             
                             <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                 {problem.testCases.map((tc, idx) => (
                                     <div key={idx} style={{ 
                                         background: "#18181b", 
                                         borderRadius: "12px", 
                                         border: "1px solid rgba(255,255,255,0.05)",
                                         overflow: "hidden" 
                                     }}>
                                         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                              {/* HEADER ROW */}
                                              <div style={{ padding: "8px 16px", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight:"600", color:"#71717a", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
                                                  INPUT
                                                  <CopyButton text={tc.input} />
                                              </div>
                                              <div style={{ padding: "8px 16px", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight:"600", color:"#71717a" }}>
                                                  OUTPUT
                                              </div>
                                         </div>
                                         
                                         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                                             {/* CONTENT ROW */}
                                             <div style={{ padding: "16px", fontFamily: "var(--font-mono)", fontSize: "13px", color: "#e4e4e7", borderRight: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
                                                 <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{tc.input}</pre>
                                             </div>
                                             <div style={{ padding: "16px", fontFamily: "var(--font-mono)", fontSize: "13px", color: "#e4e4e7" }}>
                                                 <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{tc.expectedOutput}</pre>
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                    )}

                    {/* 4. NOTE */}
                    {processedNote && (
                        <div style={{ marginTop: "40px", padding: "20px", background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.1)", borderRadius: "8px" }}>
                            <h4 style={{ fontSize: "12px", fontWeight:"700", color: "#60a5fa", marginBottom: "8px", textTransform: "uppercase" }}>Note</h4>
                            <div 
                                style={{ lineHeight: "1.6", fontSize: "14px", color: "#e4e4e7" }} 
                                dangerouslySetInnerHTML={{ __html: processedNote }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ACTION BAR */}
            <div style={{ 
                padding: "16px 40px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "#09090b",
                display: "flex", justifyContent: "flex-end"
            }}>
                <button 
                    onClick={() => onCodeNow(problem)}
                    style={{ 
                        padding: "12px 28px", fontSize: "14px", fontWeight: "600", 
                        background: "linear-gradient(135deg, #3b82f6, #2563eb)", 
                        color: "white", borderRadius: "8px", border: "none",
                        display: "flex", alignItems: "center", gap: "8px",
                        cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.2)"
                    }}
                >
                    <Play size={16} fill="white" /> Code Now
                </button>
            </div>
            
             {/* Global Styles for Math/HTML Content */}
            <style>{`
                .problem-content p { margin-bottom: 1em; opacity: 0.9; }
                .problem-content ul, .problem-content ol { margin: 1em 0 1em 1.5em; opacity: 0.9; }
                .problem-content li { margin-bottom: 0.5em; }
                .problem-content strong { color: white; font-weight: 600; }
                .problem-content pre { background: rgba(255,255,255,0.05); padding: 8px; borderRadius: 4px; overflow-x: auto; }
            `}</style>
        </div>
    );
}
