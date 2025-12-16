import React, { useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";

export default function Editors({ 
  language, 
  html, setHtml, css, setCss, js, setJs, 
  cppCode, setCppCode, javaCode, setJavaCode, pythonCode, setPythonCode,
  socket, roomId, username, remoteCursors 
}) {

  const editorRefs = useRef({});
  const decorationsRef = useRef({}); 
  
  // 1. REFS
  const propsRef = useRef({ socket, roomId, username });
  const remoteCursorsRef = useRef(remoteCursors);
  
  // FLAG: This prevents the "Infinite Loop"
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    propsRef.current = { socket, roomId, username };
    remoteCursorsRef.current = remoteCursors;
  }, [socket, roomId, username, remoteCursors]);


  // --- 2. RENDER CURSORS ---
  const renderRemoteCursors = (editor, fileType) => {
    if (!editor) return;

    const currentCursors = remoteCursorsRef.current;
    const relevantCursors = Object.entries(currentCursors)
      .filter(([remoteUser, data]) => {
          return data.position.fileType === fileType && remoteUser !== propsRef.current.username;
      });

    const newDecorationsData = relevantCursors.map(([user, data]) => {
      return {
        range: new window.monaco.Range(
          data.position.lineNumber, data.position.column,
          data.position.lineNumber, data.position.column
        ),
        options: {
          className: `cursor-${user}`, 
          hoverMessage: { value: `${user}` },
          stickiness: 1 
        }
      };
    });

    const previousIds = decorationsRef.current[fileType] || [];
    const newIds = editor.deltaDecorations(previousIds, newDecorationsData);
    decorationsRef.current[fileType] = newIds;
  };


  // --- 3. UPDATE TEXT SAFELY (Without Triggering Loop) ---
  const updateEditorContent = (editor, newText, fileType) => {
    if (!editor) return;
    const currentText = editor.getValue();
    if (currentText === newText) return;

    // A. Raise the Flag: "This is a computer update, not a human"
    isRemoteUpdate.current = true;

    // B. Save cursor
    const myCursorPosition = editor.getPosition();
    
    // C. Remove Remote Cursors (Fixes "Jump to End" bug)
    const currentDecorationIds = decorationsRef.current[fileType] || [];
    editor.deltaDecorations(currentDecorationIds, []); 
    decorationsRef.current[fileType] = [];

    // D. Apply Text Edit
    const fullRange = editor.getModel().getFullModelRange();
    editor.pushUndoStop();
    editor.executeEdits('socket-update', [
      {
        range: fullRange,
        text: newText,
        forceMoveMarkers: false 
      }
    ]);
    editor.pushUndoStop();

    // E. Restore Remote Cursors
    renderRemoteCursors(editor, fileType);

    // F. Restore Local Cursor
    if (myCursorPosition) {
        editor.setPosition(myCursorPosition);
    }

    // G. Lower the Flag: "Okay, humans can type now"
    isRemoteUpdate.current = false;
  };


  // --- 4. LISTEN FOR TEXT UPDATES ---
  useEffect(() => {
    if (language === "web") {
        updateEditorContent(editorRefs.current["html"], html, "html");
        updateEditorContent(editorRefs.current["css"], css, "css");
        updateEditorContent(editorRefs.current["js"], js, "js");
    } else if (language === "cpp") {
        updateEditorContent(editorRefs.current["cpp"], cppCode, "cpp");
    } else if (language === "java") {
        updateEditorContent(editorRefs.current["java"], javaCode, "java");
    } else if (language === "python") {
        updateEditorContent(editorRefs.current["python"], pythonCode, "python");
    }
  }, [html, css, js, cppCode, javaCode, pythonCode, language]);


  // --- 5. LISTEN FOR CURSOR UPDATES ---
  useEffect(() => {
    Object.keys(editorRefs.current).forEach((fileType) => {
      renderRemoteCursors(editorRefs.current[fileType], fileType);
    });
  }, [remoteCursors]); 


  // --- 6. HANDLE MOUNT & CURSOR EVENTS ---
  const handleEditorDidMount = useCallback((editor, fileType) => {
    editorRefs.current[fileType] = editor;
    renderRemoteCursors(editor, fileType);

    editor.onDidChangeCursorPosition((e) => {
      const { socket, roomId, username } = propsRef.current;
      const allowedReasons = [3, 4, 5]; 

      if (socket && roomId && username && allowedReasons.includes(e.reason)) {
        const position = {
          fileType: fileType,
          lineNumber: e.position.lineNumber,
          column: e.position.column
        };
        socket.emit("cursor_move", { roomId, username, position });
      }
    });
  }, []);

  // --- 7. HELPER: WRAPPER TO STOP LOOP ---
  // This function checks the flag before notifying the parent
  const handleEditorChange = (value, setter) => {
      if (isRemoteUpdate.current) {
          // STOP! This change came from the socket.
          // Do NOT call setHtml/setCppCode, because App.jsx already has the new data.
          // If we call it, App.jsx will emit 'code_change' back to server -> LOOP.
          return;
      }
      setter(value);
  };

  // --- 8. CSS GENERATOR ---
  const generateCursorStyles = () => {
    let styles = "";
    Object.keys(remoteCursors).forEach((user) => {
        if (user === username) return;
        const color = getUserColor(user);
        styles += `
            .cursor-${user} { border-left: 2px solid ${color}; position: absolute; z-index: 100; }
            .cursor-${user}::after {
              content: "${user}"; position: absolute; top: -18px; left: 0;
              background-color: ${color}; color: white; font-size: 10px;
              padding: 2px 4px; border-radius: 4px; pointer-events: none; 
              opacity: 0.9; z-index: 101;
            }
        `;
    });
    return styles;
  };

  const getUserColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 50%)`;
  };

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      <style>{generateCursorStyles()}</style>
      
      {/* C++ / JAVA / PYTHON */}
      {language !== "web" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={headerStyle}>{language === "cpp" ? "C++" : language === "java" ? "Java" : "Python"}</div>
          <Editor 
            key={language} 
            height="100%" 
            language={language === "cpp" ? "cpp" : language === "java" ? "java" : "python"} 
            theme="vs-dark"
            defaultValue={language === "cpp" ? cppCode : language === "java" ? javaCode : pythonCode} 
            
            // USE THE WRAPPER FUNCTION HERE
            onChange={(val) => {
              if (language === "cpp") handleEditorChange(val, setCppCode);
              if (language === "java") handleEditorChange(val, setJavaCode);
              if (language === "python") handleEditorChange(val, setPythonCode);
            }}
            
            onMount={(editor) => handleEditorDidMount(editor, language === "cpp" ? "cpp" : language === "java" ? "java" : "python")}
            options={editorOptions}
          />
        </div>
      )}
      
      {/* WEB EDITORS */}
      {language === "web" && (
        <>
         <div style={paneStyle}>
            <div style={headerStyle}>HTML</div>
            <Editor 
                height="100%" defaultLanguage="html" theme="vs-dark" 
                defaultValue={html} 
                onChange={(val) => handleEditorChange(val, setHtml)} 
                onMount={(e) => handleEditorDidMount(e, "html")} options={editorOptions} 
            />
         </div>
         <div style={paneStyle}>
            <div style={headerStyle}>CSS</div>
            <Editor 
                height="100%" defaultLanguage="css" theme="vs-dark" 
                defaultValue={css} 
                onChange={(val) => handleEditorChange(val, setCss)} 
                onMount={(e) => handleEditorDidMount(e, "css")} options={editorOptions} 
            />
         </div>
         <div style={paneStyle}>
            <div style={headerStyle}>JS</div>
            <Editor 
                height="100%" defaultLanguage="javascript" theme="vs-dark" 
                defaultValue={js} 
                onChange={(val) => handleEditorChange(val, setJs)} 
                onMount={(e) => handleEditorDidMount(e, "js")} options={editorOptions} 
            />
         </div>
        </>
      )}
    </div>
  );
}

const paneStyle = { flex: 1, borderRight: "1px solid #333", display: "flex", flexDirection: "column" };
const headerStyle = { background: "#1e1e1e", color: "#888", padding: "8px 16px", fontSize: "12px", fontWeight: "bold", borderBottom: "1px solid #333", textTransform: "uppercase" };
const editorOptions = { minimap: { enabled: false }, fontSize: 14, wordWrap: "on", automaticLayout: true };