import React, { useState, useEffect, useMemo } from "react";
import { Search, Trophy, Loader2, Filter, ChevronDown, CheckCircle2, User, RefreshCw, Grid, Star, ExternalLink, Zap } from "lucide-react";
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

export default function ProblemBrowser({ onOpenProblem, activeSheet: initialSheet, provider = "codeforces" }) {
    const [view, setView] = useState("browse"); 
    
    // --- STATE ---
    const [cfProblems, setCfProblems] = useState([]);
    const [cfLoading, setCfLoading] = useState(false);
    const [userHandle, setUserHandle] = useState(localStorage.getItem("cf_handle") || "");
    const [userSolved, setUserSolved] = useState(new Set());
    
    // --- FILTERS ---
    const [searchQuery, setSearchQuery] = useState("");
    const [minRating, setMinRating] = useState("");
    const [maxRating, setMaxRating] = useState("");
    const [tagFilter, setTagFilter] = useState("");
    const [activeSheet, setActiveSheet] = useState(null);

    // --- INITIAL FETCH ---
    useEffect(() => {
        if (cfProblems.length === 0) {
            setCfLoading(true);
            fetch(`${API_URL}/api/problems/codeforces/list`)
                .then(res => res.json())
                .then(data => {
                    const list = data.problems || (Array.isArray(data) ? data : []);
                    setCfProblems(list);
                })
                .catch(console.error)
                .finally(() => setCfLoading(false));
        }
    }, []);

    // --- USER STATS ---
    useEffect(() => {
        if (userHandle) fetchUserStats(); 
    }, []);

    const fetchUserStats = () => {
        if (!userHandle) return;
        localStorage.setItem("cf_handle", userHandle);
        fetch(`${API_URL}/api/problems/codeforces/user/${userHandle}`)
            .then(res => res.json())
            .then(data => {
                if (data.solved) setUserSolved(new Set(data.solved));
            })
            .catch(console.error);
    };

    // --- COMPUTED PROBLEMS ---
    const filteredProblems = useMemo(() => {
        let result = cfProblems;
        // Sheet Filter
        if (activeSheet) {
            const sheetIds = new Set(activeSheet.ids);
            result = result.filter(p => sheetIds.has(`${p.contestId}${p.index}`));
        }
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

        return result.slice(0, 100); 
    }, [cfProblems, searchQuery, minRating, maxRating, tagFilter, activeSheet, provider]);

    // --- ACTION HANDLER ---
    const handleOpen = (p) => {
        const problemObj = {
            provider: "codeforces",
            contestId: p.contestId,
            index: p.index,
            id: `${p.contestId}${p.index}`,
            title: p.name,
            rating: p.rating,
            tags: p.tags,
            url: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`
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
                 // Increased timeout to 8s for slow connections
                 setTimeout(() => { window.removeEventListener("message", handler); reject("Timeout: Extension did not respond"); }, 8000);
             });
        };

        const fallbackToBasic = (msg) => {
            // If all else fails, open with basic metadata so user isn't blocked
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

        fetchViaExtension()
            .then(html => {
                const parsed = parseCodeforcesProblem(html, p.contestId, p.index);
                onOpenProblem({ ...problemObj, ...parsed });
            })
            .catch(extErr => {
                console.warn("Extension Fetch Failed, trying backend...", extErr);
                fetch(`${API_URL}/api/problems/codeforces/${p.contestId}/${p.index}`)
                     .then(res => res.json())
                     .then(d => {
                         if (d.error) throw new Error(d.error);
                         onOpenProblem(d);
                     })
                     .catch(apiErr => {
                         console.error("Backend Fetch Failed", apiErr);
                         fallbackToBasic(extErr.toString());
                     });
            });
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
                           <div style={{background: "#ffa116", padding: "6px", borderRadius: "6px"}}><Zap size={16} color="white" /></div>
                       }
                        <h2 style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "0.5px" }}>
                            {provider === "codeforces" ? "Codeforces" : "LeetCode"}
                        </h2>
                    </div>
                    {provider === "codeforces" && <span style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", color: "#a1a1aa" }}>{cfProblems.length} Problems</span>}
                </div>

                {provider === "codeforces" ? (
                    <FilterInput icon={<Search size={14}/>} value={searchQuery} onChange={setSearchQuery} placeholder="Search problems (1000+)..." />
                ) : (
                    <div style={{padding: "20px", textAlign: "center", color: "#666", fontSize: "12px"}}>
                        LeetCode Browser coming soon.<br/>Use "Import" or "Extension".
                    </div>
                )}
            </div>

            {/* --- NAVIGATION TABS --- */}
            <div style={{ display: "flex", padding: "8px", gap: "4px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#09090b" }}>
                {['browse', 'sheets', 'user'].map(tab => (
                     <button
                        key={tab}
                        onClick={() => setView(tab)}
                        style={{
                            flex: 1, padding: "8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px",
                            background: view === tab ? "#27272a" : "transparent",
                            color: view === tab ? "white" : "#71717a",
                            border: "1px solid", borderColor: view === tab ? "rgba(255,255,255,0.1)" : "transparent",
                            cursor: "pointer", transition: "all 0.2s"
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* --- MAIN CONTENT --- */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
                
                {(view === 'browse' || view === 'sheets') && (
                    <>
                        {/* TOOLBAR */}
                        <div style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: "10px", background: "#09090b" }}>
                            {/* Search */}
                            <div style={{ position: "relative" }}>
                                <Search size={14} style={{ position: "absolute", left: "12px", top: "10px", color: "#6b7280" }} />
                                <input 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by ID or Name..." 
                                    style={{ 
                                        width: "100%", background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                                        padding: "8px 8px 8px 36px", fontSize: "12px", color: "white", outline: "none", boxSizing: "border-box"
                                    }}
                                />
                            </div>

                            {/* Filters */}
                            <div style={{ display: "flex", gap: "8px" }}>
                                <FilterInput placeholder="Min Rating" value={minRating} onChange={setMinRating} />
                                <FilterInput placeholder="Max Rating" value={maxRating} onChange={setMaxRating} />
                                <FilterInput placeholder="Tags..." value={tagFilter} onChange={setTagFilter} icon={<Filter size={10}/>} />
                            </div>

                            {/* Sheet Selector */}
                            {view === 'sheets' && (
                                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                                    {Object.keys(CP31_SHEET).map(key => (
                                        <button
                                            key={key}
                                            onClick={() => setActiveSheet(activeSheet?.name === key ? null : { name: key, ids: CP31_SHEET[key] })}
                                            style={{
                                                flexShrink: 0, padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "500", cursor: "pointer",
                                                background: activeSheet?.name === key ? "rgba(168, 85, 247, 0.1)" : "#18181b",
                                                border: activeSheet?.name === key ? "1px solid rgba(168, 85, 247, 0.5)" : "1px solid rgba(255,255,255,0.1)",
                                                color: activeSheet?.name === key ? "#c084fc" : "#9ca3af"
                                            }}
                                        >
                                           CP-31 {key}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* DATA GRID */}
                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
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
                                        display: "flex", padding: "8px 16px", background: "rgba(24, 24, 27, 0.5)", borderBottom: "1px solid rgba(255,255,255,0.05)",
                                        fontSize: "10px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", position: "sticky", top: 0, backdropFilter: "blur(4px)"
                                    }}>
                                        <div style={{ width: "60px" }}>ID</div>
                                        <div style={{ flex: 1 }}>Problem</div>
                                        <div style={{ width: "50px", textAlign: "right" }}>Rating</div>
                                    </div>

                                    {/* Rows */}
                                    {filteredProblems.map((p) => {
                                        const id = `${p.contestId}${p.index}`;
                                        const solved = userSolved.has(id);
                                        const ratingColor = getRatingColor(p.rating);
                                        return (
                                            <div 
                                                key={id}
                                                onClick={() => handleOpen(p)}
                                                style={{ 
                                                    display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)", cursor: "pointer", position: "relative",
                                                    background: solved ? "rgba(34, 197, 94, 0.02)" : "transparent",
                                                    transition: "background 0.2s"
                                                }}
                                                onMouseEnter={(e) => !solved && (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                                                onMouseLeave={(e) => !solved && (e.currentTarget.style.background = "transparent")}
                                            >
                                                {solved && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "2px", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.6)" }} />}

                                                <div style={{ width: "60px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "#71717a" }}>{p.contestId}{p.index}</div>
                                                
                                                <div style={{ flex: 1, minWidth: 0, paddingRight: "16px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                                        <span style={{ fontSize: "13px", fontWeight: "500", color: solved ? "#4ade80" : "#e4e4e7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                                                        {solved && <CheckCircle2 size={12} color="#22c55e" />}
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
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* USER VIEW */}
                {view === 'user' && (
                    <div style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", height: "100%" }}>
                         <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                            <User size={32} color="#60a5fa" />
                         </div>
                         <h3 style={{ fontSize: "18px", fontWeight: "700", color: "white", marginBottom: "4px" }}>{userHandle || "Guest"}</h3>
                         <p style={{ fontSize: "12px", color: "#71717a", marginBottom: "24px" }}>Connect your Codeforces account to track progress.</p>
                         
                         <div style={{ width: "100%", maxWidth: "200px", display: "flex", flexDirection: "column", gap: "12px" }}>
                             <input 
                                value={userHandle}
                                onChange={(e) => setUserHandle(e.target.value)}
                                placeholder="Enter Handle"
                                style={{ width: "100%", background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px", fontSize: "12px", textAlign: "center", color: "white", outline: "none", boxSizing: "border-box" }}
                             />
                             <button 
                                onClick={fetchUserStats}
                                style={{ width: "100%", padding: "8px", background: "#2563eb", border: "none", borderRadius: "8px", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                             >
                                 <RefreshCw size={12}/> Sync Progress
                             </button>
                         </div>

                         {userSolved.size > 0 && (
                             <div style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", width: "100%" }}>
                                 <div style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                     <span style={{ fontSize: "20px", fontWeight: "700", color: "#4ade80" }}>{userSolved.size}</span>
                                     <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "#6b7280", letterSpacing: "1px" }}>Solved</span>
                                 </div>
                                 <div style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                     <span style={{ fontSize: "20px", fontWeight: "700", color: "#eab308" }}>TODO</span>
                                     <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "#6b7280", letterSpacing: "1px" }}>Rating</span>
                                 </div>
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
}
