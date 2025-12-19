import React, { useEffect, useRef, useCallback, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { Awareness } from "y-protocols/awareness";
import { API_URL } from "../config"; 
import { FileJson, FileType, FileCode, Coffee, Braces } from "lucide-react";

// 1. ADVANCED EDITOR OPTIONS
const COMMON_OPTIONS = { 
  minimap: { enabled: false }, 
  fontSize: 14, 
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontLigatures: true,
  automaticLayout: true, 
  wordWrap: "on",
  scrollBeyondLastLine: false,
  padding: { top: 16, bottom: 16 },
  lineNumbersMinChars: 4,
  renderLineHighlight: "all", // Highlights current line nicely
  cursorBlinking: "smooth",
  smoothScrolling: true
};

const stringToColor = (str) => {
    if (!str) return "#ccc";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
};

export default function Editors({ 
  activeFile, onCodeChange, username, roomId
}) {
  const providerRef = useRef(null);
  const docRef = useRef(null);
  const awarenessRef = useRef(null);
  const bindingsRef = useRef([]);
  const [isSynced, setIsSynced] = useState(false);

  // --- CLEANUP ---
  const cleanupYjs = useCallback(() => {
    if (providerRef.current) {
        providerRef.current.disconnect();
        providerRef.current.destroy();
        providerRef.current = null;
    }
    if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
    }
    if (awarenessRef.current) {
        awarenessRef.current.destroy();
        awarenessRef.current = null;
    }
    bindingsRef.current.forEach(b => b.destroy());
    bindingsRef.current = [];
    setIsSynced(false);
  }, []);

  // --- LIFECYCLE ---
  useEffect(() => {
    return () => cleanupYjs();
  }, [cleanupYjs, roomId]);

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
  const handleMount = useCallback((editor, monaco) => {
    if (!activeFile) return;

    // Make sure we have a valid doc
    if (!docRef.current) {
        const doc = new Y.Doc();
        docRef.current = doc;

        if (roomId) {
            const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
            const baseUrl = API_URL.replace(/^http(s)?/, wsProtocol).replace(/\/$/, "");
            const roomName = `codeplay-${roomId}-v2`; // Updated room version

            const provider = new WebsocketProvider(baseUrl, roomName, doc, { connect: true });
            providerRef.current = provider;
            awarenessRef.current = provider.awareness;

            provider.awareness.setLocalStateField('user', {
                name: username || "Anonymous",
                color: stringToColor(username || "Anonymous")
            });

            provider.on('sync', (synced) => setIsSynced(synced));

            // Cursor Styles
            provider.awareness.on('update', () => {
                const states = provider.awareness.getStates();
                let styleContent = "";
                states.forEach((state, clientId) => {
                    if (state.user) {
                        const { name, color } = state.user;
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
        } else {
            // Offline
            awarenessRef.current = new Awareness(doc);
            setIsSynced(true);
        }
    }

    const doc = docRef.current;
    // Use file ID for unique YJS field
    const textFieldName = `file-${activeFile._id}`; 
    const yText = doc.getText(textFieldName);

    const initContent = () => {
        if (yText.toString().length === 0) { 
            if (activeFile.content) doc.transact(() => yText.insert(0, activeFile.content));
        }
    };

    if (providerRef.current && providerRef.current.synced) initContent();
    else if (providerRef.current) providerRef.current.once('synced', initContent);
    else initContent(); 

    const binding = new MonacoBinding(yText, editor.getModel(), new Set([editor]), awarenessRef.current);
    bindingsRef.current.push(binding);

    // Force update parent on immediate bind in case Yjs already has content
    if (editor.getValue()) {
        onCodeChange(editor.getValue());
    }

    // Ensure we capture remote updates that might not trigger standard change events in time
    yText.observe(() => {
        onCodeChange(yText.toString());
    });

    editor.onDidChangeModelContent(() => {
        const val = editor.getValue();
        onCodeChange(val);
    });

  }, [roomId, activeFile, username, onCodeChange]); 

  if (!activeFile) {
      return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>Select a file to edit</div>;
  }

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
       <div style={headerContainerStyle}>
          {renderTab(<FileCode size={14} color="#4fc3f7"/>, activeFile.name, "#4fc3f7")}
       </div>
       <Editor 
        key={`${roomId}-${activeFile._id}`}
        height="100%" 
        defaultLanguage={activeFile.language === "js" ? "javascript" : activeFile.language}
        theme="vs-dark" 
        options={COMMON_OPTIONS}
        defaultValue="" 
        onMount={(e, m) => handleMount(e, m)} 
       />
    </div>
  );
}

const renderTab = (icon, name, color) => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "100%", padding: "0 12px", borderTop: `2px solid ${color}`, background: "var(--bg-panel)", color: "var(--text-main)" }}>
        {icon}
        <span style={{ fontSize: "13px", fontWeight: "500" }}>{name}</span>
    </div>
);

const paneStyle = { flex: 1, borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", background: "var(--bg-panel)", overflow: "hidden" };
const headerContainerStyle = { height: "36px", background: "var(--bg-dark)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center" };