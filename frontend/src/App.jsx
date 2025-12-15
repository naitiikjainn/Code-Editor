import { useState, useEffect } from "react";
import Editors from "./components/Editors";
import Preview from "./components/Preview";
import AIButton from "./components/AIButton";
import AIPanel from "./components/AIPanel";
import ConsolePanel from "./components/ConsolePanel";
import ShareModal from "./components/ShareModal";
import AuthModal from "./components/AuthModal"; // ✅ IMPORT AUTH MODAL
import { useParams } from "react-router-dom";
import { API_URL } from "./config"; 
import io from "socket.io-client";
import { useAuth } from "./context/AuthContext"; // ✅ IMPORT AUTH CONTEXT

// Initialize Socket
const socket = io(API_URL);

export default function App() {
  const { id } = useParams();
  const { user, logout } = useAuth(); // ✅ GET USER INFO

  // --- STATE ---
  const [language, setLanguage] = useState("web"); 
  const [html, setHtml] = useState("<h2>Hello User</h2>");
  const [css, setCss] = useState("body { text-align: center; font-family: sans-serif; }");
  const [js, setJs] = useState("console.log('Hello from JS!');");
  const [cppCode, setCppCode] = useState(`#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from C++!" << endl;\n    return 0;\n}`);
  const [javaCode, setJavaCode] = useState(`public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}`);
  const [pythonCode, setPythonCode] = useState(`print("Hello from Python!")`);

  // UI State
  const [activeCode, setActiveCode] = useState({ html, css, js });
  const [isAutoRun, setIsAutoRun] = useState(true);
  const [input, setInput] = useState(""); 
  const [aiOpen, setAiOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  
  // Modals & Loading
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false); // ✅ AUTH MODAL STATE
  const [shareUrl, setShareUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // --- SOCKETS ---
  useEffect(() => {
    if (id) {
        socket.emit("join_room", id);
        
        const handleReceiveCode = (code) => {
            if (code.language === "web") {
                if (code.html !== undefined) setHtml(code.html);
                if (code.css !== undefined) setCss(code.css);
                if (code.js !== undefined) setJs(code.js);
            } else {
                if (language === "cpp") setCppCode(code);
                if (language === "java") setJavaCode(code);
                if (language === "python") setPythonCode(code);
            }
        };
        socket.on("receive_code", handleReceiveCode);
        return () => socket.off("receive_code", handleReceiveCode);
    }
  }, [id, language]);

  // Handle Code Changes (Broadcast)
  const handleCodeChange = (type, value) => {
      if (type === "html") setHtml(value);
      if (type === "css") setCss(value);
      if (type === "js") setJs(value);
      if (type === "cpp") setCppCode(value);
      if (type === "java") setJavaCode(value);
      if (type === "python") setPythonCode(value);

      if (id) {
          let payload = value;
          if (language === "web") {
              payload = { html, css, js, [type]: value, language: "web" };
          }
          socket.emit("code_change", { roomId: id, code: payload });
      }
  };

  // --- LOAD SAVED CODE ---
  useEffect(() => {
    if (id) {
      fetch(`${API_URL}/api/share/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) return alert("Code not found!");
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

  // Auto-Run (Web)
  useEffect(() => {
    if (!isAutoRun || language !== "web") return;
    const timeout = setTimeout(() => setActiveCode({ html, css, js }), 1000);
    return () => clearTimeout(timeout);
  }, [html, css, js, isAutoRun, language]);

  // Actions
  async function handleRun() {
    // 🔒 NEW: Check if user is logged in
    if (!user) {
        // alert("Please login to run code!"); // Optional: Remove if you just want the modal
        setAuthModalOpen(true); // Open the Login Popup
        return; // 🛑 STOP execution here
    }
    if (language === "web") { setActiveCode({ html, css, js }); return; } 
    setLogs([{ type: "info", message: `Compiling ${language.toUpperCase()}...` }]);
    setConsoleOpen(true); setIsRunning(true); 
    try {
        const res = await fetch(`${API_URL}/api/code/execute`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language, code: language === "cpp" ? cppCode : (language === "java" ? javaCode : pythonCode), stdin: input }),
        });
        const data = await res.json();
        setLogs(prev => [...prev, { type: data.run?.code === 0 ? "log" : "error", message: data.run?.output || "Execution failed." }]);
    } catch (err) { setLogs(prev => [...prev, { type: "error", message: "Server Error." }]); }
    finally { setIsRunning(false); }
  }

  async function handleShare() {
    if (!user) {
        setAuthModalOpen(true); // Open Login Popup
        return; // 🛑 STOP execution
    }
    setIsSharing(true); 
    const bodyData = language === "web" ? { language: "web", code: { html, css, js } } 
        : { language, code: language === "cpp" ? cppCode : (language === "java" ? javaCode : pythonCode), stdin: input };
    try {
        const res = await fetch(`${API_URL}/api/share/generate`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData),
        });
        const data = await res.json();
        if (data.id) {
            setShareUrl(`${window.location.origin}/share/${data.id}`); setShareModalOpen(true);
        }
    } catch (e) { alert("Error sharing code"); }
    finally { setIsSharing(false); }
  }

  return (
    <>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#1e1e1e" }}>
        
        {/* HEADER */}
        <div style={{ height: "50px", background: "#111", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontWeight: "bold", color: "#fff", fontSize: "18px" }}>🚀 CodePlay</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ background: "#222", color: "white", border: "1px solid #444", padding: "4px 8px", borderRadius: "4px" }}>
                    <option value="web">🌐 HTML/JS</option>
                    <option value="cpp">⚙️ C++</option>
                    <option value="java">☕ Java</option>
                    <option value="python">🐍 Python</option>
                </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                
                {/* ✅ AUTH BUTTONS */}
                {user ? (
                   <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ color: "#4caf50", fontWeight: "bold", fontSize: "14px" }}>● {user.username}</span>
                      <button onClick={logout} style={{ background: "none", border: "1px solid #444", color: "#888", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Logout</button>
                   </div>
                ) : (
                   <button 
                     onClick={() => setAuthModalOpen(true)}
                     style={{ background: "#007acc", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                   >
                     👤 Login
                   </button>
                )}

                <button onClick={handleShare} disabled={isSharing} style={{ background: "#444", color: "white", border: "1px solid #666", borderRadius: "6px", padding: "6px 16px", fontSize: "14px", fontWeight: "600", cursor: "pointer", opacity: isSharing ? 0.7 : 1 }}>
                    {isSharing ? "⏳..." : "🔗 Share"}
                </button>
                <button onClick={handleRun} disabled={isRunning} style={{ background: "#238636", color: "white", border: "1px solid #666", borderRadius: "6px", padding: "6px 16px", fontSize: "14px", fontWeight: "600", cursor: "pointer", opacity: isRunning ? 0.7 : 1 }}>
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
          />
        </div>

       {/* PREVIEW / CONSOLE */}
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
      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} onAsk={async (p) => { 
          // Simplified AI call for brevity - assume external func or inline fetch
          return "AI Response Placeholder"; 
      }} /> 
      
      {!consoleOpen && <button onClick={() => setConsoleOpen(true)} style={{ position: "fixed", bottom: "10px", left: "10px", zIndex: 50 }}>Show Console</button>}
      
      {/* MODALS */}
      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} url={shareUrl} />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} /> {/* ✅ ADDED AUTH MODAL */}
    </>
  );
}