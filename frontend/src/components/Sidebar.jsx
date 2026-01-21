import React, { useState } from "react";
import { Files, MessageSquare, Settings, FolderOpen, ChevronLeft, Users, FlaskConical, Trophy, PenTool, ListOrdered } from "lucide-react";

export default function Sidebar({ activeTab, setActiveTab, onToggle, isOpen }) {
  
  const renderIcon = (id, Icon, label, color = "var(--accent-primary)") => (
    <div 
        onClick={() => setActiveTab(id === activeTab && isOpen ? null : id)}
        data-tooltip={label} /* Pure CSS Tooltip */
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

    return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-dark)", borderRight: "1px solid var(--border-subtle)", zIndex: 50 }}>
        {/* ICON BAR */}
        <div style={{ width: "50px", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", borderRight: isOpen ? "1px solid var(--border-subtle)" : "none", background: "var(--bg-dark)", zIndex: 20 }}>
            <div style={{ height: "10px" }} />
            {renderIcon("files", Files, "Explorer", "#8b5cf6")}
            {renderIcon("participants", Users, "Participants", "#22c55e")}
            
            {/* SEPARATOR */}
            <div style={{ width: "20px", height: "1px", background: "var(--border-subtle)", margin: "8px 0" }} />

            {/* CODEFORCES */}
            <div 
                onClick={() => setActiveTab(activeTab === "codeforces" && isOpen ? null : "codeforces")}
                data-tooltip="Codeforces"
                style={{
                    width: "50px", height: "50px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "codeforces" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "codeforces" && isOpen ? "3px solid #3b82f6" : "3px solid transparent",
                    background: activeTab === "codeforces" && isOpen ? "rgba(255,255,255,0.03)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: activeTab === "codeforces" && isOpen ? "drop-shadow(0 0 8px #3b82f6)" : "none" }}>
                    <rect x="2" y="9" width="6" height="12" rx="2" fill="#FFC107"/>
                    <rect x="9" y="4" width="6" height="17" rx="2" fill="#2196F3"/>
                    <rect x="16" y="9" width="6" height="12" rx="2" fill="#F44336"/>
               </svg>
            </div>

            {/* CSES */}
            <div 
                onClick={() => setActiveTab(activeTab === "cses" && isOpen ? null : "cses")}
                data-tooltip="CSES Problem Set"
                style={{
                    width: "50px", height: "50px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "cses" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "cses" && isOpen ? "3px solid #ea580c" : "3px solid transparent",
                    background: activeTab === "cses" && isOpen ? "rgba(255,255,255,0.03)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: activeTab === "cses" && isOpen ? "drop-shadow(0 0 8px #ea580c)" : "none" }}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
               </svg>
            </div>

            {/* LEETCODE */}
            <div 
                onClick={() => setActiveTab(activeTab === "leetcode" && isOpen ? null : "leetcode")}
                data-tooltip="LeetCode"
                style={{
                    width: "50px", height: "50px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "leetcode" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "leetcode" && isOpen ? "3px solid #ffa116" : "3px solid transparent",
                    background: activeTab === "leetcode" && isOpen ? "rgba(255,255,255,0.03)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ filter: activeTab === "leetcode" && isOpen ? "drop-shadow(0 0 8px #ffa116)" : "none" }}>
                    <path d="M13.483 0a1.374 1.374 0 0 0-.961.403L5.36 7.565l-2.454-2.452-.036-.036a1.272 1.272 0 0 0-1.802 0 1.272 1.272 0 0 0 0 1.802l3.393 3.393L.403 14.331a1.277 1.277 0 0 0 0 1.805 1.27 1.27 0 0 0 1.805 0l4.058-4.058 7.217 7.217a1.375 1.375 0 0 0 2.336-.972c0-.363-.143-.714-.403-.972l-6.248-6.248L15.357 5.01a1.275 1.275 0 1 0-1.805-1.805L7.494 9.263 12.522 4.234a1.374 1.374 0 0 0 .961-4.234z" fill="#FFA116"/>
               </svg>
            </div>

            {/* CP-31 SHEET */}
            <div 
                onClick={() => setActiveTab(activeTab === "cp31" && isOpen ? null : "cp31")}
                data-tooltip="CP-31 Sheet"
                style={{
                    width: "50px", height: "50px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "cp31" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "cp31" && isOpen ? "3px solid #22c55e" : "3px solid transparent",
                    background: activeTab === "cp31" && isOpen ? "rgba(255,255,255,0.03)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <ListOrdered size={22} style={{ filter: activeTab === "cp31" && isOpen ? "drop-shadow(0 0 8px #22c55e)" : "none" }} />
            </div>

            {/* A2Z DSA SHEET */}
            <div 
                onClick={() => setActiveTab(activeTab === "a2z" && isOpen ? null : "a2z")}
                data-tooltip="Striver's A2Z Sheet"
                style={{
                    width: "50px", height: "50px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "a2z" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "a2z" && isOpen ? "3px solid #8b5cf6" : "3px solid transparent",
                    background: activeTab === "a2z" && isOpen ? "rgba(255,255,255,0.03)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: activeTab === "a2z" && isOpen ? "drop-shadow(0 0 8px #8b5cf6)" : "none" }}>
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
               </svg>
            </div>

            {/* SEPARATOR */}
            <div style={{ width: "20px", height: "1px", background: "var(--border-subtle)", margin: "8px 0" }} />

            {renderIcon("tests", FlaskConical, "Test Cases", "#eab308")}
            {renderIcon("whiteboard", PenTool, "Whiteboard", "#ec4899")}

            <div style={{ flex: 1 }} />
            {renderIcon("settings", Settings, "Settings", "#a1a1aa")}
            <div style={{ height: "10px" }} />
        </div>
    </div>
  );
}
