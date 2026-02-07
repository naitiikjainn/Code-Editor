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

// LeetCode Official Logo
const LeetCodeLogo = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transition: "all 0.25s" }}>
    <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" fill={active ? "#ffa116" : "#52525b"} />
  </svg>
);

// CSES Original Logo (golden CSES text)
const CSESLogo = ({ active }) => (
  <svg width="24" height="14" viewBox="0 0 40 14" fill="none" style={{ transition: "all 0.25s" }}>
    <defs>
      <linearGradient id="csesGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={active ? "#d4a853" : "#71717a"} />
        <stop offset="50%" stopColor={active ? "#f5d78e" : "#a1a1aa"} />
        <stop offset="100%" stopColor={active ? "#b8943a" : "#52525b"} />
      </linearGradient>
    </defs>
    <text x="20" y="11" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="Arial Black, sans-serif" fill="url(#csesGold)" stroke={active ? "#8b6914" : "#3f3f46"} strokeWidth="0.3">CSES</text>
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
