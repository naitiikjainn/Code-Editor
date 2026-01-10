import { useState, useEffect } from "react";
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
import ProblemPreview from "./ProblemPreview"; 
import ErrorBoundary from "./ErrorBoundary"; 
import useDebounce from "../hooks/useDebounce"; 
import { useParams, useNavigate } from "react-router-dom"; 
import { API_URL } from "../config"; 
import io from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { Code2, Play, Share2, PanelBottom, Globe, FileCode, ShieldAlert, FlaskConical, X, Settings, Zap, Mic, MicOff, PhoneOff } from "lucide-react"; 
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
  const [viewMode, setViewMode] = useState("editor"); // "editor" | "problem_full"
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
  const [consoleHeight, setConsoleHeight] = useState(250); 
  const [isResizing, setIsResizing] = useState(false); 
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false); 

  // RIGHT PANEL STATE (CPH Style)
  const [rightPanel, setRightPanel] = useState(() => {
    try {
        const saved = localStorage.getItem("rightPanel");
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }); // { type: 'preview', data: problem } or null 
  const [rightPanelWidth, setRightPanelWidth] = useState(600);
  const [isRightPanelResizing, setIsRightPanelResizing] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);


  // COLLAB STATE
  const [activeUsers, setActiveUsers] = useState([]); 
  const [hoveredUser, setHoveredUser] = useState(null);
  const [pendingGuests, setPendingGuests] = useState([]); 

  // TEST CASE STATE
  // TEST CASE STATE
  const [testCases, setTestCases] = useState(() => {
    try {
        const saved = localStorage.getItem("testCases");
        return saved ? JSON.parse(saved) : [];
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
  const { isConnected, isMuted, joinVoice, leaveVoice, toggleMute, peers, speakingPeers, mutePeer } = useVoiceChat(socket, id);
  // Helper to map peerId (socketId) to username
  const getPeerName = (peerId) => activeUsers.find(u => u.socketId === peerId)?.username || "Unknown";
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
          if (problem) switchRightPanel("preview", problem);
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

  const handleSubmit = async () => {
    if (!rightPanel?.data) return;

    // --- CSES SUBMISSION ---
    if (rightPanel.data.provider === "cses") {
        const problemId = rightPanel.data.id || rightPanel.data.index; // CSES uses .id, fall back if needed
        
        // TEMPORARY: Disable CSES Submission
        setLogs(prev => [...prev, { type: "warning", message: "CSES submission is not available for the moment." }]);
        setConsoleOpen(true);
        return;

        setIsSubmitting(true);
        setLogs(prev => [...prev, { type: "info", message: `Submitting problem ${problemId} to CSES...` }]);
        setConsoleOpen(true);
        
        const payload = {
            problemId,
            code: activeCode
        };

        const handleResult = (event) => {
            if (event.data.type === "CODEPLAY_CSES_SUBMIT_RESULT") {
                window.removeEventListener("message", handleResult);
                const res = event.data.payload || { success: false, error: "No response from extension" };
                setIsSubmitting(false);

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
            return;
        }

        setIsSubmitting(true);
        setLogs(prev => [...prev, { type: "info", message: `Submitting problem ${contestId}${index} to Codeforces...` }]);
        setConsoleOpen(true);

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
            code: activeCode,
            languageId: langId 
        };

        const handleResult = (event) => {
            if (event.data.type === "CODEPLAY_SUBMIT_RESULT") {
                window.removeEventListener("message", handleResult);
                
                const res = event.data.payload || { success: false, error: "No response from extension" };
                setIsSubmitting(false);
                
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
                                                 // Working...
                                            } else {
                                                clearInterval(pollInterval);
                                                const isAc = verdict === "OK";
                                                setLogs(prev => [...prev, { 
                                                    type: isAc ? "success" : "error", 
                                                    message: `Verdict: ${verdict === "OK" ? "ACCEPTED" : verdict} (${submission.timeConsumedMillis}ms)` 
                                                }]);

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
        
        setTimeout(() => {
             window.removeEventListener("message", handleResult);
             setIsSubmitting(prev => {
                 if (prev) { 
                     setLogs(p => [...p, { type: "error", message: "Submission Failed: Extension Disconnected. Please REFRESH the page to reconnect." }]);
                     return false;
                 }
                 return prev;
             });
        }, 8000);
        
        return;
    }

    let cookie = localStorage.getItem("lc_session");
    let csrfToken = localStorage.getItem("lc_csrf");
    
    // AUTO-FETCH CREDENTIALS IF MISSING
    if (!cookie || !csrfToken) {
        setLogs(prev => [...prev, { type: "info", message: "Credentials missing. Attempting auto-fetch via Extension..." }]);
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
                localStorage.setItem("lc_session", cookie);
                localStorage.setItem("lc_csrf", csrfToken);
                setLogs(prev => [...prev, { type: "success", message: "Credentials fetched successfully!" }]);
                // Update local state if settings modal was using them (optional, but good for consistency)
            } else {
                throw new Error(data.error || "Extension processing failed.");
            }
        } catch (e) {
            console.error(e);
            setLogs(prev => [...prev, { type: "error", message: `Auto-Fetch Failed: ${e.message}. CHECK: Extension installed? Logged into LeetCode?` }]);
            return;
        }
    }
    
    setIsSubmitting(true);
    setLogs(prev => [...prev, { type: "info", message: "Submitting to LeetCode..." }]);
    setConsoleOpen(true);

    try {
        const problem = rightPanel.data;
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
             setLogs(prev => [...prev, { type: "error", message: "Authentication Failed. Please update your LeetCode Cookie/CSRF in Settings." }]);
             setSettingsModalOpen(true);
             return;
        }

        if (data.success) {
             const result = data.result;
             const isSuccess = result.status_msg === "Accepted";
             setLogs(prev => [...prev, { 
                 type: isSuccess ? "success" : "error", 
                 message: `LeetCode Verdict: ${result.status_msg} \nRuntime: ${result.status_runtime} \nMemory: ${result.status_memory}` 
             }]);
        } else {
             setLogs(prev => [...prev, { type: "error", message: `Submission Error: ${data.error || "Unknown error"}` }]);
        }

    } catch (err) {
        console.error(err);
        setLogs(prev => [...prev, { type: "error", message: "Submission Failed." }]);
    } finally {
        setIsSubmitting(false);
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

        // --- GENERATE BOILERPLATE BASED ON LANGUAGE ---
        if (language === "cpp") {
             // ... existing C++ logic ...
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
            setActiveFile(targetFile);
            setActiveCode(targetFile.content || initialCode);
        }

        // 5. ENSURE PREVIEW IS AVAILABLE (Right Panel)
        setRightPanel({ type: "preview", data: problem });
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
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#333", borderRadius: "6px", padding: "2px", border: "1px solid #444" }}>
                         <button 
                            onClick={toggleMute}
                            style={{ 
                                background: isMuted ? "#ef5350" : "#22c55e", 
                                border: "none", borderRadius: "4px", 
                                width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s"
                            }}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? <MicOff size={14} color="white" /> : <Mic size={14} color="white" />}
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
                    </div>
                )}
            </div>
        </div>
        </div>

        {/* INVISIBLE AUDIO ELEMENTS FOR PEERS */}
        {peers.map(peer => (
            <audio 
                key={peer.peerId} 
                autoPlay 
                playsInline
                ref={el => {
                    if (el && el.srcObject !== peer.stream) {
                        el.srcObject = peer.stream;
                        el.play().catch(e => console.error("AutoPlay Error:", e));
                    }
                }} 
            />
        ))}

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
              position: "fixed", top: "70px", right: "20px", width: "220px",
              background: "rgba(20, 20, 30, 0.95)", border: "1px solid var(--border-subtle)",
              borderRadius: "8px", padding: "12px", zIndex: 1000, boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
          }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#aaa", marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
                  <span>VOICE CONNECTED ({peers.length + 1})</span>
                  <span style={{color:"#22c55e", fontSize: "10px"}}>● Live</span>
              </div>
              
              {/* ME */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: stringToColor(user?.username), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", border: isMuted ? "2px solid #ef5350" : "2px solid #22c55e" }}>
                          {user?.username?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ color: "white" }}>{user?.username} (You)</span>
                  </div>
                  {isMuted && <MicOff size={12} color="#ef5350" />}
              </div>

              {/* PEERS */}
              {peers.map(p => {
                  const pName = p.username || getPeerName(p.peerId); 
                  const isSpeaking = speakingPeers.has(p.peerId);
                  
                  return (
                    <div key={p.peerId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ 
                                width: "24px", height: "24px", borderRadius: "50%", 
                                background: stringToColor(pName), color: "#fff", 
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px",
                                border: isSpeaking ? "2px solid #22c55e" : "2px solid transparent",
                                boxShadow: isSpeaking ? "0 0 8px #22c55e" : "none",
                                transition: "all 0.1s"
                            }}>
                                {pName[0]?.toUpperCase()}
                            </div>
                            <span style={{ color: "white" }}>{pName}</span>
                        </div>
                    </div>
                  );
              })}
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
