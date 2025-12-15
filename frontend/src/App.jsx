import { useState, useEffect } from "react";
import Editors from "./components/Editors";
import Preview from "./components/Preview";
import AIButton from "./components/AIButton";
import AIPanel from "./components/AIPanel";
import ConsolePanel from "./components/ConsolePanel";
import ShareModal from "./components/ShareModal";
import { useParams } from "react-router-dom";
export default function App() {
  const { id } = useParams();
  // --- STATE MANAGEMENT ---
  const [language, setLanguage] = useState("web"); // Options: "web", "cpp", "java", "python"

  // Web State
  const [html, setHtml] = useState("<h2>Hello User</h2>");
  const [css, setCss] = useState("body { text-align: center; font-family: sans-serif; }");
  const [js, setJs] = useState("console.log('Hello from JS!');");

  // C++ / Java / Python State
  const [cppCode, setCppCode] = useState(`#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from C++!" << endl;\n    return 0;\n}`);
  const [javaCode, setJavaCode] = useState(`public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}`);
  
  // ✅ FIXED: Added Python default code
  const [pythonCode, setPythonCode] = useState(`print("Hello from Python!")`);

  // General State
  const [aiOpen, setAiOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  
  // Running Logic
  const [activeCode, setActiveCode] = useState({ html, css, js });
  const [isAutoRun, setIsAutoRun] = useState(true);
  const [input, setInput] = useState(""); 
const [shareModalOpen, setShareModalOpen] = useState(false);
const [shareUrl, setShareUrl] = useState("");
  // --- EFFECTS ---
  // LOAD SHARED CODE LOGIC
  useEffect(() => {
    if (id) {
      // If we have an ID, fetch the code
      fetch(`http://localhost:5000/api/share/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            alert("Code not found!");
            return;
          }

          // 1. Set Language
          setLanguage(data.language);

          // 2. Set Code based on language
          if (data.language === "web") {
            setHtml(data.code.html);
            setCss(data.code.css);
            setJs(data.code.js);
            setActiveCode(data.code); // Update preview immediately
          } else if (data.language === "cpp") {
            setCppCode(data.code);
            setInput(data.stdin || "");
          } else if (data.language === "java") {
            setJavaCode(data.code);
            setInput(data.stdin || "");
          } else if (data.language === "python") {
            setPythonCode(data.code);
            setInput(data.stdin || "");
          }
        })
        .catch(err => console.error("Error loading code:", err));
    }
  }, [id]); // Run this whenever the ID changes
  // Auto-Run Logic (Only for Web)
  useEffect(() => {
    if (!isAutoRun || language !== "web") return;
    const timeout = setTimeout(() => {
      setActiveCode({ html, css, js });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [html, css, js, isAutoRun, language]);

  // Console Listener
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === "CONSOLE_LOG") {
        setLogs((prev) => [...prev, { type: "log", message: event.data.message }]);
      }
      if (event.data.type === "CONSOLE_ERROR") {
        setLogs((prev) => [...prev, { type: "error", message: event.data.message }]);
        setConsoleOpen(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function askAI(prompt) {
    try {
        // ✅ FIXED: Now includes pythonCode in the logic
        const currentCode = language === "web" 
            ? { html, css, js } 
            : { 
                code: language === "cpp" ? cppCode : (language === "java" ? javaCode : pythonCode), 
                lang: language 
              };

        const res = await fetch("http://localhost:5000/api/ai/assist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, code: currentCode }),
        });
        const data = await res.json();
        return data.result;
    } catch(e) { return "Error connecting to AI"; }
  }

  async function handleRun() {
    if (language === "web") {
        setActiveCode({ html, css, js });
        return;
    } 

    setLogs([{ type: "info", message: `Compiling ${language.toUpperCase()}...` }]);
    setConsoleOpen(true);

    try {
        const res = await fetch("http://localhost:5000/api/code/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                language, 
                // ✅ FIXED: Now sends pythonCode if language is 'python'
                code: language === "cpp" ? cppCode : (language === "java" ? javaCode : pythonCode),
                stdin: input 
            }),
        });

        const data = await res.json();

        if (data.run) {
            const output = data.run.output;
            setLogs(prev => [
                ...prev, 
                { type: data.run.code === 0 ? "log" : "error", message: output || "Execution finished." }
            ]);
        } else {
            setLogs(prev => [...prev, { type: "error", message: "Execution failed." }]);
        }

    } catch (err) {
        setLogs(prev => [...prev, { type: "error", message: "Server Error." }]);
    }
  }
async function handleShare() {
    let bodyData;

    if (language === "web") {
        bodyData = {
            language: "web",
            code: { html, css, js } 
        };
    } else {
        bodyData = {
            language,
            code: language === "cpp" ? cppCode : (language === "java" ? javaCode : pythonCode),
            stdin: input
        };
    }

    try {
        const res = await fetch("http://localhost:5000/api/share/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData),
        });
        
        const data = await res.json();
        
        if (data.id) {
            // ✅ SUCCESS: Open the Modal instead of Alert
            const url = `${window.location.origin}/share/${data.id}`;
            setShareUrl(url);
            setShareModalOpen(true);
        } else {
            setLogs(prev => [...prev, { type: "error", message: "Failed to generate share link." }]);
        }
    } catch (e) {
        setLogs(prev => [...prev, { type: "error", message: "Network Error: Could not share code." }]);
    }
  }
  return (
    <>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#1e1e1e" }}>
        
        {/* HEADER BAR */}
        <div style={{
            height: "50px",
            background: "#111",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 16px", borderBottom: "1px solid #333", flexShrink: 0
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontWeight: "bold", color: "#fff", fontSize: "18px" }}>🚀 CodePlay</span>
                
                {/* LANGUAGE SELECTOR */}
                <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                        background: "#222", color: "white", border: "1px solid #444",
                        padding: "4px 8px", borderRadius: "4px", outline: "none", cursor: "pointer"
                    }}
                >
                    <option value="web">🌐 HTML/JS</option>
                    <option value="cpp">⚙️ C++</option>
                    <option value="java">☕ Java</option>
                    <option value="python">🐍 Python</option>
                </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {language === "web" && (
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ccc", fontSize: "13px", cursor: "pointer" }}>
                        <input type="checkbox" checked={isAutoRun} onChange={(e) => setIsAutoRun(e.target.checked)} />
                        Auto-Run
                    </label>
                )}
                {/* NEW SHARE BUTTON */}
                <button 
                    onClick={handleShare}
                    style={{
                        background: "#444", color: "white", border: "1px solid #666",
                        borderRadius: "6px", padding: "6px 16px", fontSize: "14px", fontWeight: "600",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                    }}
                >
                    🔗 Share
                </button>
                <button 
                    onClick={handleRun}
                    style={{
                        background: "#238636", color: "white", border: "1px solid rgba(240,246,252,0.1)",
                        borderRadius: "6px", padding: "6px 16px", fontSize: "14px", fontWeight: "600",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                    }}
                >
                    ▶ Run
                </button>
            </div>
        </div>

        {/* MAIN EDITORS AREA */}
        <div style={{ height: language === "web" ? "calc(50% - 25px)" : "calc(100% - 250px)", width: "100%", flexShrink: 0, borderBottom: "4px solid #1e1e1e" }}>
          <Editors
            language={language}
            // Web Props
            html={html} setHtml={setHtml}
            css={css} setCss={setCss}
            js={js} setJs={setJs}
            // C++ / Java / Python Props
            cppCode={cppCode} setCppCode={setCppCode}
            javaCode={javaCode} setJavaCode={setJavaCode}
            // ✅ FIXED: Passed Python Props
            pythonCode={pythonCode} setPythonCode={setPythonCode}
          />
        </div>

       {/* BOTTOM PANEL AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          
          {/* --- CASE 1: WEB DEVELOPMENT (Stacked) --- */}
          {language === "web" ? (
             <>
               <div style={{ flex: 1, overflow: "hidden" }}>
                  <Preview html={activeCode.html} css={activeCode.css} js={activeCode.js} />
               </div>

               <ConsolePanel
                  isOpen={consoleOpen}
                  onClose={() => setConsoleOpen(false)}
                  logs={logs}
                  onClear={() => setLogs([])}
               />
             </>
          ) : (
             
             /* --- CASE 2: C++ / JAVA / PYTHON (Side-by-Side) --- */
             <div style={{ display: "flex", height: "100%", width: "100%" }}>
                
                {/* LEFT: INPUT BOX */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #333", background: "#1e1e1e" }}>
                   <div style={{ padding: "8px 16px", background: "#252526", color: "#ccc", fontSize: "12px", fontWeight: "bold", borderBottom: "1px solid #333" }}>
                      INPUT
                   </div>
                   <textarea
                       value={input}
                       onChange={(e) => setInput(e.target.value)}
                       placeholder="Enter input here..."
                       style={{
                           flex: 1,
                           background: "#1e1e1e",
                           color: "#d4d4d4",
                           border: "none",
                           padding: "12px",
                           fontFamily: "'Fira Code', monospace",
                           fontSize: "14px",
                           resize: "none",
                           outline: "none"
                       }}
                   />
                </div>

                {/* RIGHT: OUTPUT CONSOLE */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {consoleOpen ? (
                        <ConsolePanel
                           isOpen={true} 
                           onClose={() => setConsoleOpen(false)}
                           logs={logs}
                           onClear={() => setLogs([])}
                           style={{ height: "100%", borderTop: "none" }} 
                        />
                    ) : (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#1e1e1e" }}>
                            <button 
                                onClick={() => setConsoleOpen(true)}
                                style={{ background: "#333", color: "white", border: "1px solid #555", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" }}
                            >
                                Show Output
                            </button>
                        </div>
                    )}
                </div>

             </div>
          )}
        </div>
         
      </div>

      <AIButton onClick={() => setAiOpen(true)} />
      <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} onAsk={askAI} />
      
      {!consoleOpen && (
        <button onClick={() => setConsoleOpen(true)} style={{ position: "fixed", bottom: "10px", left: "10px", zIndex: 50 }}>
          Show Console
        </button>
      )}
      <ShareModal 
        isOpen={shareModalOpen} 
        onClose={() => setShareModalOpen(false)} 
        url={shareUrl} 
      />
    </>
  );
}