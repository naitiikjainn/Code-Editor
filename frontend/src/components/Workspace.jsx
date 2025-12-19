import { useState, useEffect } from "react";
import Editors from "./Editors";
import Preview from "./Preview";
import AIPanel from "./AIPanel";
import ConsolePanel from "./ConsolePanel";
import ShareModal from "./ShareModal";
import AuthModal from "./AuthModal";
import Sidebar from "./Sidebar";
import FileExplorer from "./FileExplorer";
import ParticipantsPanel from "./ParticipantsPanel"; // <--- NEW
import useDebounce from "../hooks/useDebounce"; 
import { useParams, useNavigate } from "react-router-dom"; 
import { API_URL } from "../config"; 
import io from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { Code2, Play, Share2, PanelBottom, Globe, FileCode, ShieldAlert } from "lucide-react";

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
  const { user, loading: authLoading } = useAuth(); // Consolidated here

  // --- STATE ---
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [activeCode, setActiveCode] = useState("");
  const debouncedCode = useDebounce(activeCode, 1000); // Autosave delay
  
  const [input, setInput] = useState(""); 
  
  // UI STATE
  const [activeSidebar, setActiveSidebar] = useState("files"); 
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false); // <--- NEW INDEPENDENT STATE
  const [shareUrl, setShareUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [consoleHeight, setConsoleHeight] = useState(250); // <--- NEW
  const [isResizing, setIsResizing] = useState(false); // <--- NEW

  const [activeUsers, setActiveUsers] = useState([]); 
  const [remoteCursors, setRemoteCursors] = useState({}); 
  const [hoveredUser, setHoveredUser] = useState(null); // <--- Correctly placed
  
  // ACCESS CONTROL STATE
  // default to 'loading' (or 'login_required' if auth needed)
  const [accessStatus, setAccessStatus] = useState("loading"); 
  const [waitMessage, setWaitMessage] = useState("Connecting to room...");
  const [pendingGuests, setPendingGuests] = useState([]); 



  // --- SOCKET CONFIG ---
  useEffect(() => {
      if (!id || authLoading) return; // Wait for auth check to finish

      if (!user) {
          setAccessStatus("login_required");
          setWaitMessage("Please sign in to join this room.");
          setAuthModalOpen(true); // Auto-open login
          return;
      }
      
      // If we are here, we are logged in.
      // Reset status in case we were in 'login_required' before
      if (accessStatus === "login_required") {
          setAccessStatus("loading");
      }

      // JOIN ROOM FUNCTION
      const joinRoom = () => {
          console.log("Joining room:", id, "as", user.username);
          socket.emit("join_room", { roomId: id, username: user.username });
      };

      // INITIAL JOIN
      joinRoom();

      // RE-JOIN ON RECONNECT (Fixes server restart issue)
      socket.on("connect", joinRoom);

      // LISTENERS
      socket.on("room_users", (users) => setActiveUsers(users));
      
      socket.on("status_update", ({ status, message }) => {
          setAccessStatus(status); // 'waiting' or 'active' (if public?)
          setWaitMessage(message);
      });

      socket.on("access_granted", () => {
          setAccessStatus("granted");
          setWaitMessage("");
      });

      socket.on("access_denied", () => {
          setAccessStatus("denied");
          setWaitMessage("The host has declined your request to join this room.");
          // Removed auto-redirect to let user see the message
      });

      socket.on("request_entry", ({ username, socketId }) => {
          setPendingGuests(prev => {
              // Avoid duplicates
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
          if (!activeFile && data.length > 0) {
              setActiveFile(data[0]);
              setActiveCode(data[0].content || "");
          }
      } catch (err) { console.error("Failed to fetch files", err); }
  };

  useEffect(() => { fetchFiles(); }, []);

  useEffect(() => {
    if (activeFile && debouncedCode !== activeFile.content) {
        // Only save if changed
        fetch(`${API_URL}/api/files/${activeFile._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: debouncedCode })
        }).then(() => {
            console.log("Saved:", activeFile.name);
            // Update local file state silently to avoid re-trigger
            setFiles(prev => prev.map(f => f._id === activeFile._id ? { ...f, content: debouncedCode } : f));
        }).catch(err => console.error("Autosave failed", err));
    }
  }, [debouncedCode]);

  // --- RESIZE HANDLER ---
  useEffect(() => {
      const handleMouseMove = (e) => {
          if (!isResizing) return;
          const newHeight = window.innerHeight - e.clientY;
          if (newHeight > 50 && newHeight < window.innerHeight - 100) {
              setConsoleHeight(newHeight);
          }
      };
      const handleMouseUp = () => setIsResizing(false);

      if (isResizing) {
          window.addEventListener("mousemove", handleMouseMove);
          window.addEventListener("mouseup", handleMouseUp);
      }
      return () => {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
      };
  }, [isResizing]);

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
      // Direct delete without confirmation as requested
      try {
          await fetch(`${API_URL}/api/files/${id}`, { method: "DELETE" });
          setFiles(prev => prev.filter(f => f._id !== id));
          if (activeFile?._id === id) {
              setActiveFile(null);
              setActiveCode("");
          }
      } catch (err) { console.error(err); }
  };

  async function handleRun() {
    if (!user) { setAuthModalOpen(true); return; }
    if (!activeFile) return;

    setConsoleOpen(true);
    setIsRunning(true);
    setLogs([{ type: "info", message: "Compiling..." }]);

    if (id) socket.emit("sync_run_trigger", { roomId: id, username: user.username });

    try {
        const res = await fetch(`${API_URL}/api/code/execute`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                language: activeFile.language, 
                code: activeCode, 
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
                {/* Language (Read Only) */}
                {activeFile && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", background: "#f3f3f310", padding: "4px 8px", borderRadius: "12px", border: "1px solid #ffffff20" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: activeFile.language === "html" ? "#e34c26" : (activeFile.language === "javascript" ? "#f1e05a" : "#3572A5") }}></span>
                        <span style={{ color: "#eee", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{activeFile.language}</span>
                    </div>
                )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                
                {/* ACTIVE USERS (Google Docs Style) */}
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
                            
                            {/* CUSTOM TOOLTIP */}
                            {hoveredUser === u.username && (
                                <div style={{
                                    position: "absolute",
                                    top: "40px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    background: "#333",
                                    color: "white",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    whiteSpace: "nowrap",
                                    zIndex: 1000,
                                    pointerEvents: "none",
                                    boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
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

        {/* WORKSPACE BODY */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            
            {/* 1. SIDEBAR NAVIGATION */}
            <Sidebar activeTab={activeSidebar} setActiveTab={setActiveSidebar} isOpen={!!activeSidebar} />

            {/* 2. SIDEBAR PANEL (Conditional) */}
            {activeSidebar && (
                <div style={{ width: "260px", background: "var(--bg-panel)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column" }}>
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
                </div>
            )}

            {/* 3. MAIN EDITOR AREA */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* Coding Area */}
                <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", borderBottom: consoleOpen ? "1px solid var(--border-subtle)" : "none" }}>
                   <Editors
                        activeFile={activeFile}
                        onCodeChange={setActiveCode}
                        socket={socket}
                        roomId={id}
                        username={user?.username} 
                   />
                   
                   {/* Web Preview Split - Only if active file is HTML */}
                   {activeFile?.language === "html" && (
                       <div style={{ width: "40%", borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column" }}>
                           <div style={{ padding: "8px", background: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: "bold" }}>PREVIEW</div>
                           <div style={{ flex: 1, background: "white" }}>
                               <Preview html={activeCode} />
                           </div>
                       </div>
                   )}
                </div>

                {/* Bottom Terminal */}
                {consoleOpen && (
                    <>
                        {/* RESIZE HANDLE */}
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
      
      {/* WAITING / LOADING / LOGIN OVERLAY */}
      {(accessStatus === "waiting" || accessStatus === "loading" || accessStatus === "login_required" || accessStatus === "denied") && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white" }}>
              
              {/* ICON */}
              <div className="animate-pulse" style={{ fontSize: "64px", marginBottom: "20px", color: accessStatus === "denied" ? "#ef5350" : "white" }}>
                  {accessStatus === "login_required" ? "🔑" : (accessStatus === "denied" ? <ShieldAlert size={64} /> : (accessStatus === "loading" ? "⏳" : "🔒"))}
              </div>

              {/* TITLE */}
              <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px", color: accessStatus === "denied" ? "#ef5350" : "white" }}>
                  {accessStatus === "login_required" ? "Authentication Required" : 
                   (accessStatus === "denied" ? "Access Denied" : 
                   (accessStatus === "loading" ? "Connecting..." : "Waiting for Host"))}
              </h2>

              {/* MESSAGE */}
              <p style={{ color: "var(--text-muted)", fontSize: "16px", marginBottom: "20px" }}>{waitMessage}</p>
              
              {/* ACTIONS */}
              {accessStatus === "login_required" && (
                  <button onClick={() => setAuthModalOpen(true)} className="btn-primary" style={{ padding: "10px 24px", fontSize: "16px" }}>
                      Sign In to Join
                  </button>
              )}
              
              {accessStatus === "denied" && (
                  <button onClick={() => navigate("/")} className="btn-secondary" style={{ padding: "10px 24px", fontSize: "16px", borderColor: "#ef5350", color: "#ef5350" }}>
                      Return to Dashboard
                  </button>
              )}
          </div>
      )}

      {/* HOST NOTIFICATIONS (GUEST REQUESTS) */}
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
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      
      {/* FLOATING AI BUTTON */}
      <button 
        onClick={() => setAiPanelOpen(!aiPanelOpen)}
        style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #4285f4, #9b72cb, #d96570)", // Gemini Gradient
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100,
            transition: "transform 0.2s"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C12.5 7.5 16.5 11.5 22 12C16.5 12.5 12.5 16.5 12 22C11.5 16.5 7.5 12.5 2 12C7.5 11.5 11.5 7.5 12 2Z" fill="white"/>
        </svg>
      </button>

      {/* FLOATING AI PANEL */}
      {aiPanelOpen && (
        <div style={{
            position: "fixed",
            bottom: "90px",
            right: "24px",
            width: "350px",
            height: "500px",
            zIndex: 99,
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-panel)"
        }}>
            <AIPanel open={true} onClose={() => setAiPanelOpen(false)} onAsk={handleAskAI} />
        </div>
      )}

    </>
  );
}
