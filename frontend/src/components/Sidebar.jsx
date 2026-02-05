import React from "react";
import { Files, Settings, Users, FlaskConical, PenTool, Video } from "lucide-react";

// --- PLATFORM LOGOS ---

// Codeforces Official Logo (bar chart style)
const CodeforcesLogo = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transition: "all 0.25s" }}>
    <rect x="2" y="13" width="5" height="9" rx="1.5" fill={active ? "#FFC107" : "#52525b"} />
    <rect x="9.5" y="6" width="5" height="16" rx="1.5" fill={active ? "#2196F3" : "#3f3f46"} />
    <rect x="17" y="10" width="5" height="12" rx="1.5" fill={active ? "#F44336" : "#2c2c2e"} />
  </svg>
);

// LeetCode Logo (simplified)
const LeetCodeLogo = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transition: "all 0.25s" }}>
    <path d="M16.6 14H7.4c-.4 0-.7.3-.7.7v.6c0 .4.3.7.7.7h9.2c.4 0 .7-.3.7-.7v-.6c0-.4-.3-.7-.7-.7z" fill={active ? "#ffa116" : "#52525b"} />
    <path d="M8.9 5.5L4.2 10.2c-.4.4-.4 1 0 1.4l4.7 4.7c.4.4 1 .4 1.4 0l.7-.7c.4-.4.4-1 0-1.4l-3.3-3.3 3.3-3.3c.4-.4.4-1 0-1.4l-.7-.7c-.4-.4-1-.4-1.4 0z" fill={active ? "#ffa116" : "#52525b"} />
    <path d="M19.7 10.2l-4.7-4.7c-.4-.4-1-.4-1.4 0l-.7.7c-.4.4-.4 1 0 1.4l3.3 3.3-3.3 3.3c-.4.4-.4 1 0 1.4l.7.7c.4.4 1 .4 1.4 0l4.7-4.7c.4-.4.4-1 0-1.4z" fill={active ? "#b45309" : "#3f3f46"} />
  </svg>
);

// CSES Logo (book style)
const CSESLogo = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#ea580c" : "#52525b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "all 0.25s" }}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8" />
    <path d="M8 11h6" />
  </svg>
);

// CP-31 Sheet Logo (numbered list with badge)
const CP31Logo = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ transition: "all 0.25s" }}>
    <rect x="3" y="3" width="18" height="18" rx="4" fill={active ? "rgba(34, 197, 94, 0.12)" : "rgba(255,255,255,0.03)"} stroke={active ? "#22c55e" : "#3f3f46"} strokeWidth="1.5"/>
    <text x="7" y="11" fontSize="6" fontWeight="600" fill={active ? "#22c55e" : "#52525b"}>CP</text>
    <text x="6" y="18" fontSize="7" fontWeight="600" fill={active ? "#4ade80" : "#52525b"}>31</text>
  </svg>
);

// Striver A2Z Logo (layered stacks)
const A2ZLogo = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ transition: "all 0.25s" }}>
    <path d="M12 2L3 7l9 5 9-5-9-5z" fill={active ? "rgba(139, 92, 246, 0.25)" : "rgba(255,255,255,0.04)"} stroke={active ? "#8b5cf6" : "#3f3f46"} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M3 12l9 5 9-5" stroke={active ? "#a78bfa" : "#52525b"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 17l9 5 9-5" stroke={active ? "#c4b5fd" : "#71717a"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Sidebar = ({ activeTab, setActiveTab, onToggle, isOpen }) => {
  
  const renderIcon = (id, Icon, label, color = "var(--accent-primary)") => {
    const isActive = activeTab === id && isOpen;
    return (
    <div 
        onClick={() => setActiveTab(id === activeTab && isOpen ? null : id)}
        data-tooltip={label}
        style={{
            width: "48px",
            height: "42px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            color: isActive ? "#fff" : "var(--text-dim)",
            borderLeft: isActive ? `2px solid ${color}` : "2px solid transparent",
            background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
            transition: "all 0.2s var(--ease-smooth)",
            position: "relative"
        }}
        className="sidebar-icon"
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-dim)'; }}
    >
        <Icon size={19} strokeWidth={isActive ? 1.8 : 1.5} style={{ filter: isActive ? `drop-shadow(0 0 6px ${color}55)` : "none", transition: "all 0.25s" }} />
    </div>
    );
  };

  const renderPlatformIcon = (id, Logo, label, color) => {
    const isActive = activeTab === id && isOpen;
    return (
    <div 
        onClick={() => setActiveTab(id === activeTab && isOpen ? null : id)}
        data-tooltip={label}
        style={{
            width: "48px",
            height: "42px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            borderLeft: isActive ? `2px solid ${color}` : "2px solid transparent",
            background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
            transition: "all 0.2s var(--ease-smooth)",
            position: "relative"
        }}
        className="sidebar-icon"
    >
        <Logo active={isActive} />
    </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-dark)", borderRight: "1px solid var(--border-subtle)", zIndex: 50 }}>
        {/* ICON BAR */}
        <div style={{ width: "48px", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", borderRight: isOpen ? "1px solid var(--border-subtle)" : "none", background: "var(--bg-dark)", zIndex: 20 }}>
            <div style={{ height: "10px" }} />
            
            {/* Core Tools */}
            {renderIcon("files", Files, "Explorer", "#8b5cf6")}
            {renderIcon("participants", Users, "Participants", "#22c55e")}
            
            {/* SEPARATOR - Problem Sets */}
            <div style={{ width: "20px", height: "1px", background: "var(--border-subtle)", margin: "8px 0" }} />
            <div style={{ fontSize: "7px", color: "var(--text-dim)", letterSpacing: "1.2px", marginBottom: "4px", fontWeight: "500" }}>PROBLEMS</div>

            {/* Platform Icons */}
            {renderPlatformIcon("codeforces", CodeforcesLogo, "Codeforces", "#3b82f6")}
            {renderPlatformIcon("cses", CSESLogo, "CSES Problem Set", "#ea580c")}
            {renderPlatformIcon("leetcode", LeetCodeLogo, "LeetCode", "#ffa116")}
            
            {/* SEPARATOR - Sheets */}
            <div style={{ width: "20px", height: "1px", background: "var(--border-subtle)", margin: "8px 0" }} />
            <div style={{ fontSize: "7px", color: "var(--text-dim)", letterSpacing: "1.2px", marginBottom: "4px", fontWeight: "500" }}>SHEETS</div>

            {/* Sheet Icons */}
            {renderPlatformIcon("cp31", CP31Logo, "CP-31 Sheet", "#22c55e")}
            {renderPlatformIcon("a2z", A2ZLogo, "Striver's A2Z DSA", "#8b5cf6")}

            {/* SEPARATOR - Tools */}
            <div style={{ width: "20px", height: "1px", background: "var(--border-subtle)", margin: "8px 0" }} />
            <div style={{ fontSize: "7px", color: "var(--text-dim)", letterSpacing: "1.2px", marginBottom: "4px", fontWeight: "500" }}>TOOLS</div>

            {renderIcon("tests", FlaskConical, "Test Cases", "#eab308")}
            {renderIcon("whiteboard", PenTool, "Whiteboard", "#ec4899")}
            {renderIcon("recording", Video, "Record Solution", "#ef4444")}

            <div style={{ flex: 1 }} />
            
            {/* Bottom Settings */}
            <div style={{ width: "20px", height: "1px", background: "var(--border-subtle)", margin: "6px 0" }} />
            {renderIcon("settings", Settings, "Settings", "#71717a")}
            <div style={{ height: "10px" }} />
        </div>
    </div>
  );
};
export default React.memo(Sidebar);
