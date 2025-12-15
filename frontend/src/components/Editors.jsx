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
  
  // 1. REFS: Store latest props so we don't have stale closures
  const propsRef = useRef({ socket, roomId, username });
  const remoteCursorsRef = useRef(remoteCursors);

  useEffect(() => {
    propsRef.current = { socket, roomId, username };
    remoteCursorsRef.current = remoteCursors; // Keep this fresh
  }, [socket, roomId, username, remoteCursors]);


  // --- 2. CORE LOGIC: RENDER CURSORS ---
  // We extract this so we can call it manually after text updates
  const renderRemoteCursors = (editor, fileType) => {
    if (!editor) return;

    const currentCursors = remoteCursorsRef.current; // Use Ref for latest data
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
          stickiness: 1 // NeverGrowsWhenTypingAtEdges
        }
      };
    });

    const previousIds = decorationsRef.current[fileType] || [];
    // This atomic swap prevents flashing
    const newIds = editor.deltaDecorations(previousIds, newDecorationsData);
    decorationsRef.current[fileType] = newIds;
  };


  // --- 3. CORE LOGIC: UPDATE TEXT SAFELY ---
  const updateEditorContent = (editor, newText, fileType) => {
    if (!editor) return;
    const currentText = editor.getValue();
    if (currentText === newText) return;

    // STEP A: Save YOUR cursor position (so you don't jump)
    const myCursorPosition = editor.getPosition();
    
    // STEP B: Clear Remote Cursors (PREVENTS "JUMP TO END" BUG)
    // If we don't do this, Monaco pushes the cursors to the bottom of the file
    // because it thinks they are part of the text being replaced.
    const currentDecorationIds = decorationsRef.current[fileType] || [];
    editor.deltaDecorations(currentDecorationIds, []); 
    decorationsRef.current[fileType] = []; // Clear our track record

    // STEP C: Apply Text Edit
    const fullRange = editor.getModel().getFullModelRange();
    editor.pushUndoStop();
    editor.executeEdits('socket-update', [
      {
        range: fullRange,
        text: newText,
        forceMoveMarkers: false // Don't try to move markers, we just cleared them!
      }
    ]);
    editor.pushUndoStop();

    // STEP D: Restore Remote Cursors (Put them back where they belong)
    renderRemoteCursors(editor, fileType);

    // STEP E: Restore YOUR cursor
    if (myCursorPosition) {
        editor.setPosition(myCursorPosition);
    }
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


  // --- 5. LISTEN FOR CURSOR UPDATES (Standard Move) ---
  useEffect(() => {
    Object.keys(editorRefs.current).forEach((fileType) => {
      renderRemoteCursors(editorRefs.current[fileType], fileType);
    });
  }, [remoteCursors]); // If only cursors change, just re-render them


  // --- 6. HANDLE MOUNT & YOUR CURSOR EVENTS ---
  const handleEditorDidMount = useCallback((editor, fileType) => {
    editorRefs.current[fileType] = editor;
    
    // Initial Render
    renderRemoteCursors(editor, fileType);

    editor.onDidChangeCursorPosition((e) => {
      const { socket, roomId, username } = propsRef.current;
      const allowedReasons = [3, 4, 5]; // Explicit movements only

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

  // --- 7. CSS GENERATOR ---
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
            
            // Uncontrolled Mode (We handle updates manually in updateEditorContent)
            defaultValue={language === "cpp" ? cppCode : language === "java" ? javaCode : pythonCode} 
            
            onChange={(val) => {
              if (language === "cpp") setCppCode(val);
              if (language === "java") setJavaCode(val);
              if (language === "python") setPythonCode(val);
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
                defaultValue={html} onChange={setHtml} 
                onMount={(e) => handleEditorDidMount(e, "html")} options={editorOptions} 
            />
         </div>
         <div style={paneStyle}>
            <div style={headerStyle}>CSS</div>
            <Editor 
                height="100%" defaultLanguage="css" theme="vs-dark" 
                defaultValue={css} onChange={setCss} 
                onMount={(e) => handleEditorDidMount(e, "css")} options={editorOptions} 
            />
         </div>
         <div style={paneStyle}>
            <div style={headerStyle}>JS</div>
            <Editor 
                height="100%" defaultLanguage="javascript" theme="vs-dark" 
                defaultValue={js} onChange={setJs} 
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