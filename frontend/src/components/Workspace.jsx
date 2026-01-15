import { useState, useEffect, useRef } from "react";
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
import { Code2, Play, Share2, PanelBottom, Globe, FileCode, ShieldAlert, FlaskConical, X, Settings, Zap, Mic, MicOff, PhoneOff, Headphones, Volume2, VolumeX } from "lucide-react"; 
import { useVoiceChat } from "../hooks/useVoiceChat"; 
import SettingsModal from "./SettingsModal";
import SettingsPanel from "./SettingsPanel";
import Whiteboard from "./Whiteboard"; 

// Move socket outside to avoid multiple connections
const socket = io(API_URL);

const stringToColor = (str) => {
    if (!str) return "#ccc";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
};

export default function Workspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth(); 

  // --- STATE ---
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [activeCode, setActiveCode] = useState("");
  const debouncedCode = useDebounce(activeCode, 1000); // Autosave delay
  
  // Persist Active File
  useEffect(() => {
    if (activeFile) {
        localStorage.setItem("activeFileId", activeFile._id);
        if (activeFile.type === "preview") {
            // If it's a preview file (virtual), save the whole object
            localStorage.setItem("activePreviewFile", JSON.stringify(activeFile));
        } else {
            localStorage.removeItem("activePreviewFile");
        }
    }
  }, [activeFile]);
  
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
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false); 
  const [shareUrl, setShareUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
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


  // COLLAB STATE
  const [activeUsers, setActiveUsers] = useState([]); 
  const [hoveredUser, setHoveredUser] = useState(null);
  const [pendingGuests, setPendingGuests] = useState([]); 

  // TEST CASE STATE
  // TEST CASE STATE
  const [testCases, setTestCases] = useState(() => {
    try {
        const saved = localStorage.getItem("testCases");
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure all test cases have unique IDs (for backwards compatibility)
            return parsed.map((tc, i) => ({
                ...tc,
                id: tc.id || Date.now() + i
            }));
        }
        return [];
    } catch { return []; }
  });
  
  // Persist Test Cases
  useEffect(() => {
    localStorage.setItem("testCases", JSON.stringify(testCases));
  }, [testCases]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ACCESS STATE
  const [accessStatus, setAccessStatus] = useState("loading"); // loading, waiting, granted, denied, login_required
  const [waitMessage, setWaitMessage] = useState("Connecting to room...");


  // Persist Right Panel
  useEffect(() => {
    localStorage.setItem("rightPanel", JSON.stringify(rightPanel));
  }, [rightPanel]);

  // --- PROBLEM SYNC (Moved from JSX) ---
  useEffect(() => {
    if (!socket) return;
    
    // Listen for remote problem selection
    const handleSyncProblem = (problem) => {
        console.log(`📥 Syncing problem: ${problem?.title} (Desc Len: ${problem?.description?.length})`);
        setRightPanel({ type: "preview", data: problem });
        // Also switch to full screen problem view to match the sender
        setViewMode("problem_full");
    };

    socket.on("sync_problem", handleSyncProblem);

    // Fetch initial state when access is granted
    if (accessStatus === "granted") {
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
  const getPeerName = (peerId) => peers.find(p => p.peerId === peerId)?.username || peerId;
  const isHost = activeUsers.find(u => u.username === user?.username)?.isHost;

  // --- SOCKET CONFIG ---
  useEffect(() => {
	  if (!id || authLoading) return; 

	  if (!user) {
		  setAccessStatus("login_required");
		  setWaitMessage("Please sign in to join this room.");
		  setAuthModalOpen(true); 
		  return;
	  }
	  
	  if (accessStatus === "login_required") {
		  setAccessStatus("loading");
	  }

	  const joinRoom = () => {
		  console.log("Joining room:", id, "as", user.username);
		  socket.emit("join_room", { roomId: id, username: user.username });
	  };

	  joinRoom();
	  socket.on("connect", joinRoom);

	  socket.on("room_users", (users) => setActiveUsers(users));
	  
	  socket.on("status_update", ({ status, message }) => {
		  setAccessStatus(status); 
		  setWaitMessage(message);
	  });

	  socket.on("access_granted", () => {
		  setAccessStatus("granted");
		  setWaitMessage("");
	  });

	  socket.on("access_denied", () => {
		  setAccessStatus("denied");
		  setWaitMessage("The host has declined your request to join this room.");
	  });

	  socket.on("request_entry", ({ username, socketId }) => {
		  setPendingGuests(prev => {
			  if (prev.find(p => p.socketId === socketId)) return prev;
			  return [...prev, { username, socketId }];
		  });
	  });

	  socket.on("request_cancelled", ({ socketId }) => {
		  setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
	  });

      socket.on("sync_problem_state", ({ problem }) => {
          if (problem) {
              setRightPanel({ type: "preview", data: problem });
              setViewMode("problem_full");
          }
      });

	  return () => {
		  socket.off("connect", joinRoom);
		  socket.off("room_users");
		  socket.off("status_update");
		  socket.off("access_granted");
		  socket.off("access_denied");
		  socket.off("request_entry");
		  socket.off("request_cancelled");
          socket.off("sync_problem_state");
	  };
  }, [user, id, navigate, authLoading]);
  
  const handleGrant = (socketId) => {
	  socket.emit("grant_access", { socketId });
	  setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
  };

  const handleDeny = (socketId) => {
	   socket.emit("deny_access", { socketId });
	   setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
  };
  


  // --- FETCH FILES ---
  const fetchFiles = async () => {
	  try {
		  const res = await fetch(`${API_URL}/api/files?roomId=${id || "default"}`);
		  const data = await res.json();
		  setFiles(data);
		  
          // RESTORE ACTIVE FILE
		  if (!activeFile) {
              const lastId = localStorage.getItem("activeFileId");
              const savedPreview = localStorage.getItem("activePreviewFile");

              if (lastId && lastId.startsWith("preview-") && savedPreview) {
                  // Restore Virtual Preview
                  try {
                      const pf = JSON.parse(savedPreview);
                      setActiveFile(pf);
                      // Don't set activeCode required for preview? Preview uses activeFile.data
                  } catch (e) {}
              } else if (lastId) {
                  // Restore Real File
                  const found = data.find(f => f._id === lastId);
                  if (found) {
                      setActiveFile(found);
                      setActiveCode(found.content || "");
                  } else if (data.length > 0) {
                      // Fallback
                      setActiveFile(data[0]);
                      setActiveCode(data[0].content || "");
                  }
              } else if (data.length > 0) {
				  setActiveFile(data[0]);
				  setActiveCode(data[0].content || "");
			  }
		  }
	  } catch (err) { console.error("Failed to fetch files", err); }
  };

  useEffect(() => { fetchFiles(); }, []);

  useEffect(() => {
	if (activeFile && activeFile.type !== "preview" && debouncedCode !== activeFile.content) {
		fetch(`${API_URL}/api/files/${activeFile._id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: debouncedCode })
		}).then(() => {
			console.log("Saved:", activeFile.name);
			setFiles(prev => prev.map(f => f._id === activeFile._id ? { ...f, content: debouncedCode } : f));
		}).catch(err => console.error("Autosave failed", err));
	}
  }, [debouncedCode]);

  // --- RESIZE HANDLER ---
  useEffect(() => {
	  const handleMouseMove = (e) => {
		  if (isResizing) {
			  const newHeight = window.innerHeight - e.clientY;
			  if (newHeight > 50 && newHeight < window.innerHeight - 100) {
				  setConsoleHeight(newHeight);
			  }
		  }
		  if (isSidebarResizing) {
			  const newWidth = e.clientX - 48; // Subtract sidebar icon bar width
			  if (newWidth > 150 && newWidth < 800) {
				  setSidebarWidth(newWidth);
			  }
		  }
		  if (isRightPanelResizing) {
			  const newWidth = window.innerWidth - e.clientX;
			  if (newWidth > 200 && newWidth < window.innerWidth - 300) {
				  setRightPanelWidth(newWidth);
			  }
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

  // --- HANDLERS ---
  const switchRightPanel = (type, data) => setRightPanel({ type, data });

  const handleFileSelect = (file) => {
	  setActiveFile(file);
	  setActiveCode(file.content || "");
  };

  const handleFileCreate = async (name) => {
	  const ext = name.split('.').pop();
	  const langMap = { js: "javascript", html: "html", css: "css", py: "python", java: "java", cpp: "cpp" };
	  const language = langMap[ext] || "javascript";
	  
	  try {
		  const res = await fetch(`${API_URL}/api/files`, {
			 method: "POST", headers: { "Content-Type": "application/json" },
			 body: JSON.stringify({ name, language, folder: "/", roomId: id || "default" }) 
		  });
		  const newFile = await res.json();
		  setFiles(prev => [...prev, newFile]);
		  setActiveFile(newFile);
		  setActiveCode("");
	  } catch (err) { console.error(err); }
  };

  const handleFileDelete = async (id) => {
	  try {
		  await fetch(`${API_URL}/api/files/${id}`, { method: "DELETE" });
		  setFiles(prev => prev.filter(f => f._id !== id));
		  if (activeFile?._id === id) {
			  setActiveFile(null);
			  setActiveCode("");
		  }
	  } catch (err) { console.error(err); }
  };

  // --- EXECUTION & TESTS ---
  async function handleRun() {
	if (!user) { setAuthModalOpen(true); return; }
	if (!activeFile) return;

	setConsoleOpen(true);
	setIsRunning(true);
	setLogs([{ type: "info", message: "Compiling..." }]);

	if (id) socket.emit("sync_run_trigger", { roomId: id, username: user.username });

    // AUTO RUNNER LOGIC
    let codeToRun = activeCode;
    if (activeFile.language === "cpp" && codeToRun.includes("class Solution") && !codeToRun.includes("int main")) {
         if (rightPanel?.data) {
             console.log("Injecting Auto-Runner...");
             codeToRun = generateCppRunner(codeToRun, rightPanel.data);
         } else {
             setLogs(prev => [...prev, { type: "warning", message: "Warning: Problem description (Right Panel) is closed. Auto-runner might fail." }]);
         }
    }

	try {
		const res = await fetch(`${API_URL}/api/code/execute`, {
			method: "POST", headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ 
				language: activeFile.language, 
				code: codeToRun, 
				stdin: input 
			}),
		});
		const data = await res.json();
		const newLogs = [{ type: data.run?.code === 0 ? "log" : "error", message: data.run?.output || "Execution finished." }];
		setLogs(prev => [...prev, ...newLogs]);

		if (id) socket.emit("sync_run_result", { roomId: id, logs: newLogs });

	} catch (err) { 
		const errorLog = [{ type: "error", message: "Server Error." }];
		setLogs(prev => [...prev, ...errorLog]);
		if (id) socket.emit("sync_run_result", { roomId: id, logs: errorLog });
	}
	finally { setIsRunning(false); }
  }

  const runTests = async () => {
    if (!activeFile) return;
    setIsRunningTests(true);
    
    // AUTO RUNNER LOGIC
    let codeToRun = activeCode;
    if (activeFile.language === "cpp" && codeToRun.includes("class Solution") && !codeToRun.includes("int main")) {
         if (rightPanel?.data) {
             codeToRun = generateCppRunner(codeToRun, rightPanel.data);
         }
    }
    
    const newTestCases = [...testCases];
    
    for (let i = 0; i < newTestCases.length; i++) {
        const test = newTestCases[i];
        newTestCases[i] = { ...test, status: "running", actualOutput: "" };
        setTestCases([...newTestCases]); 

        try {
            const res = await fetch(`${API_URL}/api/code/execute`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    language: activeFile.language, 
                    code: codeToRun, 
                    stdin: test.input 
                }),
            });
            const data = await res.json();
            const output = data.run?.output?.trim() || "";
            
            newTestCases[i].actualOutput = output;
            if (output === test.expectedOutput?.trim()) {
                newTestCases[i].status = "accepted";
            } else {
                newTestCases[i].status = "wrong_answer";
            }
        } catch (err) {
            newTestCases[i].status = "error";
            newTestCases[i].actualOutput = "Execution Error";
        }
        setTestCases([...newTestCases]);
    }
    setIsRunningTests(false);
  };

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
        submissionInProgressRef.current = false; // Reset for early returns
        setIsSubmitting(false);
        const problemId = rightPanel.data.id || rightPanel.data.index; // CSES uses .id, fall back if needed
        
        // TEMPORARY: Disable CSES Submission
        setLogs(prev => [...prev, { type: "warning", message: "CSES submission is not available for the moment." }]);
        setConsoleOpen(true);
        return;
        
        const payload = {
            problemId,
            code: activeCode
        };

        const handleResult = (event) => {
            if (event.data.type === "CODEPLAY_CSES_SUBMIT_RESULT") {
                window.removeEventListener("message", handleResult);
                const res = event.data.payload || { success: false, error: "No response from extension" };
                setIsSubmitting(false);
                submissionInProgressRef.current = false;

                if (res.success) {
                     setLogs(prev => [...prev, { type: "success", message: `CSES: ${res.message}` }]);
                } else {
                     setLogs(prev => [...prev, { type: "error", message: `CSES Failed: ${res.error}` }]);
                }
            }
        };

        window.addEventListener("message", handleResult);
        window.postMessage({ type: "CODEPLAY_SUBMIT_CSES", payload }, "*");

        // Timeout
        setTimeout(() => {
             window.removeEventListener("message", handleResult);
             setIsSubmitting(prev => {
                 if (prev) { 
                     setLogs(p => [...p, { type: "error", message: "Submission Failed: Extension Disconnected. Check if Extension is active." }]);
                     return false;
                 }
                 return prev;
             });
        }, 10000);
        
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
                                                     const filtered = prev.filter(l => !l.message.startsWith("Running on test"));
                                                     return [...filtered, { type: "info", message: `Running on test ${testCount}...` }];
                                                 });
                                            } else {
                                                clearInterval(pollInterval);
                                                const isAc = verdict === "OK";
                                                setLogs(prev => {
                                                     const filtered = prev.filter(l => !l.message.startsWith("Running on test"));
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

        const res = await fetch(`${API_URL}/api/leettools/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                slug: problem.titleSlug,
                questionId: problem.questionId,
                lang: "cpp",
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
                         language: "cpp",
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
    try {
        const res = await fetch(`${API_URL}/api/ai/assist`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: userPrompt, code: codeContext })
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
        // Ensure Main.java for Java if required, or unique name
        const fileName = language === "java" ? "Main.java" : `solution_${problem.id}.${ext}`; 
        
        let targetFile = files.find(f => f.name === fileName);
        
        if (!targetFile) {
            try {
                const res = await fetch(`${API_URL}/api/files`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
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
                            input: inputLines.join('\n'),
                            expectedOutput: expectedOutputs[testIndex] || ""
                        });
                        testIndex++;
                    }
                }
                
                setTestCases(parsedTests.length > 0 ? parsedTests : [{ input: "", expectedOutput: "" }]);
                console.log("[LeetCode] Parsed", parsedTests.length, "test cases with", argCount, "args each, found", expectedOutputs.length, "expected outputs");
            } else if (problem.testCases && Array.isArray(problem.testCases)) {
                setTestCases(problem.testCases.map(tc => ({
                    input: tc.input || "",
                    expectedOutput: tc.expectedOutput || tc.output || ""
                })));
            } else {
                setTestCases([{ input: "", expectedOutput: "" }]);
            }
        } else if (problem.testCases && Array.isArray(problem.testCases)) {
            // Codeforces/GFG: standard format
            setTestCases(problem.testCases.map(tc => ({
                input: tc.input || "",
                expectedOutput: tc.expectedOutput || tc.output || ""
            })));
        } else {
            setTestCases([]);
        }
    };



    return (
    <ErrorBoundary>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-dark)", color: "var(--text-main)" }}>
        
        {/* HEADER */}
        <div style={{ height: "50px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "#111", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                 <div onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Code2 size={20} color="#8b5cf6" />
                    <span style={{ fontWeight: "700", fontSize: "16px" }}>CodePlay</span>
                </div>
                {activeFile && activeFile.type !== "preview" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", background: "#f3f3f310", padding: "4px 8px", borderRadius: "12px", border: "1px solid #ffffff20" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: activeFile.language === "html" ? "#e34c26" : (activeFile.language === "javascript" ? "#f1e05a" : "#3572A5") }}></span>
                        <span style={{ color: "#eee", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{activeFile.language}</span>
                    </div>
                )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                
                <div style={{ display: "flex", alignItems: "center", paddingLeft: "8px" }}>
                    {activeUsers.map((u, i) => (
                        <div 
                            key={i} 
                            onMouseEnter={() => setHoveredUser(u.username)}
                            onMouseLeave={() => setHoveredUser(null)}
                            style={{ 
                                width: "32px", height: "32px", borderRadius: "50%", 
                                background: stringToColor(u.username || "User"), 
                                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", 
                                fontSize: "14px", fontWeight: "bold", 
                                border: "2px solid #111", 
                                marginLeft: "-10px", 
                                cursor: "pointer",
                                position: "relative",
                                zIndex: 10 + i
                            }}
                        >
                            {(u.username || "U")[0].toUpperCase()}
                            {hoveredUser === u.username && (
                                <div style={{
                                    position: "absolute",
                                    top: "40px", left: "50%", transform: "translateX(-50%)",
                                    background: "#333", color: "white", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", whiteSpace: "nowrap", zIndex: 1000, pointerEvents: "none", boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                                }}>
                                    {u.username}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <button onClick={handleRun} disabled={isRunning} className="btn-primary" style={{ padding: "6px 16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                     {isRunning ? "..." : <><Play size={14} fill="white" /> Run</>}
                </button>
                {rightPanel?.data && (
                    <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary" style={{ padding: "6px 16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
                         {isSubmitting ? "..." : <><Zap size={14} fill="white" /> Submit</>}
                    </button>
                )}
                <button onClick={handleCopyLink} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}><Share2 size={14} /></button>
                {!user && <button onClick={() => setAuthModalOpen(true)} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}>Login</button>}
            
                {/* FORCE SEPARATOR */}
                <div style={{ width: "1px", height: "24px", background: "var(--border-subtle)", margin: "0 4px" }}></div>

                {/* VOICE CONTROLS */}
                {!isConnected ? (
                    <button 
                        onClick={joinVoice} 
                        className="btn-secondary" 
                        style={{ padding: "6px 12px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", borderColor: "var(--accent-primary)", color: "var(--accent-primary)" }}
                        title="Join Voice Chat"
                    >
                        <MicOff size={14} /> Join Voice
                    </button>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#333", borderRadius: "6px", padding: "2px", border: `1px solid ${isSpeaking ? '#22c55e' : '#444'}`, transition: "border-color 0.15s" }}>
                         <button 
                            onClick={toggleMute}
                            style={{ 
                                background: isMuted ? "#ef5350" : "#22c55e", 
                                border: "none", borderRadius: "4px", 
                                width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s",
                                boxShadow: isSpeaking && !isMuted ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none'
                            }}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? <MicOff size={14} color="white" /> : <Mic size={14} color="white" />}
                        </button>
                        <button 
                            onClick={toggleDeafen}
                            style={{ 
                                background: isDeafened ? "#ef5350" : "transparent", 
                                border: "none", borderRadius: "4px", 
                                width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s"
                            }}
                            title={isDeafened ? "Undeafen" : "Deafen (mute all audio)"}
                        >
                            {isDeafened ? <VolumeX size={14} color="white" /> : <Headphones size={14} color="#aaa" />}
                        </button>
                        <button 
                            onClick={leaveVoice}
                            style={{ 
                                background: "transparent", 
                                border: "none", borderRadius: "4px", 
                                width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" 
                            }}
                            className="hover-bg-red"
                            title="Disconnect Voice"
                        >
                            <PhoneOff size={14} color="#aaa" />
                        </button>
                        {/* Connection quality indicator */}
                        <div style={{ 
                            width: "8px", height: "8px", borderRadius: "50%", marginLeft: "4px",
                            background: connectionQuality === 'good' ? '#22c55e' : connectionQuality === 'medium' ? '#f59e0b' : '#ef5350'
                        }} title={`Connection: ${connectionQuality}`} />
                    </div>
                )}
            </div>
        </div>
        </div>

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
                            onDelete={handleFileDelete}
                        />
                    )}
                    {activeSidebar === "participants" && <ParticipantsPanel users={activeUsers} />}
                    {activeSidebar === "tests" && <TestPanel testCases={testCases} setTestCases={setTestCases} runTests={runTests} isRunningTests={isRunningTests || isSubmitting} />}
                    
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
                                            <button 
                                                onClick={handleSubmit}
                                                disabled={isSubmitting}
                                                className="btn-primary"
                                                style={{ padding: "4px 12px", fontSize: "11px", height: "24px", display: "flex", alignItems: "center", gap: "4px" }}
                                            >
                                                {isSubmitting ? "Submitting..." : "Submit to LeetCode"}
                                            </button>
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
      {(accessStatus === "waiting" || accessStatus === "loading" || accessStatus === "login_required" || accessStatus === "denied") && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white" }}>
              <div className="animate-pulse" style={{ fontSize: "64px", marginBottom: "20px", color: accessStatus === "denied" ? "#ef5350" : "white" }}>
                  {accessStatus === "login_required" ? "🔑" : (accessStatus === "denied" ? <ShieldAlert size={64} /> : (accessStatus === "loading" ? "⏳" : "🔒"))}
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px", color: accessStatus === "denied" ? "#ef5350" : "white" }}>
                  {accessStatus === "login_required" ? "Authentication Required" : 
                   (accessStatus === "denied" ? "Access Denied" : 
                   (accessStatus === "loading" ? "Connecting..." : "Waiting for Host"))}
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "16px", marginBottom: "20px" }}>{waitMessage}</p>
              
              {accessStatus === "login_required" && (
                  <button onClick={() => setAuthModalOpen(true)} className="btn-primary" style={{ padding: "10px 24px", fontSize: "16px" }}>Sign In to Join</button>
              )}
              {accessStatus === "denied" && (
                  <button onClick={() => navigate("/")} className="btn-secondary" style={{ padding: "10px 24px", fontSize: "16px", borderColor: "#ef5350", color: "#ef5350" }}>Return to Dashboard</button>
              )}
          </div>
      )}

      {pendingGuests.length > 0 && (
          <div style={{ position: "fixed", top: "70px", right: "20px", width: "320px", zIndex: 2000 }}>
              {pendingGuests.map((guest, i) => (
                  <div key={guest.socketId} className="glass-panel" style={{ padding: "16px", marginBottom: "10px", borderRadius: "8px", background: "rgba(20, 20, 30, 0.95)", border: "1px solid var(--accent-primary)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "slideIn 0.3s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                          <span style={{ fontSize: "20px" }}>👋</span>
                          <div>
                              <div style={{ fontWeight: "bold", color: "white" }}>{guest.username}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>wants to join the room.</div>
                          </div>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                          <button onClick={() => handleGrant(guest.socketId)} className="btn-primary" style={{ flex: 1, padding: "8px", fontSize: "12px" }}>Accept</button>
                          <button onClick={() => handleDeny(guest.socketId)} className="btn-secondary" style={{ flex: 1, padding: "8px", fontSize: "12px", color: "#ef5350", borderColor: "#ef5350" }}>Deny</button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* VOICE PARTICIPANTS BOX */}
      {isConnected && (
          <div style={{
              position: "fixed", top: "70px", right: "20px", width: "260px",
              background: "rgba(20, 20, 30, 0.95)", border: "1px solid var(--border-subtle)",
              borderRadius: "12px", padding: "16px", zIndex: 1000, boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
          }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#aaa", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>VOICE CHAT ({peers.length + 1})</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ 
                          width: "8px", height: "8px", borderRadius: "50%",
                          background: connectionQuality === 'good' ? '#22c55e' : connectionQuality === 'medium' ? '#f59e0b' : '#ef5350',
                          animation: "pulse 2s infinite"
                      }} />
                      <span style={{color: connectionQuality === 'good' ? "#22c55e" : connectionQuality === 'medium' ? '#f59e0b' : '#ef5350', fontSize: "10px"}}>
                          {connectionQuality === 'good' ? 'Connected' : connectionQuality === 'medium' ? 'Connecting...' : 'Poor'}
                      </span>
                  </div>
              </div>
              
              {/* MASTER VOLUME SLIDER */}
              <div style={{ marginBottom: "12px", padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <Volume2 size={14} color="#888" />
                      <span style={{ fontSize: "11px", color: "#888" }}>Master Volume</span>
                      <span style={{ fontSize: "11px", color: "#666", marginLeft: "auto" }}>{volume}%</span>
                  </div>
                  <input 
                      type="range" 
                      min="0" max="100" 
                      value={volume}
                      onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                      style={{ width: "100%", height: "4px", cursor: "pointer" }}
                  />
              </div>
              
              {/* ME */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ 
                          width: "28px", height: "28px", borderRadius: "50%", 
                          background: stringToColor(user?.username), color: "#fff", 
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold",
                          border: isSpeaking && !isMuted ? "2px solid #22c55e" : isMuted ? "2px solid #ef5350" : "2px solid transparent",
                          boxShadow: isSpeaking && !isMuted ? "0 0 10px rgba(34,197,94,0.5)" : "none",
                          transition: "all 0.15s"
                      }}>
                          {user?.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                          <div style={{ color: "white", fontWeight: "500" }}>{user?.username}</div>
                          <div style={{ fontSize: "10px", color: "#666" }}>You</div>
                      </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {isMuted && <MicOff size={14} color="#ef5350" />}
                      {isDeafened && <VolumeX size={14} color="#ef5350" />}
                  </div>
              </div>

              {/* PEERS */}
              {peers.map(p => {
                  const pName = p.username || getPeerName(p.peerId); 
                  const peerIsSpeaking = speakingPeers.has(p.peerId);
                  const peerVolume = p.volume ?? 100;
                  const peerMuted = p.muted ?? false;
                  
                  return (
                    <div key={p.peerId} style={{ marginBottom: "8px", padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px", fontSize: "13px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ 
                                    width: "28px", height: "28px", borderRadius: "50%", 
                                    background: stringToColor(pName), color: "#fff", 
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold",
                                    border: peerIsSpeaking ? "2px solid #22c55e" : "2px solid transparent",
                                    boxShadow: peerIsSpeaking ? "0 0 10px rgba(34,197,94,0.5)" : "none",
                                    transition: "all 0.15s"
                                }}>
                                    {pName[0]?.toUpperCase()}
                                </div>
                                <span style={{ color: "white", fontWeight: "500" }}>{pName}</span>
                            </div>
                            <button
                                onClick={() => mutePeer(p.peerId, !peerMuted)}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                                title={peerMuted ? "Unmute user" : "Mute user (only for you)"}
                            >
                                {peerMuted ? <VolumeX size={14} color="#ef5350" /> : <Volume2 size={14} color="#888" />}
                            </button>
                        </div>
                        {/* Individual volume slider */}
                        <input 
                            type="range" 
                            min="0" max="100" 
                            value={peerMuted ? 0 : peerVolume}
                            onChange={(e) => setPeerVolume(p.peerId, parseInt(e.target.value))}
                            disabled={peerMuted}
                            style={{ width: "100%", height: "3px", cursor: peerMuted ? "not-allowed" : "pointer", opacity: peerMuted ? 0.4 : 1 }}
                        />
                    </div>
                  );
              })}
              
              {peers.length === 0 && (
                  <div style={{ textAlign: "center", color: "#666", fontSize: "12px", padding: "12px" }}>
                      Waiting for others to join...
                  </div>
              )}
          </div>
      )}

      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} url={shareUrl} />
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      
      {/* LANGUAGE SELECTION MODAL */}
      {languageModalOpen && (
        <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
            background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
            <div className="glass-panel" style={{ 
                width: "400px", background: "#1e1e2e", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)", 
                padding: "24px", display: "flex", flexDirection: "column", gap: "16px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "white" }}>Choose Language</h3>
                    <button onClick={() => setLanguageModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}><X size={20}/></button>
                </div>
                <p style={{ color: "#a1a1aa", fontSize: "14px" }}>Select the language you want to code in for <strong>{selectedProblemForCode?.title}</strong>.</p>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {[
                        { id: "cpp", name: "C++", color: "#3b82f6" },
                        { id: "java", name: "Java", color: "#ea580c" },
                        { id: "python", name: "Python", color: "#eab308" },
                        { id: "javascript", name: "JavaScript", color: "#facc15" }
                    ].map(lang => (
                        <button
                            key={lang.id}
                            onClick={() => confirmCodeNow(lang.id)}
                            style={{
                                padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)",
                                background: "rgba(255,255,255,0.02)", color: "white", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "500",
                                transition: "all 0.2s"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = lang.color; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
                        >
                            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: lang.color }}></span>
                            {lang.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      
      <button 
        onClick={() => setAiPanelOpen(!aiPanelOpen)}
        style={{
            position: "fixed", bottom: "24px", right: "24px", width: "56px", height: "56px", borderRadius: "50%",
            background: "linear-gradient(135deg, #4285f4, #9b72cb, #d96570)", 
            border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, transition: "transform 0.2s"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C12.5 7.5 16.5 11.5 22 12C16.5 12.5 12.5 16.5 12 22C11.5 16.5 7.5 12.5 2 12C7.5 11.5 11.5 7.5 12 2Z" fill="white"/>
        </svg>
      </button>

      {aiPanelOpen && (
        <div style={{
            position: "fixed", bottom: "90px", right: "24px", width: "350px", height: "500px", zIndex: 99,
            borderRadius: "12px", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", border: "1px solid var(--border-subtle)", background: "var(--bg-panel)"
        }}>
            <AIPanel open={true} onClose={() => setAiPanelOpen(false)} onAsk={handleAskAI} />
        </div>
      )}
    </ErrorBoundary>
  );
}
