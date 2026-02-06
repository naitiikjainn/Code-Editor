import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ExternalLink, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2, Code2 } from "lucide-react";
import { API_URL } from "../config";
import TestCaseGrid from "./TestCaseGrid";
import TestCaseDetail from "./TestCaseDetail";
import SubmissionHistory from "./SubmissionHistory";

const VERDICT_CONFIG = {
    "Accepted": { color: "#22c55e", bg: "rgba(34,197,94,0.15)", icon: CheckCircle2 },
    "Wrong Answer": { color: "#ef4444", bg: "rgba(239,68,68,0.15)", icon: XCircle },
    "Time Limit Exceeded": { color: "#eab308", bg: "rgba(234,179,8,0.15)", icon: Clock },
    "Memory Limit Exceeded": { color: "#f97316", bg: "rgba(249,115,22,0.15)", icon: AlertTriangle },
    "Runtime Error": { color: "#f97316", bg: "rgba(249,115,22,0.15)", icon: AlertTriangle },
    "Compilation Error": { color: "#3b82f6", bg: "rgba(59,130,246,0.15)", icon: AlertTriangle },
    "Judge Error": { color: "#71717a", bg: "rgba(113,113,122,0.15)", icon: AlertTriangle },
    "Judging": { color: "#a78bfa", bg: "rgba(167,139,250,0.15)", icon: Loader2 },
};

const LANG_MAP = {
    cpp: "cpp",
    "c++": "cpp",
    python: "python",
    python3: "python",
    java: "java",
    javascript: "javascript",
    js: "javascript",
};

let MonacoEditor = null;

export default function CSESResultModal({ isOpen, onClose, submission, submissionId, problemId, user }) {
    const [activeSubmission, setActiveSubmission] = useState(null);
    const [selectedTest, setSelectedTest] = useState(null);
    const [pastSubmissions, setPastSubmissions] = useState([]);
    const [loadingSubmission, setLoadingSubmission] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [activeTab, setActiveTab] = useState("results"); // "results" | "code"
    const [editorLoaded, setEditorLoaded] = useState(false);
    const fetchIdRef = useRef(0);

    // Lazy load Monaco Editor
    useEffect(() => {
        if (isOpen && !MonacoEditor) {
            import("@monaco-editor/react").then(mod => {
                MonacoEditor = mod.default;
                setEditorLoaded(true);
            });
        }
    }, [isOpen]);

    // Initialize activeSubmission
    useEffect(() => {
        if (!isOpen) return;

        if (submission) {
            setActiveSubmission(submission);
            autoSelectTest(submission);
        } else if (submissionId) {
            fetchSubmission(submissionId);
        }
    }, [isOpen, submission, submissionId]);

    // Fetch past submissions when we know the problemId
    useEffect(() => {
        if (!isOpen || !activeSubmission) return;
        const pid = activeSubmission.problemId || problemId;
        if (pid) {
            fetchPastSubmissions(pid);
        }
    }, [isOpen, activeSubmission?.problemId || problemId]);

    // Keyboard handler
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowLeft" && selectedTest > 1) {
                setSelectedTest(prev => Math.max(1, prev - 1));
            } else if (e.key === "ArrowRight" && activeSubmission?.judgeResult?.totalTests) {
                setSelectedTest(prev => Math.min(activeSubmission.judgeResult.totalTests, (prev || 0) + 1));
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, selectedTest, activeSubmission]);

    function autoSelectTest(sub) {
        if (!sub?.judgeResult) {
            setSelectedTest(1);
            return;
        }
        if (sub.judgeResult.firstFailedTest) {
            setSelectedTest(sub.judgeResult.firstFailedTest);
        } else if (sub.judgeResult.totalTests > 0) {
            setSelectedTest(1);
        }
    }

    async function fetchSubmission(id) {
        const fetchId = ++fetchIdRef.current;
        setLoadingSubmission(true);
        try {
            const token = localStorage.getItem("codeplay_token");
            const res = await fetch(`${API_URL}/api/cses/submission/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            if (fetchIdRef.current !== fetchId) return;
            setActiveSubmission(data);
            autoSelectTest(data);
        } catch (err) {
            console.error("[CSESResultModal] Failed to fetch submission:", err);
        } finally {
            if (fetchIdRef.current === fetchId) setLoadingSubmission(false);
        }
    }

    async function fetchPastSubmissions(pid) {
        setLoadingHistory(true);
        try {
            const token = localStorage.getItem("codeplay_token");
            const res = await fetch(`${API_URL}/api/cses/submissions/problem/${pid}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setPastSubmissions(data.submissions || []);
        } catch (err) {
            console.error("[CSESResultModal] Failed to fetch past submissions:", err);
        } finally {
            setLoadingHistory(false);
        }
    }

    const handleSelectSubmission = useCallback((id) => {
        if (id === activeSubmission?._id) return;
        setSelectedTest(null);
        setActiveTab("results");
        fetchSubmission(id);
    }, [activeSubmission?._id]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setActiveSubmission(null);
            setSelectedTest(null);
            setPastSubmissions([]);
            setActiveTab("results");
            setLoadingSubmission(false);
            setLoadingHistory(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const sub = activeSubmission;
    const jr = sub?.judgeResult;
    const verdictCfg = sub ? (VERDICT_CONFIG[sub.verdict] || VERDICT_CONFIG["Judge Error"]) : null;
    const VIcon = verdictCfg?.icon || AlertTriangle;

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                background: "rgba(0,0,0,0.85)",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "fadeInScale 0.25s ease-out",
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "95vw",
                    maxWidth: 1400,
                    height: "90vh",
                    background: "#111113",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    gap: 12,
                    flexShrink: 0,
                }}>
                    {/* Left: Problem info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#f4f4f5",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {sub?.problemName || "CSES Submission"}
                        </span>
                        {sub?.problemId && (
                            <a
                                href={`https://cses.fi/problemset/task/${sub.problemId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    color: "#71717a",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                    fontSize: 12,
                                    textDecoration: "none",
                                    flexShrink: 0,
                                }}
                                title="Open on CSES"
                            >
                                #{sub.problemId} <ExternalLink size={11} />
                            </a>
                        )}
                    </div>

                    {/* Center: Verdict */}
                    {sub && verdictCfg && (
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 14px",
                            borderRadius: 10,
                            background: verdictCfg.bg,
                            border: `1px solid ${verdictCfg.color}30`,
                            flexShrink: 0,
                        }}>
                            <VIcon
                                size={16}
                                color={verdictCfg.color}
                                style={sub.verdict === "Judging" ? { animation: "spin 1s linear infinite" } : {}}
                            />
                            <span style={{ fontSize: 13, fontWeight: 700, color: verdictCfg.color }}>
                                {sub.verdict}
                            </span>
                            {jr && (
                                <span style={{ fontSize: 12, color: verdictCfg.color, opacity: 0.7 }}>
                                    {jr.passedTests}/{jr.totalTests}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Right: Time + Close */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        {jr?.executionTime != null && (
                            <span style={{ fontSize: 12, color: "#71717a", display: "flex", alignItems: "center", gap: 4 }}>
                                <Clock size={12} /> {jr.executionTime}ms
                            </span>
                        )}

                        {/* Tab toggle for narrower views */}
                        <div style={{
                            display: "flex",
                            gap: 2,
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 8,
                            padding: 2,
                        }}>
                            <button
                                onClick={() => setActiveTab("results")}
                                style={{
                                    padding: "4px 10px",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    border: "none",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    color: activeTab === "results" ? "#f4f4f5" : "#71717a",
                                    background: activeTab === "results" ? "rgba(255,255,255,0.08)" : "transparent",
                                    transition: "all 0.15s",
                                }}
                            >
                                Results
                            </button>
                            <button
                                onClick={() => setActiveTab("code")}
                                style={{
                                    padding: "4px 10px",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    border: "none",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    color: activeTab === "code" ? "#f4f4f5" : "#71717a",
                                    background: activeTab === "code" ? "rgba(255,255,255,0.08)" : "transparent",
                                    transition: "all 0.15s",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                <Code2 size={12} /> Code
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "none",
                                borderRadius: 8,
                                padding: 6,
                                cursor: "pointer",
                                color: "#a1a1aa",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { e.target.style.background = "rgba(255,255,255,0.12)"; e.target.style.color = "#f4f4f5"; }}
                            onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.06)"; e.target.style.color = "#a1a1aa"; }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                {loadingSubmission ? (
                    <div style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: 10,
                        color: "#71717a",
                    }}>
                        <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
                        <span style={{ fontSize: 13 }}>Loading submission...</span>
                    </div>
                ) : !sub ? (
                    <div style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#52525b",
                        fontSize: 13,
                    }}>
                        No submission data available
                    </div>
                ) : (
                    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                        {/* Left sidebar: Submission History */}
                        <div style={{
                            width: 220,
                            borderRight: "1px solid rgba(255,255,255,0.06)",
                            flexShrink: 0,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                        }}>
                            <SubmissionHistory
                                submissions={pastSubmissions}
                                activeSubmissionId={sub._id}
                                onSelectSubmission={handleSelectSubmission}
                                loading={loadingHistory}
                            />
                        </div>

                        {/* Center: Test results or Code view */}
                        {activeTab === "results" ? (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                                {/* Test Case Grid */}
                                <div style={{
                                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                                    flexShrink: 0,
                                    maxHeight: "40%",
                                    overflowY: "auto",
                                }}>
                                    <TestCaseGrid
                                        totalTests={jr?.totalTests || 0}
                                        testResults={jr?.testResults || []}
                                        selectedTest={selectedTest}
                                        onSelectTest={setSelectedTest}
                                    />
                                </div>

                                {/* Test Case Detail */}
                                <div style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    overflow: "hidden",
                                }}>
                                    <TestCaseDetail
                                        selectedTest={selectedTest}
                                        firstFailedTest={jr?.firstFailedTest}
                                        firstFailedInput={jr?.firstFailedInput}
                                        firstFailedExpected={jr?.firstFailedExpected}
                                        firstFailedActual={jr?.firstFailedActual}
                                        testResults={jr?.testResults || []}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Code view */
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                                <div style={{
                                    padding: "8px 16px",
                                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                                    fontSize: 12,
                                    color: "#71717a",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexShrink: 0,
                                }}>
                                    <Code2 size={13} />
                                    <span>{sub.language?.toUpperCase()} source code</span>
                                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#52525b" }}>
                                        {sub.code ? `${sub.code.split("\n").length} lines` : ""}
                                    </span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    {MonacoEditor ? (
                                        <MonacoEditor
                                            height="100%"
                                            language={LANG_MAP[sub.language] || "plaintext"}
                                            value={sub.code || "// No code available"}
                                            theme="vs-dark"
                                            options={{
                                                readOnly: true,
                                                minimap: { enabled: false },
                                                scrollBeyondLastLine: false,
                                                fontSize: 13,
                                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                                lineNumbers: "on",
                                                wordWrap: "on",
                                                domReadOnly: true,
                                            }}
                                        />
                                    ) : (
                                        <pre style={{
                                            margin: 0,
                                            padding: 16,
                                            fontSize: 13,
                                            lineHeight: 1.6,
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            color: "#e4e4e7",
                                            whiteSpace: "pre-wrap",
                                            overflowY: "auto",
                                            height: "100%",
                                        }}>
                                            {sub.code || "// No code available"}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
