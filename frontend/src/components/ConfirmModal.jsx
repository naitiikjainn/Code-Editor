import React from "react";
import { AlertTriangle, X } from "lucide-react";

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Delete", cancelText = "Cancel", danger = true }) => {
    if (!isOpen) return null;

    return (
        <div 
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(8px)",
                animation: "fadeInScale 0.25s ease-out"
            }}
            onClick={onCancel}
        >
            <div 
                style={{
                    background: "rgba(28,28,30,0.92)",
                    backdropFilter: "blur(40px) saturate(180%)",
                    borderRadius: "18px",
                    padding: "24px",
                    width: "min(400px, 90vw)",
                    boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.08)"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "16px" }}>
                    <div style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: danger ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                    }}>
                        <AlertTriangle size={24} color={danger ? "#ef4444" : "#3b82f6"} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ 
                            margin: 0, 
                            fontSize: "18px", 
                            fontWeight: "600", 
                            color: "#fff",
                            marginBottom: "8px"
                        }}>
                            {title}
                        </h3>
                        <p style={{ 
                            margin: 0, 
                            fontSize: "14px", 
                            color: "#9ca3af",
                            lineHeight: "1.5"
                        }}>
                            {message}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "6px",
                            borderRadius: "8px",
                            display: "flex",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: "10px 20px",
                            borderRadius: "12px",
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#d1d5db",
                            fontSize: "14px",
                            fontWeight: "500",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: "10px 20px",
                            borderRadius: "12px",
                            border: "none",
                            background: danger ? "#ef4444" : "#fff",
                            color: danger ? "#fff" : "#000",
                            fontSize: "14px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.opacity = "0.9"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.opacity = "1"; }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>

        </div>
    );
};

export default ConfirmModal;
