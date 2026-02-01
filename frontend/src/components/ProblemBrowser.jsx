import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Trophy, Loader2, Filter, ChevronDown, CheckCircle2, User, RefreshCw, Grid, Star, ExternalLink, Zap, X, Lock } from "lucide-react";
import { API_URL } from "../config";
import { fetchCodeforcesProblem, fetchCSESProblem, fetchLeetCodeProblem } from "../utils/problemFetcher";

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

const getDifficultyColor = (difficulty) => {
    if (!difficulty) return "#a1a1aa";
    const d = difficulty.toLowerCase();
    if (d === "easy") return "#4ade80";
    if (d === "medium") return "#fbbf24";
    if (d === "hard") return "#ef4444";
    return "#a1a1aa";
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

        if (!handle) return; // No handle set, skip fetching status
        console.log("[ProblemBrowser] Fetching status for handle:", handle);
        
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
    const [tagFilter, setTagFilter] = useState([]); // Multi-select tags array
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
    const tagDropdownRef = useRef(null);
    
    // --- LEETCODE SPECIFIC STATE ---
    const [lcDifficulty, setLcDifficulty] = useState(""); // "Easy", "Medium", "Hard"
    const [lcTags, setLcTags] = useState([]); // Available tags from API
    const [lcSelectedTag, setLcSelectedTag] = useState("");
    const [lcTotal, setLcTotal] = useState(0);
    const [lcSkip, setLcSkip] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    
    // --- CSES ACCORDION STATE ---
    const [expandedCategories, setExpandedCategories] = useState({}); // { "Introductory Problems": true }

    const toggleCategory = (name) => {
        setExpandedCategories(prev => ({ ...prev, [name]: !prev[name] }));
    };

    // --- INFINITE SCROLL STATE ---
    const [visibleCount, setVisibleCount] = useState(50);
    const scrollContainerRef = useRef(null);

    // --- CODEFORCES AVAILABLE TAGS ---
    const availableTags = useMemo(() => {
        if (provider !== "codeforces" || cfProblems.length === 0) return [];
        const tagSet = new Set();
        cfProblems.forEach(p => {
            p.tags?.forEach(t => tagSet.add(t));
        });
        return Array.from(tagSet).sort();
    }, [cfProblems, provider]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) {
                setTagDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- FETCH LEETCODE HELPERS ---
    const fetchLeetCode = async (skip, append = false) => {
        setCfLoading(true);
        
        try {
            const params = new URLSearchParams();
            params.append("limit", "100");
            params.append("skip", skip.toString());
            if (lcDifficulty) params.append("difficulty", lcDifficulty);
            if (lcSelectedTag) params.append("tag", lcSelectedTag);
            if (debouncedSearch) params.append("search", debouncedSearch);

            const res = await fetch(`${API_URL}/api/problems/leetcode/list?${params.toString()}`);
            const data = await res.json();
            
            setLcTotal(data.total || 0);
            if (append) {
                setCfProblems(prev => [...prev, ...(data.problems || [])]);
                setVisibleCount(prev => prev + 100);
            } else {
                setCfProblems(data.problems || []);
                setVisibleCount(100);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setCfLoading(false);
        }
    };

    // --- INITIAL FETCH & EFFECTS ---
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
        } else if (provider === "leetcode") {
            // Fetch tags if not loaded
            if (lcTags.length === 0) {
                fetch(`${API_URL}/api/problems/leetcode/tags`)
                    .then(res => res.json())
                    .then(tags => setLcTags(tags || []))
                    .catch(console.error);
            }
        }
    }, [provider]);

    // LeetCode Filter Changes -> Reset
    useEffect(() => {
        if (provider === "leetcode") {
            setLcSkip(0);
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
            fetchLeetCode(0, false);
        }
    }, [provider, lcDifficulty, lcSelectedTag, debouncedSearch]);

    // LeetCode Load More
    useEffect(() => {
        if (provider === "leetcode" && lcSkip > 0) {
            fetchLeetCode(lcSkip, true);
        }
    }, [lcSkip]);

    // --- COMPUTED PROBLEMS ---
    const filteredProblems = useMemo(() => {
        let result = cfProblems;
        
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (provider === "leetcode") {
               // Server-side search handled via debouncedSearch/fetchLeetCode
               // Client-side filtering removed to allow server results to show
            } else {
                result = result.filter(p => 
                    p.name?.toLowerCase().includes(q) || 
                    `${p.contestId}${p.index}`.toLowerCase().includes(q)
                );
            }
        }
        // Rating (Codeforces)
        if (provider === "codeforces") {
            if (minRating) result = result.filter(p => p.rating >= parseInt(minRating));
            if (maxRating) result = result.filter(p => p.rating <= parseInt(maxRating));
            // Multi-tag filter: problem must have ALL selected tags
            if (tagFilter.length > 0) {
                result = result.filter(p => 
                    tagFilter.every(selectedTag => 
                        p.tags?.some(t => t.toLowerCase().includes(selectedTag.toLowerCase()))
                    )
                );
            }
        }

        return result; 
    }, [cfProblems, searchQuery, minRating, maxRating, tagFilter, provider]);

    // Reset visible count on filter change (Local Filters for CF/CSES)
    useEffect(() => {
        if (provider !== "leetcode") {
            setVisibleCount(50);
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        }
    }, [searchQuery, minRating, maxRating, tagFilter]);

    const visibleProblems = filteredProblems.slice(0, visibleCount);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) { // Load more when near bottom
             if (provider === "leetcode") {
                 if (!cfLoading && cfProblems.length < lcTotal) {
                     // Debounce or just relying on state update speed?
                     // Verify we aren't already fetching? cfLoading checks this.
                     // But lcSkip effect triggers fetch.
                     setLcSkip(prev => {
                         if (prev + 100 >= lcTotal) return prev; // Limit
                         if (prev + 100 > cfProblems.length) return prev; // Don't skip ahead if current fetch incomplete
                         return prev + 100;
                     });
                 }
             } else {
                 setVisibleCount(prev => Math.min(prev + 50, filteredProblems.length));
             }
        }
    };

    // --- ACTION HANDLER ---
    const handleOpen = async (p) => {
        const uniqueKey = p.id || p.titleSlug || `${p.contestId}${p.index}`;
        if (openingId) return; // Block double clicks

        setOpeningId(uniqueKey);

        try {
            if (provider === "leetcode") {
                // LeetCode: Fetch problem details
                console.log(`[ProblemBrowser] Fetching LeetCode: ${p.titleSlug}...`);
                
                const result = await fetchLeetCodeProblem(p.titleSlug);
                
                if (result.success) {
                    onOpenProblem({
                        ...result.data,
                        provider: "leetcode",
                        id: p.id,
                        title: result.data.title || p.title,
                        difficulty: p.difficulty,
                        tags: p.tags,
                        acceptanceRate: p.acceptanceRate,
                        url: `https://leetcode.com/problems/${p.titleSlug}/`
                    });
                } else {
                    // Fallback: Open with basic info
                    onOpenProblem({
                        provider: "leetcode",
                        id: p.id,
                        title: p.title,
                        titleSlug: p.titleSlug,
                        difficulty: p.difficulty,
                        tags: p.tags,
                        url: `https://leetcode.com/problems/${p.titleSlug}/`,
                        description: `<div style="width: 100%; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #161b22; border-radius: 12px; padding: 40px; text-align: center;">
                            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, rgba(255, 161, 22, 0.2), rgba(234, 88, 12, 0.1)); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffa116"><path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0z"/></svg>
                            </div>
                            <h3 style="color: #e4e4e7; font-size: 18px; margin: 0 0 8px 0;">${p.title}</h3>
                            <p style="color: #71717a; font-size: 13px; margin-bottom: 20px;">Problem details couldn't be loaded</p>
                            <a href="https://leetcode.com/problems/${p.titleSlug}/" target="_blank" 
                               style="padding: 10px 20px; background: linear-gradient(135deg, #ffa116 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                Open on LeetCode
                            </a>
                        </div>`
                    });
                }
                return;
            }
            
            if (provider === "cses") {
                // CSES: Use new fetcher
                const result = await fetchCSESProblem(p.index);
                if (result.success) {
                    onOpenProblem(result.data);
                } else {
                    onOpenProblem(result.data); // Will show error message
                }
                return;
            }

            // Codeforces: Use new fetcher with built-in fallback
            const id = `${p.contestId}${p.index}`;
            const isSolved = solvedProblems.has(id) || solvedNames.has(p.name);
            const isAttempted = !isSolved && (attemptedProblems.has(id) || attemptedNames.has(p.name));

            console.log(`[ProblemBrowser] Fetching ${id}...`);

            const result = await fetchCodeforcesProblem(p.contestId, p.index);

            // Merge with local status info
            const problemData = {
                ...result.data,
                title: result.data.title || p.name,
                rating: p.rating,
                tags: p.tags,
                isSolved,
                isAttempted
            };

            if (result.source) {
                console.log(`[ProblemBrowser] Loaded ${id} from ${result.source}`);
            }

            onOpenProblem(problemData);

        } catch (err) {
            console.error("[ProblemBrowser] Error:", err);
            let url = "";
            if (provider === "leetcode") {
                url = `https://leetcode.com/problems/${p.titleSlug}/`;
            } else if (provider === "cses") {
                url = `https://cses.fi/problemset/task/${p.index}`;
            } else {
                url = `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`;
            }
            
            onOpenProblem({
                provider: provider,
                id: uniqueKey,
                title: p.name || p.title || uniqueKey,
                url: url,
                description: `<div style="padding:20px; text-align:center; color:#ef4444;">
                    <h3>Failed to Load Problem</h3>
                    <p>${err.message}</p>
                </div>`,
                testCases: []
            });
        } finally {
            setOpeningId(null);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#09090b", color: "#e4e4e7", fontFamily: "var(--font-main)", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
            
            {/* --- HEADER WITH PLATFORM BRANDING --- */}
            <div style={{ 
                padding: "16px", 
                borderBottom: "1px solid rgba(255,255,255,0.05)", 
                background: provider === "codeforces" 
                    ? "linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, transparent 100%)" 
                    : (provider === "cses" 
                        ? "linear-gradient(180deg, rgba(234, 88, 12, 0.08) 0%, transparent 100%)"
                        : "linear-gradient(180deg, rgba(255, 161, 22, 0.08) 0%, transparent 100%)")
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                       {/* Platform Logo */}
                       {provider === "codeforces" ? (
                           <div style={{ 
                               background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", 
                               padding: "8px", 
                               borderRadius: "10px",
                               boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
                           }}>
                               <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                   <rect x="2" y="13" width="5" height="9" rx="1" fill="#FFC107"/>
                                   <rect x="9.5" y="6" width="5" height="16" rx="1" fill="white"/>
                                   <rect x="17" y="10" width="5" height="12" rx="1" fill="#F44336"/>
                               </svg>
                           </div>
                       ) : provider === "cses" ? (
                           <div style={{ 
                               background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", 
                               padding: "8px", 
                               borderRadius: "10px",
                               boxShadow: "0 4px 12px rgba(234, 88, 12, 0.3)"
                           }}>
                               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                   <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                   <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                               </svg>
                           </div>
                       ) : (
                           <div style={{ 
                               background: "linear-gradient(135deg, #ffa116 0%, #d97706 100%)", 
                               padding: "8px", 
                               borderRadius: "10px",
                               boxShadow: "0 4px 12px rgba(255, 161, 22, 0.3)"
                           }}>
                               <Zap size={18} color="white" fill="white" />
                           </div>
                       )}
                       
                       <div>
                           <h2 style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "0.3px", margin: 0 }}>
                               {provider === "codeforces" ? "Codeforces" : (provider === "cses" ? "CSES Problem Set" : "LeetCode")}
                           </h2>
                           <span style={{ fontSize: "10px", color: "#71717a" }}>
                               {provider === "codeforces" ? "Competitive Programming" : (provider === "cses" ? "Algorithm Collection" : "Interview Prep")}
                           </span>
                       </div>
                    </div>
                    
                    {provider === "codeforces" && (
                        <span style={{ 
                            fontSize: "11px", 
                            padding: "4px 10px", 
                            background: "rgba(59, 130, 246, 0.15)", 
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                            borderRadius: "20px", 
                            color: "#60a5fa",
                            fontWeight: "600"
                        }}>
                            {filteredProblems.length.toLocaleString()} problems
                        </span>
                    )}
                    {provider === "cses" && cfProblems.length > 0 && (
                        <span style={{ 
                            fontSize: "11px", 
                            padding: "4px 10px", 
                            background: "rgba(234, 88, 12, 0.15)", 
                            border: "1px solid rgba(234, 88, 12, 0.2)",
                            borderRadius: "20px", 
                            color: "#fb923c",
                            fontWeight: "600"
                        }}>
                            {cfProblems.reduce((acc, cat) => acc + cat.problems.length, 0)} problems
                        </span>
                    )}
                </div>

                {provider === "codeforces" ? (
                    <>
                    {/* Search & Filters */}
                    <FilterInput icon={<Search size={14}/>} value={searchQuery} onChange={setSearchQuery} placeholder="Search problems (1000+)..." />
                     {/* Rating Filters */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        <FilterInput placeholder="Min Rating" value={minRating} onChange={setMinRating} />
                        <FilterInput placeholder="Max Rating" value={maxRating} onChange={setMaxRating} />
                    </div>
                    
                    {/* Multi-Select Tag Dropdown */}
                    <div ref={tagDropdownRef} style={{ position: "relative", marginTop: "10px" }}>
                        <div 
                            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                            style={{
                                background: "#18181b",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "6px",
                                padding: "8px 12px",
                                fontSize: "11px",
                                color: tagFilter.length > 0 ? "#e4e4e7" : "#71717a",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Filter size={12} color="#71717a" />
                                <span>{tagFilter.length > 0 ? `${tagFilter.length} tag${tagFilter.length > 1 ? 's' : ''} selected` : "Filter by tags..."}</span>
                            </div>
                            <ChevronDown size={14} color="#71717a" style={{ transform: tagDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                        </div>
                        
                        {/* Dropdown Menu */}
                        {tagDropdownOpen && (
                            <div style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                right: 0,
                                maxHeight: "200px",
                                overflowY: "auto",
                                background: "#18181b",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "6px",
                                marginTop: "4px",
                                zIndex: 100,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                            }}>
                                {availableTags.map(tag => {
                                    const isSelected = tagFilter.includes(tag);
                                    return (
                                        <div
                                            key={tag}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setTagFilter(tagFilter.filter(t => t !== tag));
                                                } else {
                                                    setTagFilter([...tagFilter, tag]);
                                                }
                                            }}
                                            style={{
                                                padding: "8px 12px",
                                                fontSize: "11px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                background: isSelected ? "rgba(59, 130, 246, 0.15)" : "transparent",
                                                color: isSelected ? "#60a5fa" : "#a1a1aa",
                                                borderBottom: "1px solid rgba(255,255,255,0.03)"
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.05)"}
                                            onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? "rgba(59, 130, 246, 0.15)" : "transparent"}
                                        >
                                            <div style={{
                                                width: "14px",
                                                height: "14px",
                                                borderRadius: "3px",
                                                border: isSelected ? "none" : "1px solid #444",
                                                background: isSelected ? "#3b82f6" : "transparent",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center"
                                            }}>
                                                {isSelected && <CheckCircle2 size={10} color="white" />}
                                            </div>
                                            {tag}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    
                    {/* Selected Tag Chips */}
                    {tagFilter.length > 0 && (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                            {tagFilter.map(tag => (
                                <span 
                                    key={tag}
                                    style={{
                                        fontSize: "10px",
                                        padding: "4px 8px",
                                        borderRadius: "12px",
                                        background: "rgba(59, 130, 246, 0.15)",
                                        border: "1px solid rgba(59, 130, 246, 0.3)",
                                        color: "#60a5fa",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px"
                                    }}
                                >
                                    {tag}
                                    <X 
                                        size={10} 
                                        style={{ cursor: "pointer" }}
                                        onClick={() => setTagFilter(tagFilter.filter(t => t !== tag))}
                                    />
                                </span>
                            ))}
                            <button
                                onClick={() => setTagFilter([])}
                                style={{
                                    fontSize: "10px",
                                    padding: "4px 8px",
                                    borderRadius: "12px",
                                    background: "rgba(239, 68, 68, 0.1)",
                                    border: "1px solid rgba(239, 68, 68, 0.2)",
                                    color: "#ef4444",
                                    cursor: "pointer"
                                }}
                            >
                                Clear All
                            </button>
                        </div>
                    )}
                    </>
                ) : provider === "leetcode" ? (
                    <>
                    {/* LeetCode Search & Filters */}
                    <FilterInput icon={<Search size={14}/>} value={searchQuery} onChange={setSearchQuery} placeholder="Search LeetCode problems..." />
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        {/* Difficulty Dropdown */}
                        <select 
                            value={lcDifficulty} 
                            onChange={(e) => setLcDifficulty(e.target.value)}
                            style={{
                                flex: 1,
                                background: "#18181b",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "6px",
                                padding: "6px 10px",
                                fontSize: "11px",
                                color: lcDifficulty ? getDifficultyColor(lcDifficulty) : "#a1a1aa",
                                outline: "none",
                                cursor: "pointer"
                            }}
                        >
                            <option value="">All Difficulties</option>
                            <option value="Easy" style={{ color: "#4ade80" }}>Easy</option>
                            <option value="Medium" style={{ color: "#fbbf24" }}>Medium</option>
                            <option value="Hard" style={{ color: "#ef4444" }}>Hard</option>
                        </select>
                        
                        {/* Tag Dropdown */}
                        <select 
                            value={lcSelectedTag} 
                            onChange={(e) => setLcSelectedTag(e.target.value)}
                            style={{
                                flex: 1,
                                background: "#18181b",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "6px",
                                padding: "6px 10px",
                                fontSize: "11px",
                                color: lcSelectedTag ? "#ffa116" : "#a1a1aa",
                                outline: "none",
                                cursor: "pointer"
                            }}
                        >
                            <option value="">All Topics</option>
                            {lcTags.slice(0, 30).map(tag => (
                                <option key={tag.slug || tag.name} value={tag.slug || tag.name}>{tag.name}</option>
                            ))}
                        </select>
                    </div>
                    </>
                ) : null}
                
                {/* LeetCode Problem Count */}
                {provider === "leetcode" && lcTotal > 0 && (
                    <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ 
                            fontSize: "11px", 
                            padding: "4px 10px", 
                            background: "rgba(255, 161, 22, 0.15)", 
                            border: "1px solid rgba(255, 161, 22, 0.2)",
                            borderRadius: "20px", 
                            color: "#ffa116",
                            fontWeight: "600"
                        }}>
                            {filteredProblems.length} / {lcTotal.toLocaleString()} problems
                        </span>
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
                                            {p.tags.slice(0, 3).map((t, idx) => <TagChip key={`${t}-${idx}`} label={t}/>)}
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

            {/* --- MAIN CONTENT (LEETCODE INFINITE SCROLL) --- */}
            {provider === "leetcode" && (
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}
            >
                {cfLoading ? (
                    <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#6b7280", fontSize: "12px" }}>
                        <Loader2 className="animate-spin" size={16}/> Loading LeetCode Problems...
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
                            <div style={{ width: "50px" }}>ID</div>
                            <div style={{ flex: 1 }}>Problem</div>
                            <div style={{ width: "70px", textAlign: "center" }}>Difficulty</div>
                            <div style={{ width: "50px", textAlign: "right" }}>Rate</div>
                        </div>

                        {/* Rows */}
                        {visibleProblems.map((p) => {
                            const diffColor = getDifficultyColor(p.difficulty);
                            const isPremium = p.isPremium;
                            
                            return (
                                <div 
                                    key={p.id || p.titleSlug}
                                    onClick={() => !isPremium && handleOpen(p)}
                                    style={{ 
                                        display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)", 
                                        cursor: isPremium ? "not-allowed" : "pointer", position: "relative",
                                        transition: "background 0.2s",
                                        background: isPremium ? "rgba(255,161,22,0.02)" : "transparent",
                                        opacity: isPremium ? 0.6 : 1
                                    }}
                                    onMouseEnter={(e) => { if (!isPremium) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                    onMouseLeave={(e) => { if (!isPremium) e.currentTarget.style.background = "transparent"; }}
                                >
                                    <div style={{ width: "50px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "#71717a" }}>
                                        <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
                                            {openingId === (p.id || p.titleSlug) ? <Loader2 className="animate-spin" size={10} /> : null}
                                            {p.id}
                                        </div>
                                    </div>
                                    
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                            {isPremium && <Lock size={12} color="#ffa116" />}
                                            <span style={{ fontSize: "13px", fontWeight: "500", color: "#e4e4e7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
                                        </div>
                                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                            {p.tags?.slice(0, 2).map((t, idx) => <TagChip key={`${t}-${idx}`} label={t}/>)}
                                        </div>
                                    </div>

                                    <div style={{ width: "70px", textAlign: "center" }}>
                                        <span style={{ 
                                            fontSize: "10px", fontWeight: "600", color: diffColor,
                                            padding: "2px 8px", borderRadius: "10px",
                                            background: diffColor === "#4ade80" ? "rgba(74, 222, 128, 0.1)" : 
                                                       (diffColor === "#fbbf24" ? "rgba(251, 191, 36, 0.1)" : "rgba(239, 68, 68, 0.1)")
                                        }}>
                                            {p.difficulty}
                                        </span>
                                    </div>

                                    <div style={{ width: "50px", textAlign: "right" }}>
                                        <span style={{ fontSize: "11px", color: "#71717a" }}>{p.acceptanceRate}%</span>
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
