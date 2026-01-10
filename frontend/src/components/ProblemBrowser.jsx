import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Trophy, Loader2, Filter, ChevronDown, CheckCircle2, User, RefreshCw, Grid, Star, ExternalLink, Zap, X } from "lucide-react";
import { API_URL } from "../config";
import { parseCodeforcesProblem } from "../utils/codeforces";

// --- MOCK DATA ---
const CP31_SHEET = {
    "800": ["1903A", "1901A", "1900A", "1899A"],
    "900": ["1904A", "1896A", "1883B"],
    "1000": ["1891A", "1886A"],
    "1100": ["1899B", "1895B"],
};

// --- STYLES HELPER ---
const getRatingColor = (rating) => {
    if (!rating) return "#a1a1aa"; 
    if (rating < 1200) return "#a1a1aa"; 
    if (rating < 1400) return "#4ade80"; 
    if (rating < 1600) return "#06b6d4"; 
    if (rating < 1900) return "#3b82f6"; 
    if (rating < 2100) return "#a855f7"; 
    if (rating < 2400) return "#fbbf24"; 
    return "#ef4444"; 
};

// Reusable Components with Inline Styles
const TagChip = ({ label }) => (
    <span style={{ 
        fontSize: "10px", padding: "2px 8px", borderRadius: "12px", 
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", 
        color: "#a1a1aa", whiteSpace: "nowrap" 
    }}>
        {label}
    </span>
);

const FilterInput = ({ value, onChange, placeholder, icon }) => (
    <div style={{ position: 'relative', flex: 1 }}>
        <input 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                width: "100%", background: "#18181b", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px", padding: "6px 12px", fontSize: "11px", color: "white",
                outline: "none", boxSizing: "border-box", fontFamily: "var(--font-mono)"
            }}
        />
        {icon && <div style={{ position: "absolute", right: "8px", top: "8px", color: "#666", opacity: 0.5 }}>{icon}</div>}
    </div>
);

export default function ProblemBrowser({ onOpenProblem, activeSheet: initialSheet, provider = "codeforces", user }) {
    
    // --- STATE ---
    const [cfProblems, setCfProblems] = useState([]);
    const [cfLoading, setCfLoading] = useState(false);
    const [solvedProblems, setSolvedProblems] = useState(new Set());
    const [solvedNames, setSolvedNames] = useState(new Set());
    const [attemptedProblems, setAttemptedProblems] = useState(new Set());
    const [attemptedNames, setAttemptedNames] = useState(new Set());
    const [openingId, setOpeningId] = useState(null); // Prevents multi-click

    // --- FETCH SOLVED STATUS ---
    useEffect(() => {
        if (provider !== "codeforces") return;
        
        const handle = localStorage.getItem("cf_handle") || user?.platforms?.codeforces;
        console.log("[ProblemBrowser] Fetching status for handle:", handle);

        if (!handle) return;
        
        // Use Backend Proxy to avoid CORS
        fetch(`${API_URL}/api/problems/codeforces/status/${handle}`) 
            .then(res => res.json())
            .then(data => {
                if (data.status === "OK") {
                    const solved = new Set();
                    const sNames = new Set();
                    const attempted = new Set();
                    const aNames = new Set();
                    
                    data.result.forEach(sub => {
                        const id = `${sub.contestId}${sub.problem.index}`;
                        const name = sub.problem.name;
                        
                        if (sub.verdict === "OK") {
                            solved.add(id);
                            sNames.add(name);
                        } else {
                            attempted.add(id);
                            aNames.add(name);
                        }
                    });
                    setSolvedProblems(solved);
                    setSolvedNames(sNames);
                    setAttemptedProblems(attempted);
                    setAttemptedNames(aNames);
                }
            })
            .catch(err => console.error("Failed to fetch user status", err));
    }, [provider, user]);
    
    // --- FILTERS ---
    const [searchQuery, setSearchQuery] = useState("");
    const [minRating, setMinRating] = useState("");
    const [maxRating, setMaxRating] = useState("");
    const [tagFilter, setTagFilter] = useState("");
    
    // --- CSES ACCORDION STATE ---
    const [expandedCategories, setExpandedCategories] = useState({}); // { "Introductory Problems": true }

    const toggleCategory = (name) => {
        setExpandedCategories(prev => ({ ...prev, [name]: !prev[name] }));
    };

    // --- USER HANDLE (For Verdict Polling) ---


    // --- INFINITE SCROLL STATE ---
    const [visibleCount, setVisibleCount] = useState(50);
    const scrollContainerRef = useRef(null);

    // --- INITIAL FETCH ---
    useEffect(() => {
        if (provider === "codeforces" && cfProblems.length === 0) {
            setCfLoading(true);
            fetch(`${API_URL}/api/problems/codeforces/list`)
                .then(res => res.json())
                .then(data => {
                    const list = data.problems || (Array.isArray(data) ? data : []);
                    setCfProblems(list);
                })
                .catch(console.error)
                .finally(() => setCfLoading(false));
        } else if (provider === "cses" && cfProblems.length === 0) {
            setCfLoading(true);
            fetch(`${API_URL}/api/problems/cses/list`)
                .then(res => res.json())
                .then(data => {
                     // data.categories is the new structure
                     setCfProblems(data.categories || []);
                })
                .catch(console.error)
                .finally(() => setCfLoading(false));
        }
    }, [provider]);

    // --- COMPUTED PROBLEMS ---
    const filteredProblems = useMemo(() => {
        let result = cfProblems;
        
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => 
                p.name.toLowerCase().includes(q) || 
                `${p.contestId}${p.index}`.toLowerCase().includes(q)
            );
        }
        // Rating
        if (minRating) result = result.filter(p => p.rating >= parseInt(minRating));
        if (maxRating) result = result.filter(p => p.rating <= parseInt(maxRating));
        if (tagFilter) result = result.filter(p => p.tags.some(t => t.includes(tagFilter.toLowerCase())));

        return result; 
    }, [cfProblems, searchQuery, minRating, maxRating, tagFilter, provider]);

    // Reset visible count on filter change
    useEffect(() => {
        setVisibleCount(50);
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }, [searchQuery, minRating, maxRating, tagFilter]);

    const visibleProblems = filteredProblems.slice(0, visibleCount);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) { // Load more when near bottom
             setVisibleCount(prev => Math.min(prev + 50, filteredProblems.length));
        }
    };

    // --- ACTION HANDLER ---
    const handleOpen = (p) => {
        const uniqueKey = p.id || `${p.contestId}${p.index}`; // Handle Codeforces vs CSES keys
        if (openingId) return; // Block double clicks

        setOpeningId(uniqueKey);

        const finalize = () => setOpeningId(null);

        if (provider === "cses") {
            // CSES OPEN LOGIC
             fetch(`${API_URL}/api/problems/cses/problem/${p.index}`)
                .then(res => res.json())
                .then(problemData => {
                    if (problemData.error) throw new Error(problemData.error);
                    onOpenProblem(problemData);
                })
                .catch(err => {
                    console.error(err);
                    alert("Failed to load CSES problem: " + err.message);
                })
                .finally(finalize);
             return;
        }

        // Check ID or Name (Parallel Contests fix)
        const id = `${p.contestId}${p.index}`;
        const isSolved = solvedProblems.has(id) || solvedNames.has(p.name);
        const isAttempted = !isSolved && (attemptedProblems.has(id) || attemptedNames.has(p.name));

        const problemObj = {
            provider: "codeforces",
            contestId: p.contestId,
            index: p.index,
            id: id,
            title: p.name,
            rating: p.rating,
            tags: p.tags,
            url: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`,
            isSolved: isSolved,
            isAttempted: isAttempted
        };

        const fallbackToBasic = (msg) => {
             onOpenProblem({ 
                ...problemObj, 
                description: `<div style="padding:20px; text-align:center; color:#ef4444;">
                    <h3>Fetch Failed</h3>
                    <p>${msg}</p>
                    <p>Codeforces might be blocking automated requests.</p>
                    <a href="${problemObj.url}" target="_blank" style="color:#60a5fa; text-decoration:underline;">View on Codeforces</a>
                </div>`
            });
        };

        const fetchViaExtension = () => {
             return new Promise((resolve, reject) => {
                 const handler = (event) => {
                     // Accept HTML result or explicit error
                     if (event.data.type === "CODEPLAY_CF_HTML_RESULT") {
                         window.removeEventListener("message", handler);
                         if (event.data.payload.success) resolve(event.data.payload.html);
                         else reject(event.data.payload.error);
                     }
                 };
                 window.addEventListener("message", handler);
                 window.postMessage({ type: "CODEPLAY_FETCH_CF_HTML", payload: { url: problemObj.url } }, "*");
                 setTimeout(() => { window.removeEventListener("message", handler); reject("Timeout: Extension did not respond"); }, 8000);
             });
        };

        // STRATEGY: Backend (Redis/Cache) -> Extension (Fallback) -> Cache Result
        const tryBackendFirst = () => {
             console.log(`[ProblemBrowser] Checking Backend for ${id}...`);
             fetch(`${API_URL}/api/problems/codeforces/${p.contestId}/${p.index}`)
                 .then(res => {
                     if (!res.ok) throw new Error("Backend miss or error");
                     return res.json();
                 })
                 .then(d => {
                     // CRITICAL: If backend returns "No description", treat as MISS
                     if (d.error || !d.description || d.description.includes("No description available")) {
                         throw new Error("Backend has no description (Anti-Bot)");
                     }
                     console.log(`[ProblemBrowser] Backend Hit!`);
                     onOpenProblem(d);
                     finalize();
                 })
                 .catch(apiErr => {
                     console.warn("[ProblemBrowser] Backend Failed/Empty, trying Extension...", apiErr.message);
                     tryExtensionFallback();
                 });
        };

        const tryExtensionFallback = () => {
             fetchViaExtension()
                .then(html => {
                    const parsed = parseCodeforcesProblem(html, p.contestId, p.index);
                    onOpenProblem({ ...problemObj, ...parsed });
                    finalize();
                    
                    // NEW: Save this successful scrape to Backend for other users!
                    console.log("[ProblemBrowser] Extension Success! Caching to backend...");
                    fetch(`${API_URL}/api/problems/cache`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            problemId: id, 
                            data: { ...problemObj, ...parsed } 
                        })
                    }).catch(err => console.error("Failed to cache extension result:", err));
                })
                .catch(extErr => {
                    console.error("All Fetches Failed", extErr);
                    fallbackToBasic("Both Backend and Extension failed to load this problem.");
                    finalize();
                });
        };

        tryBackendFirst();
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#09090b", color: "#e4e4e7", fontFamily: "var(--font-main)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
            
            {/* --- HEADER --- */}
            <div style={{ 
                padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", 
                background: provider === "codeforces" ? "linear-gradient(180deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%)" : "linear-gradient(180deg, rgba(255, 161, 22, 0.05) 0%, transparent 100%)"
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                       {provider === "codeforces" ? 
                           <div style={{background: "#3b82f6", padding: "6px", borderRadius: "6px"}}><Trophy size={16} color="white" /></div> :
                           (provider === "cses" ? 
                               <div style={{background: "#ea580c", padding: "6px", borderRadius: "6px"}}><Grid size={16} color="white" /></div> :
                               <div style={{background: "#ffa116", padding: "6px", borderRadius: "6px"}}><Zap size={16} color="white" /></div>
                           )
                       }
                        <h2 style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "0.5px" }}>
                            {provider === "codeforces" ? "Codeforces" : (provider === "cses" ? "CSES Problem Set" : "LeetCode")}
                        </h2>
                    </div>
                    {provider === "codeforces" && <span style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", color: "#a1a1aa" }}>{filteredProblems.length} Problems</span>}
                </div>

                {provider === "codeforces" ? (
                    <>
                    {/* Handle Input for Polling */}


                    <FilterInput icon={<Search size={14}/>} value={searchQuery} onChange={setSearchQuery} placeholder="Search problems (1000+)..." />
                     {/* Filters */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        <FilterInput placeholder="Min Rating" value={minRating} onChange={setMinRating} />
                        <FilterInput placeholder="Max Rating" value={maxRating} onChange={setMaxRating} />
                        <FilterInput placeholder="Tags..." value={tagFilter} onChange={setTagFilter} icon={<Filter size={10}/>} />
                    </div>
                    </>
                ) : (
                    <div style={{padding: "20px", textAlign: "center", color: "#666", fontSize: "12px"}}>
                        LeetCode Browser coming soon.<br/>Use "Import" or "Extension".
                    </div>
                )}
            </div>

            {/* --- FILTER & SCROLL (CSES has no filters yet) --- */}
            {provider === "cses" && (
                <div style={{ padding: "0 16px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <FilterInput icon={<Search size={14}/>} value={searchQuery} onChange={setSearchQuery} placeholder="Search CSES problems..." />
                </div>
            )}



            {/* --- MAIN CONTENT (CSES ACCORDION) --- */}
            {provider === "cses" && (
            <div 
                style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}
            >
                {cfLoading ? (
                    <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#6b7280", fontSize: "12px" }}>
                        <Loader2 className="animate-spin" size={16}/> Loading CSES...
                    </div>
                ) : cfProblems.length === 0 ? (
                    <div style={{ height: "160px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#6b7280", fontSize: "12px" }}>
                        <Grid size={24} style={{ opacity: 0.2 }}/> No problems found
                    </div>
                ) : (
                    <div>
                         {/* Render Categories */}
                         {cfProblems.map((category, catIdx) => {
                             // Filter problems within category if searching
                             const catProblems = category.problems.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));
                             
                             if (catProblems.length === 0) return null;
                             
                             // State for collapse (using local state map if needed, or simple ID approach)
                             // Since we are inside a map, we need a parent state. 
                             // But we can't add hooks inside map. 
                             // We need to move this mapping to a separate component or add state at top.
                             
                             const isExpanded = expandedCategories[category.name]; // Need to add this state

                             return (
                                 <div key={catIdx} style={{ marginBottom: "0px" }}>
                                     {/* Category Header */}
                                     <div 
                                        onClick={() => toggleCategory(category.name)}
                                        style={{ 
                                            padding: "12px 16px", background: "rgba(255,255,255,0.03)", 
                                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                                            display: "flex", alignItems: "center", gap: "8px",
                                            fontSize: "13px", fontWeight: "700", color: "#e4e4e7",
                                            cursor: "pointer", userSelect: "none"
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                                        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                     >
                                         <div style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "flex" }}>
                                            <ChevronDown size={14} color="#6b7280" />
                                         </div>
                                         {category.name}
                                         <span style={{ fontSize: "10px", color: "#71717a", marginLeft: "auto" }}>{catProblems.length}</span>
                                     </div>
                                     
                                     {/* Problems List */}
                                     {isExpanded && (
                                     <div style={{ background: "rgba(0,0,0,0.2)" }}>
                                         {catProblems.map((p) => (
                                             <div 
                                                key={p.index}
                                                onClick={() => handleOpen(p)}
                                                style={{ 
                                                    display: "flex", alignItems: "center", padding: "8px 16px 8px 36px", 
                                                    borderBottom: "1px solid rgba(255,255,255,0.02)", cursor: "pointer", 
                                                    transition: "background 0.2s"
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                             >
                                                 <div style={{ flex: 1, fontSize: "12px", color: "#a1a1aa" }}>{p.name}</div>
                                                 <div style={{ background: "rgba(234, 88, 12, 0.1)", color: "#ea580c", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}>Solve</div>
                                             </div>
                                         ))}
                                     </div>
                                     )}
                                 </div>
                             );
                         })}
                    </div>
                )}
            </div>
            )}
            
            {/* --- MAIN CONTENT (CODEFORCES INFINITE SCROLL) --- */}
            {provider === "codeforces" && (
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}
            >
                {cfLoading ? (
                    <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#6b7280", fontSize: "12px" }}>
                        <Loader2 className="animate-spin" size={16}/> Loading Problems...
                    </div>
                ) : filteredProblems.length === 0 ? (
                    <div style={{ height: "160px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#6b7280", fontSize: "12px" }}>
                        <Grid size={24} style={{ opacity: 0.2 }}/> No problems found
                    </div>
                ) : (
                    <div>
                        {/* Grid Header */}
                        <div style={{ 
                            display: "flex", padding: "8px 16px", background: "rgba(24, 24, 27, 0.95)", borderBottom: "1px solid rgba(255,255,255,0.05)",
                            fontSize: "10px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", position: "sticky", top: 0, zIndex: 5
                        }}>
                            <div style={{ width: "60px" }}>ID</div>
                            <div style={{ flex: 1 }}>Problem</div>
                            <div style={{ width: "50px", textAlign: "right" }}>Rating</div>
                        </div>

                        {/* Rows */}
                        {visibleProblems.map((p) => {
                            const id = `${p.contestId}${p.index}`;
                            const ratingColor = getRatingColor(p.rating);
                            
                            // Check ID or Name (Parallel Contests fix)
                            const isSolved = solvedProblems.has(id) || solvedNames.has(p.name);
                            const isAttempted = !isSolved && (attemptedProblems.has(id) || attemptedNames.has(p.name));
                            
                            return (
                                <div 
                                    key={id}
                                    onClick={() => handleOpen(p)}
                                    style={{ 
                                        display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)", cursor: "pointer", position: "relative",
                                        transition: "background 0.2s",
                                        background: isSolved ? "rgba(34, 197, 94, 0.05)" : (isAttempted ? "rgba(239, 68, 68, 0.1)" : "transparent")
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = isSolved ? "rgba(34, 197, 94, 0.1)" : (isAttempted ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.03)")}
                                    onMouseLeave={(e) => e.currentTarget.style.background = isSolved ? "rgba(34, 197, 94, 0.05)" : (isAttempted ? "rgba(239, 68, 68, 0.1)" : "transparent")}
                                >
                                    <div style={{ width: "60px", fontSize: "12px", fontFamily: "var(--font-mono)", color: isSolved ? "#4ade80" : (isAttempted ? "#ef4444" : "#71717a") }}>
                                        <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
                                            {openingId === id ? <Loader2 className="animate-spin" size={10} /> : (isSolved ? <CheckCircle2 size={10} color="#4ade80" /> : (isAttempted ? <X size={10} color="#ef4444" strokeWidth={3}/> : null))}
                                            {p.contestId}{p.index}
                                        </div>
                                    </div>
                                    
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: "16px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                            <span style={{ fontSize: "13px", fontWeight: "500", color: isSolved ? "#86efac" : (isAttempted ? "#fca5a5" : "#e4e4e7"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                                        </div>
                                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                            {p.tags.slice(0, 3).map(t => <TagChip key={t} label={t}/>)}
                                        </div>
                                    </div>

                                    <div style={{ width: "50px", textAlign: "right" }}>
                                        {p.rating ? (
                                            <span style={{ fontSize: "12px", fontWeight: "700", color: ratingColor }}>{p.rating}</span>
                                        ) : <span style={{ fontSize: "12px", color: "#3f3f46" }}>-</span>}
                                    </div>
                                </div>
                            );
                        })}
                        {visibleCount < filteredProblems.length && (
                             <div style={{ padding: "16px", display: "flex", justifyContent: "center", color: "#666", fontSize: "12px" }}>
                                <Loader2 className="animate-spin" size={14} style={{marginRight: "8px"}} /> Loading more...
                             </div>
                        )}
                    </div>
                )}
            </div>
            )}


        </div>
    );
}
