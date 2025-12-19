import React, { useState } from "react";
import { Files, MessageSquare, Settings, FolderOpen, ChevronLeft } from "lucide-react";

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
            <div style={{ flex: 1 }} />
            {renderIcon("settings", Settings, "Settings")}
        </div>
    </div>
  );
}
