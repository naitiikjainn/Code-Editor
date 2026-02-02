import React from "react";
import { Files, Settings, Users, FlaskConical, PenTool, Video } from "lucide-react";

// --- PLATFORM LOGOS ---

// Codeforces Official Logo (bar chart style)
const CodeforcesLogo = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ filter: active ? "drop-shadow(0 0 8px #3b82f6)" : "none", transition: "filter 0.3s" }}>
    <rect x="2" y="13" width="5" height="9" rx="1" fill={active ? "#FFC107" : "#6b7280"} />
    <rect x="9.5" y="6" width="5" height="16" rx="1" fill={active ? "#2196F3" : "#4b5563"} />
    <rect x="17" y="10" width="5" height="12" rx="1" fill={active ? "#F44336" : "#374151"} />
  </svg>
);

// LeetCode Logo (simplified)
const LeetCodeLogo = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ filter: active ? "drop-shadow(0 0 8px #ffa116)" : "none", transition: "filter 0.3s" }}>
    <path d="M16.6 14H7.4c-.4 0-.7.3-.7.7v.6c0 .4.3.7.7.7h9.2c.4 0 .7-.3.7-.7v-.6c0-.4-.3-.7-.7-.7z" fill={active ? "#ffa116" : "#6b7280"} />
    <path d="M8.9 5.5L4.2 10.2c-.4.4-.4 1 0 1.4l4.7 4.7c.4.4 1 .4 1.4 0l.7-.7c.4-.4.4-1 0-1.4l-3.3-3.3 3.3-3.3c.4-.4.4-1 0-1.4l-.7-.7c-.4-.4-1-.4-1.4 0z" fill={active ? "#ffa116" : "#6b7280"} />
    <path d="M19.7 10.2l-4.7-4.7c-.4-.4-1-.4-1.4 0l-.7.7c-.4.4-.4 1 0 1.4l3.3 3.3-3.3 3.3c-.4.4-.4 1 0 1.4l.7.7c.4.4 1 .4 1.4 0l4.7-4.7c.4-.4.4-1 0-1.4z" fill={active ? "#b45309" : "#4b5563"} />
  </svg>
);

// CSES Logo (book style)
const CSESLogo = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#ea580c" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: active ? "drop-shadow(0 0 8px #ea580c)" : "none", transition: "filter 0.3s" }}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8" />
    <path d="M8 11h6" />
  </svg>
);

// CP-31 Sheet Logo (numbered list with badge)
const CP31Logo = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ filter: active ? "drop-shadow(0 0 8px #22c55e)" : "none", transition: "filter 0.3s" }}>
    <rect x="3" y="3" width="18" height="18" rx="3" fill={active ? "rgba(34, 197, 94, 0.15)" : "rgba(107, 114, 128, 0.1)"} stroke={active ? "#22c55e" : "#4b5563"} strokeWidth="1.5"/>
    <text x="7" y="11" fontSize="6" fontWeight="bold" fill={active ? "#22c55e" : "#6b7280"}>CP</text>
    <text x="6" y="18" fontSize="7" fontWeight="bold" fill={active ? "#4ade80" : "#6b7280"}>31</text>
  </svg>
);

// Striver A2Z Logo (layered stacks)
const A2ZLogo = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ filter: active ? "drop-shadow(0 0 8px #8b5cf6)" : "none", transition: "filter 0.3s" }}>
    <path d="M12 2L3 7l9 5 9-5-9-5z" fill={active ? "rgba(139, 92, 246, 0.3)" : "rgba(107, 114, 128, 0.2)"} stroke={active ? "#8b5cf6" : "#4b5563"} strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M3 12l9 5 9-5" stroke={active ? "#a78bfa" : "#6b7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 17l9 5 9-5" stroke={active ? "#c4b5fd" : "#9ca3af"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Sidebar = ({ activeTab, setActiveTab, onToggle, isOpen }) => {
  
  const renderIcon = (id, Icon, label, color = "var(--accent-primary)") => (
    <div 
        onClick={() => setActiveTab(id === activeTab && isOpen ? null : id)}
        data-tooltip={label}
        style={{
            width: "50px",
            height: "50px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            color: activeTab === id && isOpen ? "white" : "var(--text-muted)",
            borderLeft: activeTab === id && isOpen ? `3px solid ${color}` : "3px solid transparent",
            background: activeTab === id && isOpen ? "rgba(255,255,255,0.03)" : "transparent",
            transition: "all 0.2s var(--ease-smooth)",
            position: "relative"
        }}
        className="sidebar-icon"
    >
        <Icon size={20} strokeWidth={activeTab === id ? 2 : 1.5} style={{ filter: activeTab === id && isOpen ? `drop-shadow(0 0 8px ${color})` : "none", transition: "filter 0.3s" }} />
    </div>
  );

  const renderPlatformIcon = (id, Logo, label, color) => (
    <div 
        onClick={() => setActiveTab(id === activeTab && isOpen ? null : id)}
        data-tooltip={label}
        style={{
            width: "50px",
            height: "50px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            borderLeft: activeTab === id && isOpen ? `3px solid ${color}` : "3px solid transparent",
            background: activeTab === id && isOpen ? "rgba(255,255,255,0.03)" : "transparent",
            transition: "all 0.25s var(--ease-smooth)",
            position: "relative"
        }}
        className="sidebar-icon"
    >
        <Logo active={activeTab === id && isOpen} />
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-dark)", borderRight: "1px solid var(--border-subtle)", zIndex: 50 }}>
        {/* ICON BAR */}
        <div style={{ width: "50px", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", borderRight: isOpen ? "1px solid var(--border-subtle)" : "none", background: "var(--bg-dark)", zIndex: 20 }}>
            <div style={{ height: "12px" }} />
            
            {/* Core Tools */}
            {renderIcon("files", Files, "Explorer", "#8b5cf6")}
            {renderIcon("participants", Users, "Participants", "#22c55e")}
            
            {/* SEPARATOR - Problem Sets */}
            <div style={{ width: "24px", height: "1px", background: "linear-gradient(90deg, transparent, var(--border-subtle), transparent)", margin: "10px 0" }} />
            <div style={{ fontSize: "8px", color: "#4b5563", letterSpacing: "1px", marginBottom: "6px" }}>PROBLEMS</div>

            {/* Platform Icons */}
            {renderPlatformIcon("codeforces", CodeforcesLogo, "Codeforces", "#3b82f6")}
            {renderPlatformIcon("cses", CSESLogo, "CSES Problem Set", "#ea580c")}
            {renderPlatformIcon("leetcode", LeetCodeLogo, "LeetCode", "#ffa116")}
            
            {/* SEPARATOR - Sheets */}
            <div style={{ width: "24px", height: "1px", background: "linear-gradient(90deg, transparent, var(--border-subtle), transparent)", margin: "10px 0" }} />
            <div style={{ fontSize: "8px", color: "#4b5563", letterSpacing: "1px", marginBottom: "6px" }}>SHEETS</div>

            {/* Sheet Icons */}
            {renderPlatformIcon("cp31", CP31Logo, "CP-31 Sheet", "#22c55e")}
            {renderPlatformIcon("a2z", A2ZLogo, "Striver's A2Z DSA", "#8b5cf6")}

            {/* SEPARATOR - Tools */}
            <div style={{ width: "24px", height: "1px", background: "linear-gradient(90deg, transparent, var(--border-subtle), transparent)", margin: "10px 0" }} />
            <div style={{ fontSize: "8px", color: "#4b5563", letterSpacing: "1px", marginBottom: "6px" }}>TOOLS</div>

            {renderIcon("tests", FlaskConical, "Test Cases", "#eab308")}
            {renderIcon("whiteboard", PenTool, "Whiteboard", "#ec4899")}
            {renderIcon("recording", Video, "Record Solution", "#ef4444")}

            <div style={{ flex: 1 }} />
            
            {/* Bottom Settings */}
            <div style={{ width: "24px", height: "1px", background: "linear-gradient(90deg, transparent, var(--border-subtle), transparent)", margin: "8px 0" }} />
            {renderIcon("settings", Settings, "Settings", "#71717a")}
            <div style={{ height: "12px" }} />
        </div>
    </div>
  );
};
export default React.memo(Sidebar);
