import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import { 
    User, Edit, Save, Code, CheckCircle, XCircle, Clock, Globe, Github, 
    Lock, Eye, X, Copy, Trophy, Target, Flame, Calendar, TrendingUp,
    Award, Zap, Activity, BarChart2, ChevronDown, ExternalLink, Loader2,
    Star, Medal, Hash, ArrowUp, ArrowDown, Minus
} from "lucide-react";

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewSubmission, setViewSubmission] = useState(null);

    // Form State
    const [editBio, setEditBio] = useState("");
    const [editCF, setEditCF] = useState("");
    const [editLC, setEditLC] = useState("");
    const [editCC, setEditCC] = useState("");
    const [editGH, setEditGH] = useState("");

    // Platform Stats State
    const [cfStats, setCfStats] = useState(null);
    const [cfHistory, setCfHistory] = useState([]);
    const [cfSubmissions, setCfSubmissions] = useState([]);
    const [lcStats, setLcStats] = useState(null);
    const [ccStats, setCcStats] = useState(null);
    const [ccHistory, setCcHistory] = useState([]);
    
    // Loading states for each platform
    const [loadingStates, setLoadingStates] = useState({
        cf: false, lc: false, cc: false
    });

    // Graph source
    const [graphSource, setGraphSource] = useState("codeforces");

    useEffect(() => {
        if (user) fetchProfile();
    }, [user]);

    const fetchProfile = async () => {
        if (!user) return;
        setLoading(true);
        
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
            setEditCC(data.platforms?.codechef || "");
            setEditGH(data.platforms?.github || "");

            // Fetch local submissions
            fetch(`${API_URL}/api/submissions/my`, { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(s => setSubmissions(Array.isArray(s) ? s : []))
                .catch(e => console.error("Submissions Error:", e));

            // Fetch platform stats in parallel
            if (data.platforms?.codeforces) {
                setLoadingStates(prev => ({ ...prev, cf: true }));
                fetchCodeforcesStats(data.platforms.codeforces);
            }
            
            if (data.platforms?.leetcode) {
                setLoadingStates(prev => ({ ...prev, lc: true }));
                fetchLeetCodeStats(data.platforms.leetcode);
            }
            
            if (data.platforms?.codechef) {
                setLoadingStates(prev => ({ ...prev, cc: true }));
                fetchCodeChefStats(data.platforms.codechef);
            }

        } catch (err) { 
            console.error("Profile fetch error:", err); 
        } finally { 
            setLoading(false); 
        }
    };

    const fetchCodeforcesStats = async (handle) => {
        try {
            const [infoRes, ratingRes, statusRes] = await Promise.all([
                fetch(`${API_URL}/api/proxy/codeforces/user/info/${handle}`).then(r => r.json()),
                fetch(`${API_URL}/api/proxy/codeforces/user/rating/${handle}`).then(r => r.json()),
                fetch(`${API_URL}/api/proxy/codeforces/user/status/${handle}`).then(r => r.json())
            ]);
            
            if (infoRes.status === "OK") setCfStats(infoRes.result[0]);
            if (ratingRes.status === "OK") setCfHistory(ratingRes.result || []);
            if (statusRes.status === "OK") setCfSubmissions(statusRes.result || []);
        } catch (e) {
            console.error("CF Stats Error:", e);
        } finally {
            setLoadingStates(prev => ({ ...prev, cf: false }));
        }
    };

    const fetchLeetCodeStats = async (username) => {
        try {
            const res = await fetch(`${API_URL}/api/proxy/leetcode/${username}`);
            const data = await res.json();
            if (data && !data.error) setLcStats(data);
        } catch (e) {
            console.error("LC Stats Error:", e);
        } finally {
            setLoadingStates(prev => ({ ...prev, lc: false }));
        }
    };

    const fetchCodeChefStats = async (handle) => {
        try {
            const res = await fetch(`${API_URL}/api/proxy/codechef/${handle}`);
            const data = await res.json();
            if (data) {
                setCcStats(data);
                if (data.ratingData && Array.isArray(data.ratingData)) {
                    const history = data.ratingData.map(item => ({
                        newRating: parseInt(item.rating) || 0,
                        oldRating: 0,
                        contestName: item.name || "Contest",
                        ratingUpdateTimeSeconds: new Date(item.end_date).getTime() / 1000
                    })).sort((a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds);
                    setCcHistory(history);
                }
            }
        } catch (e) {
            console.error("CC Stats Error:", e);
        } finally {
            setLoadingStates(prev => ({ ...prev, cc: false }));
        }
    };

    const handleSave = async () => {
        setSaving(true);
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
                    platforms: {
                        codeforces: editCF.trim(),
                        leetcode: editLC.trim(),
                        codechef: editCC.trim(),
                        github: editGH.trim()
                    }
                })
            });
            
            if (!res.ok) {
                if (res.status === 401) {
                    alert("Session expired. Please log in again.");
                    logout();
                    return;
                }
                throw new Error("Failed to save");
            }

            setIsEditing(false);
            fetchProfile();
        } catch (e) { 
            console.error(e);
            alert("Failed to save: " + e.message); 
        } finally {
            setSaving(false);
        }
    };

    const handleViewCode = async (subId) => {
        try {
            const token = localStorage.getItem("codeplay_token");
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

    // Computed Stats
    const computedStats = useMemo(() => {
        const cfSolved = cfSubmissions.filter(s => s.verdict === "OK").length;
        const cfUniqueSolved = new Set(
            cfSubmissions.filter(s => s.verdict === "OK").map(s => `${s.problem.contestId}${s.problem.index}`)
        ).size;
        
        const localSolved = submissions.filter(s => 
            ['Accepted', 'OK', 'ACCEPTED'].includes(s.verdict)
        ).length;

        // Calculate active days from CF submissions
        const cfDays = new Set(
            cfSubmissions.map(s => new Date(s.creationTimeSeconds * 1000).toISOString().split('T')[0])
        );
        const localDays = new Set(
            submissions.map(s => new Date(s.createdAt).toISOString().split('T')[0])
        );
        const allDays = new Set([...cfDays, ...localDays]);

        return {
            cfSolved,
            cfUniqueSolved,
            localSolved,
            lcSolved: lcStats?.totalSolved || 0,
            lcEasy: lcStats?.easySolved || 0,
            lcMedium: lcStats?.mediumSolved || 0,
            lcHard: lcStats?.hardSolved || 0,
            totalSolved: cfUniqueSolved + (lcStats?.totalSolved || 0) + localSolved,
            activeDays: allDays.size,
            cfContests: cfHistory.length,
            ccContests: ccHistory.length
        };
    }, [cfSubmissions, submissions, lcStats, cfHistory, ccHistory]);

    // Rating color helper
    const getRatingColor = (rating) => {
        if (!rating) return "#71717a";
        if (rating < 1200) return "#71717a";
        if (rating < 1400) return "#22c55e";
        if (rating < 1600) return "#06b6d4";
        if (rating < 1900) return "#3b82f6";
        if (rating < 2100) return "#a855f7";
        if (rating < 2400) return "#f59e0b";
        return "#ef4444";
    };

    const getRatingTitle = (rating) => {
        if (!rating) return "Unrated";
        if (rating < 1200) return "Newbie";
        if (rating < 1400) return "Pupil";
        if (rating < 1600) return "Specialist";
        if (rating < 1900) return "Expert";
        if (rating < 2100) return "Candidate Master";
        if (rating < 2400) return "Master";
        if (rating < 2600) return "International Master";
        if (rating < 3000) return "Grandmaster";
        return "Legendary Grandmaster";
    };

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                    <Loader2 size={40} color="#3b82f6" style={{ animation: "spin 1s linear infinite" }} />
                    <div style={{ color: "#71717a", fontSize: "14px" }}>Loading your profile...</div>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!profile) {
        return (
            <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a" }}>
                Please log in to view your profile
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "#09090b", color: "#f4f4f5", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", overflowY: "auto", height: "100vh" }}>
            
            {/* Code Viewer Modal */}
            {viewSubmission && (
                <CodeViewerModal submission={viewSubmission} onClose={() => setViewSubmission(null)} />
            )}

            {/* Hero Section with Profile */}
            <div style={{ 
                background: "linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, transparent 100%)",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                padding: "40px 0 60px"
            }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
                    <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap" }}>
                        
                        {/* Avatar */}
                        <div style={{ 
                            width: "140px", height: "140px", 
                            background: `linear-gradient(135deg, ${getRatingColor(cfStats?.rating)}, #8b5cf6)`,
                            borderRadius: "28px", 
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "56px", fontWeight: "bold", color: "white",
                            boxShadow: `0 8px 32px ${getRatingColor(cfStats?.rating)}40`,
                            flexShrink: 0
                        }}>
                            {profile.username?.[0]?.toUpperCase() || "?"}
                        </div>

                        {/* Profile Info */}
                        <div style={{ flex: 1, minWidth: "280px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px", flexWrap: "wrap" }}>
                                <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "#fff" }}>
                                    {profile.username}
                                </h1>
                                {cfStats?.rank && (
                                    <span style={{ 
                                        padding: "6px 12px", borderRadius: "20px",
                                        background: `${getRatingColor(cfStats.rating)}20`,
                                        color: getRatingColor(cfStats.rating),
                                        fontSize: "12px", fontWeight: "600", textTransform: "capitalize"
                                    }}>
                                        {cfStats.rank}
                                    </span>
                                )}
                            </div>
                            
                            <div style={{ color: "#71717a", fontSize: "14px", marginBottom: "16px" }}>
                                @{profile.username} • Joined {new Date(profile.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </div>

                            {/* Bio */}
                            {isEditing ? (
                                <textarea 
                                    value={editBio} 
                                    onChange={e => setEditBio(e.target.value)}
                                    placeholder="Write something about yourself..."
                                    style={{ 
                                        width: "100%", maxWidth: "500px", padding: "12px 16px", 
                                        borderRadius: "12px", border: "1px solid #27272a",
                                        background: "#18181b", color: "#e4e4e7", fontSize: "14px",
                                        resize: "vertical", minHeight: "80px", outline: "none"
                                    }}
                                />
                            ) : (
                                <p style={{ color: "#a1a1aa", fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px", maxWidth: "600px" }}>
                                    {profile.bio || "No bio added yet."}
                                </p>
                            )}

                            {/* Edit/Save Button */}
                            <button 
                                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                disabled={saving}
                                style={{ 
                                    display: "inline-flex", alignItems: "center", gap: "8px",
                                    padding: "10px 20px", borderRadius: "10px",
                                    background: isEditing ? "#3b82f6" : "rgba(255,255,255,0.05)",
                                    border: isEditing ? "none" : "1px solid rgba(255,255,255,0.1)",
                                    color: isEditing ? "#fff" : "#a1a1aa",
                                    fontSize: "13px", fontWeight: "600", cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : 
                                 isEditing ? <Save size={14} /> : <Edit size={14} />}
                                {saving ? "Saving..." : isEditing ? "Save Changes" : "Edit Profile"}
                            </button>
                        </div>

                        {/* Quick Stats */}
                        <div style={{ display: "flex", gap: "16px", flexShrink: 0, flexWrap: "wrap" }}>
                            <QuickStatCard 
                                value={cfStats?.rating || "-"} 
                                label="CF Rating" 
                                color={getRatingColor(cfStats?.rating)}
                                subtitle={getRatingTitle(cfStats?.rating)}
                            />
                            <QuickStatCard 
                                value={lcStats?.ranking ? `#${lcStats.ranking.toLocaleString()}` : "-"} 
                                label="LC Rank" 
                                color="#fbbf24"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
                
                {/* Platform Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "32px" }}>
                    
                    {/* Codeforces Card */}
                    <PlatformCard
                        name="Codeforces"
                        handle={profile.platforms?.codeforces}
                        icon="CF"
                        color="#3b82f6"
                        loading={loadingStates.cf}
                        isEditing={isEditing}
                        editValue={editCF}
                        onEditChange={setEditCF}
                        stats={cfStats ? [
                            { label: "Rating", value: cfStats.rating || "-", color: getRatingColor(cfStats.rating) },
                            { label: "Max Rating", value: cfStats.maxRating || "-" },
                            { label: "Contests", value: cfHistory.length },
                            { label: "Problems", value: computedStats.cfUniqueSolved }
                        ] : null}
                        link={profile.platforms?.codeforces ? `https://codeforces.com/profile/${profile.platforms.codeforces}` : null}
                    />

                    {/* LeetCode Card */}
                    <PlatformCard
                        name="LeetCode"
                        handle={profile.platforms?.leetcode}
                        icon="LC"
                        color="#fbbf24"
                        loading={loadingStates.lc}
                        isEditing={isEditing}
                        editValue={editLC}
                        onEditChange={setEditLC}
                        stats={lcStats ? [
                            { label: "Solved", value: lcStats.totalSolved || 0 },
                            { label: "Easy", value: lcStats.easySolved || 0, color: "#22c55e" },
                            { label: "Medium", value: lcStats.mediumSolved || 0, color: "#f59e0b" },
                            { label: "Hard", value: lcStats.hardSolved || 0, color: "#ef4444" }
                        ] : null}
                        link={profile.platforms?.leetcode ? `https://leetcode.com/${profile.platforms.leetcode}` : null}
                    />

                    {/* CodeChef Card */}
                    <PlatformCard
                        name="CodeChef"
                        handle={profile.platforms?.codechef}
                        icon="CC"
                        color="#a855f7"
                        loading={loadingStates.cc}
                        isEditing={isEditing}
                        editValue={editCC}
                        onEditChange={setEditCC}
                        stats={ccStats?.currentRating || ccStats?.rating ? [
                            { label: "Rating", value: ccStats.currentRating || ccStats.rating || "-" },
                            { label: "Stars", value: ccStats.stars || "-" },
                            { label: "Contests", value: ccHistory.length },
                            { label: "Global Rank", value: ccStats.globalRank || "-" }
                        ] : null}
                        apiError={!loadingStates.cc && profile.platforms?.codechef && !ccStats?.currentRating && !ccStats?.rating}
                        link={profile.platforms?.codechef ? `https://www.codechef.com/users/${profile.platforms.codechef}` : null}
                    />

                    {/* GitHub Card */}
                    <PlatformCard
                        name="GitHub"
                        handle={profile.platforms?.github}
                        icon={<Github size={20} />}
                        color="#e4e4e7"
                        isEditing={isEditing}
                        editValue={editGH}
                        onEditChange={setEditGH}
                        link={profile.platforms?.github ? `https://github.com/${profile.platforms.github}` : null}
                    />
                </div>

                {/* Stats Overview */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "32px" }}>
                    <StatCard icon={<Target size={20} />} value={computedStats.totalSolved} label="Total Problems Solved" color="#22c55e" />
                    <StatCard icon={<Trophy size={20} />} value={computedStats.cfContests + computedStats.ccContests} label="Contests Participated" color="#3b82f6" />
                    <StatCard icon={<Calendar size={20} />} value={computedStats.activeDays} label="Active Days" color="#f59e0b" />
                    <StatCard icon={<Flame size={20} />} value={submissions.length + cfSubmissions.length} label="Total Submissions" color="#ef4444" />
                </div>

                {/* Two Column Layout */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "32px" }}>
                    
                    {/* Heatmap */}
                    <div style={{ 
                        background: "#111113", borderRadius: "16px", 
                        border: "1px solid rgba(255,255,255,0.05)", padding: "24px"
                    }}>
                        <Heatmap cfSubmissions={cfSubmissions} localSubmissions={submissions} />
                    </div>

                    {/* Problems Breakdown */}
                    <div style={{ 
                        background: "#111113", borderRadius: "16px", 
                        border: "1px solid rgba(255,255,255,0.05)", padding: "24px"
                    }}>
                        <h3 style={{ margin: "0 0 24px", fontSize: "14px", fontWeight: "600", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Problems Breakdown
                        </h3>
                        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                            <DonutChart value={computedStats.lcSolved} total={3000} label="LeetCode" color="#fbbf24" />
                            <DonutChart value={computedStats.cfUniqueSolved} total={1500} label="Codeforces" color="#3b82f6" />
                            <DonutChart value={computedStats.localSolved} total={100} label="CodePlay" color="#22c55e" />
                        </div>
                        
                        {/* LeetCode Difficulty Breakdown */}
                        {lcStats && (
                            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "12px" }}>LeetCode by Difficulty</div>
                                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                    <DifficultyBar label="Easy" value={computedStats.lcEasy} total={lcStats.totalEasy || 800} color="#22c55e" />
                                    <DifficultyBar label="Medium" value={computedStats.lcMedium} total={lcStats.totalMedium || 1700} color="#f59e0b" />
                                    <DifficultyBar label="Hard" value={computedStats.lcHard} total={lcStats.totalHard || 700} color="#ef4444" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rating Graph */}
                <div style={{ 
                    background: "#111113", borderRadius: "16px", 
                    border: "1px solid rgba(255,255,255,0.05)", padding: "24px",
                    marginBottom: "32px"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
                        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Rating History
                        </h3>
                        <select 
                            value={graphSource} 
                            onChange={(e) => setGraphSource(e.target.value)}
                            style={{ 
                                background: "#1c1c1e", color: "#e4e4e7", 
                                border: "1px solid #27272a", fontSize: "13px", 
                                padding: "8px 12px", borderRadius: "8px", 
                                outline: "none", cursor: "pointer"
                            }}
                        >
                            <option value="codeforces">Codeforces</option>
                            <option value="codechef">CodeChef</option>
                        </select>
                    </div>
                    
                    <div style={{ height: "250px", width: "100%", position: "relative" }}>
                        {(graphSource === 'codeforces' ? cfHistory : ccHistory).length > 0 ? (
                            <RatingGraph 
                                data={graphSource === 'codeforces' ? cfHistory : ccHistory} 
                                color={graphSource === 'codeforces' ? "#3b82f6" : "#a855f7"} 
                            />
                        ) : (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#3f3f46", fontSize: "14px" }}>
                                {loadingStates[graphSource === 'codeforces' ? 'cf' : 'cc'] ? (
                                    <><Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: "8px" }} /> Loading...</>
                                ) : (
                                    "No contest history available"
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Submissions */}
                <div style={{ 
                    background: "#111113", borderRadius: "16px", 
                    border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden"
                }}>
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Recent Submissions
                        </h3>
                    </div>
                    
                    <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                        {submissions.length === 0 ? (
                            <div style={{ padding: "48px", textAlign: "center", color: "#3f3f46" }}>
                                No submissions recorded yet. Solve some problems to see them here!
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "600px" }}>
                                    <thead>
                                        <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                            <th style={{ padding: "12px 24px", textAlign: "left", color: "#52525b", fontWeight: "500", fontSize: "12px" }}>Problem</th>
                                            <th style={{ padding: "12px 16px", textAlign: "left", color: "#52525b", fontWeight: "500", fontSize: "12px" }}>Platform</th>
                                            <th style={{ padding: "12px 16px", textAlign: "left", color: "#52525b", fontWeight: "500", fontSize: "12px" }}>Verdict</th>
                                            <th style={{ padding: "12px 16px", textAlign: "left", color: "#52525b", fontWeight: "500", fontSize: "12px" }}>Language</th>
                                            <th style={{ padding: "12px 16px", textAlign: "left", color: "#52525b", fontWeight: "500", fontSize: "12px" }}>Time</th>
                                            <th style={{ padding: "12px 24px", textAlign: "right", color: "#52525b", fontWeight: "500", fontSize: "12px" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {submissions.slice(0, 20).map(sub => (
                                            <tr key={sub._id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                                <td style={{ padding: "16px 24px" }}>
                                                    <div style={{ fontWeight: "500", color: "#e4e4e7" }}>{sub.problemName}</div>
                                                    <div style={{ fontSize: "12px", color: "#52525b" }}>{sub.problemId}</div>
                                                </td>
                                                <td style={{ padding: "16px" }}>
                                                    <span style={{ 
                                                        padding: "4px 10px", borderRadius: "12px", fontSize: "11px", 
                                                        fontWeight: "500", textTransform: "uppercase",
                                                        background: sub.platform === "codeforces" ? "rgba(59,130,246,0.1)" : "rgba(251,191,36,0.1)",
                                                        color: sub.platform === "codeforces" ? "#60a5fa" : "#fbbf24"
                                                    }}>
                                                        {sub.platform}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "16px" }}>
                                                    <span style={{ 
                                                        display: "inline-flex", alignItems: "center", gap: "6px",
                                                        color: ['Accepted', 'OK', 'ACCEPTED'].includes(sub.verdict) ? "#22c55e" : "#ef4444",
                                                        fontWeight: "500"
                                                    }}>
                                                        {['Accepted', 'OK', 'ACCEPTED'].includes(sub.verdict) ? 
                                                            <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        {sub.verdict}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "16px", color: "#71717a", fontFamily: "monospace", fontSize: "13px" }}>
                                                    {sub.language}
                                                </td>
                                                <td style={{ padding: "16px", color: "#52525b", fontSize: "13px" }}>
                                                    {new Date(sub.createdAt).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: "16px 24px", textAlign: "right" }}>
                                                    <button 
                                                        onClick={() => handleViewCode(sub._id)}
                                                        style={{ 
                                                            background: "rgba(255,255,255,0.05)", 
                                                            border: "1px solid rgba(255,255,255,0.08)",
                                                            borderRadius: "8px", padding: "8px 12px",
                                                            color: "#a1a1aa", fontSize: "12px",
                                                            cursor: "pointer", display: "inline-flex",
                                                            alignItems: "center", gap: "6px",
                                                            transition: "all 0.2s"
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#a1a1aa"; }}
                                                    >
                                                        <Eye size={14} /> View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ================== SUB COMPONENTS ==================

const QuickStatCard = ({ value, label, color, subtitle }) => (
    <div style={{ 
        background: "#111113", borderRadius: "16px", padding: "20px 24px",
        border: "1px solid rgba(255,255,255,0.05)", minWidth: "140px", textAlign: "center"
    }}>
        <div style={{ fontSize: "28px", fontWeight: "700", color, marginBottom: "4px" }}>{value}</div>
        <div style={{ fontSize: "12px", color: "#52525b", marginBottom: subtitle ? "4px" : 0 }}>{label}</div>
        {subtitle && <div style={{ fontSize: "11px", color: "#3f3f46" }}>{subtitle}</div>}
    </div>
);

const PlatformCard = ({ name, handle, icon, color, loading, isEditing, editValue, onEditChange, stats, link, apiError }) => (
    <div style={{ 
        background: "#111113", borderRadius: "16px", padding: "20px",
        border: "1px solid rgba(255,255,255,0.05)", position: "relative",
        transition: "all 0.2s"
    }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ 
                width: "40px", height: "40px", borderRadius: "10px",
                background: `${color}15`, color: color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: "700", fontSize: "14px"
            }}>
                {typeof icon === 'string' ? icon : icon}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "600", color: "#e4e4e7", fontSize: "14px" }}>{name}</div>
                {isEditing ? (
                    <input 
                        value={editValue} 
                        onChange={e => onEditChange(e.target.value)}
                        placeholder={`Enter ${name} handle`}
                        style={{ 
                            width: "100%", padding: "6px 10px", marginTop: "4px",
                            borderRadius: "6px", border: "1px solid #27272a",
                            background: "#1c1c1e", color: "#e4e4e7", fontSize: "12px",
                            outline: "none"
                        }}
                    />
                ) : (
                    <div style={{ fontSize: "12px", color: "#52525b" }}>
                        {handle || "Not linked"}
                    </div>
                )}
            </div>
            {link && !isEditing && (
                <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "#52525b" }}>
                    <ExternalLink size={14} />
                </a>
            )}
        </div>

        {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#3f3f46", fontSize: "12px" }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading stats...
            </div>
        ) : stats ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {stats.map((stat, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "10px 12px" }}>
                        <div style={{ fontSize: "16px", fontWeight: "600", color: stat.color || "#e4e4e7" }}>{stat.value}</div>
                        <div style={{ fontSize: "10px", color: "#52525b", textTransform: "uppercase" }}>{stat.label}</div>
                    </div>
                ))}
            </div>
        ) : apiError ? (
            <div style={{ fontSize: "12px", color: "#ef4444" }}>API unavailable - visit profile directly</div>
        ) : !handle ? (
            <div style={{ fontSize: "12px", color: "#3f3f46" }}>Link your account to see stats</div>
        ) : null}
    </div>
);

const StatCard = ({ icon, value, label, color }) => (
    <div style={{ 
        background: "#111113", borderRadius: "16px", padding: "24px",
        border: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", gap: "16px"
    }}>
        <div style={{ 
            width: "48px", height: "48px", borderRadius: "12px",
            background: `${color}15`, color: color,
            display: "flex", alignItems: "center", justifyContent: "center"
        }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#fff" }}>{value}</div>
            <div style={{ fontSize: "12px", color: "#52525b" }}>{label}</div>
        </div>
    </div>
);

const DonutChart = ({ value, total, label, color }) => {
    const percentage = Math.min(100, (value / total) * 100);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ position: "relative", width: "100px", height: "100px" }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#1c1c1e" strokeWidth="8" />
                    <circle 
                        cx="50" cy="50" r={radius} fill="none" 
                        stroke={color} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        transform="rotate(-90 50 50)"
                        style={{ transition: "stroke-dashoffset 0.5s ease" }}
                    />
                </svg>
                <div style={{ 
                    position: "absolute", top: "50%", left: "50%", 
                    transform: "translate(-50%, -50%)",
                    fontSize: "20px", fontWeight: "700", color: "#fff"
                }}>
                    {value}
                </div>
            </div>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#71717a", fontWeight: "500" }}>{label}</div>
        </div>
    );
};

const DifficultyBar = ({ label, value, total, color }) => {
    const percentage = Math.min(100, (value / total) * 100);
    return (
        <div style={{ flex: 1, minWidth: "100px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "#71717a" }}>{label}</span>
                <span style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: "500" }}>{value}/{total}</span>
            </div>
            <div style={{ height: "6px", background: "#1c1c1e", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${percentage}%`, background: color, borderRadius: "3px", transition: "width 0.5s ease" }} />
            </div>
        </div>
    );
};

const CodeViewerModal = ({ submission, onClose }) => (
    <div style={{ 
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
        background: "rgba(0,0,0,0.85)", zIndex: 1000, 
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(8px)"
    }} onClick={onClose}>
        <div 
            style={{ 
                width: "800px", maxWidth: "90%", maxHeight: "85vh", 
                background: "#111113", border: "1px solid rgba(255,255,255,0.08)", 
                borderRadius: "20px", display: "flex", flexDirection: "column", overflow: "hidden",
                boxShadow: "0 25px 50px rgba(0,0,0,0.5)"
            }}
            onClick={e => e.stopPropagation()}
        >
            <div style={{ 
                padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", 
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "#fff", fontWeight: "600" }}>{submission.problemName}</h3>
                    <div style={{ 
                        fontSize: "12px", marginTop: "4px",
                        color: ['Accepted', 'OK', 'ACCEPTED'].includes(submission.verdict) ? "#22c55e" : "#ef4444"
                    }}>
                        {submission.verdict} • {submission.language}
                    </div>
                </div>
                <button onClick={onClose} style={{ background: "none", border: "none", color: "#52525b", cursor: "pointer", padding: "8px" }}>
                    <X size={20} />
                </button>
            </div>
            <div style={{ flex: 1, overflow: "auto", background: "#0a0a0b" }}>
                <pre style={{ 
                    margin: 0, padding: "24px", 
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace", 
                    fontSize: "13px", color: "#e4e4e7", lineHeight: "1.6",
                    whiteSpace: "pre-wrap", wordBreak: "break-word"
                }}>
                    {submission.code}
                </pre>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "flex-end" }}>
                <button 
                    onClick={() => { navigator.clipboard.writeText(submission.code); }}
                    style={{ 
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "10px 20px", borderRadius: "10px",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "500"
                    }}
                >
                    <Copy size={14} /> Copy Code
                </button>
            </div>
        </div>
    </div>
);

const RatingGraph = ({ data, color }) => {
    const [hoveredData, setHoveredData] = useState(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

    if (!data || data.length === 0) return null;

    const ratings = data.map(d => d.newRating);
    const min = Math.min(...ratings) - 100;
    const max = Math.max(...ratings) + 100;
    const range = max - min;

    const points = ratings.map((r, i) => {
        const x = (i / Math.max(1, ratings.length - 1)) * 100;
        const y = 100 - ((r - min) / range) * 100;
        return `${x},${y}`;
    }).join(" ");

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {/* Tooltip */}
            {hoveredData && (
                <div style={{
                    position: "absolute",
                    left: `${Math.min(85, Math.max(15, hoverPos.x))}%`,
                    bottom: `${100 - hoverPos.y + 15}%`,
                    transform: "translateX(-50%)",
                    background: "#1c1c1e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    zIndex: 20,
                    minWidth: "180px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    pointerEvents: "none"
                }}>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>
                        {hoveredData.newRating}
                        {hoveredData.oldRating > 0 && (
                            <span style={{ 
                                fontSize: "12px", marginLeft: "8px",
                                color: hoveredData.newRating >= hoveredData.oldRating ? "#22c55e" : "#ef4444"
                            }}>
                                {hoveredData.newRating >= hoveredData.oldRating ? "+" : ""}
                                {hoveredData.newRating - hoveredData.oldRating}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "2px" }}>{hoveredData.contestName}</div>
                    <div style={{ fontSize: "11px", color: "#52525b" }}>
                        {new Date(hoveredData.ratingUpdateTimeSeconds * 1000).toLocaleDateString()}
                    </div>
                </div>
            )}

            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                <defs>
                    <linearGradient id={`grad-${color}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(y => (
                    <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                ))}
                
                {/* Fill */}
                <path 
                    d={`M0,100 L0,${100 - ((ratings[0] - min) / range) * 100} ${points.replace(/,/g, ' ')} L100,${100 - ((ratings[ratings.length - 1] - min) / range) * 100} L100,100 Z`} 
                    fill={`url(#grad-${color})`} 
                />
                
                {/* Line */}
                <polyline 
                    fill="none" stroke={color} strokeWidth="2" points={points} 
                    vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" 
                />
            </svg>

            {/* Interactive dots */}
            {ratings.map((r, i) => {
                const x = (i / Math.max(1, ratings.length - 1)) * 100;
                const y = 100 - ((r - min) / range) * 100;
                return (
                    <div
                        key={i}
                        onMouseEnter={() => { setHoveredData(data[i]); setHoverPos({ x, y }); }}
                        onMouseLeave={() => setHoveredData(null)}
                        style={{
                            position: "absolute",
                            left: `${x}%`, top: `${y}%`,
                            width: "10px", height: "10px",
                            borderRadius: "50%",
                            background: hoveredData === data[i] ? color : "#111113",
                            border: `2px solid ${color}`,
                            transform: "translate(-50%, -50%)",
                            cursor: "pointer",
                            zIndex: 10,
                            transition: "all 0.15s ease"
                        }}
                    />
                );
            })}
        </div>
    );
};

const Heatmap = ({ cfSubmissions, localSubmissions }) => {
    const { stats, weeks, monthLabels } = useMemo(() => {
        const allSubs = [
            ...cfSubmissions.filter(s => s.verdict === "OK").map(s => ({
                date: new Date(s.creationTimeSeconds * 1000).toISOString().split('T')[0]
            })),
            ...localSubmissions.filter(s => ['Accepted', 'OK', 'ACCEPTED'].includes(s.verdict)).map(s => ({
                date: new Date(s.createdAt).toISOString().split('T')[0]
            }))
        ];

        const map = new Map();
        allSubs.forEach(sub => {
            map.set(sub.date, (map.get(sub.date) || 0) + 1);
        });

        // Generate grid for last 365 days, starting from Sunday
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - 364);
        // Adjust to start from Sunday
        const startDay = startDate.getDay();
        startDate.setDate(startDate.getDate() - startDay);

        const gridDays = [];
        const monthPositions = []; // Track where each month starts
        let lastMonth = -1;

        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const month = d.getMonth();
            const weekIndex = Math.floor(gridDays.length / 7);
            
            // Track month changes for labels
            if (month !== lastMonth && d.getDay() === 0) {
                monthPositions.push({ month, weekIndex });
                lastMonth = month;
            }
            
            gridDays.push({ 
                date: dateStr, 
                count: map.get(dateStr) || 0,
                dayOfWeek: d.getDay(),
                month: month
            });
        }

        // Calculate streaks
        const dates = [...map.keys()].sort();
        let maxStreak = 0, currentStreak = 0;
        
        if (dates.length > 0) {
            let streak = 1;
            for (let i = 1; i < dates.length; i++) {
                const diff = (new Date(dates[i]).getTime() - new Date(dates[i-1]).getTime()) / (1000*60*60*24);
                if (diff <= 1.1 && diff >= 0.9) streak++;
                else streak = 1;
                maxStreak = Math.max(maxStreak, streak);
            }
            
            // Current streak
            let checkDate = new Date();
            for (let i = 0; i < 365; i++) {
                if (map.get(checkDate.toISOString().split('T')[0])) currentStreak++;
                else if (i > 0) break;
                checkDate.setDate(checkDate.getDate() - 1);
            }
        }

        // Group into weeks
        const weeksArr = [];
        for (let i = 0; i < gridDays.length; i += 7) {
            weeksArr.push(gridDays.slice(i, i + 7));
        }

        // Generate month labels with positions
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const labels = monthPositions.map(mp => ({
            label: months[mp.month],
            position: mp.weekIndex
        }));

        return { 
            stats: { total: allSubs.length, maxStreak, currentStreak }, 
            weeks: weeksArr,
            monthLabels: labels
        };
    }, [cfSubmissions, localSubmissions]);

    const getColor = (c) => {
        if (c === 0) return "rgba(255,255,255,0.03)";
        if (c <= 1) return "rgba(34,197,94,0.25)";
        if (c <= 3) return "rgba(34,197,94,0.5)";
        if (c <= 5) return "rgba(34,197,94,0.75)";
        return "#22c55e";
    };

    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Submission Activity
                </h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <StatBadge label="Total" value={stats.total} />
                    <StatBadge label="Max Streak" value={stats.maxStreak} icon={<Flame size={12} />} />
                    <StatBadge label="Current" value={stats.currentStreak} icon={<Zap size={12} />} />
                </div>
            </div>
            
            <div style={{ overflowX: "auto", paddingBottom: "8px" }}>
                {/* Month Labels Row */}
                <div style={{ display: "flex", marginLeft: "36px", marginBottom: "8px", position: "relative", height: "16px" }}>
                    {monthLabels.map((ml, i) => (
                        <span 
                            key={i} 
                            style={{ 
                                position: "absolute",
                                left: `${ml.position * 14}px`,
                                fontSize: "11px", 
                                color: "#71717a",
                                fontWeight: "500",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {ml.label}
                        </span>
                    ))}
                </div>
                
                {/* Main Grid with Day Labels */}
                <div style={{ display: "flex" }}>
                    {/* Day Labels */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginRight: "6px", width: "28px" }}>
                        {dayLabels.map((day, i) => (
                            <div 
                                key={i} 
                                style={{ 
                                    height: "11px", 
                                    fontSize: "10px", 
                                    color: "#52525b",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end"
                                }}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Weeks Grid */}
                    <div style={{ display: "flex", gap: "3px" }}>
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                {week.map((d) => (
                                    <div 
                                        key={d.date} 
                                        style={{ 
                                            width: "11px", height: "11px", 
                                            borderRadius: "2px", 
                                            background: getColor(d.count),
                                            cursor: "pointer",
                                            transition: "transform 0.1s ease"
                                        }} 
                                        title={`${d.date}: ${d.count} submission${d.count !== 1 ? 's' : ''}`}
                                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.3)"}
                                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "16px", fontSize: "10px", color: "#52525b" }}>
                <span>Less</span>
                {[0, 1, 3, 5, 7].map(c => (
                    <div key={c} style={{ width: "11px", height: "11px", borderRadius: "2px", background: getColor(c) }} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
};

const StatBadge = ({ label, value, icon }) => (
    <div style={{ 
        display: "flex", alignItems: "center", gap: "6px",
        background: "rgba(255,255,255,0.03)", 
        padding: "6px 12px", borderRadius: "8px",
        fontSize: "12px", color: "#71717a"
    }}>
        {icon}
        {label}: <span style={{ color: "#e4e4e7", fontWeight: "600" }}>{value}</span>
    </div>
);
