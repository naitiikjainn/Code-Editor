import React, { useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";

const VERDICT_CONFIG = {
    "Accepted": { color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: CheckCircle2, short: "AC" },
    "Wrong Answer": { color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: XCircle, short: "WA" },
    "Time Limit Exceeded": { color: "#eab308", bg: "rgba(234,179,8,0.12)", icon: Clock, short: "TLE" },
    "Memory Limit Exceeded": { color: "#f97316", bg: "rgba(249,115,22,0.12)", icon: AlertTriangle, short: "MLE" },
    "Runtime Error": { color: "#f97316", bg: "rgba(249,115,22,0.12)", icon: AlertTriangle, short: "RE" },
    "Compilation Error": { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: AlertTriangle, short: "CE" },
    "Judge Error": { color: "#71717a", bg: "rgba(113,113,122,0.12)", icon: AlertTriangle, short: "ERR" },
    "Judging": { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", icon: Loader2, short: "..." },
};

function timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

const LANG_LABELS = {
    cpp: "C++",
    "c++": "C++",
    python: "Python",
    python3: "Python",
    java: "Java",
    javascript: "JS",
    js: "JS",
};

export default function SubmissionHistory({ submissions, activeSubmissionId, onSelectSubmission, loading }) {
    const [hoveredId, setHoveredId] = useState(null);

    if (loading) {
        return (
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                gap: 8,
                color: "#71717a",
                fontSize: 12,
            }}>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                Loading history...
            </div>
        );
    }

    if (!submissions || submissions.length === 0) {
        return (
            <div style={{
                padding: 20,
                textAlign: "center",
                color: "#52525b",
                fontSize: 12,
            }}>
                No previous submissions
            </div>
        );
    }

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
        }}>
            <div style={{
                padding: "10px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                position: "sticky",
                top: 0,
                background: "#111113",
                zIndex: 1,
            }}>
                Submissions ({submissions.length})
            </div>
            {submissions.map(sub => {
                const isActive = sub._id === activeSubmissionId;
                const isHovered = hoveredId === sub._id;
                const cfg = VERDICT_CONFIG[sub.verdict] || VERDICT_CONFIG["Judge Error"];
                const Icon = cfg.icon;
                const passed = sub.judgeResult?.passedTests ?? "?";
                const total = sub.judgeResult?.totalTests ?? "?";
                const lang = LANG_LABELS[sub.language] || sub.language;

                return (
                    <div
                        key={sub._id}
                        onClick={() => onSelectSubmission(sub._id)}
                        onMouseEnter={() => setHoveredId(sub._id)}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            borderLeft: `3px solid ${isActive ? cfg.color : "transparent"}`,
                            background: isActive ? "rgba(255,255,255,0.04)" : isHovered ? "rgba(255,255,255,0.02)" : "transparent",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            transition: "all 0.15s ease",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <Icon
                                size={14}
                                color={cfg.color}
                                style={sub.verdict === "Judging" ? { animation: "spin 1s linear infinite" } : {}}
                            />
                            <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>
                                {cfg.short}
                            </span>
                            <span style={{ fontSize: 11, color: "#52525b", marginLeft: "auto" }}>
                                {passed}/{total}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{
                                fontSize: 10,
                                color: "#52525b",
                                background: "rgba(255,255,255,0.04)",
                                padding: "1px 6px",
                                borderRadius: 4,
                            }}>
                                {lang}
                            </span>
                            <span style={{ fontSize: 10, color: "#52525b" }}>
                                {timeAgo(sub.createdAt)}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
