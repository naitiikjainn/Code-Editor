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
                background: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(4px)",
                animation: "fadeIn 0.15s ease-out"
            }}
            onClick={onCancel}
        >
            <div 
                style={{
                    background: "linear-gradient(145deg, #1a1a1f, #0d0d10)",
                    borderRadius: "16px",
                    padding: "24px",
                    width: "min(400px, 90vw)",
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
                    animation: "scaleIn 0.2s ease-out"
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
                            background: "transparent",
                            border: "none",
                            color: "#6b7280",
                            cursor: "pointer",
                            padding: "4px",
                            borderRadius: "6px",
                            display: "flex",
                            transition: "all 0.15s"
                        }}
                        onMouseEnter={(e) => e.target.style.color = "#fff"}
                        onMouseLeave={(e) => e.target.style.color = "#6b7280"}
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
                            borderRadius: "10px",
                            border: "1px solid #374151",
                            background: "transparent",
                            color: "#d1d5db",
                            fontSize: "14px",
                            fontWeight: "500",
                            cursor: "pointer",
                            transition: "all 0.15s"
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = "#374151";
                            e.target.style.borderColor = "#4b5563";
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = "transparent";
                            e.target.style.borderColor = "#374151";
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: "10px 20px",
                            borderRadius: "10px",
                            border: "none",
                            background: danger 
                                ? "linear-gradient(135deg, #dc2626, #b91c1c)" 
                                : "linear-gradient(135deg, #3b82f6, #2563eb)",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            boxShadow: danger 
                                ? "0 4px 14px rgba(220, 38, 38, 0.4)" 
                                : "0 4px 14px rgba(59, 130, 246, 0.4)"
                        }}
                        onMouseEnter={(e) => e.target.style.transform = "translateY(-1px)"}
                        onMouseLeave={(e) => e.target.style.transform = "translateY(0)"}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default ConfirmModal;
