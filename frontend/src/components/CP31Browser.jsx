import React, { useState, useEffect } from 'react';
import cpData from './cp31.json';
import { ChevronDown, ChevronRight, CheckCircle, Circle, Play } from 'lucide-react';
import { API_URL } from '../config';
import { parseCodeforcesProblem } from "../utils/codeforces";

const CP31Browser = ({ onOpenProblem, user }) => {
    const [expandedRating, setExpandedRating] = useState(null);
    const ratings = Object.keys(cpData).sort((a, b) => parseInt(a) - parseInt(b));
    const [solvedProblems, setSolvedProblems] = useState([]);
    useEffect(() => {
        const handle = localStorage.getItem("cf_handle") || user?.platforms?.codeforces;
        if (handle) {
            // Use the working Proxy endpoint that fetches full status
            fetch(`${API_URL}/api/problems/codeforces/status/${handle}`)
                .then(res => res.json())
                .then(data => { 
                    if (data.status === "OK") {
                        // Extract solved problems (verdict "OK")
                        // ProblemBrowser uses contestId + index (e.g. 1903A)
                        const solved = data.result
                            .filter(sub => sub.verdict === "OK")
                            .map(sub => `${sub.problem.contestId}${sub.problem.index}`);
                        setSolvedProblems(solved);
                    }
                })
                .catch(e => console.error("CP31 Status Fetch Error:", e));
        }
    }, [user]);

    const toggleRating = (rating) => {
        setExpandedRating(expandedRating === rating ? null : rating);
    };

    const [loadingId, setLoadingId] = useState(null);

    const handleProblemClick = async (problem) => {
        if (loadingId) return;
        const id = `${problem.contestId}${problem.index}`;
        setLoadingId(id);
        const problemObj = {
            provider: "codeforces",
            contestId: problem.contestId,
            index: problem.index,
            id: id,
            title: problem.name,
            rating: problem.rating,
            tags: problem.tags,
            url: `https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`,
            isSolved: solvedProblems.includes(id),
            isAttempted: false 
        };

        const finalize = () => setLoadingId(null);

        const fetchViaExtension = () => {
             return new Promise((resolve, reject) => {
                 const handler = (event) => {
                     if (event.data.type === "CODEPLAY_CF_HTML_RESULT") {
                         window.removeEventListener("message", handler);
                         if (event.data.payload.success) resolve(event.data.payload.html);
                         else reject(event.data.payload.error);
                     }
                 };
                 window.addEventListener("message", handler);
                 window.postMessage({ type: "CODEPLAY_FETCH_CF_HTML", payload: { url: problemObj.url } }, "*");
                 setTimeout(() => { window.removeEventListener("message", handler); reject("Timeout: Extension did not respond"); }, 30000);
             });
        };

        // STRATEGY: Backend (Cache) -> Extension -> Save to Cache
        try {
             // 1. Try Backend
             // Force backend to bypass Redis cache using refresh=true
             const res = await fetch(`${API_URL}/api/problems/codeforces/${problem.contestId}/${problem.index}?refresh=true`);
             const data = await res.json();

             if (!data.error && data.description && !data.description.includes("No description available")) {
                 console.log("[CP31Browser] Backend Hit!");
                 // Merge with original problemObj to ensure IDs are present
                 onOpenProblem({ ...problemObj, ...data });
                 finalize();
                 return;
             }
             throw new Error("Backend miss or empty");
        } catch (err) {
             console.warn("[CP31Browser] Backend failed, trying Extension...", err.message);
             
             // 2. Try Extension
             try {
                const { parseCodeforcesProblem } = await import("../utils/codeforces"); // Dynamic import if needed or import at top
                const html = await fetchViaExtension();
                const parsed = parseCodeforcesProblem(html, problem.contestId, problem.index);
                
                const fullProblem = { ...problemObj, ...parsed };
                onOpenProblem(fullProblem);
                
                // 3. Cache Result
                console.log("[CP31Browser] Extension Success! Caching to backend...");
                fetch(`${API_URL}/api/problems/cache`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        problemId: id, 
                        data: fullProblem 
                    })
                }).catch(e => console.error("Cache failed", e));

             } catch (extErr) {
                 console.error("All Fetches Failed", extErr);
                 // Fallback to basic view
                 onOpenProblem({ 
                    ...problemObj, 
                    description: `<div style="padding:20px; text-align:center; color:#ef4444;">
                        <h3>Fetch Failed</h3>
                        <p>Could not load problem data.</p>
                        <a href="${problemObj.url}" target="_blank" style="color:#60a5fa; text-decoration:underline;">View on Codeforces</a>
                    </div>`
                });
             } finally {
                 finalize();
             }
        }
    };

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#09090b", color: "#d4d4d8", fontFamily: "sans-serif", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "16px", borderBottom: "1px solid #27272a", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "white", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                    <span style={{ background: "linear-gradient(to right, #4ade80, #3b82f6)", WebkitBackgroundClip: "text", color: "transparent" }}>
                        CP-31 Sheet
                    </span>
                </h2>
                <span style={{ fontSize: "10px", background: "#18181b", padding: "4px 8px", borderRadius: "4px", color: "#a1a1aa", border: "1px solid #27272a" }}>
                    800-1900
                </span>
            </div>

            {/* Column Headers */}
            <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid #27272a", background: "#101012", fontSize: "11px", fontWeight: "bold", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <div style={{ width: "64px", flexShrink: 0 }}>ID</div>
                <div style={{ flex: 1 }}>Problem</div>
                <div style={{ width: "48px", textAlign: "right", flexShrink: 0 }}>Rating</div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", background: "#000000" }} className="custom-scrollbar">
                {ratings.map((rating) => {
                    const isOpen = expandedRating === rating;
                    
                    return (
                        <div key={rating} style={{ borderBottom: "1px solid #18181b" }}>
                            {/* Rating Accordion Header */}
                            <button
                                onClick={() => toggleRating(rating)}
                                style={{ 
                                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", 
                                    padding: "12px 16px", background: "#09090b", border: "none", borderBottom: "1px solid #18181b",
                                    cursor: "pointer", color: isOpen ? "white" : "#a1a1aa", transition: "0.2s"
                                }}
                            >
                                <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                                    Rated {rating}
                                </span>
                                <div style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: "0.2s", color: "#52525b" }}>
                                    <ChevronDown size={14} />
                                </div>
                            </button>

                            {/* Problems List */}
                            {isOpen && (
                                <div style={{ background: "#050505" }}>
                                    {cpData[rating].map((problem, idx) => {
                                        const pid = `${problem.contestId}${problem.index}`;
                                        const isSolved = solvedProblems.includes(pid);

                                        return (
                                            <div 
                                                key={idx} 
                                                onClick={() => handleProblemClick(problem)}
                                                style={{ 
                                                    display: "flex", alignItems: "flex-start", padding: "12px 16px", 
                                                    borderBottom: "1px solid #18181b", cursor: "pointer", position: "relative",
                                                    background: isSolved ? "rgba(34,197,94,0.03)" : "transparent",
                                                    transition: "background 0.2s"
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = isSolved ? "rgba(34,197,94,0.06)" : "#121214"}
                                                onMouseLeave={(e) => e.currentTarget.style.background = isSolved ? "rgba(34,197,94,0.03)" : "transparent"}
                                            >
                                                {/* Left Status Bar */}
                                                {isSolved && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "2px", background: "rgba(34,197,94,0.5)" }} />}
                                                
                                                {/* ID Column */}
                                                <div style={{ width: "64px", flexShrink: 0, display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                                                     {isSolved ? (
                                                         <CheckCircle size={12} color="#22c55e" style={{ flexShrink: 0 }} />
                                                     ) : (
                                                         <span style={{ width: "12px", display: "inline-block" }} /> 
                                                     )}
                                                     <span style={{ fontSize: "13px", fontFamily: "monospace", color: isSolved ? "#4ade80" : "#71717a" }}>{pid}</span>
                                                </div>

                                                {/* Problem Column */}
                                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, paddingRight: "16px" }}>
                                                    <div style={{ display: "flex", alignItems: "center" }}>
                                                        <span style={{ fontSize: "14px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: isSolved ? "white" : "#e4e4e7" }}>
                                                            {problem.name.replace(/^(Problem )?[A-Z]\. /, '')}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Tags */}
                                                    {problem.tags && problem.tags.length > 0 && (
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                                            {problem.tags.slice(0, 3).map(tag => (
                                                                <span key={tag} style={{ 
                                                                    padding: "2px 6px", borderRadius: "4px", fontSize: "10px", 
                                                                    background: "#18181b", color: "#71717a", border: "1px solid #27272a", whiteSpace: "nowrap" 
                                                                }}>
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Rating Column + Loader */}
                                                <div style={{ width: "48px", textAlign: "right", flexShrink: 0, marginTop: "2px" }}>
                                                     {loadingId === pid ? (
                                                         <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                                             <span className="animate-spin" style={{ display: "block", height: "12px", width: "12px", borderRadius: "50%", border: "2px solid white", borderTopColor: "transparent" }}></span>
                                                         </div>
                                                     ) : (
                                                         <span style={{ fontSize: "12px", fontFamily: "monospace", color: isSolved ? "#22c55e" : "#52525b" }}>
                                                             {problem.rating || "-"}
                                                         </span>
                                                     )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CP31Browser;
