import React from "react";
import Editor from "@monaco-editor/react";

export default function Editors({ 
  language, 
  html, setHtml, 
  css, setCss, 
  js, setJs, 
  cppCode, setCppCode, 
  javaCode, setJavaCode, 
  pythonCode, setPythonCode 
}) {

  // Helper to choose the right language config for Monaco
  const getEditorLanguage = () => {
    if (language === "cpp") return "cpp";
    if (language === "java") return "java";
    if (language === "python") return "python";
    return "html"; // Default for Web mode (we split visually)
  };

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      
      {/* --- CASE 1: WEB DEVELOPMENT (3 Split Screens) --- */}
      {language === "web" && (
        <>
          <div style={{ flex: 1, borderRight: "1px solid #333", display: "flex", flexDirection: "column" }}>
            <div style={headerStyle}>HTML</div>
            <Editor 
              height="100%" 
              defaultLanguage="html" 
              theme="vs-dark"
              value={html} // ✅ Controlled Input (Listens to Socket)
              onChange={(value) => setHtml(value || "")}
              options={editorOptions}
            />
          </div>
          <div style={{ flex: 1, borderRight: "1px solid #333", display: "flex", flexDirection: "column" }}>
            <div style={headerStyle}>CSS</div>
            <Editor 
              height="100%" 
              defaultLanguage="css" 
              theme="vs-dark"
              value={css} // ✅ Controlled Input
              onChange={(value) => setCss(value || "")}
              options={editorOptions}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={headerStyle}>JS</div>
            <Editor 
              height="100%" 
              defaultLanguage="javascript" 
              theme="vs-dark"
              value={js} // ✅ Controlled Input
              onChange={(value) => setJs(value || "")}
              options={editorOptions}
            />
          </div>
        </>
      )}

      {/* --- CASE 2: C++ / JAVA / PYTHON (Single Screen) --- */}
      {language !== "web" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={headerStyle}>
             {language === "cpp" ? "C++ (main.cpp)" : 
              language === "java" ? "Java (Main.java)" : "Python (main.py)"}
          </div>
          <Editor 
            height="100%" 
            language={getEditorLanguage()} 
            theme="vs-dark"
            // ✅ Dynamically choose the value based on language
            value={
              language === "cpp" ? cppCode : 
              language === "java" ? javaCode : pythonCode
            }
            onChange={(value) => {
              if (language === "cpp") setCppCode(value || "");
              if (language === "java") setJavaCode(value || "");
              if (language === "python") setPythonCode(value || "");
            }}
            options={editorOptions}
          />
        </div>
      )}
    </div>
  );
}

// --- CONFIG ---
const headerStyle = {
  background: "#1e1e1e",
  color: "#888",
  padding: "8px 16px",
  fontSize: "12px",
  fontWeight: "bold",
  borderBottom: "1px solid #333",
  textTransform: "uppercase"
};

const editorOptions = {
  minimap: { enabled: false },
  fontSize: 14,
  wordWrap: "on",
  scrollBeyondLastLine: false,
  automaticLayout: true,
};