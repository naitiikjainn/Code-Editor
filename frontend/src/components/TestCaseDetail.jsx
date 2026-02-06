import React, { useState } from "react";
import { Copy, Check, CheckCircle2, XCircle, AlertTriangle, Clock, MinusCircle } from "lucide-react";

const VERDICT_CONFIG = {
    AC: { label: "Accepted", color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: CheckCircle2 },
    WA: { label: "Wrong Answer", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: XCircle },
    TLE: { label: "Time Limit Exceeded", color: "#eab308", bg: "rgba(234,179,8,0.12)", icon: Clock },
    MLE: { label: "Memory Limit Exceeded", color: "#f97316", bg: "rgba(249,115,22,0.12)", icon: AlertTriangle },
    RE: { label: "Runtime Error", color: "#f97316", bg: "rgba(249,115,22,0.12)", icon: AlertTriangle },
    CE: { label: "Compilation Error", color: "#3b82f6", bg: "rgba(59,130,246,0.12)", icon: AlertTriangle },
};

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <button
            onClick={handleCopy}
            style={{
                background: "none",
                border: "none",
                color: copied ? "#22c55e" : "#71717a",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s",
            }}
            title="Copy"
        >
            {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
    );
}

function DataPanel({ label, content, color }) {
    const isTruncated = content && content.endsWith("...");

    return (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: color ? `${color}08` : "transparent",
            }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: color || "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {label}
                </span>
                <CopyButton text={content} />
            </div>
            <pre style={{
                margin: 0,
                padding: "10px 12px",
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
                color: "#e4e4e7",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                overflowY: "auto",
                flex: 1,
                minHeight: 60,
                maxHeight: 250,
            }}>
                {content || "(empty)"}
            </pre>
            {isTruncated && (
                <div style={{ padding: "4px 10px", fontSize: 10, color: "#71717a", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    Output was truncated to 500 characters
                </div>
            )}
        </div>
    );
}

export default function TestCaseDetail({ selectedTest, firstFailedTest, firstFailedInput, firstFailedExpected, firstFailedActual, testResults }) {
    // Find the test result for the selected test
    const result = testResults?.find(r => r.testNumber === selectedTest);
    const verdict = result?.verdict || null;
    const config = verdict ? VERDICT_CONFIG[verdict] : null;
    const isFirstFailed = selectedTest === firstFailedTest;

    if (!selectedTest) {
        return (
            <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#52525b",
                fontSize: 13,
                padding: 24,
            }}>
                Click a test case above to see details
            </div>
        );
    }

    // "Not Run" test
    if (!verdict) {
        return (
            <div style={{ flex: 1, padding: 20 }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "rgba(39,39,42,0.4)",
                    border: "1px solid rgba(255,255,255,0.06)",
                }}>
                    <MinusCircle size={18} color="#71717a" />
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa" }}>
                            Test #{selectedTest} — Not Run
                        </div>
                        <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>
                            Judging stopped at an earlier test case. This test was not executed.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const Icon = config?.icon || CheckCircle2;

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Verdict header */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
                <Icon size={16} color={config?.color || "#71717a"} />
                <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: config?.color || "#a1a1aa",
                }}>
                    Test #{selectedTest} — {config?.label || verdict}
                </span>
                {result?.time != null && (
                    <span style={{ fontSize: 12, color: "#71717a", marginLeft: "auto" }}>
                        {result.time}ms
                    </span>
                )}
            </div>

            {/* Content area */}
            {verdict === "AC" && !isFirstFailed ? (
                <div style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    color: "#52525b",
                    fontSize: 13,
                    textAlign: "center",
                    lineHeight: 1.6,
                }}>
                    This test passed successfully.<br />
                    Input/output details are only available for the first failed test.
                </div>
            ) : isFirstFailed && firstFailedInput != null ? (
                <div style={{
                    flex: 1,
                    display: "flex",
                    gap: 1,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.02)",
                }}>
                    <DataPanel label="Input" content={firstFailedInput} />
                    <DataPanel label="Expected" content={firstFailedExpected} color="#22c55e" />
                    <DataPanel label="Your Output" content={firstFailedActual} color="#ef4444" />
                </div>
            ) : (
                <div style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    color: "#52525b",
                    fontSize: 13,
                }}>
                    Detailed input/output not available for this test case.
                </div>
            )}
        </div>
    );
}
