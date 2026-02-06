import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import {
  User, Code, CheckCircle, XCircle, Globe, Github, Eye, X, Copy, Star,
  Trophy, Target, Flame, Calendar, TrendingUp, Activity, BarChart2,
  ChevronRight, ExternalLink, Loader2, Users, UserPlus, UserMinus, UserCheck,
  ArrowLeft, Share2, Clock, ChevronDown, Lock, Award, MapPin, MessageCircle
} from "lucide-react";

/* ─────────── Design tokens ─────────── */
const c = {
  bg: "#09090b", card: "#111113", cardHover: "#161618",
  border: "rgba(255,255,255,0.06)", borderLight: "rgba(255,255,255,0.1)",
  text: "#f4f4f5", textMuted: "#a1a1aa", textDim: "#71717a", textDark: "#52525b",
  blue: "#3b82f6", green: "#22c55e", yellow: "#fbbf24", red: "#ef4444",
  purple: "#a855f7", cyan: "#06b6d4", pink: "#ec4899", orange: "#f97316",
};

const GLOBAL_STYLES = `
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
  .ptab { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:500; border:none; cursor:pointer; transition:all .2s; display:flex; align-items:center; gap:8px; background:transparent; color:#71717a; }
  .ptab:hover { background:rgba(255,255,255,0.06); }
  .ptab.active { background:rgba(59,130,246,0.12); color:#3b82f6; }
  .pcard { background:#111113; border-radius:16px; border:1px solid rgba(255,255,255,0.06); transition:border-color .2s; }
  .pcard:hover { border-color:rgba(255,255,255,0.1); }
  .pbtn { padding:8px 16px; border-radius:8px; font-size:13px; font-weight:500; border:none; cursor:pointer; transition:all .15s; display:inline-flex; align-items:center; gap:6px; }
  .pbtn:hover { transform:translateY(-1px); }
  * { scrollbar-width:thin; scrollbar-color:#27272a transparent; }
  *::-webkit-scrollbar { width:6px; } *::-webkit-scrollbar-track { background:transparent; } *::-webkit-scrollbar-thumb { background:#27272a; border-radius:3px; }
`;

export default function UserProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const token = localStorage.getItem("codeplay_token");

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);

  // Social state
  const [friendStatus, setFriendStatus] = useState("none"); // none|friend|pending|incoming
  const [friendLoading, setFriendLoading] = useState(false);

  // Platform stats
  const [cfStats, setCfStats] = useState(null);
  const [cfHistory, setCfHistory] = useState([]);
  const [cfSubmissions, setCfSubmissions] = useState([]);
  const [lcStats, setLcStats] = useState(null);
  const [ccStats, setCcStats] = useState(null);
  const [ccHistory, setCcHistory] = useState([]);
  const [ghStats, setGhStats] = useState(null);
  const [loadingStates, setLoadingStates] = useState({ cf: false, lc: false, cc: false, gh: false });
  const [graphSource, setGraphSource] = useState("codeforces");

  // Public submissions
  const [submissions, setSubmissions] = useState([]);
  const [submissionPagination, setSubmissionPagination] = useState(null);
  const [viewSubmission, setViewSubmission] = useState(null);
  const [submissionFilter, setSubmissionFilter] = useState("all");

  const isOwnProfile = currentUser?.username === username;

  /* ─────────── Data Fetching ─────────── */
  useEffect(() => {
    if (isOwnProfile) { navigate("/profile"); return; }
    if (username) fetchProfileData();
  }, [username]);

  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/profile/${username}`);
      if (!res.ok) { setError(res.status === 404 ? "User not found" : "Failed to load profile"); setLoading(false); return; }
      const data = await res.json();
      setProfile(data);

      // Fetch platform stats
      if (data.platforms?.codeforces) { setLoadingStates(p => ({ ...p, cf: true })); fetchCFStats(data.platforms.codeforces); }
      if (data.platforms?.leetcode) { setLoadingStates(p => ({ ...p, lc: true })); fetchLCStats(data.platforms.leetcode); }
      if (data.platforms?.codechef) { setLoadingStates(p => ({ ...p, cc: true })); fetchCCStats(data.platforms.codechef); }
      if (data.platforms?.github) { setLoadingStates(p => ({ ...p, gh: true })); fetchGHStats(data.platforms.github); }
      // Fetch public submissions
      if (data._id) fetchPublicSubmissions(data._id, 1);

      // Check friendship status
      if (token && data._id) checkFriendStatus(data._id);
    } catch (err) { setError("Failed to load profile"); console.error(err); }
    finally { setLoading(false); }
  };

  const fetchPublicSubmissions = async (userId, page = 1) => {
    try {
      const res = await fetch(`${API_URL}/api/submissions/user/${userId}?page=${page}&limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.submissions) {
        setSubmissions(prev => page === 1 ? data.submissions : [...prev, ...data.submissions]);
        setSubmissionPagination(data.pagination);
      }
    } catch (e) { console.error(e); }
  };

  const checkFriendStatus = async (targetId) => {
    try {
      // Get our friends and requests to determine status
      const [friendsRes, reqRes] = await Promise.all([
        fetch(`${API_URL}/api/friends`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/friends/requests`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const friends = await friendsRes.json();
      const requests = await reqRes.json();
      if (Array.isArray(friends) && friends.some(f => f._id === targetId)) { setFriendStatus("friend"); return; }
      if (Array.isArray(requests) && requests.some(r => r._id === targetId)) { setFriendStatus("incoming"); return; }
      // We can't easily know if WE sent them a request without a backend change, so default to none
      setFriendStatus("none");
    } catch (e) { console.error(e); }
  };

  const fetchCFStats = async (handle) => {
    try {
      const [info, rating, status] = await Promise.all([
        fetch(`${API_URL}/api/proxy/codeforces/user/info/${handle}`).then(r => r.json()),
        fetch(`${API_URL}/api/proxy/codeforces/user/rating/${handle}`).then(r => r.json()),
        fetch(`${API_URL}/api/proxy/codeforces/user/status/${handle}`).then(r => r.json())
      ]);
      if (info.status === "OK") setCfStats(info.result[0]);
      if (rating.status === "OK") setCfHistory(rating.result || []);
      if (status.status === "OK") setCfSubmissions(status.result || []);
    } catch (e) { console.error(e); }
    finally { setLoadingStates(p => ({ ...p, cf: false })); }
  };

  const fetchLCStats = async (username) => {
    try {
      const res = await fetch(`${API_URL}/api/proxy/leetcode/${username}`);
      const data = await res.json();
      if (data && !data.error) setLcStats(data);
    } catch (e) { console.error(e); }
    finally { setLoadingStates(p => ({ ...p, lc: false })); }
  };

  const fetchCCStats = async (handle) => {
    try {
      const res = await fetch(`${API_URL}/api/proxy/codechef/${handle}`);
      const data = await res.json();
      if (data && data.success !== false) {
        setCcStats({
          currentRating: data.currentRating || data.rating || 0,
          highestRating: data.highestRating || 0,
          stars: data.stars || '-',
          globalRank: data.globalRank || '-',
          ...data
        });
        if (Array.isArray(data.ratingData) && data.ratingData.length > 0) {
          setCcHistory(data.ratingData.map(item => ({
            newRating: parseInt(item.rating || item.code) || 0, oldRating: 0,
            contestName: item.name || item.getcode || "Contest",
            ratingUpdateTimeSeconds: new Date(item.end_date || item.getyear).getTime() / 1000
          })).filter(x => !isNaN(x.ratingUpdateTimeSeconds))
            .sort((a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds));
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoadingStates(p => ({ ...p, cc: false })); }
  };

  const fetchGHStats = async (username) => {
    try {
      const res = await fetch(`${API_URL}/api/proxy/github/${username}`);
      const data = await res.json();
      if (data && data.success) setGhStats(data);
    } catch (e) { console.error(e); }
    finally { setLoadingStates(p => ({ ...p, gh: false })); }
  };

  /* ─────────── Friend Actions ─────────── */
  const sendFriendRequest = async () => {
    if (!token || !profile?._id) return;
    setFriendLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/friends/request/${profile._id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { setFriendStatus(data.status === "accepted" ? "friend" : "pending"); }
    } catch (e) { console.error(e); }
    finally { setFriendLoading(false); }
  };

  const acceptFriendRequest = async () => {
    if (!token || !profile?._id) return;
    setFriendLoading(true);
    try {
      await fetch(`${API_URL}/api/friends/accept/${profile._id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setFriendStatus("friend");
    } catch (e) { console.error(e); }
    finally { setFriendLoading(false); }
  };

  const removeFriend = async () => {
    if (!token || !profile?._id || !confirm("Remove this friend?")) return;
    setFriendLoading(true);
    try {
      await fetch(`${API_URL}/api/friends/${profile._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setFriendStatus("none");
    } catch (e) { console.error(e); }
    finally { setFriendLoading(false); }
  };

  const handleViewCode = async (subId) => {
    try {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/submissions/${subId}`, { headers });
      if (!res.ok) throw new Error("Not available");
      setViewSubmission(await res.json());
    } catch (e) { alert("This submission is not publicly available."); }
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ─────────── Computed ─────────── */
  const ratingColor = (r) => { if (!r) return c.textDim; if (r < 1200) return "#71717a"; if (r < 1400) return "#22c55e"; if (r < 1600) return "#06b6d4"; if (r < 1900) return "#3b82f6"; if (r < 2100) return "#a855f7"; if (r < 2400) return "#f59e0b"; return "#ef4444"; };
  const ratingTitle = (r) => { if (!r) return "Unrated"; if (r < 1200) return "Newbie"; if (r < 1400) return "Pupil"; if (r < 1600) return "Specialist"; if (r < 1900) return "Expert"; if (r < 2100) return "Candidate Master"; if (r < 2400) return "Master"; if (r < 2600) return "Intl. Master"; if (r < 3000) return "Grandmaster"; return "Legendary GM"; };

  const stats = useMemo(() => {
    const cfUnique = new Set(cfSubmissions.filter(s => s.verdict === "OK").map(s => `${s.problem.contestId}${s.problem.index}`)).size;
    const cfDays = new Set(cfSubmissions.map(s => new Date(s.creationTimeSeconds * 1000).toISOString().split('T')[0]));
    const lcSolved = lcStats?.totalSolved || 0;
    return {
      cfUnique, lcSolved, totalSolved: cfUnique + lcSolved,
      cfContests: cfHistory.length, ccContests: ccHistory.length,
      activeDays: cfDays.size,
      publicSubs: submissions.length,
      lcEasy: lcStats?.easySolved || 0, lcMedium: lcStats?.mediumSolved || 0, lcHard: lcStats?.hardSolved || 0,
    };
  }, [cfSubmissions, submissions, lcStats, cfHistory, ccHistory, ghStats]);

  const filteredSubs = useMemo(() => {
    if (submissionFilter === "all") return submissions;
    if (submissionFilter === "accepted") return submissions.filter(s => ['Accepted', 'OK', 'ACCEPTED'].includes(s.verdict));
    return submissions.filter(s => !['Accepted', 'OK', 'ACCEPTED'].includes(s.verdict));
  }, [submissions, submissionFilter]);

  /* ─────────── Loading / Error ─────────── */
  if (loading) return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 44, height: 44, border: `3px solid ${c.border}`, borderTopColor: c.blue, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
        <span style={{ color: c.textDim, fontSize: 14 }}>Loading profile...</span>
      </div>
      <style>{GLOBAL_STYLES}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <User size={48} color={c.textDark} />
      <span style={{ color: c.textDim, fontSize: 18, fontWeight: 600 }}>{error}</span>
      <span style={{ color: c.textDark, fontSize: 14 }}>The profile for @{username} could not be found</span>
      <button onClick={() => navigate("/")} className="pbtn" style={{ background: c.blue, color: "#fff", marginTop: 8 }}>Back to Dashboard</button>
      <style>{GLOBAL_STYLES}</style>
    </div>
  );

  if (!profile) return null;

  /* ═══════════════════════════════════════════
     FRIEND BUTTON LOGIC
     ═══════════════════════════════════════════ */
  const FriendButton = () => {
    if (!token) return <button onClick={() => navigate("/auth")} className="pbtn" style={{ background: "rgba(255,255,255,0.04)", color: c.textMuted }}><UserPlus size={14} /> Sign in to add friend</button>;

    const btnStyle = (bg, clr) => ({ background: bg, color: clr, border: "none" });

    switch (friendStatus) {
      case "friend":
        return (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="pbtn" style={btnStyle(`${c.green}15`, c.green)} disabled><UserCheck size={14} /> Friends</button>
            <button onClick={removeFriend} className="pbtn" style={btnStyle(`${c.red}12`, c.red)} disabled={friendLoading}><UserMinus size={14} /></button>
          </div>
        );
      case "pending":
        return <button className="pbtn" style={btnStyle("rgba(255,255,255,0.06)", c.textMuted)} disabled><Clock size={14} /> Request Sent</button>;
      case "incoming":
        return <button onClick={acceptFriendRequest} className="pbtn" style={btnStyle(c.blue, "#fff")} disabled={friendLoading}>{friendLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus size={14} />} Accept Request</button>;
      default:
        return <button onClick={sendFriendRequest} className="pbtn" style={btnStyle(c.blue, "#fff")} disabled={friendLoading}>{friendLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus size={14} />} Add Friend</button>;
    }
  };

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", overflowY: "auto", height: "100vh" }}>
      <style>{GLOBAL_STYLES}</style>

      {viewSubmission && <CodeViewerModal submission={viewSubmission} onClose={() => setViewSubmission(null)} />}

      {/* ─── HERO ─── */}
      <div style={{ background: `linear-gradient(180deg, rgba(139,92,246,0.06) 0%, rgba(59,130,246,0.03) 50%, transparent 100%)`, borderBottom: `1px solid ${c.border}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -120, right: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.06),transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 0" }}>
          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <button onClick={() => navigate(-1)} className="pbtn" style={{ background: "rgba(255,255,255,0.04)", color: c.textMuted }}><ArrowLeft size={16} /> Back</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copyProfileLink} className="pbtn" style={{ background: copied ? `${c.green}15` : "rgba(255,255,255,0.04)", color: copied ? c.green : c.textMuted }}>
                {copied ? <><CheckCircle size={14} /> Copied!</> : <><Share2 size={14} /> Share</>}
              </button>
              <FriendButton />
            </div>
          </div>

          {/* Profile header */}
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", paddingBottom: 28 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 112, height: 112,
                background: profile.avatar ? `url(${profile.avatar}) center/cover` : `linear-gradient(135deg, ${ratingColor(cfStats?.rating)}, ${c.purple})`,
                borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 44, fontWeight: 700, color: "#fff",
                boxShadow: `0 8px 32px ${ratingColor(cfStats?.rating)}30`, border: `3px solid ${c.border}`
              }}>
                {!profile.avatar && (profile.username?.[0]?.toUpperCase() || "?")}
              </div>
              {cfStats?.rank && (
                <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 600, background: c.card, border: `1px solid ${c.border}`, color: ratingColor(cfStats.rating), whiteSpace: "nowrap", textTransform: "capitalize" }}>
                  {cfStats.rank}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{profile.username}</h1>
                {cfStats?.rating && <span style={{ padding: "3px 10px", borderRadius: 8, background: `${ratingColor(cfStats.rating)}15`, color: ratingColor(cfStats.rating), fontSize: 13, fontWeight: 600 }}>{cfStats.rating}</span>}
                {friendStatus === "friend" && <span style={{ padding: "3px 10px", borderRadius: 8, background: `${c.green}12`, color: c.green, fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}><UserCheck size={11} /> Friend</span>}
              </div>
              <div style={{ color: c.textDim, fontSize: 13, marginBottom: 10 }}>
                @{profile.username} · Joined {new Date(profile.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <p style={{ color: c.textMuted, fontSize: 14, lineHeight: 1.6, margin: "0 0 10px", maxWidth: 540 }}>
                {profile.bio || "This user hasn't written a bio yet."}
              </p>

              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                {[
                  { icon: <Target size={14} color={c.green} />, val: stats.totalSolved, label: "problems" },
                  { icon: <Trophy size={14} color={c.yellow} />, val: stats.cfContests + stats.ccContests, label: "contests" },
                  { icon: <Flame size={14} color={c.orange} />, val: stats.activeDays, label: "active days" },
                  ...(ghStats ? [{ icon: <Github size={14} color="#e4e4e7" />, val: ghStats.public_repos, label: "repos" }] : []),
                ].map((s, i) => (
                  <span key={i} style={{ color: c.textDim, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                    {s.icon} <strong style={{ color: c.text }}>{s.val}</strong> {s.label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
              {cfStats?.rating && (
                <div className="pcard" style={{ padding: "16px 20px", textAlign: "center", minWidth: 110, boxShadow: "0 0 60px rgba(59,130,246,0.06)" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: ratingColor(cfStats.rating) }}>{cfStats.rating}</div>
                  <div style={{ fontSize: 11, color: c.textDark, marginTop: 2 }}>CF Rating</div>
                  <div style={{ fontSize: 10, color: c.textDim, textTransform: "capitalize" }}>{ratingTitle(cfStats.rating)}</div>
                </div>
              )}
              {lcStats?.ranking && (
                <div className="pcard" style={{ padding: "16px 20px", textAlign: "center", minWidth: 110 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c.yellow }}>#{lcStats.ranking.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: c.textDark, marginTop: 2 }}>LC Rank</div>
                </div>
              )}
              {ghStats && (
                <div className="pcard" style={{ padding: "16px 20px", textAlign: "center", minWidth: 110 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#e4e4e7" }}>{ghStats.public_repos}</div>
                  <div style={{ fontSize: 11, color: c.textDark, marginTop: 2 }}>GH Repos</div>
                  <div style={{ fontSize: 10, color: c.textDim }}>{ghStats.followers} followers</div>
                </div>
              )}
            </div>
          </div>

          {/* TAB BAR */}
          <div style={{ display: "flex", gap: 4, borderTop: `1px solid ${c.border}`, paddingTop: 10, marginTop: -1 }}>
            {[
              { id: "overview", label: "Overview", icon: <BarChart2 size={15} /> },
              { id: "submissions", label: "Submissions", icon: <Code size={15} />, count: stats.publicSubs },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`ptab ${activeTab === t.id ? "active" : ""}`}>
                {t.icon} {t.label}
                {t.count !== undefined && <span style={{ fontSize: 11, opacity: 0.6 }}>({t.count})</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 60px" }}>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div style={{ animation: "fadeIn .3s ease" }}>
            {/* Platform Cards */}
            <SectionHeader icon={<Globe size={16} />} title="Platforms" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginBottom: 32 }}>
              <PlatformCard name="Codeforces" handle={profile.platforms?.codeforces} icon="CF" color={c.blue} loading={loadingStates.cf}
                stats={cfStats ? [{ label: "Rating", value: cfStats.rating || "-", color: ratingColor(cfStats.rating) }, { label: "Max", value: cfStats.maxRating || "-" }, { label: "Contests", value: cfHistory.length }, { label: "Problems", value: stats.cfUnique }] : null}
                link={profile.platforms?.codeforces ? `https://codeforces.com/profile/${profile.platforms.codeforces}` : null} />
              <PlatformCard name="LeetCode" handle={profile.platforms?.leetcode} icon={<svg width="18" height="18" viewBox="0 0 24 24"><path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" fill="currentColor"/></svg>} color={c.yellow} loading={loadingStates.lc}
                stats={lcStats ? [{ label: "Solved", value: lcStats.totalSolved || 0 }, { label: "Easy", value: lcStats.easySolved || 0, color: c.green }, { label: "Medium", value: lcStats.mediumSolved || 0, color: c.yellow }, { label: "Hard", value: lcStats.hardSolved || 0, color: c.red }] : null}
                link={profile.platforms?.leetcode ? `https://leetcode.com/${profile.platforms.leetcode}` : null} />
              <PlatformCard name="CodeChef" handle={profile.platforms?.codechef} icon="CC" color={c.purple} loading={loadingStates.cc}
                stats={ccStats?.currentRating || ccStats?.rating ? [{ label: "Rating", value: ccStats.currentRating || ccStats.rating || "-" }, { label: "Stars", value: ccStats.stars || "-" }, { label: "Contests", value: ccHistory.length }, { label: "Global", value: ccStats.globalRank || "-" }] : null}
                apiError={!loadingStates.cc && profile.platforms?.codechef && !ccStats?.currentRating && !ccStats?.rating}
                link={profile.platforms?.codechef ? `https://www.codechef.com/users/${profile.platforms.codechef}` : null} />
              {profile.platforms?.github && (
                <PlatformCard name="GitHub" handle={profile.platforms.github} icon={<Github size={18} />} color="#e4e4e7" loading={loadingStates.gh}
                  stats={ghStats ? [{ label: "Repos", value: ghStats.public_repos || 0 }, { label: "Followers", value: ghStats.followers || 0 }, { label: "Following", value: ghStats.following || 0 }, { label: "Stars", value: ghStats.totalStars ?? "-", color: c.yellow }] : null}
                  apiError={!loadingStates.gh && profile.platforms?.github && !ghStats}
                  link={`https://github.com/${profile.platforms.github}`} />
              )}
            </div>

            {/* Stats */}
            <SectionHeader icon={<Activity size={16} />} title="Statistics" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14, marginBottom: 32 }}>
              <StatCard icon={<Target size={20} />} value={stats.totalSolved} label="Problems Solved" sub="CF + LC" color={c.green} />
              <StatCard icon={<Trophy size={20} />} value={stats.cfContests + stats.ccContests} label="Contests" sub="CF + CC" color={c.blue} />
              <StatCard icon={<Calendar size={20} />} value={stats.activeDays} label="Active Days" sub="All platforms" color={c.yellow} />
              <StatCard icon={<Eye size={20} />} value={stats.publicSubs} label="Public Submissions" sub="On CodePlay" color={c.purple} />
            </div>

            {/* Heatmap + Breakdown */}
            {cfSubmissions.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, marginBottom: 32 }}>
                <div className="pcard" style={{ padding: 24, minWidth: 0 }}>
                  <Heatmap cfSubmissions={cfSubmissions} />
                </div>
                <div className="pcard" style={{ padding: 24 }}>
                  <SectionHeader icon={<BarChart2 size={14} />} title="Breakdown" compact />
                  <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", gap: 12, marginTop: 20 }}>
                    <DonutChart value={stats.lcSolved} total={3000} label="LeetCode" color={c.yellow} />
                    <DonutChart value={stats.cfUnique} total={1500} label="Codeforces" color={c.blue} />
                  </div>
                  {lcStats && (
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: 11, color: c.textDim, marginBottom: 10 }}>LC by Difficulty</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <DiffBar label="Easy" val={stats.lcEasy} total={lcStats.totalEasy || 800} color={c.green} />
                        <DiffBar label="Medium" val={stats.lcMedium} total={lcStats.totalMedium || 1700} color={c.yellow} />
                        <DiffBar label="Hard" val={stats.lcHard} total={lcStats.totalHard || 700} color={c.red} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rating Graph */}
            {(cfHistory.length > 0 || ccHistory.length > 0) && (
              <div className="pcard" style={{ padding: 24, marginBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <SectionHeader icon={<TrendingUp size={14} />} title="Rating History" compact />
                  <div style={{ display: "flex", gap: 6 }}>
                    {cfHistory.length > 0 && <button onClick={() => setGraphSource("codeforces")} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", background: graphSource === "codeforces" ? `${c.blue}18` : "rgba(255,255,255,0.03)", color: graphSource === "codeforces" ? c.blue : c.textDim, transition: "all .15s" }}>CF</button>}
                    {ccHistory.length > 0 && <button onClick={() => setGraphSource("codechef")} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", background: graphSource === "codechef" ? `${c.purple}18` : "rgba(255,255,255,0.03)", color: graphSource === "codechef" ? c.purple : c.textDim, transition: "all .15s" }}>CC</button>}
                  </div>
                </div>
                <div style={{ height: 220, position: "relative" }}>
                  <RatingGraph data={graphSource === 'codeforces' ? cfHistory : ccHistory} color={graphSource === 'codeforces' ? c.blue : c.purple} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SUBMISSIONS TAB ═══ */}
        {activeTab === "submissions" && (
          <div style={{ animation: "fadeIn .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <SectionHeader icon={<Eye size={16} />} title="Public Submissions" compact />
              <div style={{ display: "flex", gap: 6 }}>
                {[{ id: "all", label: "All" }, { id: "accepted", label: "Accepted", clr: c.green }, { id: "failed", label: "Failed", clr: c.red }].map(f => (
                  <button key={f.id} onClick={() => setSubmissionFilter(f.id)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer", background: submissionFilter === f.id ? `${f.clr || c.blue}18` : "rgba(255,255,255,0.03)", color: submissionFilter === f.id ? (f.clr || c.blue) : c.textDim, transition: "all .15s" }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pcard" style={{ overflow: "hidden" }}>
              {filteredSubs.length === 0 ? (
                <div style={{ padding: 60, textAlign: "center", color: c.textDark }}>
                  <Code size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <div style={{ fontSize: 14 }}>{submissionFilter !== "all" ? "No matching submissions" : "No public submissions yet"}</div>
                </div>
              ) : (
                <div>
                  {filteredSubs.map((sub, i) => (
                    <div key={sub._id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 24px", borderBottom: i < filteredSubs.length - 1 ? `1px solid ${c.border}` : "none", transition: "background .15s", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      onClick={() => handleViewCode(sub._id)}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: ['Accepted', 'OK', 'ACCEPTED'].includes(sub.verdict) ? `${c.green}15` : `${c.red}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {['Accepted', 'OK', 'ACCEPTED'].includes(sub.verdict) ? <CheckCircle size={15} color={c.green} /> : <XCircle size={15} color={c.red} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: c.text, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.problemName || sub.problemId}</div>
                        <div style={{ fontSize: 12, color: c.textDark, display: "flex", gap: 8, marginTop: 2 }}><span>{sub.problemId}</span><span>·</span><span style={{ textTransform: "capitalize" }}>{sub.platform}</span></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: sub.platform === "codeforces" ? `${c.blue}12` : sub.platform === "leetcode" ? `${c.yellow}12` : `${c.purple}12`, color: sub.platform === "codeforces" ? c.blue : sub.platform === "leetcode" ? c.yellow : c.purple }}>{sub.language}</span>
                        <span style={{ fontSize: 12, color: c.textDark, minWidth: 60, textAlign: "right" }}>{new Date(sub.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <ChevronRight size={14} color={c.textDark} />
                      </div>
                    </div>
                  ))}
                  {submissionPagination && submissionPagination.page < submissionPagination.pages && (
                    <div style={{ padding: "14px 24px", textAlign: "center", borderTop: `1px solid ${c.border}` }}>
                      <button onClick={() => fetchPublicSubmissions(profile._id, submissionPagination.page + 1)} className="pbtn" style={{ background: "rgba(255,255,255,0.04)", color: c.textMuted }}>Load More <ChevronDown size={14} /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════ */

const SectionHeader = ({ icon, title, compact }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: compact ? 0 : 16 }}>
    <span style={{ color: c.blue }}>{icon}</span>
    <h3 style={{ margin: 0, fontSize: compact ? 14 : 15, fontWeight: 600, color: c.textDim, textTransform: "uppercase", letterSpacing: "0.4px" }}>{title}</h3>
  </div>
);

const PlatformCard = ({ name, handle, icon, color, loading, stats: platformStats, link, apiError }) => (
  <div className="pcard" style={{ padding: 20, minHeight: 140, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}12`, color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
        {typeof icon === 'string' ? icon : icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: c.text, fontSize: 14 }}>{name}</div>
        <div style={{ fontSize: 12, color: handle ? c.textDim : c.textDark }}>{handle || "Not linked"}</div>
      </div>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: c.textDark, padding: 4 }}><ExternalLink size={14} /></a>}
    </div>
    {loading ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.textDark, fontSize: 12 }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading...</div>
    ) : platformStats ? (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {platformStats.map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: s.color || c.text }}>{s.value}</div>
            <div style={{ fontSize: 10, color: c.textDark, textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>
    ) : apiError ? <div style={{ fontSize: 12, color: c.red }}>API unavailable</div>
      : !handle ? <div style={{ fontSize: 12, color: c.textDark }}>Not linked</div> : null}
  </div>
);

const StatCard = ({ icon, value, label, sub, color }) => (
  <div className="pcard" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}12`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: c.textDim, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: c.textDark }}>{sub}</div>}
    </div>
  </div>
);

const DonutChart = ({ value, total, label, color }) => {
  const pct = Math.min(100, (value / Math.max(1, total)) * 100);
  const r = 36, circ = 2 * Math.PI * r, off = circ - (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: 88, height: 88 }}>
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
          <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 44 44)" style={{ transition: "stroke-dashoffset .6s ease" }} />
        </svg>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 18, fontWeight: 700, color: "#fff" }}>{value}</div>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: c.textDim, fontWeight: 500 }}>{label}</div>
    </div>
  );
};

const DiffBar = ({ label, val, total, color }) => {
  const pct = Math.min(100, (val / Math.max(1, total)) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: c.textDim }}>{label}</span>
        <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 500 }}>{val}/{total}</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width .5s ease" }} />
      </div>
    </div>
  );
};

const CodeViewerModal = ({ submission, onClose }) => {
  const [copied, setCopied] = useState(false);
  const copyCode = () => { navigator.clipboard.writeText(submission.code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 800, maxWidth: "92%", maxHeight: "85vh", background: c.card, border: `1px solid ${c.border}`, borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px rgba(0,0,0,0.5)", animation: "fadeIn .2s ease" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: "#fff", fontWeight: 600 }}>{submission.problemName}</h3>
            <div style={{ fontSize: 12, marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: ['Accepted', 'OK', 'ACCEPTED'].includes(submission.verdict) ? c.green : c.red }}>{submission.verdict}</span>
              <span style={{ color: c.textDark }}>·</span><span style={{ color: c.textDim }}>{submission.language}</span>
              <span style={{ color: c.textDark }}>·</span><span style={{ color: c.textDim }}>{submission.platform}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: c.textDark, cursor: "pointer", padding: 8 }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflow: "auto", background: "#0a0a0b" }}>
          <pre style={{ margin: 0, padding: 24, fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 13, color: c.text, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{submission.code}</pre>
        </div>
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={copyCode} className="pbtn" style={{ background: copied ? `${c.green}15` : "rgba(255,255,255,0.05)", color: copied ? c.green : "#fff", border: `1px solid ${copied ? c.green + "30" : c.borderLight}` }}>
            {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy Code</>}
          </button>
        </div>
      </div>
    </div>
  );
};

const RatingGraph = ({ data, color }) => {
  const [hovered, setHovered] = useState(null);
  const [hPos, setHPos] = useState({ x: 0, y: 0 });
  if (!data?.length) return null;
  const ratings = data.map(d => d.newRating);
  const mn = Math.min(...ratings) - 100, mx = Math.max(...ratings) + 100, rng = mx - mn;
  const pts = ratings.map((r, i) => `${(i / Math.max(1, ratings.length - 1)) * 100},${100 - ((r - mn) / rng) * 100}`).join(" ");

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {hovered && (
        <div style={{ position: "absolute", left: `${Math.min(82, Math.max(18, hPos.x))}%`, bottom: `${100 - hPos.y + 12}%`, transform: "translateX(-50%)", background: "#1c1c1e", border: `1px solid ${c.borderLight}`, borderRadius: 12, padding: "10px 14px", zIndex: 20, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
            {hovered.newRating}
            {hovered.oldRating > 0 && <span style={{ fontSize: 12, marginLeft: 6, color: hovered.newRating >= hovered.oldRating ? c.green : c.red }}>{hovered.newRating >= hovered.oldRating ? "+" : ""}{hovered.newRating - hovered.oldRating}</span>}
          </div>
          <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>{hovered.contestName}</div>
          <div style={{ fontSize: 10, color: c.textDark, marginTop: 1 }}>{new Date(hovered.ratingUpdateTimeSeconds * 1000).toLocaleDateString()}</div>
        </div>
      )}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        <defs><linearGradient id={`g-${color}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0, 25, 50, 75, 100].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
        <polygon points={`0,${100 - ((ratings[0] - mn) / rng) * 100} ${pts} 100,100 0,100`} fill={`url(#g-${color})`} />
        <polyline fill="none" stroke={color} strokeWidth="2" points={pts} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {ratings.map((r, i) => {
        const x = (i / Math.max(1, ratings.length - 1)) * 100, y = 100 - ((r - mn) / rng) * 100;
        return <div key={i} onMouseEnter={() => { setHovered(data[i]); setHPos({ x, y }); }} onMouseLeave={() => setHovered(null)}
          style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 10, height: 10, borderRadius: "50%", background: hovered === data[i] ? color : c.card, border: `2px solid ${color}`, transform: "translate(-50%,-50%)", cursor: "pointer", zIndex: 10, transition: "all .15s" }} />;
      })}
    </div>
  );
};

const Heatmap = ({ cfSubmissions }) => {
  const { stats: heatStats, weeks, monthLabels } = useMemo(() => {
    const allSubs = cfSubmissions.filter(s => s.verdict === "OK").map(s => ({ date: new Date(s.creationTimeSeconds * 1000).toISOString().split('T')[0] }));
    const map = new Map();
    allSubs.forEach(s => map.set(s.date, (map.get(s.date) || 0) + 1));
    const today = new Date(), start = new Date();
    start.setDate(today.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());
    const grid = [], mpos = [];
    let lastM = -1;
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0], m = d.getMonth(), wi = Math.floor(grid.length / 7);
      if (m !== lastM && d.getDay() === 0) { mpos.push({ month: m, weekIndex: wi }); lastM = m; }
      grid.push({ date: ds, count: map.get(ds) || 0 });
    }
    const w = [];
    for (let i = 0; i < grid.length; i += 7) w.push(grid.slice(i, i + 7));
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { stats: { total: allSubs.length }, weeks: w, monthLabels: mpos.map(p => ({ label: mo[p.month], position: p.weekIndex })) };
  }, [cfSubmissions]);

  const gc = (n) => n === 0 ? "rgba(255,255,255,0.03)" : n <= 1 ? "rgba(34,197,94,0.25)" : n <= 3 ? "rgba(34,197,94,0.5)" : n <= 5 ? "rgba(34,197,94,0.75)" : "#22c55e";
  const days = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <SectionHeader icon={<Activity size={14} />} title="CF Activity" compact />
        <span style={{ fontSize: 12, color: c.textDim }}><strong style={{ color: c.text }}>{heatStats.total}</strong> accepted</span>
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 6 }}>
        <div style={{ display: "flex", marginLeft: 34, marginBottom: 6, position: "relative", height: 14 }}>
          {monthLabels.map((m, i) => <span key={i} style={{ position: "absolute", left: m.position * 14, fontSize: 10, color: c.textDim, fontWeight: 500 }}>{m.label}</span>)}
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 5, width: 26 }}>
            {days.map((d, i) => <div key={i} style={{ height: 11, fontSize: 9, color: c.textDark, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{d}</div>)}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {weeks.map((w, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {w.map(d => <div key={d.date} style={{ width: 11, height: 11, borderRadius: 2, background: gc(d.count), cursor: "pointer", transition: "transform .1s" }}
                  title={`${d.date}: ${d.count} sub${d.count !== 1 ? 's' : ''}`}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.3)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 12, fontSize: 10, color: c.textDark }}>
        <span>Less</span> {[0, 1, 3, 5, 7].map(v => <div key={v} style={{ width: 11, height: 11, borderRadius: 2, background: gc(v) }} />)} <span>More</span>
      </div>
    </div>
  );
};
