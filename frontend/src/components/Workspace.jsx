import { useState, useEffect, useRef, useCallback } from "react";
import ConfirmModal from "./ConfirmModal";
import Editors from "./Editors";
import Preview from "./Preview";
import AIPanel from "./AIPanel";
import ConsolePanel from "./ConsolePanel";
import ShareModal from "./ShareModal";
import AuthModal from "./AuthModal";
import Sidebar from "./Sidebar";
import FileExplorer from "./FileExplorer";
import ParticipantsPanel from "./ParticipantsPanel";
import TestPanel from "./TestPanel";
import { generateCppRunner } from "../utils/cppRunner"; 
import { generateJavaRunner } from "../utils/javaRunner"; 
import { generatePythonRunner } from "../utils/pythonRunner"; 
import { executeCode } from "../utils/execution"; 
import ProblemBrowser from "./ProblemBrowser"; 
import CP31Browser from "./CP31Browser";
import A2ZBrowser from "./A2ZBrowser";
import ProblemPreview from "./ProblemPreview"; 
import ErrorBoundary from "./ErrorBoundary"; 
import useDebounce from "../hooks/useDebounce"; 
import { useParams, useNavigate } from "react-router-dom"; 
import { API_URL } from "../config"; 
import io from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { Code2, Play, Share2, PanelBottom, Globe, FileCode, ShieldAlert, FlaskConical, X, Settings, Zap, Mic, MicOff, PhoneOff, Headphones, VolumeX, Download, ExternalLink, Puzzle } from "lucide-react"; 
import { useVoiceChat } from "../hooks/useVoiceChat"; 
import { useWorkspaceSocket } from "../hooks/useWorkspaceSocket";
import { useWorkspaceFiles } from "../hooks/useWorkspaceFiles";
import { useWorkspaceExecution } from "../hooks/useWorkspaceExecution";
import WorkspaceHeader from "./WorkspaceHeader";
import SettingsModal from "./SettingsModal";
import SettingsPanel from "./SettingsPanel";
import Whiteboard from "./Whiteboard"; 
import VoicePanel from "./VoicePanel";
import RecordingPanel, { CountdownOverlay, RecordingPreview } from "./RecordingPanel";
import RecordingIndicator from "./RecordingIndicator";
import CSESResultModal from "./CSESResultModal";
import { useScreenRecording } from "../hooks/useScreenRecording";
import { stringToColor } from "../utils/colors";



export default function Workspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth(); 

  const [logs, setLogs] = useState([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // --- HOOKS ---
  const { 
      socket, accessStatus, setAccessStatus, waitMessage, activeUsers, pendingGuests, 
      hostUserId, isHost, hostOnline, isReadOnly, handleGrant, handleDeny, handleLeaveRoom 
  } = useWorkspaceSocket({ id, user, authLoading, setAuthModalOpen, setLogs });

  const { 
      files, setFiles, activeFile, activeCodeRef, activeCode, setActiveCode, debouncedCode, 
      handleFileSelect, handleFileCreate, handleFileDeleteRequest, handleFileDeleteConfirm, 
      deleteConfirm, setDeleteConfirm 
  } = useWorkspaceFiles({ id, user, socket, accessStatus, isHost, hostUserId, isReadOnly, setLogs, setAuthModalOpen });

  // --- UI STATE ---
  const [input, setInput] = useState(""); 
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("viewMode") || "editor"); // "editor" | "problem_full"
  
  // Persist View Mode
  useEffect(() => { localStorage.setItem("viewMode", viewMode); }, [viewMode]);

  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [selectedProblemForCode, setSelectedProblemForCode] = useState(null); 
  
  // UI STATE
  const [activeSidebar, setActiveSidebar] = useState(() => localStorage.getItem("activeSidebar") || "files");
  
  // Persist Sidebar Tab
  useEffect(() => {
    localStorage.setItem("activeSidebar", activeSidebar || "");
  }, [activeSidebar]); 
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(() => parseInt(localStorage.getItem("aiPanelWidth")) || 420);
  const [isAiPanelResizing, setIsAiPanelResizing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  // LAYOUT PERSISTENCE
  const [consoleHeight, setConsoleHeight] = useState(() => parseInt(localStorage.getItem("consoleHeight")) || 250); 
  const [isResizing, setIsResizing] = useState(false); 
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem("sidebarWidth")) || 380);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false); 

  // RIGHT PANEL STATE (CPH Style)
  const [rightPanel, setRightPanel] = useState(() => {
    try {
        const saved = localStorage.getItem("rightPanel");
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }); // { type: 'preview', data: problem } or null 
  const [rightPanelWidth, setRightPanelWidth] = useState(() => parseInt(localStorage.getItem("rightPanelWidth")) || 600);
  const [isRightPanelResizing, setIsRightPanelResizing] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // SAVE LAYOUT CHANGES
  useEffect(() => { localStorage.setItem("consoleHeight", consoleHeight); }, [consoleHeight]);
  useEffect(() => { localStorage.setItem("sidebarWidth", sidebarWidth); }, [sidebarWidth]);
  useEffect(() => { localStorage.setItem("rightPanelWidth", rightPanelWidth); }, [rightPanelWidth]);

  // GLOBAL RESIZE HANDLER (Restored)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
          const newHeight = window.innerHeight - e.clientY;
          setConsoleHeight(Math.max(100, Math.min(newHeight, window.innerHeight * 0.8)));
      } else if (isSidebarResizing) {
          setSidebarWidth(Math.max(200, Math.min(e.clientX, window.innerWidth * 0.4)));
      } else if (isRightPanelResizing) {
          const newWidth = window.innerWidth - e.clientX;
          setRightPanelWidth(Math.max(300, Math.min(newWidth, window.innerWidth * 0.6)));
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      setIsSidebarResizing(false);
      setIsRightPanelResizing(false);
      document.body.style.cursor = "default";
    };

    if (isResizing || isSidebarResizing || isRightPanelResizing) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, isSidebarResizing, isRightPanelResizing]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csesResultModalOpen, setCSESResultModalOpen] = useState(false);
  const [csesResultModalData, setCSESResultModalData] = useState(null);
  const [csesResultModalSubmissionId, setCSESResultModalSubmissionId] = useState(null);

  // EXTENSION DETECTION
  const EXTENSION_URL = "https://chromewebstore.google.com/detail/codeplay-helper/ldkpphfppokocibnlbdbkiohgocfgelb";
  const [extensionDetected, setExtensionDetected] = useState(null); // null = checking, true/false
  const [extensionBannerDismissed, setExtensionBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem("ext_banner_dismissed") === "1"; } catch { return false; }
  });

  // Detect extension on mount by sending a ping
  useEffect(() => {
    let timeout;
    const handlePong = (event) => {
      if (event.data?.type === "CODEPLAY_PONG" || event.data?.type === "CODEPLAY_COOKIES_RECEIVED" || event.data?.type === "CODEPLAY_SUBMIT_RESULT" || event.data?.type === "CODEPLAY_CF_HANDLE_RESULT") {
        setExtensionDetected(true);
        window.removeEventListener("message", handlePong);
        clearTimeout(timeout);
      }
    };
    window.addEventListener("message", handlePong);
    // Send a ping that the extension content script should respond to
    window.postMessage({ type: "CODEPLAY_PING" }, "*");
    // Also try fetching CF handle as a secondary check
    window.postMessage({ type: "CODEPLAY_FETCH_CF_HANDLE" }, "*");
    timeout = setTimeout(() => {
      setExtensionDetected(prev => prev === null ? false : prev);
      window.removeEventListener("message", handlePong);
    }, 3000);
    return () => {
      window.removeEventListener("message", handlePong);
      clearTimeout(timeout);
    };
  }, []);



  // Persist Right Panel
  useEffect(() => {
    localStorage.setItem("rightPanel", JSON.stringify(rightPanel));
  }, [rightPanel]);

  // --- PROBLEM SYNC (Moved from JSX) ---
  useEffect(() => {
    if (!socket) return;
    
    // Listen for remote problem selection
    const handleSyncProblem = (problem) => {
        console.log(`[DEBUG] 📥 Socket received sync_problem:`, problem?.title);
        console.log(`[DEBUG] Description Length: ${problem?.description?.length}`);
        console.log(`[DEBUG] Full Problem Object:`, problem);
        
        if (problem) {
             setRightPanel({ type: "preview", data: problem });
             // Also switch to full screen problem view to match the sender
             setViewMode("problem_full");
        } else {
            console.log(`[DEBUG] ⚠️ Received null/undefined problem in sync_problem`);
        }
    };

    socket.on("sync_problem", handleSyncProblem);

    // Always request problem state from server when access is granted
    // This ensures we get the host's current problem, not stale localStorage
    if (accessStatus === "granted") {
        console.log("📥 Access granted, requesting current problem state from server...");
        socket.emit("request_problem_state", { roomId: id });
    }

    return () => {
        socket.off("sync_problem", handleSyncProblem);
    };
  }, [socket, id, accessStatus]);

  // --- VOICE CHAT ---
  const { 
    isConnected, isMuted, isDeafened, isSpeaking, volume, connectionQuality,
    joinVoice, leaveVoice, toggleMute, toggleDeafen, setMasterVolume, setPeerVolume, mutePeer,
    peers, speakingPeers 
  } = useVoiceChat(socket, id, user?.username);
  // Helper to map peerId (socketId) to username - now peers already have username from LiveKit
    const getPeerName = useCallback(
        (peerId) => peers.find((p) => p.peerId === peerId)?.username || peerId,
        [peers]
    );
  // isHost is now a state variable set in access_granted

  // --- SCREEN RECORDING ---
  const {
    isRecording,
    isPaused,
    formattedTime: recordingTime,
    recordedBlob,
    recordingError,
    audioLevel: recordingAudioLevel,
    isPreviewOpen: isRecordingPreviewOpen,
    countdownActive,
    countdown,
    // Webcam state
    webcamEnabled,
    webcamStream,
    webcamPosition,
    // Recording actions
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    downloadRecording,
    discardRecording,
    setIsPreviewOpen: setIsRecordingPreviewOpen,
    // Webcam actions
    toggleWebcam,
    startWebcam,
    stopWebcam,
    setWebcamPosition
  } = useScreenRecording();

  // --- AUTO LOGOUT ON TOKEN EXPIRY ---
  useEffect(() => {
      const handleAuthExpired = () => {
          console.log("[Workspace] Token expired, opening auth modal...");
          setAccessStatus("login_required");
          setWaitMessage("Your session has expired. Please sign in again.");
          setAuthModalOpen(true);
      };

      window.addEventListener("auth:expired", handleAuthExpired);
      return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, []);

  // Socket listeners were extracted to custom hooks useWorkspaceSocket and useWorkspaceFiles
  
  const { 
      isRunning, isRunningTests, testCases, setTestCases, 
      handleRun, runTests, handleCancel 
  } = useWorkspaceExecution({ user, activeFile, activeCodeRef, rightPanel, input, id, socket, setLogs, setAuthModalOpen, setConsoleOpen });

  // Run a single test case by ID
  const runSingleTest = useCallback(async (testId) => {
    if (!activeFile) {
        setLogs(prev => [...prev, { type: "error", message: "No file selected to run test." }]);
        return;
    }
    if (!user) {
        setAuthModalOpen(true);
        return;
    }
    
    // AUTO RUNNER LOGIC - C++
    let codeToRun = activeCodeRef.current;
    if (activeFile.language === "cpp" && codeToRun.includes("class Solution") && !codeToRun.includes("int main")) {
         if (rightPanel?.data) {
             codeToRun = generateCppRunner(codeToRun, rightPanel.data);
         }
    }
    // AUTO RUNNER LOGIC - Java
    if (activeFile.language === "java" && codeToRun.includes("class Solution") && !codeToRun.includes("public static void main")) {
         if (rightPanel?.data) {
             codeToRun = generateJavaRunner(codeToRun, rightPanel.data);
         }
    }
    // AUTO RUNNER LOGIC - Python
    if (activeFile.language === "python" && codeToRun.includes("class Solution") && !codeToRun.includes("if __name__")) {
         if (rightPanel?.data) {
             codeToRun = generatePythonRunner(codeToRun, rightPanel.data);
         }
    }
    
    const testIndex = testCases.findIndex(t => t.id === testId);
    if (testIndex === -1) {
        setLogs(prev => [...prev, { type: "error", message: "Test case not found." }]);
        return;
    }
    
    const test = testCases[testIndex];
    const testNumber = testIndex + 1;
    
    // Set running state for this test
    setTestCases(prev => prev.map(t => 
        t.id === testId ? { ...t, status: "running", actualOutput: "" } : t
    ));
    
    // Show in console
    setConsoleOpen(true);
    setLogs(prev => [...prev, { type: "info", message: `Running Test ${testNumber}...` }]);

    const startTime = Date.now();

    try {
        let data;
        if (activeFile.language === "javascript") {
            data = await executeCode(codeToRun, test.input);
        } else {
            const token = localStorage.getItem("codeplay_token");
            const res = await fetch(`${API_URL}/api/code/execute`, {
                method: "POST", 
                headers: { 
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    language: activeFile.language, 
                    code: codeToRun, 
                    stdin: test.input 
                }),
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody.error || `Server error (${res.status})`);
            }
            data = await res.json();
        }
        
        const executionTime = Date.now() - startTime;
        const output = (data.run?.output || data.compile?.output || data.run?.stderr || "").trim();
        const isAccepted = output === test.expectedOutput?.trim();
        
        setTestCases(prev => prev.map(t => 
            t.id === testId ? { 
                ...t, 
                actualOutput: output,
                status: isAccepted ? "accepted" : "wrong_answer"
            } : t
        ));
        
        // Log result to console
        if (isAccepted) {
            setLogs(prev => [...prev, { 
                type: "success", 
                message: `✓ Test ${testNumber} PASSED (${executionTime}ms)` 
            }]);
        } else {
            setLogs(prev => [...prev, { 
                type: "error", 
                message: `✗ Test ${testNumber} FAILED (${executionTime}ms)\nExpected: ${test.expectedOutput?.trim()}\nGot: ${output}` 
            }]);
        }
    } catch (err) {
        const executionTime = Date.now() - startTime;
        setTestCases(prev => prev.map(t => 
            t.id === testId ? { ...t, status: "error", actualOutput: err.message || "Execution Error" } : t
        ));
        setLogs(prev => [...prev, { 
            type: "error", 
            message: `✗ Test ${testNumber} ERROR (${executionTime}ms): ${err.message || "Execution failed"}` 
        }]);
    }
  }, [activeFile, rightPanel, testCases, user]);

    // --- AUTOSAVE & STATE SYNC (Moved to top level) ---
    useEffect(() => {
        if (!activeFile || !activeFile._id || activeFile.type === "preview") return;

        const timeout = setTimeout(async () => {
            // 1. Update local files array so switching files preserves content
            setFiles(prev => prev.map(f => 
                f._id === activeFile._id ? { ...f, content: activeCode } : f
            ));

            // 2. Persist to Database
            try {
                const token = localStorage.getItem("codeplay_token");
                // If guest, we are editing Host's file, so we pass hostId
                const targetHostId = isHost ? null : hostUserId;
                
                await fetch(`${API_URL}/api/files/${activeFile._id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        content: activeCode,
                        hostId: targetHostId
                    })
                });
                // console.log("[Autosave] Saved:", activeFile.name); 
            } catch (e) {
                console.error("Autosave failed", e);
            }
        }, 3000); // 3 seconds debounce

        return () => clearTimeout(timeout);
    }, [activeCode, activeFile?._id, isHost, hostUserId]); // Only re-run if code or file changes


  // Track if submission is in progress to prevent double submissions
  const submissionInProgressRef = useRef(false);
  const submissionIdRef = useRef(0); // Track which submission we're waiting for

  const handleSubmit = async () => {
    // IMMEDIATELY check and set the lock before anything else
    if (submissionInProgressRef.current || isSubmitting) {
        console.log("[Submit] Already submitting, ignoring duplicate click");
        return;
    }
    
    // Set BOTH lock and state immediately - before ANY async operation
    submissionInProgressRef.current = true;
    setIsSubmitting(true); // Set state immediately to disable button
    const currentSubmissionId = ++submissionIdRef.current;
    console.log(`[Submit] Starting submission #${currentSubmissionId}`);
    
    if (!rightPanel?.data) {
        submissionInProgressRef.current = false;
        setIsSubmitting(false);
        return;
    }

    // --- CSES SUBMISSION ---
    if (rightPanel.data.provider === "cses") {
        const problemId = rightPanel.data.id || rightPanel.data.index;
        const problemName = rightPanel.data.title || rightPanel.data.name || `CSES Task ${problemId}`;
        const lang = activeFile?.language || "cpp";
        const token = localStorage.getItem("codeplay_token");

        if (!token) {
            setLogs(prev => [...prev, { type: "error", message: "Please log in to submit CSES solutions." }]);
            setConsoleOpen(true);
            submissionInProgressRef.current = false;
            setIsSubmitting(false);
            return;
        }

        setLogs(prev => [...prev, { type: "info", message: `[CSES Judge] Submitting ${problemName}...` }]);
        setConsoleOpen(true);

        try {
            const res = await fetch(`${API_URL}/api/cses/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    taskId: String(problemId),
                    code: activeCode,
                    language: lang,
                    problemName,
                    timeLimit: rightPanel.data.timeLimit,
                    memoryLimit: rightPanel.data.memoryLimit,
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setLogs(prev => [...prev, { type: "error", message: `CSES Submit Failed: ${data.error || "Unknown error"}` }]);
                submissionInProgressRef.current = false;
                setIsSubmitting(false);
                return;
            }

            const submissionId = data.submissionId;
            setLogs(prev => [...prev, { type: "info", message: `[CSES Judge] Judging started (ID: ${submissionId.slice(-6)})...` }]);

            // Join user room for real-time updates
            if (user?.id) {
                socket.emit("join_user_room", { userId: user.id });
            }

            // Listen for progress updates
            const handleProgress = (progressData) => {
                if (progressData.submissionId !== submissionId) return;
                const { testNumber, totalTests, verdict, passed, time } = progressData;
                if (testNumber === 0) return; // Initial "Judging" event

                const icon = verdict === "AC" ? "\u2713" : "\u2717";
                const type = verdict === "AC" ? "success" : "error";
                const verdictText = verdict === "AC" ? "Accepted" : verdict === "WA" ? "Wrong Answer" : verdict === "TLE" ? "Time Limit Exceeded" : verdict === "MLE" ? "Memory Limit Exceeded" : verdict === "RE" ? "Runtime Error" : verdict === "CE" ? "Compilation Error" : verdict;

                setLogs(prev => [...prev, {
                    type,
                    message: `[Test ${testNumber}/${totalTests}] ${icon} ${verdictText}${time ? ` (${time}ms)` : ""}`
                }]);
            };

            const handleResult = (resultData) => {
                if (resultData.submissionId !== submissionId) return;

                // Clean up listeners
                socket.off("cses:judge:progress", handleProgress);
                socket.off("cses:judge:result", handleResult);

                const { verdict, judgeResult } = resultData;
                const isAccepted = verdict === "Accepted";

                setLogs(prev => [...prev, {
                    type: isAccepted ? "success" : "error",
                    message: `\n${"─".repeat(40)}\n[CSES Judge] Final Verdict: ${verdict}${judgeResult ? ` (${judgeResult.passedTests}/${judgeResult.totalTests} tests passed)` : ""}${judgeResult?.executionTime ? ` | Max time: ${judgeResult.executionTime}ms` : ""}${judgeResult?.error ? `\n${judgeResult.error}` : ""}`
                }]);

                // Show first failed test details on failure
                if (!isAccepted && judgeResult?.firstFailedStderr && verdict === "Compilation Error") {
                    setLogs(prev => [...prev, {
                        type: "error",
                        message: `\u2500\u2500 Compiler Error \u2500\u2500\n${judgeResult.firstFailedStderr}`
                    }]);
                } else if (!isAccepted && judgeResult?.firstFailedInput) {
                    setLogs(prev => [...prev, {
                        type: "info",
                        message: `\u2500\u2500 First Failed Test (#${judgeResult.firstFailedTest}) \u2500\u2500\nInput:    ${judgeResult.firstFailedInput}\nExpected: ${judgeResult.firstFailedExpected}\nGot:      ${judgeResult.firstFailedActual}`
                    }]);
                }

                // Open CSES Result Modal
                setCSESResultModalData({
                    _id: submissionId,
                    problemId: String(problemId),
                    problemName,
                    code: activeCodeRef.current,
                    language: lang,
                    verdict,
                    judgeResult,
                    createdAt: new Date().toISOString(),
                });
                setCSESResultModalOpen(true);

                submissionInProgressRef.current = false;
                setIsSubmitting(false);
            };

            socket.on("cses:judge:progress", handleProgress);
            socket.on("cses:judge:result", handleResult);

            // Timeout fallback (5 minutes)
            setTimeout(() => {
                socket.off("cses:judge:progress", handleProgress);
                socket.off("cses:judge:result", handleResult);
                if (submissionInProgressRef.current) {
                    setLogs(prev => [...prev, { type: "error", message: "[CSES Judge] Judging timed out. Check your submissions page." }]);
                    submissionInProgressRef.current = false;
                    setIsSubmitting(false);
                }
            }, 5 * 60 * 1000);

        } catch (err) {
            setLogs(prev => [...prev, { type: "error", message: `CSES Submit Error: ${err.message}` }]);
            submissionInProgressRef.current = false;
            setIsSubmitting(false);
        }

        return;
    }

    // --- CODEFORCES SUBMISSION ---
    if (rightPanel.data.provider === "codeforces") {
        const { contestId, index } = rightPanel.data;
        
        if (!contestId || !index) {
            setLogs(prev => [...prev, { type: "error", message: "Cannot submit: Problem ID invalid (Fetch failed?)." }]);
            submissionInProgressRef.current = false;
            setIsSubmitting(false);
            return;
        }

        // Get the absolute latest code from state
        const codeToSubmit = activeCode;
        
        if (!codeToSubmit || codeToSubmit.trim().length === 0) {
            setLogs(prev => [...prev, { type: "error", message: "Cannot submit: Code is empty." }]);
            submissionInProgressRef.current = false;
            setIsSubmitting(false);
            return;
        }

        setLogs(prev => [...prev, { type: "info", message: `Submitting problem ${contestId}${index} to Codeforces...` }]);
        setConsoleOpen(true);

        // Debug: Log code hash to verify it's different
        const codeHash = codeToSubmit.length + '-' + codeToSubmit.slice(0, 50).replace(/\s/g, '');
        console.log(`[Submit] Code signature: ${codeHash}`);

        const langMap = {
            cpp: "54",      // GNU C++17
            python: "31",   // Python 3.8.10
            java: "36",     // Java 1.8
            javascript: "34" // Node.js
        };
        const langId = langMap[activeFile?.language] || "54";

        const payload = {
            contestId,
            problemIndex: index,
            code: codeToSubmit,
            languageId: langId 
        };

        // Capture the submission ID for this specific handler
        const handlerSubmissionId = currentSubmissionId;
        const handleResult = (event) => {
            if (event.data.type === "CODEPLAY_SUBMIT_RESULT") {
                window.removeEventListener("message", handleResult);
                
                // Ignore if this is a stale handler from an old submission
                if (submissionIdRef.current !== handlerSubmissionId) {
                    console.log(`[Submit] Ignoring stale result for submission #${handlerSubmissionId}`);
                    return;
                }
                
                const res = event.data.payload || { success: false, error: "No response from extension" };
                setIsSubmitting(false);
                submissionInProgressRef.current = false;
                
                if (res.success) {
                    const msg = typeof res.message === 'object' ? JSON.stringify(res.message) : String(res.message || "Unknown Success");
                    setLogs(prev => [...prev, { type: "success", message: `Codeforces: ${msg}` }]);
                    
                    // --- POLL FOR VERDICT ---
                    const startPolling = (targetHandle) => {
                         if (!targetHandle) return;
                         setLogs(prev => [...prev, { type: "info", message: `Polling verdict for ${targetHandle}...` }]);
                         let attempts = 0;
                         const pollInterval = setInterval(() => {
                            attempts++;
                            if (attempts > 30) { clearInterval(pollInterval); return; } 

                            fetch(`https://codeforces.com/api/user.status?handle=${targetHandle}&from=1&count=5`)
                                .then(r => r.json())
                                .then(data => {
                                    if (data.status === "OK") {
                                        const submission = data.result.find(s => 
                                            s.contestId == contestId && s.problem.index == index
                                        );
                                        if (submission) {

                                            const verdict = submission.verdict;
                                            if (verdict === "TESTING") {
                                                 const testCount = submission.passedTestCount + 1;
                                                 setLogs(prev => {
                                                     // Remove previous "Running on test" logs to avoid clutter
                                                     const filtered = prev.filter(l => !String(l?.message ?? l ?? "").startsWith("Running on test"));
                                                     return [...filtered, { type: "info", message: `Running on test ${testCount}...` }];
                                                 });
                                            } else {
                                                clearInterval(pollInterval);
                                                const isAc = verdict === "OK";
                                                setLogs(prev => {
                                                     const filtered = prev.filter(l => !String(l?.message ?? l ?? "").startsWith("Running on test"));
                                                     return [...filtered, { 
                                                        type: isAc ? "success" : "error", 
                                                        message: `Verdict: ${verdict === "OK" ? "ACCEPTED" : verdict} (${submission.timeConsumedMillis}ms) [Tests: ${submission.passedTestCount}]` 
                                                    }];
                                                });

                                                // SAVE TO DB
                                                fetch(`${API_URL}/api/submissions`, {
                                                    method: "POST",
                                                    headers: { 
                                                        "Content-Type": "application/json",
                                                        Authorization: `Bearer ${localStorage.getItem("codeplay_token")}`
                                                    },
                                                    body: JSON.stringify({
                                                        problemId: `${contestId}${index}`,
                                                        problemName: rightPanel.data.name || `Problem ${contestId}${index}`,
                                                        platform: "codeforces",
                                                        code: activeCode,
                                                        language: activeFile?.language || "cpp",
                                                        verdict: isAc ? "Accepted" : verdict,
                                                        visibility: "public"
                                                    })
                                                }).catch(e => console.error("Failed to save submission:", e));
                                            }
                                        }
                                    }
                                })
                                .catch(e => console.error(e));
                         }, 2000);
                    };

                    let handle = localStorage.getItem("cf_handle");
                    if (handle) {
                        startPolling(handle);
                    } else {
                        // Try Fetching from Extension
                        // setLogs(prev => [...prev, { type: "info", message: "Fetching Codeforces handle from Extension..." }]);
                        const hHandler = (evt) => {
                            if (evt.data.type === "CODEPLAY_CF_HANDLE_RESULT") {
                                window.removeEventListener("message", hHandler);
                                const res = evt.data.payload;
                                if (res.success && res.handle) {
                                    localStorage.setItem("cf_handle", res.handle);
                                    startPolling(res.handle);
                                } else {
                                    // Fallback
                                    startPolling(user?.username);
                                }
                            }
                        };
                        window.addEventListener("message", hHandler);
                        window.postMessage({ type: "CODEPLAY_FETCH_CF_HANDLE" }, "*");
                        // Timeout Fallback
                        setTimeout(() => {
                            window.removeEventListener("message", hHandler);
                            if (!handle) startPolling(user?.username);
                        }, 3000);
                    }


                } else {
                    const err = typeof res.error === 'object' ? JSON.stringify(res.error) : String(res.error || "Unknown Error");
                    setLogs(prev => [...prev, { type: "error", message: `Codeforces Error: ${err}` }]);
                }
            }
        };

        window.addEventListener("message", handleResult);
        window.postMessage({ type: "CODEPLAY_SUBMIT_CODEFORCES", payload }, "*");
        
        // Store the submission ID for this timeout
        const timeoutSubmissionId = currentSubmissionId;
        setTimeout(() => {
             window.removeEventListener("message", handleResult);
             // Only reset if this is still the same submission
             if (submissionIdRef.current === timeoutSubmissionId) {
                 submissionInProgressRef.current = false;
                 setIsSubmitting(prev => {
                     if (prev) { 
                         setLogs(p => [...p, { type: "error", message: "Submission Timeout: Extension took too long to respond. The code might have been submitted." }]);
                         return false;
                     }
                     return prev;
                 });
             }
        }, 60000); // Increased to 60s for Codeforces latency
        
        return;
    }

    // --- AUTOSAVE & STATE SYNC ---


    let cookie = null;
    let csrfToken = null;
    
    // ALWAYS fetch fresh credentials from extension for LeetCode submissions
    setLogs(prev => [...prev, { type: "info", message: "Fetching LeetCode credentials from extension..." }]);
    setConsoleOpen(true);

    try {
        const data = await new Promise((resolve, reject) => {
            const handler = (event) => {
                if (event.data.type === "CODEPLAY_COOKIES_RECEIVED") {
                    window.removeEventListener("message", handler);
                    resolve(event.data.payload);
                }
            };
            window.addEventListener("message", handler);
            window.postMessage({ type: "CODEPLAY_FETCH_COOKIES" }, "*");
            setTimeout(() => {
                window.removeEventListener("message", handler);
                reject(new Error("Timeout: Extension not responding."));
            }, 5000);
        });

        if (data.success) {
            cookie = data.cookie;
            csrfToken = data.csrfToken;
            console.log("[LeetCode] Got fresh credentials from extension");
        } else {
            throw new Error(data.error || "Extension returned failure.");
        }
    } catch (e) {
        console.error(e);
        setLogs(prev => [...prev, { type: "error", message: `Failed to get LeetCode credentials: ${e.message}. Make sure extension is installed and you're logged into LeetCode.` }]);
        submissionInProgressRef.current = false;
        setIsSubmitting(false);
        return;
    }
    
    setLogs(prev => [...prev, { type: "info", message: "Submitting to LeetCode..." }]);
    setConsoleOpen(true);

    try {
        const problem = rightPanel.data;
        
        // Validate required fields for LeetCode submission
        if (!problem.titleSlug || !problem.questionId) {
            setLogs(prev => [...prev, { type: "error", message: `Missing LeetCode data: titleSlug=${problem.titleSlug}, questionId=${problem.questionId}. Try reloading the problem.` }]);
            setIsSubmitting(false);
            submissionInProgressRef.current = false;
            return;
        }
        
        let codeToSubmit = activeCode;
        
        if (codeToSubmit.includes("int main() {")) {
             codeToSubmit = codeToSubmit.split("int main() {")[0];
        }

        // Map internal language names to LeetCode's expected lang slugs
        const leetcodeLangMap = {
            cpp: "cpp",
            java: "java",
            python: "python3",
            javascript: "javascript"
        };
        const leetcodeLang = leetcodeLangMap[activeFile?.language] || "cpp";

        const authToken = localStorage.getItem("codeplay_token");
        const res = await fetch(`${API_URL}/api/leettools/submit`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify({
                slug: problem.titleSlug,
                questionId: problem.questionId,
                lang: leetcodeLang,
                code: codeToSubmit,
                cookie,
                csrfToken
            })
        });
        
        const data = await res.json();
        
        if (res.status === 403 || (data.error && data.error.includes("authenticated"))) {
             setLogs(prev => [...prev, { type: "error", message: "LeetCode Authentication Failed (403). Please make sure you're logged into LeetCode in your browser, then try again." }]);
             setIsSubmitting(false);
             submissionInProgressRef.current = false;
             return;
        }

        if (data.success) {
             const result = data.result;
             const isSuccess = result.status_msg === "Accepted";
             
             let message = `LeetCode Verdict: ${result.status_msg}`;
             
             if (isSuccess) {
                 message += `\n✅ Runtime: ${result.status_runtime} (Beats ${result.runtime_percentile?.toFixed(1) || '?'}%)`;
                 message += `\n✅ Memory: ${result.status_memory} (Beats ${result.memory_percentile?.toFixed(1) || '?'}%)`;
             } else {
                 // Show failed test case details
                 if (result.status_msg === "Wrong Answer") {
                     message += `\n\n❌ Failed Test Case:`;
                     if (result.input_formatted || result.input) {
                         message += `\n📥 Input:\n${result.input_formatted || result.input}`;
                     }
                     if (result.expected_output) {
                         message += `\n\n✅ Expected Output:\n${result.expected_output}`;
                     }
                     if (result.code_output) {
                         message += `\n\n❌ Your Output:\n${result.code_output}`;
                     }
                     if (result.total_testcases && result.total_correct) {
                         message += `\n\n📊 Passed: ${result.total_correct}/${result.total_testcases} test cases`;
                     }
                 } else if (result.status_msg === "Runtime Error") {
                     message += `\n\n💥 Runtime Error:`;
                     if (result.runtime_error) {
                         message += `\n${result.runtime_error}`;
                     }
                     if (result.last_testcase) {
                         message += `\n\n📥 Last Test Case:\n${result.last_testcase}`;
                     }
                 } else if (result.status_msg === "Compile Error") {
                     message += `\n\n🔧 Compile Error:`;
                     if (result.compile_error) {
                         message += `\n${result.compile_error}`;
                     }
                 } else if (result.status_msg === "Time Limit Exceeded") {
                     message += `\n\n⏱️ Time Limit Exceeded`;
                     if (result.last_testcase) {
                         message += `\n📥 Last Test Case:\n${result.last_testcase}`;
                     }
                     if (result.total_testcases && result.total_correct) {
                         message += `\n\n📊 Passed: ${result.total_correct}/${result.total_testcases} test cases`;
                     }
                 } else if (result.status_msg === "Memory Limit Exceeded") {
                     message += `\n\n💾 Memory Limit Exceeded`;
                     if (result.last_testcase) {
                         message += `\n📥 Last Test Case:\n${result.last_testcase}`;
                     }
                 }
             }
             
             setLogs(prev => [...prev, { 
                 type: isSuccess ? "success" : "error", 
                 message 
             }]);
             
             // Also log the full result for debugging
             console.log("[LeetCode] Full result:", result);
             
             // SAVE TO DB (just like Codeforces)
             const token = localStorage.getItem("codeplay_token");
             if (token) {
                 fetch(`${API_URL}/api/submissions`, {
                     method: "POST",
                     headers: { 
                         "Content-Type": "application/json",
                         Authorization: `Bearer ${token}`
                     },
                     body: JSON.stringify({
                         problemId: problem.titleSlug,
                         problemName: problem.title || problem.titleSlug,
                         platform: "leetcode",
                         code: codeToSubmit,
                         language: activeFile?.language || "cpp",
                         verdict: isSuccess ? "Accepted" : result.status_msg,
                         visibility: "public"
                     })
                 }).catch(e => console.error("Failed to save LeetCode submission:", e));
             }
        } else {
             setLogs(prev => [...prev, { type: "error", message: `Submission Error: ${data.error || "Unknown error"}` }]);
        }

    } catch (err) {
        console.error(err);
        setLogs(prev => [...prev, { type: "error", message: "Submission Failed." }]);
    } finally {
        setIsSubmitting(false);
        submissionInProgressRef.current = false;
    }
  };

  function handleCopyLink() {
      const url = window.location.href.replace('editor', 'share');
      setShareUrl(window.location.href);
      setShareModalOpen(true);
  }

  async function handleAskAI(userPrompt) {
    if (!activeFile) return "Please select a file first.";
    const codeContext = { [activeFile.language]: activeCode };
    
    // Build problem context if a problem is open
    let problemContext = null;
    if (rightPanel?.data) {
      const problem = rightPanel.data;
      problemContext = {
        title: problem.title || problem.name || `Problem ${problem.contestId}${problem.index}`,
        provider: problem.provider || "unknown",
        difficulty: problem.difficulty || problem.rating || null,
        description: problem.description || problem.content || null,
        examples: problem.examples || problem.sampleTests || null,
        constraints: problem.constraints || null,
        tags: problem.tags || problem.topicTags || null
      };
    }
    
    try {
        const res = await fetch(`${API_URL}/api/ai/assist`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ 
              prompt: userPrompt, 
              code: codeContext,
              problem: problemContext 
            })
        });
        const data = await res.json();
        return data.result || "AI is thinking...";
    } catch (error) { return "Error: Could not reach the AI server."; }
  }

    const handleCodeNow = async (problem) => {
        // Open Language Selection Modal instead of auto-creating
        setSelectedProblemForCode(problem);
        setLanguageModalOpen(true);
    };

    const confirmCodeNow = async (language) => {
        setLanguageModalOpen(false);
        const problem = selectedProblemForCode;
        if (!problem) return;

        // Switch View Back
        setViewMode("editor");
        
        // 1. Prepare Content & Tests based on Language
        let initialCode = "";
        let initialTests = [];
        
        console.log("Code Now Triggered for:", problem, "Language:", language);

        // 0. Ensure we have snippets (LeetCode specific)
        let fullProblem = problem;
        if (problem.provider === "leetcode" && !problem.snippets) {
                 // ... Fetch logic remains similar but maybe adapt for language ...
        }

        // --- FOR LEETCODE: Use starter code from snippets ---
        if (problem.provider === "leetcode" && problem.snippets && Array.isArray(problem.snippets)) {
            // Map our language names to LeetCode's langSlug
            const langSlugMap = {
                "cpp": "cpp",
                "java": "java", 
                "python": "python3",
                "javascript": "javascript"
            };
            const targetSlug = langSlugMap[language] || language;
            
            // Find the matching snippet
            const snippet = problem.snippets.find(s => s.langSlug === targetSlug || s.lang?.toLowerCase().includes(language));
            
            if (snippet && snippet.code) {
                // LeetCode snippets don't include headers - add them for C++
                if (language === "cpp") {
                    initialCode = `#include <bits/stdc++.h>
using namespace std;

${snippet.code}`;
                } else {
                    initialCode = snippet.code;
                }
                console.log("[LeetCode] Using starter code for", language);
            }
        }
        
        // --- FALLBACK: Use CP template if no LeetCode snippet found ---
        if (!initialCode || initialCode.trim().length === 0) {
            if (language === "cpp") {
                 const userTmp = localStorage.getItem("user_cpp_template");
                 if (userTmp && userTmp.trim().length > 0) {
                     initialCode = userTmp;
                 } else {
                     initialCode = `#include <bits/stdc++.h>
using namespace std;

void solve() {
    // Write your solution here
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    solve();
    return 0;
}
`;
                 }
            } else if (language === "java") {
                initialCode = `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
    }
}
`;
            } else if (language === "python") {
                initialCode = `import sys

def solve():
    # Write your solution here
    pass

if __name__ == "__main__":
    solve()
`;
            } else if (language === "javascript") {
                initialCode = `const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    // Write your solution here
    console.log(line);
});
`;
            }
        }

        // 2. Create File
        const extMap = { cpp: "cpp", java: "java", python: "py", javascript: "js" };
        const ext = extMap[language] || "txt";
        
        // Generate unique file name based on problem
        let fileName;
        if (language === "java") {
            // For Java, create unique filename based on problem slug
            // Convert slug like "two-sum" to "TwoSum.java"
            const slug = problem.titleSlug || problem.id || "Solution";
            const javaClassName = slug
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join('');
            fileName = `${javaClassName}.java`;
        } else {
            // For other languages, use solution_<problem_id>.<ext>
            fileName = `solution_${problem.titleSlug || problem.id}.${ext}`;
        }
        
        let targetFile = files.find(f => f.name === fileName);
        
        if (!targetFile) {
            try {
                const token = localStorage.getItem("codeplay_token");
                const res = await fetch(`${API_URL}/api/files`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        name: fileName, 
                        language: language, 
                        folder: "/", 
                        roomId: id || "default",
                        content: initialCode 
                    }) 
                });
                targetFile = await res.json();
                setFiles(prev => [...prev, targetFile]);
                
                // SYNC TO ROOM
                if (id) {
                    console.log("[CodeNow] Broadcasting new file:", targetFile.name);
                    socket.emit("sync_file_created", { roomId: id, file: targetFile });
                }
            } catch (e) {
                console.error("Failed to create file", e);
                return;
            }
        } 
        
        // 3. Switch to File
        if (targetFile) {
            // FIX: Editors.jsx uses activeFile.content to init YJS.
            // If the file is new or empty, we MUST ensure the object passed to setActiveFile has content.
            if (!targetFile.content || targetFile.content.trim().length === 0) {
                 // Create a copy to avoid mutating state directly if it came from 'files'
                 targetFile = { ...targetFile, content: initialCode };
            }
            
            setActiveFile(targetFile);
            setActiveCode(targetFile.content);
        }

        // 5. ENSURE PREVIEW IS AVAILABLE (Right Panel)
        setRightPanel({ type: "preview", data: problem });

        // 6. SYNC TEST CASES (Handle both Codeforces and LeetCode formats)
        if (problem.provider === "leetcode") {
            // LeetCode: test cases come from 'examples' field (exampleTestcases)
            // Format: inputs are on separate lines, grouped by number of function arguments
            // Example for twoSum(nums, target): "[2,7,11,15]\n9\n[3,2,4]\n6\n[3,3]\n6"
            if (problem.examples && typeof problem.examples === 'string' && problem.snippets) {
                // Count number of arguments from the snippet
                const snippet = problem.snippets.find(s => s.langSlug === "cpp");
                let argCount = 1;
                if (snippet) {
                    const signatureMatch = snippet.code.match(/\((.*)\)/);
                    if (signatureMatch) {
                        // Count commas at depth 0
                        let depth = 0;
                        let commas = 0;
                        for (const c of signatureMatch[1]) {
                            if (c === '<') depth++;
                            if (c === '>') depth--;
                            if (c === ',' && depth === 0) commas++;
                        }
                        argCount = commas + 1;
                    }
                }
                
                const lines = problem.examples.split('\n').filter(l => l.trim());
                const parsedTests = [];
                
                // Extract expected outputs from problem description
                const expectedOutputs = [];
                if (problem.description) {
                    const outputMatches = problem.description.match(/<strong>Output:<\/strong>\s*([^<]+)/g);
                    if (outputMatches) {
                        outputMatches.forEach(m => {
                            const val = m.replace(/<strong>Output:<\/strong>\s*/, '').trim();
                            expectedOutputs.push(val);
                        });
                    }
                }
                
                // Group lines by argCount
                let testIndex = 0;
                for (let i = 0; i < lines.length; i += argCount) {
                    const inputLines = lines.slice(i, i + argCount);
                    if (inputLines.length === argCount) {
                        parsedTests.push({
                            id: Date.now() + testIndex,
                            input: inputLines.join('\n'),
                            expectedOutput: expectedOutputs[testIndex] || "",
                            status: "idle",
                            actualOutput: "",
                            expanded: true
                        });
                        testIndex++;
                    }
                }
                
                setTestCases(parsedTests.length > 0 ? parsedTests : [{ id: Date.now(), input: "", expectedOutput: "", status: "idle", actualOutput: "", expanded: true }]);
                console.log("[LeetCode] Parsed", parsedTests.length, "test cases with", argCount, "args each, found", expectedOutputs.length, "expected outputs");
            } else if (problem.testCases && Array.isArray(problem.testCases)) {
                setTestCases(problem.testCases.map((tc, idx) => ({
                    id: Date.now() + idx,
                    input: tc.input || "",
                    expectedOutput: tc.expectedOutput || tc.output || "",
                    status: "idle",
                    actualOutput: "",
                    expanded: true
                })));
            } else {
                setTestCases([{ id: Date.now(), input: "", expectedOutput: "", status: "idle", actualOutput: "", expanded: true }]);
            }
        } else if (problem.testCases && Array.isArray(problem.testCases)) {
            // Codeforces/GFG: standard format
            setTestCases(problem.testCases.map((tc, idx) => ({
                id: Date.now() + idx,
                input: tc.input || "",
                expectedOutput: tc.expectedOutput || tc.output || "",
                status: "idle",
                actualOutput: "",
                expanded: true
            })));
        } else {
            setTestCases([]);
        }
    };



    return (
    <ErrorBoundary>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-dark)", color: "var(--text-main)" }}>
        
        {/* HEADER */}
        <WorkspaceHeader 
            activeFile={activeFile}
            activeUsers={activeUsers}
            isRunning={isRunning}
            handleRun={handleRun}
            isSubmitting={isSubmitting}
            handleSubmit={handleSubmit}
            extensionDetected={extensionDetected}
            EXTENSION_URL={EXTENSION_URL}
            handleCopyLink={handleCopyLink}
            aiPanelOpen={aiPanelOpen}
            setAiPanelOpen={setAiPanelOpen}
            rightPanel={rightPanel}
            user={user}
            setAuthModalOpen={setAuthModalOpen}
            isConnected={isConnected}
            joinVoice={joinVoice}
            isSpeaking={isSpeaking}
            isMuted={isMuted}
            toggleMute={toggleMute}
            isDeafened={isDeafened}
            toggleDeafen={toggleDeafen}
            leaveVoice={leaveVoice}
            connectionQuality={connectionQuality}
            extensionBannerDismissed={extensionBannerDismissed}
            setExtensionBannerDismissed={setExtensionBannerDismissed}
        />

        {/* WORKSPACE BODY */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            
            {/* 1. SIDEBAR NAVIGATION */}
            <Sidebar activeTab={activeSidebar} setActiveTab={setActiveSidebar} isOpen={!!activeSidebar} />

            {/* 2. SIDEBAR PANEL (Only if active and NOT whiteboard which is floating) */}
            {activeSidebar && activeSidebar !== "whiteboard" && (
                <>
                    <div style={{ width: sidebarWidth, height: "100%", overflow: "hidden", background: "var(--bg-panel)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column" }}>
                    {activeSidebar === "files" && (
                        <FileExplorer 
                            files={files} 
                            activeFileId={activeFile?._id} 
                            onSelect={handleFileSelect} 
                            onCreate={handleFileCreate} 
                            onDelete={handleFileDeleteRequest}
                        />
                    )}
                    {activeSidebar === "participants" && (
                        <ParticipantsPanel 
                            users={activeUsers} 
                            hostOnline={hostOnline}
                            isReadOnly={isReadOnly}
                            onLeaveRoom={handleLeaveRoom}
                            currentUsername={user?.username}
                        />
                    )}
                    {activeSidebar === "tests" && (
                        <TestPanel
                            testCases={testCases}
                            setTestCases={setTestCases}
                            runTests={runTests}
                            runSingleTest={runSingleTest}
                            isRunningTests={isRunningTests || isSubmitting}
                            onClose={() => setActiveSidebar(null)}
                            language={activeFile?.language || "text"} // Pass language
                        />
                    )}
                    
                    {/* NEW CP PANELS */}

                    {/* NEW CP PANELS */}
                    {activeSidebar === "codeforces" && (
                        <ProblemBrowser 
                            provider="codeforces" 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode on Click
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                            activeSheet={null} 
                        />
                    )}
                    {activeSidebar === "cses" && (
                         <ProblemBrowser 
                            provider="cses" 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                        />
                    )}
                    {activeSidebar === "leetcode" && (
                         <ProblemBrowser 
                            provider="leetcode" 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                        />
                    )}
                    {activeSidebar === "cp31" && (
                         <CP31Browser 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                        />
                    )}
                    {activeSidebar === "a2z" && (
                         <A2ZBrowser 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                        />
                    )}
                    {activeSidebar === "settings" && <SettingsPanel />}
                    {activeSidebar === "recording" && (
                        <RecordingPanel 
                          onClose={() => setActiveSidebar(null)}
                          isRecording={isRecording}
                          isPaused={isPaused}
                          formattedTime={recordingTime}
                          recordedBlob={recordedBlob}
                          recordingError={recordingError}
                          audioLevel={recordingAudioLevel}
                          isPreviewOpen={isRecordingPreviewOpen}
                          countdownActive={countdownActive}
                          countdown={countdown}
                          // Webcam state
                          webcamEnabled={webcamEnabled}
                          webcamStream={webcamStream}
                          webcamPosition={webcamPosition}
                          // Recording actions
                          startRecording={startRecording}
                          pauseRecording={pauseRecording}
                          resumeRecording={resumeRecording}
                          stopRecording={stopRecording}
                          downloadRecording={downloadRecording}
                          discardRecording={discardRecording}
                          setIsPreviewOpen={setIsRecordingPreviewOpen}
                          // Webcam actions
                          toggleWebcam={toggleWebcam}
                          setWebcamPosition={setWebcamPosition}
                        />
                    )}
                </div>
                    {/* RESIZE HANDLE */}
                    <div 
                        onMouseDown={(e) => { e.preventDefault(); setIsSidebarResizing(true); document.body.style.cursor = "col-resize"; }}
                        className="resize-handle-vertical"
                        style={{ 
                            width: "4px", cursor: "col-resize", background: isSidebarResizing ? "var(--accent-primary)" : "transparent", 
                            transition: "background 0.2s", zIndex: 10, position: "relative", right: "2px"
                        }}
                    />
                </>
            )}

            {/* 3. FLOATABLE WHITEBOARD */}
            {/* 3. FLOATABLE WHITEBOARD */}
            {activeSidebar === "whiteboard" && (
                <Whiteboard 
                    socket={socket} 
                    roomId={id} 
                    username={user?.username}
                    onClose={() => setActiveSidebar(null)} 
                />
            )}

            {/* 3. MAIN EDITOR AREA */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* Coding Area + Right Panel Split */}
                <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", borderBottom: consoleOpen ? "1px solid var(--border-subtle)" : "none" }}>
                   
                   {/* EDITOR AREA or FULL SCREEN PROBLEM */}
                   <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                       {viewMode === "problem_full" ? (
                           // FULL SCREEN PROBLEM VIEW
                            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                                {rightPanel?.data && (
                                    <ProblemPreview 
                                        problem={rightPanel.data} 
                                        onCodeNow={handleCodeNow} 
                                    />
                                )}
                                {/* Close Full Screen Button */}
                                <button 
                                    onClick={() => setViewMode("editor")}
                                    style={{
                                        position: "absolute", top: "20px", right: "20px",
                                        background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)",
                                        color: "white", borderRadius: "50%", width: "32px", height: "32px",
                                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                       ) : (
                           // NORMAL EDITOR
                           accessStatus === "granted" && (
                               <Editors
                                    activeFile={activeFile}
                                        onCodeChange={setActiveCode}
                                        socket={socket}
                                        roomId={id}
                                        username={user?.username} 
                                        readOnly={isReadOnly}
                                        onCodeNow={handleCodeNow}
                               />
                           )
                       )}
                   </div>

                   {/* RIGHT PANEL (SPLIT VIEW) */}
                   {activeFile?.language === "html" && (
                       <>
                           <div 
                               onMouseDown={(e) => { e.preventDefault(); setIsRightPanelResizing(true); document.body.style.cursor = "col-resize"; }}
                               style={{ width: "4px", cursor: "col-resize", background: isRightPanelResizing ? "var(--accent-primary)" : "var(--border-subtle)", transition: "background 0.2s", zIndex: 10 }}
                           />
                           <div style={{ width: rightPanelWidth, display: "flex", flexDirection: "column" }}>
                                <div style={{ padding: "8px", background: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: "bold" }}>PREVIEW</div>
                                <div style={{ flex: 1, background: "white" }}>
                                    <Preview html={activeCode} />
                                </div>
                           </div>
                       </>
                   )}
                   
                   {rightPanel?.type === "preview" && activeFile?.type !== "preview" && viewMode !== "problem_full" && (
                        <>
                           <div 
                               onMouseDown={(e) => { e.preventDefault(); setIsRightPanelResizing(true); document.body.style.cursor = "col-resize"; }}
                               style={{ width: "4px", cursor: "col-resize", background: isRightPanelResizing ? "var(--accent-primary)" : "var(--border-subtle)", transition: "background 0.2s", zIndex: 10 }}
                           />
                            <div style={{ width: rightPanelWidth, display: "flex", flexDirection: "column" }}>
                                 {/* Tabs / Header */}
                                 <div style={{ height: "36px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Globe size={13}/> Description
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                         {rightPanel.data.provider === "leetcode" && (
                                            <>
                                            <button 
                                                onClick={handleSubmit}
                                                disabled={isSubmitting}
                                                className="btn-primary"
                                                title={extensionDetected === false ? "⚠️ Extension required — Install CodePlay Helper first" : "Submit to LeetCode"}
                                                style={{ padding: "4px 12px", fontSize: "11px", height: "24px", display: "flex", alignItems: "center", gap: "4px" }}
                                            >
                                                {isSubmitting ? "Submitting..." : "Submit to LeetCode"}
                                            </button>
                                            {extensionDetected === false && (
                                                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" title="Install extension to enable submissions" style={{ height: "24px", padding: "0 8px", borderRadius: "6px", background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", textDecoration: "none", fontSize: "11px", color: "#fb923c", fontWeight: 600, transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(251,146,60,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(251,146,60,0.12)"}>
                                                    <Puzzle size={11} /> Get Extension
                                                </a>
                                            )}
                                            </>
                                         )}
                                        <button 
                                            onClick={() => setRightPanel(null)}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                 </div>
                                 
                                 <div style={{ flex: 1, overflow: "hidden" }}>
                                     <ProblemPreview problem={rightPanel.data} onCodeNow={handleCodeNow} />
                                 </div>
                            </div>
                        </>
                   )}
                </div>

                {/* Bottom Terminal */}
                {consoleOpen && (
                    <>
                        <div 
                           onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                           style={{ height: "4px", cursor: "ns-resize", background: isResizing ? "var(--accent-primary)" : "var(--border-subtle)", transition: "background 0.2s" }} 
                        />
                        <ConsolePanel 
                            logs={logs} 
                            isOpen={consoleOpen} 
                            onClose={() => setConsoleOpen(false)} 
                            onClear={() => setLogs([])} 
                            input={input}
                            setInput={setInput}
                            height={consoleHeight}
                        />
                    </>
                )}
                {!consoleOpen && (
                    <div style={{ height: "30px", background: "var(--bg-panel)", display: "flex", alignItems: "center", padding: "0 16px", cursor: "pointer", borderTop: "1px solid var(--border-subtle)" }} onClick={() => setConsoleOpen(true)}>
                        <PanelBottom size={14} style={{ marginRight: "8px" }} />
                        <span style={{ fontSize: "12px" }}>Terminal</span>
                    </div>
                )}
            </div>

        </div>
      </div>

      
      
      {/* OVERLAYS */}
      
      {/* Recording Countdown Overlay - Always rendered at top level */}
      <CountdownOverlay count={countdown} active={countdownActive} />
      
      {/* Recording Preview Modal - Only when not recording */}
      {!isRecording && (
      <RecordingPreview
        blob={recordedBlob}
        isOpen={isRecordingPreviewOpen}
                isRecording={isRecording}
        onClose={() => setIsRecordingPreviewOpen(false)}
        onDownload={() => {
          downloadRecording("codeplay-solution");
          setIsRecordingPreviewOpen(false);
        }}
        onDiscard={() => {
          discardRecording();
          setIsRecordingPreviewOpen(false);
        }}
        duration={recordingTime}
      />
      )}

      {(accessStatus === "waiting" || accessStatus === "loading" || accessStatus === "login_required" || accessStatus === "denied") && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(24px) saturate(180%)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white" }}>
              <div style={{ 
                width: "72px", height: "72px", borderRadius: "20px", 
                background: accessStatus === "denied" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)", 
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px",
                border: `1px solid ${accessStatus === "denied" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
                animation: accessStatus === "loading" ? "pulse 2s ease-in-out infinite" : "none"
              }}>
                  {accessStatus === "login_required" ? <span style={{ fontSize: "32px" }}>🔑</span> : 
                   (accessStatus === "denied" ? <ShieldAlert size={32} color="#ef5350" /> : 
                   (accessStatus === "loading" ? <span style={{ fontSize: "32px" }}>⏳</span> : <span style={{ fontSize: "32px" }}>🔒</span>))}
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "8px", letterSpacing: "-0.02em", color: accessStatus === "denied" ? "#ef5350" : "white" }}>
                  {accessStatus === "login_required" ? "Authentication Required" : 
                   (accessStatus === "denied" ? "Access Denied" : 
                   (accessStatus === "loading" ? "Connecting..." : "Waiting for Host"))}
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "15px", marginBottom: "28px", maxWidth: "400px", textAlign: "center", lineHeight: "1.5" }}>{waitMessage}</p>
              
              {accessStatus === "login_required" && (
                  <button onClick={() => setAuthModalOpen(true)} className="btn-primary" style={{ padding: "12px 28px", fontSize: "15px", borderRadius: "12px" }}>Sign In to Join</button>
              )}
              {accessStatus === "denied" && (
                  <button onClick={() => navigate("/")} className="btn-secondary" style={{ padding: "12px 28px", fontSize: "15px", borderRadius: "12px", borderColor: "#ef5350", color: "#ef5350" }}>Return to Dashboard</button>
              )}
          </div>
      )}

      {pendingGuests.length > 0 && (
          <div style={{ position: "fixed", top: "60px", right: "16px", width: "300px", zIndex: 2000 }}>
              {pendingGuests.map((guest, i) => (
                  <div key={guest.socketId} style={{ padding: "16px", marginBottom: "8px", borderRadius: "14px", background: "rgba(28,28,30,0.95)", border: "1px solid rgba(124,92,252,0.25)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", backdropFilter: "blur(20px)", animation: "slideUp 0.3s ease-out" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: stringToColor(guest.username), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "14px", fontWeight: "600" }}>
                              {guest.username[0]?.toUpperCase()}
                          </div>
                          <div>
                              <div style={{ fontWeight: "600", color: "white", fontSize: "14px" }}>{guest.username}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>wants to join</div>
                          </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => handleGrant(guest.socketId)} className="btn-primary" style={{ flex: 1, padding: "8px", fontSize: "13px", borderRadius: "10px" }}>Accept</button>
                          <button onClick={() => handleDeny(guest.socketId)} className="btn-secondary" style={{ flex: 1, padding: "8px", fontSize: "13px", borderRadius: "10px", color: "#ef5350", borderColor: "rgba(239,68,68,0.3)" }}>Deny</button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      <VoicePanel
        isConnected={isConnected}
        connectionQuality={connectionQuality}
        user={user}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isSpeaking={isSpeaking}
        volume={volume}
        onMasterVolumeChange={setMasterVolume}
        peers={peers}
        speakingPeers={speakingPeers}
        onTogglePeerMute={mutePeer}
        onPeerVolumeChange={setPeerVolume}
        resolvePeerName={getPeerName}
      />

      {/* Floating Recording Indicator - Shows when recording but panel is closed */}
      {isRecording && activeSidebar !== "recording" && (
        <RecordingIndicator
          isRecording={isRecording}
          isPaused={isPaused}
          formattedTime={recordingTime}
          audioLevel={recordingAudioLevel}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          onExpand={() => setActiveSidebar("recording")}
          webcamEnabled={webcamEnabled}
          webcamStream={webcamStream}
          webcamPosition={webcamPosition}
                    isPreviewOpen={isRecordingPreviewOpen}
        />
      )}

      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} url={shareUrl} />
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      
      {/* LANGUAGE SELECTION MODAL */}
      {languageModalOpen && (
        <div style={{
            position: "fixed", inset: 0, 
            background: "rgba(0,0,0,0.65)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", animation: "fadeInScale 0.25s ease-out"
        }}>
            <div style={{ 
                width: "400px", maxWidth: "90%", background: "rgba(28,28,30,0.95)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", 
                padding: "28px", display: "flex", flexDirection: "column", gap: "18px",
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)", backdropFilter: "blur(40px)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "17px", fontWeight: "600", color: "white", letterSpacing: "-0.02em" }}>Choose Language</h3>
                    <button onClick={() => setLanguageModalOpen(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: "var(--text-muted)", width: "28px", height: "28px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}><X size={16}/></button>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.5", margin: 0 }}>Select the language for <strong style={{ color: "#fff" }}>{selectedProblemForCode?.title}</strong></p>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {[
                        { id: "cpp", name: "C++", color: "#f34b7d" },
                        { id: "java", name: "Java", color: "#b07219" },
                        { id: "python", name: "Python", color: "#3572A5" },
                        { id: "javascript", name: "JavaScript", color: "#f1e05a" }
                    ].map(lang => (
                        <button
                            key={lang.id}
                            onClick={() => confirmCodeNow(lang.id)}
                            style={{
                                padding: "14px 16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)",
                                background: "rgba(255,255,255,0.03)", color: "white", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "500",
                                transition: "all 0.2s ease"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${lang.color}60`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: lang.color, flexShrink: 0 }}></span>
                            {lang.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal 
          isOpen={deleteConfirm.isOpen}
          title="Delete File"
          message={`Are you sure you want to delete "${deleteConfirm.fileName}"? This action cannot be undone.`}
          onConfirm={handleFileDeleteConfirm}
          onCancel={() => setDeleteConfirm({ isOpen: false, fileId: null, fileName: "" })}
          confirmText="Delete"
          danger={true}
      />
      
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {aiPanelOpen && (
        <div style={{
            position: "fixed", 
            top: 0, 
            right: 0, 
            width: `${aiPanelWidth}px`, 
            minWidth: "320px",
            maxWidth: "50vw",
            height: "100vh", 
            zIndex: 99,
            borderLeft: "1px solid var(--border-subtle)", 
            background: "var(--bg-panel)",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
            animation: "slideInRight 0.25s ease-out",
            display: "flex",
            flexDirection: "row"
        }}>
            {/* Resize Handle */}
            <div
              style={{
                width: "6px",
                cursor: "ew-resize",
                background: isAiPanelResizing ? "linear-gradient(135deg, #4285f4, #9b72cb)" : "transparent",
                transition: "background 0.2s",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, #4285f440, #9b72cb40)"}
              onMouseLeave={e => { if(!isAiPanelResizing) e.currentTarget.style.background = "transparent"; }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsAiPanelResizing(true);
                const startX = e.clientX;
                const startWidth = aiPanelWidth;
                
                const onMouseMove = (moveEvent) => {
                  const delta = startX - moveEvent.clientX;
                  const newWidth = Math.min(Math.max(startWidth + delta, 320), window.innerWidth * 0.5);
                  setAiPanelWidth(newWidth);
                };
                
                const onMouseUp = () => {
                  setIsAiPanelResizing(false);
                  localStorage.setItem("aiPanelWidth", aiPanelWidth.toString());
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);
                };
                
                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
              }}
            >
              <div style={{ width: "2px", height: "40px", borderRadius: "2px", background: "var(--text-muted)", opacity: 0.3 }} />
            </div>
            
            {/* Panel Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <AIPanel 
                open={true} 
                onClose={() => setAiPanelOpen(false)} 
                onAsk={handleAskAI}
                currentProblem={rightPanel?.data ? (rightPanel.data.title || rightPanel.data.name || `Problem ${rightPanel.data.contestId}${rightPanel.data.index}`) : null}
              />
            </div>
        </div>
      )}
      
      {/* AI Panel slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* CSES Result Modal */}
      <CSESResultModal
        isOpen={csesResultModalOpen}
        onClose={() => {
          setCSESResultModalOpen(false);
          setCSESResultModalData(null);
          setCSESResultModalSubmissionId(null);
        }}
        submission={csesResultModalData}
        submissionId={csesResultModalSubmissionId}
        problemId={csesResultModalData?.problemId || null}
        user={user}
      />
    </ErrorBoundary>
  );
}
