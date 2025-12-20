import React, { useState } from "react";
import { Search, Trophy, Loader2, Import, ExternalLink, Code } from "lucide-react";
import { API_URL } from "../config";

export default function ProblemBrowser({ onClose, onImportTests, onOpenProblem }) {
    const [platform, setPlatform] = useState("leetcode"); // leetcode | codeforces
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [problem, setProblem] = useState(null);
    const [error, setError] = useState("");

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError("");
        setProblem(null);

        try {
            let url = "";
            if (platform === "leetcode") {
                // assume query is slug
                // Removing url parts if user pasted full url
                const slug = query.replace("https://leetcode.com/problems/", "").replace(/\/$/, "");
                url = `${API_URL}/api/problems/leetcode/${slug}`;
            } else {
                // Codeforces: assume "1000/A" or "1000A" format or URL
                // Parse contestId and Index
                let contestId, index;
                // Regex for 1234A or 1234/A
                const match = query.match(/(\d+)\/?([A-Z0-9]+)/i);
                if (match) {
                    contestId = match[1];
                    index = match[2];
                    url = `${API_URL}/api/problems/codeforces/${contestId}/${index}`;
                } else {
                    throw new Error("Invalid Codeforces format. Use '1234A' or '1234/A'");
                }
            }

            const res = await fetch(url);
            const data = await res.json();

            if (data.error) throw new Error(data.error);
            setProblem(data);
            if (onOpenProblem) onOpenProblem(data); // <--- Trigger Main Tab Open

        } catch (err) {
            setError(err.message || "Failed to fetch problem");
        } finally {
            setLoading(false);
        }
    };

    const handleImport = () => {
        if (!problem) return;
        
        // Convert problem data to test cases
        let newTestCases = [];

        if (platform === "codeforces" && problem.testCases) {
            newTestCases = problem.testCases.map(tc => ({
                id: Date.now() + Math.random(),
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                status: "idle",
                actualOutput: "",
                expanded: true
            }));
        } else if (platform === "leetcode" && problem.examples) {
             // Basic parsing for raw example string if needed, 
             // but ideally we rely on what the user wants to copy/paste if parsing fails.
             // For now, if we have raw string, we might just put it in input and let user edit?
             // Or if we have structured data. For this MVP, we might import the description to the "AI" or just show it.
             // Wait, LeetCode "exampleTestcases" is usually just INPUTS.
             
             // If we have just inputs, we can add them as test cases with empty expected output
             const inputs = problem.examples.split("\n").filter(l => l.trim());
             newTestCases = inputs.map(inp => ({
                id: Date.now() + Math.random(),
                input: inp,
                expectedOutput: "", // Unknown validation
                status: "idle",
                actualOutput: "",
                expanded: true
             }));
        }

        if (newTestCases.length > 0) {
            onImportTests(newTestCases);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0f0f0f", borderLeft: "1px solid #222", fontFamily: "'Inter', sans-serif" }}>
            
            {/* HEADER */}
            <div style={{ 
                height: "48px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", padding: "0 16px", gap: "10px",
                background: "rgba(20,20,20,0.8)", backdropFilter: "blur(10px)" 
            }}>
                <Trophy size={16} color="#fbbf24" />
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#eee" }}>Problem Browser</span>
            </div>

            {/* SEARCH BAR */}
            <div style={{ padding: "16px", borderBottom: "1px solid #222" }}>
                
                {/* PLATFORM TOGGLER */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <button 
                        onClick={() => setPlatform("leetcode")}
                        style={{ 
                            flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid", 
                            borderColor: platform === "leetcode" ? "#ca8a04" : "#333",
                            background: platform === "leetcode" ? "rgba(202, 138, 4, 0.1)" : "#1a1a1a",
                            color: platform === "leetcode" ? "#facc15" : "#666",
                            cursor: "pointer", fontSize: "12px", fontWeight: "600", transition: "all 0.2s"
                        }}
                    >
                        LeetCode
                    </button>
                    <button 
                         onClick={() => setPlatform("codeforces")}
                         style={{ 
                            flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid", 
                            borderColor: platform === "codeforces" ? "#dc2626" : "#333",
                            background: platform === "codeforces" ? "rgba(220, 38, 38, 0.1)" : "#1a1a1a",
                            color: platform === "codeforces" ? "#f87171" : "#666",
                            cursor: "pointer", fontSize: "12px", fontWeight: "600", transition: "all 0.2s"
                        }}
                    >
                        Codeforces
                    </button>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <input 
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={platform === "leetcode" ? "two-sum" : "1352A"}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        style={{ 
                            flex: 1, background: "#0a0a0a", border: "1px solid #333", borderRadius: "6px", padding: "8px 12px",
                            color: "white", fontSize: "12px", outline: "none"
                        }}
                    />
                    <button 
                        onClick={handleSearch}
                        disabled={loading}
                        style={{ 
                            background: "#222", border: "1px solid #333", borderRadius: "6px", padding: "0 10px",
                            cursor: loading ? "not-allowed" : "pointer", color: "#eee"
                        }}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
                    </button>
                </div>
                {error && <div style={{ marginTop: "8px", fontSize: "11px", color: "#ef5350" }}>{error}</div>}
            </div>

            {/* CONTENT */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                {problem ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#eee" }}>{problem.title}</h3>
                            <a href={problem.url || `https://leetcode.com/problems/${query}`} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: "#60a5fa", display: "flex", alignItems: "center", gap: "4px" }}>
                                View Original <ExternalLink size={10}/>
                            </a>
                        </div>

                        {/* DESCRIPTION SNEAK PEEK (HTML) */}
                        <div 
                            className="problem-content"
                            style={{ 
                                fontSize: "12px", color: "#ccc", lineHeight: "1.5", 
                                background: "#161616", padding: "12px", borderRadius: "8px",
                                maxHeight: "300px", overflowY: "auto"
                            }}
                            dangerouslySetInnerHTML={{ __html: problem.description || "No description available." }}
                        />

                        {/* IMPORT ACTION */}
                        <button 
                            onClick={handleImport}
                            style={{ 
                                width: "100%", padding: "12px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", 
                                border: "none", borderRadius: "6px", color: "white", fontSize: "12px", fontWeight: "600",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)"
                            }}
                        >
                            <Import size={16}/> Import Test Cases
                        </button>
                    </div>
                ) : (
                    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#444", gap: "12px" }}>
                        <Trophy size={48} strokeWidth={1}/>
                        <div style={{ fontSize: "13px" }}>Search for a problem to start</div>
                    </div>
                )}
            </div>
        </div>
    );
}
