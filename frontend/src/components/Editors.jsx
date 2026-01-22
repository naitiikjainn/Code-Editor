import React, { useEffect, useRef, useCallback, useState } from "react";
import Editor, { loader } from "@monaco-editor/react"; // Import loader
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { Awareness } from "y-protocols/awareness";
import { API_URL } from "../config"; 
import { FileJson, FileType, FileCode, Coffee, Braces } from "lucide-react";
import ProblemPreview from "./ProblemPreview";

// 1. ADVANCED EDITOR OPTIONS
const COMMON_OPTIONS = { 
  minimap: { enabled: false }, 
  fontSize: 14, 
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontLigatures: true,
  automaticLayout: true, 
  wordWrap: "off",
  scrollBeyondLastLine: true,
  padding: { top: 16, bottom: 16 },
  lineNumbersMinChars: 4,
  renderLineHighlight: "all", 
  cursorBlinking: "smooth",
  smoothScrolling: true,
  formatOnPaste: false,
  formatOnType: false,
  "semanticHighlighting.enabled": true
};

const stringToColor = (str) => {
    if (!str) return "#ccc";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
};

// DEFINE CUSTOM THEME BEFORE MOUNT
loader.init().then(monaco => {
    monaco.editor.defineTheme('cyber-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'ff79c6' },
            { token: 'identifier', foreground: '8be9fd' },
            { token: 'string', foreground: 'f1fa8c' },
            { token: 'number', foreground: 'bd93f9' },
            { token: 'type', foreground: '8be9fd' },
        ],
        colors: {
            'editor.background': '#050505', // MATCHES DASHBOARD BG
            'editor.foreground': '#f8f8f2',
            'editor.lineHighlightBackground': '#121212',
            'editorCursor.foreground': '#8be9fd',
            'editorWhitespace.foreground': '#3b3a32',
            'editorIndentGuide.background': '#1e1e1e',
            'editorIndentGuide.activeBackground': '#6272a4',
        }
    });
});

export default function Editors({ 
  activeFile, onCodeChange, username, roomId, onCodeNow, readOnly = false 
}) {
  const providerRef = useRef(null);
  const docRef = useRef(null);
  const awarenessRef = useRef(null);
  const bindingRef = useRef(null);
  const editorRef = useRef(null);
  const [isSynced, setIsSynced] = useState(false);

  // --- CLEANUP ---
  const cleanupYjs = useCallback(() => {
    // ... (cleanup logic same as before)
    if (bindingRef.current) {
        try {
            if (editorRef.current && editorRef.current.getModel() && !editorRef.current.getModel().isDisposed()) {
                 bindingRef.current.destroy();
            } else {
                 bindingRef.current = null;
            }
        } catch (e) { console.warn("Yjs binding cleanup warning:", e); }
        bindingRef.current = null;
    }
    if (awarenessRef.current) { try { awarenessRef.current.destroy(); } catch (e) { } awarenessRef.current = null; }
    if (providerRef.current) { try { providerRef.current.disconnect(); providerRef.current.destroy(); } catch (e) { } providerRef.current = null; }
    if (docRef.current) { try { docRef.current.destroy(); } catch (e) { } docRef.current = null; }
    setIsSynced(false);
    editorRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanupYjs();
  }, [cleanupYjs, roomId, activeFile?._id]);

  useEffect(() => {
    if (providerRef.current && username && username !== "Anonymous") {
        const awareness = providerRef.current.awareness;
        const currentUser = awareness.getLocalState()?.user;
        if (currentUser && currentUser.name !== username) {
            awareness.setLocalStateField('user', { ...currentUser, name: username });
        }
    }
  }, [username, isSynced]);

  const handleMount = useCallback((editor, monaco) => {
    if (!activeFile) return;
    editorRef.current = editor;

    if (bindingRef.current) { bindingRef.current.destroy(); bindingRef.current = null; }

    if (!docRef.current) {
        const doc = new Y.Doc();
        docRef.current = doc;

        if (roomId) {
            const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
            const baseUrl = API_URL.replace(/^http(s)?/, wsProtocol).replace(/\/$/, "");
            const roomName = `codeplay-${roomId}-${activeFile._id}`; 
            
            const provider = new WebsocketProvider(baseUrl, roomName, doc, { connect: true });
            providerRef.current = provider;
            awarenessRef.current = provider.awareness;
            
            provider.awareness.setLocalStateField('user', {
                name: username || "Anonymous",
                color: stringToColor(username || "Anonymous")
            });

            provider.on('sync', (synced) => setIsSynced(synced));

            provider.awareness.on('update', () => {
                const states = provider.awareness.getStates();
                let styleContent = "";
                states.forEach((state, clientId) => {
                    if (state.user) {
                        const { name, color } = state.user;
                        const escapedName = name ? name.replace(/"/g, '\\"').replace(/\n/g, '') : 'Anonymous';
                        styleContent += `
                            .yRemoteSelection-${clientId} { background-color: ${color}40 !important; }
                            .yRemoteSelectionHead-${clientId} { position: absolute; border-left: 2px solid ${color} !important; border-top: none; border-bottom: none; height: 100%; box-sizing: border-box; }
                            .yRemoteSelectionHead-${clientId}::after { content: "${escapedName}"; background: ${color}; color: #fff; font-size: 10px; padding: 1px 4px; border-radius: 2px; position: absolute; top: -16px; left: -2px; white-space: nowrap; pointer-events: none; z-index: 100; font-family: sans-serif; }
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
        } else {
            awarenessRef.current = new Awareness(doc);
            setIsSynced(true);
        }
    }

    const doc = docRef.current;
    const textFieldName = `file-${activeFile._id}`; 
    const yText = doc.getText(textFieldName);

    const initContent = () => {
        const currentContent = yText.toString();
        if (currentContent.length === 0) { 
            if (activeFile.content) {
                const normalizedContent = activeFile.content.replace(/\r\n/g, "\n");
                doc.transact(() => yText.insert(0, normalizedContent));
            }
        } else if (currentContent.includes("\r")) {
             const clean = currentContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
             doc.transact(() => {
                 yText.delete(0, currentContent.length);
                 yText.insert(0, clean);
             });
        }
    };

    if (providerRef.current && providerRef.current.synced) initContent();
    else if (providerRef.current) providerRef.current.once('synced', initContent);
    else initContent(); 

    const binding = new MonacoBinding(yText, editor.getModel(), new Set([editor]), awarenessRef.current);
    bindingRef.current = binding;

    if (editor.getValue()) onCodeChange(editor.getValue());
    yText.observe(() => onCodeChange(yText.toString()));
    editor.onDidChangeModelContent(() => onCodeChange(editor.getValue()));

  }, [roomId, activeFile, username, onCodeChange]); 

  if (!activeFile) {
      return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", background: "#050505" }}>Select a file to edit</div>;
  }

  if (activeFile.type === "preview") {
      return (
          <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#050505" }}>
               <div style={headerContainerStyle}>
                  {renderTab(<FileCode size={14} color="#facc15"/>, activeFile.name, "#facc15")}
               </div>
               <ProblemPreview problem={activeFile.data} onCodeNow={onCodeNow} />
          </div>
      );
  }

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#050505" }}>
       <div style={headerContainerStyle}>
          {renderTab(<FileCode size={14} color="#4fc3f7"/>, activeFile.name, "#4fc3f7")}
       </div>
       <Editor 
        key={`${roomId}-${activeFile._id}`}
        height="100%" 
        defaultLanguage={activeFile.language === "js" ? "javascript" : activeFile.language}
        theme="cyber-dark" // USE CUSTOM THEME
        options={{...COMMON_OPTIONS, readOnly}}
        defaultValue="" 
        onMount={(editor, monaco) => {
            editor.getModel().setEOL(0);
            handleMount(editor, monaco);
        }} 
       />
    </div>
  );
}

const renderTab = (icon, name, color) => (
    <div style={{
        display: "flex", alignItems: "center", gap: "8px", height: "100%", padding: "0 16px",
        borderTop: `2px solid ${color}`, background: "#0a0a0a", color: "#f4f4f5",
        fontSize: "13px", fontWeight: "500", borderRight: "1px solid #1f1f23"
    }}>
        {icon}
        <span>{name}</span>
    </div>
);

const headerContainerStyle = { height: "40px", background: "#050505", borderBottom: "1px solid #27272a", display: "flex", alignItems: "center" };
