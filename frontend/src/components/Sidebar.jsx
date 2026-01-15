import React, { useState } from "react";
import { Files, MessageSquare, Settings, FolderOpen, ChevronLeft, Users, FlaskConical, Trophy, PenTool, ListOrdered } from "lucide-react";

export default function Sidebar({ activeTab, setActiveTab, onToggle, isOpen }) {
  
  const renderIcon = (id, Icon, label) => (
    <div 
        onClick={() => setActiveTab(id === activeTab && isOpen ? null : id)}
        title={label}
        style={{
            width: "48px",
            height: "48px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            color: activeTab === id && isOpen ? "white" : "var(--text-muted)",
            borderLeft: activeTab === id && isOpen ? "2px solid var(--accent-primary)" : "2px solid transparent",
            background: activeTab === id && isOpen ? "var(--bg-hover)" : "transparent",
            transition: "all 0.2s"
        }}
    >
        <Icon size={22} strokeWidth={1.5} />
    </div>
  );

    return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg-dark)", borderRight: "1px solid var(--border-subtle)" }}>
        {/* ICON BAR */}
        <div style={{ width: "48px", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", borderRight: isOpen ? "1px solid var(--border-subtle)" : "none", background: "#111", zIndex: 20 }}>
            {renderIcon("files", Files, "Explorer")}
            {renderIcon("participants", Users, "Participants")}
            
            {/* CODEFORCES */}
            <div 
                onClick={() => setActiveTab(activeTab === "codeforces" && isOpen ? null : "codeforces")}
                title="Codeforces"
                style={{
                    width: "48px", height: "48px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "codeforces" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "codeforces" && isOpen ? "2px solid #3b82f6" : "2px solid transparent",
                    background: activeTab === "codeforces" && isOpen ? "var(--bg-hover)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="9" width="6" height="12" rx="2" fill="#FFC107"/>
                    <rect x="9" y="4" width="6" height="17" rx="2" fill="#2196F3"/>
                    <rect x="16" y="9" width="6" height="12" rx="2" fill="#F44336"/>
               </svg>
            </div>

            {/* CSES */}
            <div 
                onClick={() => setActiveTab(activeTab === "cses" && isOpen ? null : "cses")}
                title="CSES Problem Set"
                style={{
                    width: "48px", height: "48px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "cses" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "cses" && isOpen ? "2px solid #ea580c" : "2px solid transparent",
                    background: activeTab === "cses" && isOpen ? "var(--bg-hover)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
                {/* Simple Logo for CSES (Orange square/Book) */}
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
               </svg>
            </div>

            {/* LEETCODE */}
            <div 
                onClick={() => setActiveTab(activeTab === "leetcode" && isOpen ? null : "leetcode")}
                title="LeetCode"
                style={{
                    width: "48px", height: "48px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "leetcode" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "leetcode" && isOpen ? "2px solid #ffa116" : "2px solid transparent",
                    background: activeTab === "leetcode" && isOpen ? "var(--bg-hover)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.483 0a1.374 1.374 0 0 0-.961.403L5.36 7.565l-2.454-2.452-.036-.036a1.272 1.272 0 0 0-1.802 0 1.272 1.272 0 0 0 0 1.802l3.393 3.393L.403 14.331a1.277 1.277 0 0 0 0 1.805 1.27 1.27 0 0 0 1.805 0l4.058-4.058 7.217 7.217a1.375 1.375 0 0 0 2.336-.972c0-.363-.143-.714-.403-.972l-6.248-6.248L15.357 5.01a1.275 1.275 0 1 0-1.805-1.805L7.494 9.263 12.522 4.234a1.374 1.374 0 0 0 .961-4.234z" fill="#FFA116"/>
               </svg>
            </div>

            {/* CP-31 SHEET */}
            <div 
                onClick={() => setActiveTab(activeTab === "cp31" && isOpen ? null : "cp31")}
                title="CP-31 Sheet"
                style={{
                    width: "48px", height: "48px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "cp31" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "cp31" && isOpen ? "2px solid #22c55e" : "2px solid transparent",
                    background: activeTab === "cp31" && isOpen ? "var(--bg-hover)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <ListOrdered size={22} />
            </div>

            {/* A2Z DSA SHEET */}
            <div 
                onClick={() => setActiveTab(activeTab === "a2z" && isOpen ? null : "a2z")}
                title="Striver's A2Z DSA Sheet"
                style={{
                    width: "48px", height: "48px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer",
                    color: activeTab === "a2z" && isOpen ? "white" : "var(--text-muted)",
                    borderLeft: activeTab === "a2z" && isOpen ? "2px solid #8b5cf6" : "2px solid transparent",
                    background: activeTab === "a2z" && isOpen ? "var(--bg-hover)" : "transparent",
                    transition: "all 0.2s"
                }}
            >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
               </svg>
            </div>

            {renderIcon("tests", FlaskConical, "Test Cases")}
            {renderIcon("whiteboard", PenTool, "Whiteboard (Drag & Draw)")}
            <div style={{ flex: 1 }} />
            {renderIcon("settings", Settings, "Settings")}
        </div>
    </div>
  );
}
