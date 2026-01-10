import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import { User, Edit, Save, Code, CheckCircle, XCircle, Clock, Globe, Github, Lock, Eye, X, Copy } from "lucide-react";

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    // New State for Code Viewer
    const [viewSubmission, setViewSubmission] = useState(null);

    // Form State
    const [editBio, setEditBio] = useState("");
    const [editCF, setEditCF] = useState("");
    const [editLC, setEditLC] = useState("");
    const [editGH, setEditGH] = useState("");

    // Stats State
    const [cfStats, setCfStats] = useState(null);
    const [cfHistory, setCfHistory] = useState([]);
    const [cfSubmissions, setCfSubmissions] = useState([]); 
    const [lcStats, setLcStats] = useState(null);
    
    // CodeChef State
    const [editCC, setEditCC] = useState("");
    const [ccHistory, setCcHistory] = useState([]);
    const [graphSource, setGraphSource] = useState("codeforces"); // 'codeforces' | 'codechef'

    useEffect(() => {
        if (user) fetchProfile();
    }, [user]);

    const fetchProfile = async () => {
        if (!user) return;
        try {
            const token = localStorage.getItem("codeplay_token");
            const res = await fetch(`${API_URL}/api/profile/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setProfile(data);
            setEditBio(data.bio || "");
            setEditCF(data.platforms?.codeforces || "");
            setEditLC(data.platforms?.leetcode || "");
            setEditCC(data.platforms?.codechef || ""); // Load CC
            setEditGH(data.platforms?.github || "");
            
            // Collect all promises
            const promises = [];

            // 1. Fetch Submissions (Local)
            promises.push(
                fetch(`${API_URL}/api/submissions/my`, { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(s => setSubmissions(s))
                .catch(e => console.error("Submissions Fetch Error:", e))
            );
            
            // 2. CF Stats (Direct)
            if (data.platforms?.codeforces) {
                promises.push(
                    fetch(`https://codeforces.com/api/user.info?handles=${data.platforms.codeforces}`)
                    .then(r => r.json())
                    .then(d => { if (d.status === "OK") setCfStats(d.result[0]); })
                    .catch(e => console.error("CF Info Error:", e))
                );
                
                promises.push(
                     fetch(`https://codeforces.com/api/user.rating?handle=${data.platforms.codeforces}`)
                    .then(r => r.json())
                    .then(d => { if(d.status === "OK") setCfHistory(d.result); })
                    .catch(e => console.error("CF Rating Error:", e))
                );

                promises.push(
                    fetch(`https://codeforces.com/api/user.status?handle=${data.platforms.codeforces}`)
                   .then(r => r.json())
                   .then(d => { if(d.status === "OK") setCfSubmissions(d.result); })
                   .catch(e => console.error("CF Status Error:", e))
               );
            }
            
            // 3. NEW: Fetch LeetCode
            if (data.platforms?.leetcode) {
                promises.push(
                    fetch(`https://leetcode-stats-api.herokuapp.com/${data.platforms.leetcode}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.status === "success") setLcStats(d);
                    })
                    .catch(e => console.error("LC Fetch Error:", e))
                );
            }
            
            // 4. NEW: Fetch CodeChef (via Backend Proxy)
            if (data.platforms?.codechef) {
                 promises.push(
                    fetch(`${API_URL}/api/proxy/codechef/${data.platforms.codechef}`)
                    .then(r => r.json())
                    .then(d => {
                        if(d.ratingData && Array.isArray(d.ratingData)) {
                             // Transform CC data format to match CF or standard format
                             const history = d.ratingData.map(item => ({
                                 newRating: parseInt(item.rating),
                                 oldRating: -1, // Not always available, simplified
                                 contestName: item.name,
                                 ratingUpdateTimeSeconds: new Date(item.end_date).getTime() / 1000
                             }));
                             setCcHistory(history.sort((a,b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds));
                        }
                    })
                    .catch(e => console.error("CC Fetch Error:", e))
                );
            }

            // Wait for all
            await Promise.allSettled(promises);


        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem("codeplay_token");
            const res = await fetch(`${API_URL}/api/profile`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({
                    bio: editBio,
                    platforms: { // Changed structure to nest platforms
                        codeforces: editCF,
                        leetcode: editLC,
                        codechef: editCC, // Save CC
                        github: editGH
                    }
                })
            });
            const data = await res.json();
            
            if (!res.ok) {
                if (res.status === 401) {
                    alert("Session expired. Please log in again.");
                    logout();
                    return;
                }
                throw new Error(data.msg || data.error || "Server Error");
            }

            setIsEditing(false);
            fetchProfile(); // Refresh to get new stats
        } catch (e) { 
            console.error(e);
            alert("Failed to save: " + e.message); 
        }
    };

    // --- NEW: View Code Handler ---
    const handleViewCode = async (subId) => {
        try {
            const token = localStorage.getItem("codeplay_token"); // Auth might be needed depending on API
            const res = await fetch(`${API_URL}/api/submissions/${subId}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch code");
            const data = await res.json();
            setViewSubmission(data);
        } catch (e) {
            alert("Error loading code: " + e.message);
        }
    };

    // --- HELPERS FOR STATS ---
    const localDays = submissions.map(s => new Date(s.createdAt).toISOString().split('T')[0]);
    const cfDays = cfSubmissions.map(s => new Date(s.creationTimeSeconds * 1000).toISOString().split('T')[0]);
    const uniqueDays = new Set([...localDays, ...cfDays]);
    const activeDays = uniqueDays.size;

    const localSolved = submissions.filter(s => ['Accepted', 'OK', 'ACCEPTED'].includes(s.verdict)).length;
    
    // Codeforces specific
    const totalActivity = submissions.length + (cfStats?.contribution || 0) + (lcStats?.totalSolved || 0); // Updated
    const totalSolvedAll = localSolved + (lcStats?.totalSolved || 0); // NEW: Aggregated solved count

    if (loading) return <div style={{padding:"40px", textAlign:"center", color:"#666", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center"}}>Loading Profile...</div>;
    if (!profile) return <div style={{padding:"40px", textAlign:"center"}}>Please Log In</div>;

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#09090b", color: "#f4f4f5", fontFamily: "'Inter', sans-serif" }}>
            
            {/* VIEW CODE MODAL */}
            {viewSubmission && (
                <div style={{ 
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
                    background: "rgba(0,0,0,0.8)", zIndex: 100, 
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backdropFilter: "blur(4px)"
                }}>
                    <div className="glass-panel" style={{ 
                        width: "800px", maxWidth: "90%", maxHeight: "85vh", 
                        background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", 
                        borderRadius: "16px", display: "flex", flexDirection: "column", overflow: "hidden" 
                    }}>
                        <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#09090b" }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "16px", color: "#fff" }}>{viewSubmission.problemName}</h3>
                                <div style={{ fontSize: "12px", color: viewSubmission.verdict === "Accepted" ? "#4ade80" : "#ef4444", marginTop: "4px" }}>
                                    {viewSubmission.verdict} • {viewSubmission.language}
                                </div>
                            </div>
                            <button onClick={() => setViewSubmission(null)} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", padding: "4px" }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflow: "auto", padding: "0", background: "#0d0d10" }}>
                            <pre style={{ margin: 0, padding: "24px", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: "#e4e4e7", lineHeight: "1.5" }}>
                                {viewSubmission.code}
                            </pre>
                        </div>
                        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "flex-end", background: "#09090b" }}>
                             <button 
                                onClick={() => { navigator.clipboard.writeText(viewSubmission.code); alert("Code copied!"); }}
                                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontSize: "13px" }}
                             >
                                <Copy size={14} /> Copy Code
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- LEFT SIDEBAR --- */}
            <div className="glass-panel" style={{ width: "320px", padding: "32px", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto", position: "fixed", left: 0, top: 0, borderRadius: 0, boxSizing: "border-box", zIndex: 10 }}>
                {/* Profile Header */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
                    <div style={{ width: "120px", height: "120px", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px", fontWeight:"bold", color: "white", marginBottom: "16px", boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" }}>
                         {profile.username ? profile.username[0].toUpperCase() : "?"}
                    </div>
                    <h1 style={{ margin: "0 0 4px 0", fontSize: "24px", color: "#fff" }}>{profile.username}</h1>
                    <div style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "24px" }}>@{profile.username}</div>
                    
                    <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                        <div style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", textAlign: "center" }}>
                            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff" }}>{cfStats?.rating || "-"}</div>
                            <div style={{ fontSize: "12px", color: "#71717a" }}>CF Rating</div> {/* Changed label */}
                        </div>
                        <div style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", textAlign: "center" }}>
                            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff" }}>{lcStats?.ranking || "-"}</div> {/* Changed to LC Rank */}
                            <div style={{ fontSize: "12px", color: "#71717a" }}>LC Rank</div> {/* Changed label */}
                        </div>
                    </div>
                </div>

                {/* About Section */}
                <div style={{ marginBottom: "32px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>About</h3>
                     {isEditing ? (
                        <textarea value={editBio} onChange={e => setEditBio(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", background: "rgba(0,0,0,0.3)", color: "white" }} />
                    ) : (
                        <p style={{ color: "#d4d4d8", fontSize: "14px", lineHeight: "1.6" }}>{profile.bio || "No bio added yet."}</p>
                    )}
                    <button onClick={() => isEditing ? handleSave() : setIsEditing(true)} style={{ marginTop: "12px", border: "none", background: "none", color: "#60a5fa", fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: 0, display: "flex", gap: "6px", alignItems: "center" }}>
                        {isEditing ? <Save size={14}/> : <Edit size={14}/>} {isEditing ? "Save Changes" : "Edit Profile"}
                    </button>
                </div>

                {/* Handles */}
                <div style={{ marginBottom: "32px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>Linked Accounts</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {isEditing ? (
                            <>
                                <input placeholder="Codeforces" value={editCF} onChange={e=>setEditCF(e.target.value)} style={inputStyle}/>
                                <input placeholder="LeetCode" value={editLC} onChange={e=>setEditLC(e.target.value)} style={inputStyle}/>
                                <input placeholder="CodeChef" value={editCC} onChange={e=>setEditCC(e.target.value)} style={inputStyle}/>
                                <input placeholder="GitHub" value={editGH} onChange={e=>setEditGH(e.target.value)} style={inputStyle}/>
                            </>
                        ) : (
                            <>
                                <PlatformRow icon={<Code size={16}/>} name="Codeforces" handle={profile.platforms?.codeforces} color="#3b82f6" />
                                <PlatformRow icon={<Globe size={16}/>} name="LeetCode" handle={profile.platforms?.leetcode} color="#fbbf24" />
                                <PlatformRow icon={<Globe size={16}/>} name="CodeChef" handle={profile.platforms?.codechef} color="#8b5cf6" />
                                <PlatformRow icon={<Github size={16}/>} name="GitHub" handle={profile.platforms?.github} color="#e4e4e7" />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div style={{ marginLeft: "320px", padding: "40px", flex: 1, height: "100vh", overflowY: "auto", boxSizing: "border-box" }}>
                
                {/* TOP STATS CARDS */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
                    <Card>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8" }}>TOTAL ACTIVITY</div>
                            <Code size={20} color="#3b82f6" style={{ opacity: 0.8 }} />
                        </div>
                        <div style={{ fontSize: "42px", fontWeight: "800", color: "#fff" }}>
                            {totalActivity}
                        </div>
                    </Card>
                    <Card>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8" }}>ACTIVE DAYS</div>
                            <Clock size={20} color="#22c55e" style={{ opacity: 0.8 }} />
                        </div>
                        <div style={{ fontSize: "42px", fontWeight: "800", color: "#fff" }}>
                            {activeDays}
                        </div>
                    </Card>
                </div>

                {/* HEATMAP CARD */}
                <Card style={{ marginBottom: "24px", padding: "24px" }}>
                    <Heatmap cfSubmissions={cfSubmissions} />
                </Card>

                {/* MIDDLE ROW */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
                     {/* CONTESTS */}
                    <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                         <div style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", marginBottom: "16px" }}>CONTEST PARTICIPATION</div>
                         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                             <div style={{ fontSize: "56px", fontWeight: "800", color: "#fff" }}>{cfHistory.length}</div>
                             <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "140px" }}>
                                <ContestRow label="Codeforces" count={cfHistory.length} color="#3b82f6" />
                                <ContestRow label="CodeChef" count={ccHistory.length} color="#8b5cf6" />
                                <ContestRow label="LeetCode" count={lcStats ? "N/A" : "-"} color="#fbbf24" /> {/* Updated LeetCode count */}
                             </div>
                        </div>
                    </Card>

                    {/* PROBLEMS SOLVED */}
                    <Card>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", textAlign: "center", marginBottom: "24px" }}>PROBLEMS SOLVED</div>
                        <div style={{ display: "flex", justifyContent: "space-around" }}>
                             <DonutChart value={lcStats?.totalSolved || 0} total={lcStats?.totalQuestions || 3000} label="LeetCode" color="#fbbf24" /> {/* New LeetCode Donut */}
                             <DonutChart value={localSolved} total={localSolved + 50} label="CodePlay" color="#22c55e" /> {/* Updated label and total */}
                             <DonutChart value={cfStats?.rating || 0} total={3500} label="CF (Rating)" color="#3b82f6" /> {/* Updated label and total */}
                        </div>
                    </Card>
                </div>

                {/* RATING GRAPH */}
                <Card>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8" }}>RATING HISTORY</div>
                        </div>
                        
                        {/* Platform Select Dropdown */}
                        <select 
                            value={graphSource} 
                            onChange={(e) => setGraphSource(e.target.value)}
                            style={{ background: "#27272a", color: "#e4e4e7", border: "1px solid #3f3f46", fontSize: "12px", padding: "4px 8px", borderRadius: "6px", outline: "none", cursor: "pointer" }}
                        >
                            <option value="codeforces">Codeforces</option>
                            <option value="codechef">CodeChef</option>
                        </select>
                    </div>
                    
                    <div style={{ height: "200px", width: "100%", position: "relative" }}>
                        {(graphSource === 'codeforces' ? cfHistory : ccHistory).length > 0 ? (
                            <RatingGraph data={graphSource === 'codeforces' ? cfHistory : ccHistory} color={graphSource === 'codeforces' ? "#eab308" : "#8b5cf6"} />
                        ) : (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#52525b" }}>No Contest History</div>
                        )}
                    </div>
                </Card>


                {/* SUBMISSION HISTORY */}
                <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#e4e4e7", marginBottom: "20px", marginTop: "32px" }}>Recent Submissions</h2>
                <div className="glass-panel" style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                        <thead>
                            <tr style={{ background: "rgba(255,255,255,0.03)", textAlign: "left" }}>
                                <th style={{ padding: "16px", color: "#a1a1aa", fontWeight: "600" }}>Problem</th>
                                <th style={{ padding: "16px", color: "#a1a1aa", fontWeight: "600" }}>Platform</th>
                                <th style={{ padding: "16px", color: "#a1a1aa", fontWeight: "600" }}>Verdict</th>
                                <th style={{ padding: "16px", color: "#a1a1aa", fontWeight: "600" }}>Language</th>
                                <th style={{ padding: "16px", color: "#a1a1aa", fontWeight: "600" }}>Time</th>
                                <th style={{ padding: "16px", color: "#a1a1aa", fontWeight: "600", textAlign: "right" }}>View Code</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.length === 0 ? (
                                <tr><td colSpan="6" style={{padding:"32px", textAlign:"center", color:"#71717a"}}>No submissions recorded yet.</td></tr>
                            ) : submissions.map(sub => (
                                <tr key={sub._id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                    <td style={{ padding: "16px", fontWeight: "500", color: "#e4e4e7" }}>{sub.problemName} <span style={{color:"#71717a", fontSize:"12px"}}>({sub.problemId})</span></td>
                                    <td style={{ padding: "16px" }}>
                                        <span style={{ 
                                            padding: "4px 8px", borderRadius: "12px", fontSize: "10px", textTransform: "uppercase", 
                                            background: sub.platform === "codeforces" ? "rgba(59, 130, 246, 0.1)" : "rgba(234, 179, 8, 0.1)",
                                            color: sub.platform === "codeforces" ? "#60a5fa" : "#facc15" 
                                        }}>
                                            {sub.platform}
                                        </span>
                                    </td>
                                    <td style={{ padding: "16px" }}>
                                        <span style={{ color: (sub.verdict === "Accepted" || sub.verdict === "OK" || sub.verdict === "ACCEPTED") ? "#4ade80" : "#ef4444", fontWeight: "600" }}>
                                            {sub.verdict}
                                        </span>
                                    </td>
                                    <td style={{ padding: "16px", color: "#a1a1aa", fontFamily: "monospace" }}>{sub.language}</td>
                                    <td style={{ padding: "16px", color: "#71717a", fontSize: "12px" }}>{new Date(sub.createdAt).toLocaleString()}</td>
                                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                                        <button 
                                            onClick={() => handleViewCode(sub._id)}
                                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#a1a1aa", transition: "all 0.2s" }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#a1a1aa"; }}
                                            title="View Code"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}

// --- SUB COMPONENTS ---

const Card = ({ children, style }) => (
    <div className="glass-panel" style={{ padding: "24px", borderRadius: "16px", ...style }}>
        {children}
    </div>
);

const PlatformRow = ({ icon, name, handle, color }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#e4e4e7", fontWeight: "500" }}>
            <span style={{color}}>{icon}</span> {name}
        </div>
        <div style={{ fontSize: "13px", color: "#a1a1aa" }}>{handle || "-"}</div>
    </div>
);

const ContestRow = ({ label, count, color }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "14px", fontWeight: "500", color: "#d4d4d8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }}></div>
            {label}
        </div>
        <div style={{ fontFamily: "monospace" }}>{count}</div>
    </div>
);

const inputStyle = { width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #333", background: "#18181b", color: "white", fontSize: "13px" };


// --- GRAPHS ---

function DonutChart({ value, total, label, color }) {
    const percentage = Math.min(100, (value / total) * 100);
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ 
                width: "100px", height: "100px", borderRadius: "50%", 
                background: `conic-gradient(${color} ${percentage}%, #27272a 0)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}>
                <div style={{ width: "84px", height: "84px", background: "#131315", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "20px", color: "#fff" }}>
                    {value}
                </div>
            </div>
            <div style={{ marginTop: "12px", fontWeight: "600", color: "#a1a1aa" }}>{label}</div>
        </div>
    );
}

function RatingGraph({ data }) {
    const [hoveredData, setHoveredData] = useState(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

    if(!data || data.length === 0) return null;
    
    // Normalize data
    const ratings = data.map(d => d.newRating);
    const min = Math.min(...ratings) - 50;
    const max = Math.max(...ratings) + 50;
    const range = max - min;
    
    const points = ratings.map((r, i) => {
        const x = (i / (ratings.length - 1)) * 100;
        const y = 100 - ((r - min) / range) * 100;
        return `${x},${y}`;
    }).join(" ");

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {hoveredData && (
                <div style={{
                    position: "absolute",
                    left: `${hoverPos.x}%`,
                    bottom: `${100 - hoverPos.y + 10}%`,
                    transform: "translateX(-50%)",
                    background: "rgba(24, 24, 27, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    padding: "12px",
                    zIndex: 20,
                    minWidth: "200px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
                    pointerEvents: "none",
                    backdropFilter: "blur(4px)"
                }}>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginBottom: "4px" }}>
                        {hoveredData.newRating}
                        <span style={{ fontSize: "11px", color: hoveredData.newRating >= hoveredData.oldRating ? "#4ade80" : "#ef4444", marginLeft: "6px" }}>
                             ({hoveredData.newRating >= hoveredData.oldRating ? "+" : ""}{hoveredData.newRating - hoveredData.oldRating})
                        </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>{hoveredData.contestName}</div>
                    <div style={{ fontSize: "11px", color: "#71717a" }}>{new Date(hoveredData.ratingUpdateTimeSeconds * 1000).toLocaleDateString()}</div>
                </div>
            )}
            
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible", position: "absolute", top: 0, left: 0, zIndex: 1 }}>
                 {/* Gradient Fill */}
                 <defs>
                    <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#eab308" stopOpacity="0.4"/>
                        <stop offset="100%" stopColor="#eab308" stopOpacity="0"/>
                    </linearGradient>
                </defs>
                <path d={`M0,100 L0,${100 - ((ratings[0]-min)/range)*100} ${points.replace(/,/g, ' ')} L100,${100 - ((ratings[ratings.length-1]-min)/range)*100} L100,100 Z`} fill="url(#lineGrad)" />
                <polyline fill="none" stroke="#eab308" strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {/* HTML Dots to avoid SVG distortion */}
            {ratings.map((r, i) => {
                const x = (i / (ratings.length - 1)) * 100;
                const y = 100 - ((r - min) / range) * 100;
                return (
                    <div 
                        key={i}
                        onMouseEnter={() => {
                            setHoveredData(data[i]);
                            setHoverPos({ x: x, y: y });
                        }}
                        onMouseLeave={() => setHoveredData(null)}
                        style={{
                            position: "absolute",
                            left: `${x}%`,
                            top: `${y}%`,
                            width: "6px", 
                            height: "6px",
                            borderRadius: "50%",
                            background: "#eab308",
                            transform: "translate(-50%, -50%)",
                            cursor: "pointer",
                            zIndex: 10,
                            boxShadow: "0 0 0 2px #09090b" // border effect
                        }}
                    />
                );
            })}
        </div>
    );
}

// Reuse Heatmap (Updated for DARK theme)
function Heatmap({ cfSubmissions }) {
    const [stats, setStats] = useState({ total: 0, days: [], maxStreak: 0, currentStreak: 0 }); 

    useEffect(() => {
         if(!cfSubmissions || cfSubmissions.length === 0) return;
         
         const submissions = cfSubmissions.filter(s => s.verdict === "OK");
         const map = new Map();
         submissions.forEach(sub => {
            const date = new Date(sub.creationTimeSeconds * 1000).toISOString().split('T')[0];
            map.set(date, (map.get(date) || 0) + 1);
         });
         
         // Grid Generation
         const today = new Date();
         const startDate = new Date(); startDate.setDate(today.getDate() - 364);
         const startDay = startDate.getDay();
         startDate.setDate(startDate.getDate() - startDay); // Align to Sunday start
         
         const gridDays = [];
         for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            gridDays.push({ 
                date: dateStr, 
                count: map.get(dateStr) || 0,
                month: d.toLocaleString('default', { month: 'short' }),
                day: d.getDay()
            });
         }
         
         // CALC STREAKS
         const dates = [...map.keys()].sort();
         const validDates = dates.map(d => new Date(d).getTime());
         let max = 0; let current = 0; let streak = 0;
         if (validDates.length > 0) {
            streak = 1; max = 1;
            for(let i=1; i<validDates.length; i++) {
                const diff = (validDates[i] - validDates[i-1]) / (1000*60*60*24);
                if(diff < 1.1 && diff > 0.9) streak++;
                else if(diff > 0.1) streak = 1;
                max = Math.max(max, streak);
            }
            // Current Streak
            let curr = 0; let checkDate = new Date();
            for(let i=0; i<365; i++) {
                    if(map.get(checkDate.toISOString().split('T')[0])) curr++;
                    else if(i>0) break; // Break if missed a day (excluding today if 0) - simplisitic logic
                    checkDate.setDate(checkDate.getDate() - 1);
            }
            current = curr;
         }
         
         setStats({
             total: submissions.length,
             days: gridDays,
             maxStreak: max,
             currentStreak: current
         });

    }, [cfSubmissions]);

    
    const weeks = [];
    for(let i=0; i<stats.days.length; i+=7) weeks.push(stats.days.slice(i, i+7));
    
    // DARK THEME COLORS
    // DARK THEME COLORS (Cyber Green)
    const getColor = (c) => {
        if(c===0) return "rgba(255,255,255,0.05)";
        if(c<=1) return "rgba(34, 197, 94, 0.3)"; 
        if(c<=3) return "rgba(34, 197, 94, 0.6)";
        if(c<=5) return "rgba(34, 197, 94, 0.8)";
        return "#22c55e"; 
    };
    
    return (
        <div style={{width:"100%"}}>
             <div style={{display:"flex", justifyContent:"space-between", marginBottom:"16px", alignItems:"center"}}>
                 <div style={{fontWeight:"bold", color:"#e4e4e7"}}>Submission Heatmap</div>
                 <div style={{display:"flex", gap:"16px", fontSize:"12px", color:"#a1a1aa"}}>
                     <div style={{background:"rgba(255,255,255,0.05)", padding:"4px 8px", borderRadius:"6px"}}>Total: <b style={{color:"#fff"}}>{stats.total}</b></div>
                     <div style={{background:"rgba(255,255,255,0.05)", padding:"4px 8px", borderRadius:"6px"}}>Max Streak: <b style={{color:"#fff"}}>{stats.maxStreak}</b></div>
                     <div style={{background:"rgba(255,255,255,0.05)", padding:"4px 8px", borderRadius:"6px"}}>Current Streak: <b style={{color:"#fff"}}>{stats.currentStreak}</b></div>
                 </div>
             </div>
             <div style={{display:"flex", overflowX:"hidden", width:"100%"}}>
                 <div style={{display:"flex", gap:"3px", margin:"0 auto"}}>
                     {weeks.map((w,i)=>(
                         <div key={i} style={{display:"flex", flexDirection:"column", gap:"3px"}}>
                             {w.map(d=>(
                                 <div key={d.date} style={{width:"10px", height:"10px", borderRadius:"2px", background:getColor(d.count)}} title={`${d.date}: ${d.count}`}/>
                             ))}
                         </div>
                     ))}
                 </div>
             </div>
        </div>
    );
}
