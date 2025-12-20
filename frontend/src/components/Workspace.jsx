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
import useDebounce from "../hooks/useDebounce"; 
import { useParams, useNavigate } from "react-router-dom"; 
import { API_URL } from "../config"; 
import io from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { Code2, Play, Share2, PanelBottom, Globe, FileCode, ShieldAlert, FlaskConical, X, Settings } from "lucide-react"; 
import SettingsModal from "./SettingsModal"; 

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
  const [sidebarWidth, setSidebarWidth] = useState(300);
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

	  return () => {
		  socket.off("connect", joinRoom);
		  socket.off("room_users");
		  socket.off("status_update");
		  socket.off("access_granted");
		  socket.off("access_denied");
		  socket.off("request_entry");
		  socket.off("request_cancelled");
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
    const cookie = localStorage.getItem("lc_session");
    const csrfToken = localStorage.getItem("lc_csrf");
    
    if (!cookie || !csrfToken) {
        setSettingsModalOpen(true);
        return;
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

  return (
    <>
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
                <button onClick={() => setSettingsModalOpen(true)} className="btn-secondary" style={{ padding: "6px" }} title="LeetCode Settings">
                    <Settings size={16} />
                </button>
                
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
                <button onClick={handleCopyLink} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}><Share2 size={14} /></button>
                {!user && <button onClick={() => setAuthModalOpen(true)} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}>Login</button>}
            </div>
        </div>
        </div>

        {/* WORKSPACE BODY */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            
            {/* 1. SIDEBAR NAVIGATION */}
            <Sidebar activeTab={activeSidebar} setActiveTab={setActiveSidebar} isOpen={!!activeSidebar} />

            {/* 2. SIDEBAR PANEL */}
            {activeSidebar && (
                <>
                    <div style={{ width: sidebarWidth, height: "100%", overflow: "hidden", background: "var(--bg-panel)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column" }}>
                        {activeSidebar === "files" && (
                            <FileExplorer 
                                files={files} 
                                activeFileId={activeFile?._id} 
                                onSelect={handleFileSelect} 
                                onDelete={handleFileDelete}
                                onCreate={handleFileCreate}
                            />
                        )}
                        {activeSidebar === "participants" && (
                            <ParticipantsPanel users={activeUsers} />
                        )}
                        {activeSidebar === "tests" && (
                            <TestPanel 
                                testCases={testCases}
                                setTestCases={setTestCases}
                                runTests={runTests}
                                isRunningTests={isRunningTests}
                                onClose={() => setActiveSidebar(null)}
                            />
                        )}
                        {activeSidebar === "problems" && (
                            <ProblemBrowser 
                                onClose={() => setActiveSidebar(null)}
                                onOpenProblem={(problem) => {
                                    // Open as a virtual preview file
                                    const previewFile = {
                                        _id: `preview-${problem.id}`,
                                        name: `Preview: ${problem.id || "Problem"}`,
                                        type: "preview",
                                        language: "markdown",
                                        data: problem,
                                        content: ""
                                    };
                                    setActiveFile(previewFile);
                                    setRightPanel(null);
                                }}
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

            {/* 3. MAIN EDITOR AREA */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* Coding Area + Right Panel Split */}
                <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", borderBottom: consoleOpen ? "1px solid var(--border-subtle)" : "none" }}>
                   
                   {/* EDITOR */}
                   <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                       <Editors
                            activeFile={activeFile}
                            onCodeChange={setActiveCode}
                            socket={socket}
                            roomId={id}
                            username={user?.username} 
                            
                            onCodeNow={async (problem) => {
                                // 1. Prepare Content & Tests
                                let initialCode = "";
                                let initialTests = [];
                                
                                console.log("Code Now Triggered for:", problem);
                                console.log("Snippets:", problem.snippets);


                                // 0. Ensure we have snippets
                                let fullProblem = problem;
                                if (problem.provider === "leetcode" && !problem.snippets) {
                                     try {
                                         console.log("Fetching full problem details for:", problem.titleSlug || problem.id);
                                         const slug = problem.titleSlug || problem.id;
                                         const res = await fetch(`${API_URL}/api/problems/leetcode/${slug}`);
                                         const data = await res.json();
                                         if (data && data.snippets) {
                                             fullProblem = { ...problem, ...data };
                                         }
                                     } catch (e) {
                                         console.error("Failed to fetch full problem details", e);
                                     }
                                }

                                if (fullProblem.provider === "leetcode" && fullProblem.snippets) {
                                    // A. Get C++ Snippet
                                    const snippet = fullProblem.snippets.find(s => s.langSlug === "cpp");
                                    if (snippet) {
                                        // Wrap with headers but NO main function (auto-runner will handle it)
                                        initialCode = `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <set>
#include <unordered_map>

using namespace std;

${snippet.code}
`;

                                        // B. Parse Inputs (Heuristic: Count args)
                                        if (problem.examples) {
                                            const lines = problem.examples.trim().split('\n');
                                            
                                            // Count args to group lines
                                            const openParen = snippet.code.indexOf("(");
                                            const closeParen = snippet.code.indexOf(")", openParen);
                                            let argCount = 1;
                                            
                                            if (openParen !== -1 && closeParen !== -1) {
                                                const argsStr = snippet.code.substring(openParen + 1, closeParen);
                                                if (!argsStr.trim()) argCount = 0;
                                                else {
                                                    let depth = 0;
                                                    for (let char of argsStr) {
                                                        if (char === "<") depth++;
                                                        else if (char === ">") depth--;
                                                        else if (char === "," && depth === 0) argCount++;
                                                    }
                                                }
                                            }

                                            // Group lines
                                            if (argCount > 0) {
                                                // Extract expected outputs from description (heuristic)
                                                // Look for "Output:</strong> <span ...>val</span>" or "Output: val"
                                                // Simple regex for "Output: ... \n" or "Output: ... <"
                                                let expectedOutputs = [];
                                                if (fullProblem.description) {
                                                    const desc = fullProblem.description;
                                                    // Regex to find Output: ... blocks
                                                    // This matches "Output:</strong>" followed by anything until newline or <
                                                    const regex = /Output:\s*<\/strong>\s*([^<]+)/g;
                                                    let match;
                                                    while ((match = regex.exec(desc)) !== null) {
                                                        expectedOutputs.push(match[1].trim());
                                                    }
                                                    // Fallback check for plain text "Output: "
                                                    if (expectedOutputs.length === 0) {
                                                         const plainRegex = /Output:\s*([^<\n]+)/g;
                                                         while ((match = plainRegex.exec(desc)) !== null) {
                                                            expectedOutputs.push(match[1].trim());
                                                         }
                                                    }
                                                }

                                                let testCaseIndex = 0;
                                                for (let i = 0; i < lines.length; i += argCount) {
                                                    const inputChunk = lines.slice(i, i + argCount).join("\n");
                                                    if (inputChunk) {
                                                        initialTests.push({
                                                            input: inputChunk,
                                                            expectedOutput: expectedOutputs[testCaseIndex] || "", 
                                                            status: "idle" 
                                                        });
                                                        testCaseIndex++;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    // Codeforces / Default (Standard CP Template) - Keeps main
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
                                    initialTests = problem.testCases || [];
                                }


                                // 2. Create File
                                const fileName = `solution_${problem.id}.cpp`; 
                                let targetFile = files.find(f => f.name === fileName);
                                
                                if (!targetFile) {
                                    try {
                                        const res = await fetch(`${API_URL}/api/files`, {
                                            method: "POST", headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ 
                                                name: fileName, 
                                                language: "cpp", 
                                                folder: "/", 
                                                roomId: id || "default",
                                                content: initialCode 
                                            }) 
                                        });
                                        targetFile = await res.json();
                                        setFiles(prev => [...prev, targetFile]);
                                    } catch (e) {
                                        console.error("Failed to create solution file", e);
                                        return;
                                    }
                                } 

                                // 3. Switch to File
                                setActiveFile(targetFile);
                                setActiveCode(targetFile.content || initialCode);

                                // 4. Import Tests
                                if (initialTests.length > 0) {
                                    const newTests = initialTests.map(tc => ({
                                        id: Date.now() + Math.random(),
                                        input: tc.input,
                                        expectedOutput: tc.expectedOutput,
                                        status: "idle",
                                        actualOutput: "",
                                        expanded: true
                                    }));
                                    setTestCases(prev => [...prev, ...newTests]);
                                    if(problem.provider === "leetcode") setActiveSidebar("tests");
                                }

                                // 5. MOVE PREVIEW TO RIGHT PANEL
                                setRightPanel({ type: "preview", data: problem });
                            }}
                       />
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
                   
                   {rightPanel?.type === "preview" && activeFile?.type !== "preview" && (
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
                                     <ProblemPreview problem={rightPanel.data} onCodeNow={() => {}} />
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

      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} url={shareUrl} />
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
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

    </>
  );
}
