import React from "react";
import CodeEditor from "./CodeEditor";

export default function Editors({ 
  language, 
  // Web Props
  html, setHtml, css, setCss, js, setJs, 
  // C++ Props
  cppCode, setCppCode, 
  // Java Props
  javaCode, setJavaCode,
  // ✅ FIXED: Added Python Props
  pythonCode, setPythonCode
}) {

  // --- LAYOUT 1: WEB (3 Columns) ---
  if (language === "web") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", height: "100%", width: "100%", overflow: "hidden" }}>
        
        {/* HTML */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #333", overflow: "hidden" }}>
          <div style={headerStyle}>HTML</div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <CodeEditor value={html} onChange={setHtml} language="html" />
          </div>
        </div>

        {/* CSS */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #333", overflow: "hidden" }}>
          <div style={headerStyle}>CSS</div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <CodeEditor value={css} onChange={setCss} language="css" />
          </div>
        </div>

        {/* JS */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={headerStyle}>JS</div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <CodeEditor value={js} onChange={setJs} language="javascript" />
          </div>
        </div>
      </div>
    );
  }

  // --- LAYOUT 2: C++, JAVA, or PYTHON (Single Column) ---
  
  // Helper to determine which code/setter to use
  let activeCode = "";
  let activeSetter = null;
  let activeLang = "text";
  let activeTitle = "";

  if (language === "cpp") {
      activeCode = cppCode;
      activeSetter = setCppCode;
      activeLang = "cpp";
      activeTitle = "C++ (main.cpp)";
  } else if (language === "java") {
      activeCode = javaCode;
      activeSetter = setJavaCode;
      activeLang = "java";
      activeTitle = "Java (Main.java)";
  } else if (language === "python") { // ✅ FIXED: Handle Python Case
      activeCode = pythonCode;
      activeSetter = setPythonCode;
      activeLang = "python";
      activeTitle = "Python (main.py)";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
      <div style={headerStyle}>
        {activeTitle}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <CodeEditor 
            value={activeCode} 
            onChange={activeSetter} 
            language={activeLang} 
        />
      </div>
    </div>
  );
}

// Reusable Style for the headers
const headerStyle = {
  background: "#1e1e1e",
  color: "#858585",
  padding: "8px 16px",
  fontSize: "12px",
  fontWeight: "bold",
  borderBottom: "1px solid #333"
};