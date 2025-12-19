import React, { useState } from "react";
import { FileCode, File, FolderOpen, Trash2, Plus, FilePlus } from "lucide-react";
import { API_URL } from "../config";

export default function FileExplorer({ files, onSelect, onDelete, onCreate, activeFileId }) {
    const [isCreating, setIsCreating] = useState(false);
    const [newFileName, setNewFileName] = useState("");

    const handleCreate = async () => {
        if (!newFileName.trim()) return setIsCreating(false);
        await onCreate(newFileName);
        setNewFileName("");
        setIsCreating(false);
    };

    return (
        <div style={{ padding: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Explorer</div>
                <button 
                    onClick={() => setIsCreating(true)} 
                    title="New File"
                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }}
                    onMouseEnter={(e) => e.target.style.color = "white"}
                    onMouseLeave={(e) => e.target.style.color = "var(--text-muted)"}
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* FOLDER ROOT */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px", background: "var(--bg-surface)", borderRadius: "6px", fontSize: "13px", marginBottom: "10px", color: "var(--text-main)" }}>
                <FolderOpen size={16} color="var(--accent-secondary)" /> 
                <span style={{ fontWeight: "600" }}>Project Root</span>
            </div>

            {/* FILE LIST */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {files.map(file => (
                    <div 
                        key={file._id}
                        onClick={() => onSelect(file)}
                        className="file-item"
                        style={{
                           display: "flex", 
                           justifyContent: "space-between",
                           alignItems: "center",
                           padding: "6px 8px", 
                           cursor: "pointer",
                           fontSize: "13px",
                           borderRadius: "4px",
                           background: activeFileId === file._id ? "var(--bg-active)" : "transparent",
                           color: activeFileId === file._id ? "white" : "var(--text-muted)",
                           borderLeft: activeFileId === file._id ? "2px solid var(--accent-primary)" : "2px solid transparent",
                           transition: "background 0.2s"
                        }}
                    >
                       <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                           <FileCode size={14} color={file.language === "html" ? "#e34c26" : (file.language === "css" ? "#563d7c" : (file.language === "javascript" ? "#f1e05a" : "#3572A5"))} />
                           <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</span>
                       </div>
                       
                       <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(file._id); }}
                          className="delete-btn"
                          title="Delete"
                          style={{
                              background: "transparent",
                              border: "none",
                              color: "#ef5350",
                              opacity: activeFileId === file._id ? 1 : 0, 
                              cursor: "pointer",
                              display: "flex"
                          }}
                       >
                           <Trash2 size={12} />
                       </button>
                    </div>
                ))}

                {/* CREATE NEW INPUT */}
                {isCreating && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px" }}>
                        <FilePlus size={14} color="var(--text-muted)" />
                        <input 
                            autoFocus
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onBlur={handleCreate}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            style={{ background: "transparent", border: "1px solid var(--accent-primary)", borderRadius: "2px", color: "white", width: "100%", fontSize: "13px", padding: "2px 4px", outline: "none" }} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
