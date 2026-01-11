import React, { useState, useEffect } from "react";
import { Save, KeyRound, ChevronRight, FileCode, ChevronLeft } from "lucide-react";

export default function SettingsPanel() {
  const [view, setView] = useState("menu"); // "menu" or "template"
  const [cppTemplate, setCppTemplate] = useState("");

  useEffect(() => {
    setCppTemplate(localStorage.getItem("user_cpp_template") || "");
  }, []);

  const handleSave = () => {
    localStorage.setItem("user_cpp_template", cppTemplate);
    alert("Settings Saved!");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0f0f0f", color: "#eee" }}>
        
        {/* Header */}
        <div style={{ padding: "16px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: "10px", background: "#111" }}>
             {view === "menu" ? (
                 <KeyRound size={18} color="#8b5cf6" />
             ) : (
                 <button onClick={() => setView("menu")} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", display: "flex", padding: 0 }}>
                     <ChevronLeft size={18} />
                 </button>
             )}
             <span style={{ fontWeight: "600", fontSize: "14px" }}>
                 {view === "menu" ? "Settings" : "Edit Template"}
             </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
            
            {/* View: Menu */}
            {view === "menu" && (
                <div style={{ padding: "8px" }}>
                    <div 
                        onClick={() => setView("template")}
                        style={{ 
                            padding: "12px", borderRadius: "8px", background: "#161616", 
                            display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                            border: "1px solid #222", transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#222"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "#161616"}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ padding: "8px", background: "rgba(139, 92, 246, 0.1)", borderRadius: "6px" }}>
                                <FileCode size={18} color="#8b5cf6" />
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: "500" }}>Add or Edit Template</div>
                        </div>
                        <ChevronRight size={16} color="#666" />
                        </div>
                </div>
            )}

            {/* View: Template Editor */}
            {view === "template" && (
                <div style={{ padding: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
                    <p style={{ fontSize: "12px", color: "#666", marginBottom: "12px", lineHeight: "1.4" }}>
                        Define your custom boilerplate for new Codeforces/CP problems.
                    </p>
                    
                    <textarea 
                        value={cppTemplate}
                        onChange={(e) => setCppTemplate(e.target.value)}
                        placeholder="#include <bits/stdc++.h>..."
                        style={{
                            flex: 1, width: "100%", padding: "12px", borderRadius: "6px",
                            background: "#0a0a0a", border: "1px solid #333",
                            color: "#eee", fontFamily: "'Fira Code', monospace", fontSize: "12px", 
                             boxSizing: "border-box", lineHeight: "1.5", outline: "none", marginBottom: "16px"
                        }}
                        spellCheck="false"
                    />

                    <button 
                        onClick={handleSave} 
                        className="btn-primary" 
                        style={{ 
                            width: "100%", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            background: "#8b5cf6"
                        }}
                    >
                        <Save size={16} /> Save Changes
                    </button>
                    <div style={{ height: "40px" }} />
                </div>
            )}

        </div>
    </div>
  );
}
