import React, { useEffect, useRef, useCallback, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { API_URL } from "../config"; 

// 1. MOVE OPTIONS OUTSIDE to prevent re-renders on every keystroke
const COMMON_OPTIONS = { 
  minimap: { enabled: false }, 
  fontSize: 14, 
  automaticLayout: true, 
  wordWrap: "on",
  scrollBeyondLastLine: false // Fixes "scrolling too far" feel
};

const getRandomColor = () => {
    const colors = ['#ff0055', '#0099ff', '#22cc88', '#ffaa00', '#9900ff', '#00ccff'];
    return colors[Math.floor(Math.random() * colors.length)];
};

export default function Editors({ 
  language, username, roomId,
  html, css, js, cppCode, javaCode, pythonCode, 
  setHtml, setCss, setJs, setCppCode, setJavaCode, setPythonCode
}) {
  const providerRef = useRef(null);
  const docRef = useRef(null);
  const bindingsRef = useRef([]);
  const [isSynced, setIsSynced] = useState(false);

  // --- CLEANUP ---
  const cleanupYjs = useCallback(() => {
    if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current.destroy();
    }
    if (docRef.current) docRef.current.destroy();
    bindingsRef.current.forEach(b => b.destroy());
    bindingsRef.current = [];
    setIsSynced(false);
  }, []);

  // --- LIFECYCLE ---
  useEffect(() => {
    return () => cleanupYjs();
  }, [cleanupYjs, language, roomId]);

  // --- USERNAME UPDATE ---
  useEffect(() => {
    if (providerRef.current && username && username !== "Anonymous") {
        const awareness = providerRef.current.awareness;
        const currentUser = awareness.getLocalState()?.user;
        if (currentUser && currentUser.name !== username) {
            awareness.setLocalStateField('user', { ...currentUser, name: username });
        }
    }
  }, [username, isSynced]);

  // --- MOUNT HANDLER ---
  const handleMount = useCallback((editor, monaco, fileType) => {
    if (!docRef.current) {
    const doc = new Y.Doc();
    docRef.current = doc;

    const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
    
    // FIX: Robust URL cleaning
    const baseUrl = API_URL.replace(/^http(s)?/, wsProtocol).replace(/\/$/, "");
    
    const modeSuffix = language === "web" ? "web" : language;
    const roomName = `codeplay-${roomId}-${modeSuffix}`; 

    console.log(` Connecting: ${baseUrl}/${roomName}`);

    const provider = new WebsocketProvider(
        baseUrl, 
        roomName, 
        doc,
        { connect: true } 
    );
    providerRef.current = provider;

        // User Awareness
        provider.awareness.setLocalStateField('user', {
            name: username || "Anonymous",
            color: getRandomColor()
        });

        provider.on('sync', (synced) => setIsSynced(synced));

        // Inject Dynamic Cursor Colors
        provider.awareness.on('update', () => {
            const states = provider.awareness.getStates();
            let styleContent = "";
            states.forEach((state, clientId) => {
                if (state.user) {
                    const { name, color } = state.user;
                    // UPDATED CSS GENERATION (Removed border-top/bottom)
                    styleContent += `
                        .yRemoteSelection-${clientId} { background-color: ${color}33; }
                        .yRemoteSelectionHead-${clientId} { border-left-color: ${color}; }
                        .yRemoteSelectionHead-${clientId}::after {
                            content: "${name}";
                            background: ${color};
                        }
                    `;
                }
            });
            let styleEl = document.getElementById("yjs-cursor-styles");
            if (!styleEl) {
                styleEl = document.createElement("style");
                styleEl.id = "yjs-cursor-styles";
                document.head.appendChild(styleEl);
            }
            styleEl.innerHTML = styleContent;
        });
    }

    const doc = docRef.current;
    const provider = providerRef.current;
    
    const textFieldName = language === "web" ? `${fileType}-code` : `${language}-code`;
    const yText = doc.getText(textFieldName);

    // Initial Seed
    const initContent = () => {
        if (yText.toString().length === 0) { 
            let initialValue = "";
            if (language === "web") {
                if (fileType === "html") initialValue = html;
                if (fileType === "css") initialValue = css;
                if (fileType === "js") initialValue = js;
            } else {
                if (language === "cpp") initialValue = cppCode;
                if (language === "java") initialValue = javaCode;
                if (language === "python") initialValue = pythonCode;
            }
            if (initialValue) doc.transact(() => yText.insert(0, initialValue));
        }
    };

    if (provider.synced) initContent();
    else provider.once('synced', initContent);

    // Bind Editor
    const binding = new MonacoBinding(yText, editor.getModel(), new Set([editor]), provider.awareness);
    bindingsRef.current.push(binding);

    // Update Local State
    editor.onDidChangeModelContent(() => {
        const val = editor.getValue();
        if (language === "cpp") setCppCode(val);
        else if (language === "java") setJavaCode(val);
        else if (language === "python") setPythonCode(val);
        else if (fileType === "html") setHtml(val);
        else if (fileType === "css") setCss(val);
        else if (fileType === "js") setJs(val);
    });

  }, [roomId, language, username]); 

  // Helper Renderer
  const renderEditor = (ft) => (
      <Editor 
        height="100%" 
        defaultLanguage={language === "web" ? (ft === "js" ? "javascript" : ft) : language}
        theme="vs-dark" 
        options={COMMON_OPTIONS} // <--- USE THE EXTERNAL CONSTANT
        defaultValue="" 
        onMount={(e, m) => handleMount(e, m, ft)} 
      />
  );

  if (language === "web") {
    return (
      <div style={{ display: "flex", height: "100%", width: "100%" }}>
         <div style={paneStyle}><div style={headerStyle}>HTML</div>{renderEditor("html")}</div>
         <div style={paneStyle}><div style={headerStyle}>CSS</div>{renderEditor("css")}</div>
         <div style={paneStyle}><div style={headerStyle}>JS</div>{renderEditor("js")}</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      <div style={headerStyle}>{language === "cpp" ? "C++" : language === "java" ? "Java" : "Python"}</div>
      {renderEditor(language)}
    </div>
  );
}

const paneStyle = { flex: 1, borderRight: "1px solid #333", display: "flex", flexDirection: "column" };
const headerStyle = { background: "#1e1e1e", color: "#888", padding: "8px 16px", fontSize: "12px", fontWeight: "bold", borderBottom: "1px solid #333", textTransform: "uppercase" };