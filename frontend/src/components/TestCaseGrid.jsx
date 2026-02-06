import React, { useState } from "react";

const VERDICT_COLORS = {
    AC: { bg: "rgba(34,197,94,0.18)", border: "#22c55e", text: "#22c55e" },
    WA: { bg: "rgba(239,68,68,0.18)", border: "#ef4444", text: "#ef4444" },
    TLE: { bg: "rgba(234,179,8,0.18)", border: "#eab308", text: "#eab308" },
    MLE: { bg: "rgba(249,115,22,0.18)", border: "#f97316", text: "#f97316" },
    RE: { bg: "rgba(249,115,22,0.18)", border: "#f97316", text: "#f97316" },
    CE: { bg: "rgba(59,130,246,0.18)", border: "#3b82f6", text: "#3b82f6" },
};

const NOT_RUN = { bg: "rgba(39,39,42,0.5)", border: "#3f3f46", text: "#71717a" };

const VERDICT_LABELS = {
    AC: "Accepted",
    WA: "Wrong Answer",
    TLE: "Time Limit Exceeded",
    MLE: "Memory Limit Exceeded",
    RE: "Runtime Error",
    CE: "Compilation Error",
};

export default function TestCaseGrid({ totalTests, testResults, selectedTest, onSelectTest }) {
    const [hoveredTest, setHoveredTest] = useState(null);

    // Build lookup map from testResults
    const resultMap = {};
    if (testResults) {
        for (const r of testResults) {
            resultMap[r.testNumber] = r;
        }
    }

    const boxes = [];
    for (let i = 1; i <= totalTests; i++) {
        const result = resultMap[i];
        const verdict = result?.verdict || null;
        const colors = verdict ? (VERDICT_COLORS[verdict] || NOT_RUN) : NOT_RUN;
        const isSelected = selectedTest === i;
        const isHovered = hoveredTest === i;
        const label = verdict ? VERDICT_LABELS[verdict] || verdict : "Not Run";
        const timeStr = result?.time != null ? ` (${result.time}ms)` : "";

        boxes.push(
            <div
                key={i}
                onClick={() => onSelectTest(i)}
                onMouseEnter={() => setHoveredTest(i)}
                onMouseLeave={() => setHoveredTest(null)}
                title={`Test ${i}: ${label}${timeStr}`}
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                    color: isSelected ? "#fff" : colors.text,
                    background: isSelected ? colors.border : isHovered ? colors.bg : colors.bg,
                    border: `2px solid ${isSelected ? "#fff" : isHovered ? colors.border : "transparent"}`,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    userSelect: "none",
                    opacity: !verdict ? 0.5 : 1,
                }}
            >
                {i}
            </div>
        );
    }

    return (
        <div style={{ padding: "12px 16px" }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
            }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#f4f4f5" }}>
                    Test Cases
                </span>
                <div style={{ display: "flex", gap: 10, marginLeft: "auto", fontSize: 11, color: "#71717a" }}>
                    {[
                        { label: "AC", color: "#22c55e" },
                        { label: "WA", color: "#ef4444" },
                        { label: "TLE", color: "#eab308" },
                        { label: "RE", color: "#f97316" },
                        { label: "N/A", color: "#3f3f46" },
                    ].map(l => (
                        <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{
                                width: 8, height: 8, borderRadius: 2,
                                background: l.color, display: "inline-block",
                            }} />
                            {l.label}
                        </span>
                    ))}
                </div>
            </div>
            <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
            }}>
                {boxes}
            </div>
        </div>
    );
}
