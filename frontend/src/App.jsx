import { useState, useEffect } from "react";
import Editors from "./components/Editors";
import Preview from "./components/Preview";
import AIButton from "./components/AIButton";
import AIPanel from "./components/AIPanel";
import ConsolePanel from "./components/ConsolePanel";
import ShareModal from "./components/ShareModal";
import AuthModal from "./components/AuthModal";
import { useParams, useNavigate } from "react-router-dom"; 
import { API_URL } from "./config"; 
import io from "socket.io-client";
import { useAuth } from "./context/AuthContext";

const socket = io(API_URL);

export default function App() {
  const { id } = useParams();
  const navigate = useNavigate(); 
  const { user, logout } = useAuth();

  // --- STATE ---
  const [language, setLanguage] = useState("web"); 
  const [html, setHtml] = useState("<h2>Hello User</h2>");
  const [css, setCss] = useState("body { text-align: center; font-family: sans-serif; }");
  const [js, setJs] = useState("console.log('Hello from JS!');");
  const [cppCode, setCppCode] = useState(`#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from C++!" << endl;\n    return 0;\n}`);
  const [javaCode, setJavaCode] = useState(`public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}`);
  const [pythonCode, setPythonCode] = useState(`print("Hello from Python!")`);

  const [activeCode, setActiveCode] = useState({ html, css, js });
  const [isAutoRun, setIsAutoRun] = useState(true);
  const [input, setInput] = useState(""); 
  const [aiOpen, setAiOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false); 

  const [activeUsers, setActiveUsers] = useState([]); 
  const [typingUser, setTypingUser] = useState("");   
  const [remoteCursors, setRemoteCursors] = useState({}); 

// In frontend/src/App.jsx

  // 1. CLEANER SOCKET EFFECT (Only Chat & Room Logic)
  useEffect(() => {
    if (id && user) { 
        socket.emit("join_room", { roomId: id, username: user.username });
        
        const handleRoomUsers = (users) => setActiveUsers(users);
        const handleTyping = (username) => {
            setTypingUser(`${username} is typing...`);
            setTimeout(() => setTypingUser(""), 2000);
        };
        // Note: We keep cursor_update for now if you want simple cursors, 
        // but Yjs handles cursors better. You can remove this too if using Yjs cursors.
        
        const handleSyncRunStart = ({ username }) => { 
            setConsoleOpen(true);
            setIsRunning(true); 
            setLogs([{ type: "info", message: `🚀 ${username} started execution...` }]); 
        };
        const handleSyncRunComplete = ({ logs }) => { 
            setIsRunning(false);
            setLogs(prev => [...prev, ...logs]); 
        };

        // Attach Listeners
        socket.on("room_users", handleRoomUsers);
        socket.on("user_typing", handleTyping);
        socket.on("sync_run_start", handleSyncRunStart);
        socket.on("sync_run_complete", handleSyncRunComplete);

        return () => {
            socket.off("room_users", handleRoomUsers);
            socket.off("user_typing", handleTyping);
            socket.off("sync_run_start", handleSyncRunStart);
            socket.off("sync_run_complete", handleSyncRunComplete);
        };
    }
  }, [id, user]);


  // 2. SIMPLIFIED CHANGE HANDLER (Only updates Local State for the "Run" button)
  const handleCodeChange = (type, value) => {
      // We ONLY update local state so the "Run" button works.
      // We DO NOT emit "code_change" anymore. Yjs does that automatically.
      if (type === "html") setHtml(value);
      if (type === "css") setCss(value);
      if (type === "js") setJs(value);
      if (type === "cpp") setCppCode(value);
      if (type === "java") setJavaCode(value);
      if (type === "python") setPythonCode(value);
      
      // Send typing indicator (Optional)
      if (id && user) {
          socket.emit("typing", { roomId: id, username: user.username });
      }
  };

  // --- LOAD SAVED CODE ---
  useEffect(() => {
    if (id) {
      fetch(`${API_URL}/api/share/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) return alert("Room not found!");
          setLanguage(data.language);
          if (data.language === "web") {
            setHtml(data.code.html); setCss(data.code.css); setJs(data.code.js); setActiveCode(data.code); 
          } else if (data.language === "cpp") {
            setCppCode(data.code); setInput(data.stdin || "");
          } else if (data.language === "java") {
            setJavaCode(data.code); setInput(data.stdin || "");
          } else if (data.language === "python") {
            setPythonCode(data.code); setInput(data.stdin || "");
          }
        })
        .catch(err => console.error(err));
    }
  }, [id]); 

  // --- HANDLERS ---
  
  // NEW: CREATE ROOM FUNCTION
  async function handleCreateRoom() {
    if (!user) {
        setAuthModalOpen(true);
        return;
    }
    
    setIsCreatingRoom(true);
    
    const bodyData = language === "web" ? { language: "web", code: { html, css, js } } 
        : { language, code: language === "cpp" ? cppCode : (language === "java" ? javaCode : pythonCode), stdin: input };

    try {
        const res = await fetch(`${API_URL}/api/share/generate`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData),
        });
        const data = await res.json();
        
        if (data.id) {
            // Redirect to the Room URL
            window.location.href = `/share/${data.id}`;
        }
    } catch (e) { alert("Error creating room"); }
    finally { setIsCreatingRoom(false); }
  }

  async function handleRun() {
    if (!user) { setAuthModalOpen(true); return; }

    // Case 1: Web (Just sync the active code state)
    if (language === "web") { 
        setActiveCode({ html, css, js }); 
        return; 
    } 

    // Case 2: C++/Java/Python
    setConsoleOpen(true);
    setIsRunning(true);
    setLogs([{ type: "info", message: "Compiling..." }]);

    //1. Tell others we are starting
    if (id) {
        socket.emit("sync_run_trigger", { roomId: id, username: user.username });
    }

    try {
        const res = await fetch(`${API_URL}/api/code/execute`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                language, 
                code: language === "cpp" ? cppCode : (language === "java" ? javaCode : pythonCode), 
                stdin: input 
            }),
        });
        const data = await res.json();
        
        // Prepare logs
        const newLogs = [
             { type: data.run?.code === 0 ? "log" : "error", message: data.run?.output || "Execution finished." }
        ];

        setLogs(prev => [...prev, ...newLogs]);

        //2. Send the result to others
        if (id) {
            socket.emit("sync_run_result", { roomId: id, logs: newLogs });
        }

    } catch (err) { 
        const errorLog = [{ type: "error", message: "Server Error." }];
        setLogs(prev => [...prev, ...errorLog]);
        
        // Broadcast error too
        if (id) socket.emit("sync_run_result", { roomId: id, logs: errorLog });
    }
    finally { 
        setIsRunning(false); 
    }
  }

  // Helper to Copy Link (If already in a room)
  function handleCopyLink() {
      const url = window.location.href;
      setShareUrl(url);
      setShareModalOpen(true);
  }

  return (
    <>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#1e1e1e" }}>
        
        {/* HEADER */}
        <div style={{ height: "50px", background: "#111", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontWeight: "bold", color: "#fff", fontSize: "18px" }}>🚀 CodePlay</span>
                
                {/* NAVBAR FIX: Fixed Select Element */}
                <select 
                    value={language} 
                    onChange={(e) => { setLanguage(e.target.value); setLogs([]); }}
                    style={{ background: "#222", color: "white", border: "1px solid #444", padding: "6px 12px", borderRadius: "4px", outline: "none", cursor: "pointer" }}
                >
                    <option value="web">🌐 HTML/JS</option>
                    <option value="cpp">⚙️ C++</option>
                    <option value="java">☕ Java</option>
                    <option value="python">🐍 Python</option>
                </select>

                {/* USER AVATARS */}
                {activeUsers.length > 0 && (
                  <div style={{ display: "flex", gap: "-5px", marginLeft: "10px" }}>
                    {activeUsers.map((name, i) => (
                      <div key={i} title={name} style={{ width: "24px", height: "24px", borderRadius: "50%", background: `hsl(${i * 60}, 70%, 50%)`, color: "#fff", fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #111" }}>
                        {name[0].toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}
                {typingUser && <span style={{ color: "#aaa", fontSize: "12px", fontStyle: "italic" }}>{typingUser}</span>}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {user ? (
                   <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ color: "#4caf50", fontWeight: "bold", fontSize: "14px" }}>● {user.username}</span>
                      <button onClick={logout} style={{ background: "none", border: "1px solid #444", color: "#888", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Logout</button>
                   </div>
                ) : (
                   <button onClick={() => setAuthModalOpen(true)} style={{ background: "#007acc", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>👤 Login</button>
                )}

                {/* NEW BUTTONS: Create Room vs Invite */}
                {!id ? (
                     <button 
                        onClick={handleCreateRoom}
                        disabled={isCreatingRoom}
                        style={{ background: "#8e44ad", color: "white", border: "1px solid #9b59b6", borderRadius: "6px", padding: "6px 16px", fontSize: "14px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                        {isCreatingRoom ? "Creating..." : "➕ Create Room"}
                    </button>
                ) : (
                    <button 
                        onClick={handleCopyLink}
                        style={{ background: "#444", color: "white", border: "1px solid #666", borderRadius: "6px", padding: "6px 16px", fontSize: "14px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                        🔗 Invite
                    </button>
                )}

                <button onClick={handleRun} disabled={isRunning} style={{ background: "#238636", color: "white", border: "1px solid rgba(240,246,252,0.1)", borderRadius: "6px", padding: "6px 16px", fontSize: "14px", fontWeight: "600", cursor: "pointer", opacity: isRunning ? 0.7 : 1 }}>
                    {isRunning ? "⏳..." : "▶ Run"}
                </button>
            </div>
        </div>

        {/* EDITORS */}
        <div style={{ height: language === "web" ? "calc(50% - 25px)" : "calc(100% - 250px)", width: "100%", borderBottom: "4px solid #1e1e1e" }}>
          <Editors
            language={language}
            html={html} setHtml={(val) => handleCodeChange("html", val)}
            css={css} setCss={(val) => handleCodeChange("css", val)}
            js={js} setJs={(val) => handleCodeChange("js", val)}
            cppCode={cppCode} setCppCode={(val) => handleCodeChange("cpp", val)}
            javaCode={javaCode} setJavaCode={(val) => handleCodeChange("java", val)}
            pythonCode={pythonCode} setPythonCode={(val) => handleCodeChange("python", val)}
            socket={socket}
            roomId={id}
            username={user?.username} 
            remoteCursors={remoteCursors}
          />
        </div>

       {/* OUTPUT */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          {language === "web" ? (
             <>
               <div style={{ flex: 1, overflow: "hidden" }}><Preview html={activeCode.html} css={activeCode.css} js={activeCode.js} /></div>
               <ConsolePanel isOpen={consoleOpen} onClose={() => setConsoleOpen(false)} logs={logs} onClear={() => setLogs([])} />
             </>
          ) : (
             <div style={{ display: "flex", height: "100%", width: "100%" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #333", background: "#1e1e1e" }}>
                   <div style={{ padding: "8px", background: "#252526", color: "#ccc", fontSize: "12px", borderBottom: "1px solid #333" }}>INPUT</div>
                   <textarea value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1, background: "#1e1e1e", color: "#d4d4d4", border: "none", padding: "12px", fontFamily: "monospace", resize: "none", outline: "none" }} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <ConsolePanel isOpen={true} onClose={() => setConsoleOpen(false)} logs={logs} onClear={() => setLogs([])} style={{ height: "100%", borderTop: "none" }} />
                </div>
             </div>
          )}
        </div>
      </div>

      <AIButton onClick={() => setAiOpen(true)} />
      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} onAsk={async (p) => { return "AI Placeholder"; }} /> 
      {!consoleOpen && <button onClick={() => setConsoleOpen(true)} style={{ position: "fixed", bottom: "10px", left: "10px", zIndex: 50 }}>Show Console</button>}
      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} url={shareUrl} />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}