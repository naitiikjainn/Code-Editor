import React, { useEffect, useRef, useCallback, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { Awareness } from "y-protocols/awareness";
import { API_URL } from "../config"; 
import { FileJson, FileType, FileCode, Coffee, Braces } from "lucide-react";
import ProblemPreview from "./ProblemPreview"; // <--- Import

// 1. ADVANCED EDITOR OPTIONS
const COMMON_OPTIONS = { 
  minimap: { enabled: false }, 
  fontSize: 14, 
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontLigatures: true,
  automaticLayout: true, 
  wordWrap: "off", // Disable wrapping to prevent "spreading"
  scrollBeyondLastLine: true,
  padding: { top: 16, bottom: 16 },
  lineNumbersMinChars: 4,
  renderLineHighlight: "all", 
  cursorBlinking: "smooth",
  smoothScrolling: true,
  formatOnPaste: false,
  formatOnType: false
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
  activeFile, onCodeChange, username, roomId, onCodeNow 
}) {
  const providerRef = useRef(null);
  const docRef = useRef(null);
  const awarenessRef = useRef(null);
  const bindingRef = useRef(null);
  const editorRef = useRef(null);
  const [isSynced, setIsSynced] = useState(false);

  // --- CLEANUP ---
  const cleanupYjs = useCallback(() => {
    console.log("[Editors] Cleanup Triggered");
    
    if (bindingRef.current) {
        try {
            // Only destroy binding if model is potentially still alive
            if (editorRef.current && editorRef.current.getModel() && !editorRef.current.getModel().isDisposed()) {
                 bindingRef.current.destroy();
            } else {
                 console.log("[Editors] Model already disposed, skipping binding.destroy()");
                 // Manually nullify if needed or just let it go
                 bindingRef.current = null;
            }
        } catch (e) { 
            console.warn("Yjs binding cleanup warning:", e); 
        }
        bindingRef.current = null;
    }
    
    if (awarenessRef.current) {
        try { awarenessRef.current.destroy(); } catch (e) { /* ignore */ }
        awarenessRef.current = null;
    }
    if (providerRef.current) {
        try { 
            providerRef.current.disconnect();
            providerRef.current.destroy(); 
        } catch (e) { /* ignore */ }
        providerRef.current = null;
    }
    if (docRef.current) {
        try { docRef.current.destroy(); } catch (e) { /* ignore */ }
        docRef.current = null;
    }
    setIsSynced(false);
    editorRef.current = null;
  }, []);


  // --- LIFECYCLE ---
  useEffect(() => {
    return () => cleanupYjs();
  }, [cleanupYjs, roomId, activeFile?._id]); // Cleanup on file switch

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
    editorRef.current = editor;

    // DESTROY OLD BINDING IF EXISTS (Crucial for file switching)
    if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
    }

    // Make sure we have a valid doc (Singleton for the room)
    if (!docRef.current) {
        const doc = new Y.Doc();
        docRef.current = doc;

        if (roomId) {
            const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
            const baseUrl = API_URL.replace(/^http(s)?/, wsProtocol).replace(/\/$/, "");
            // CRITICAL FIX: Unique Room PER FILE to prevent ghost cursors across files
            const roomName = `codeplay-${roomId}-${activeFile._id}`; 
            
            console.log(`[Editors] Connecting to Yjs room: ${roomName}`);
            console.log(`[Editors] WebSocket URL: ${baseUrl}/${roomName}`);

            const provider = new WebsocketProvider(baseUrl, roomName, doc, { connect: true });
            providerRef.current = provider;
            awarenessRef.current = provider.awareness;
            
            // Connection status logging
            provider.on('status', ({ status }) => {
                console.log(`[Editors] Yjs connection status: ${status}`);
            });

            provider.awareness.setLocalStateField('user', {
                name: username || "Anonymous",
                color: stringToColor(username || "Anonymous")
            });

            provider.on('sync', (synced) => setIsSynced(synced));

            // Cursor Styles
            provider.awareness.on('update', () => {
                const states = provider.awareness.getStates();
                let styleContent = "";
                let userCount = 0;
                states.forEach((state, clientId) => {
                    if (state.user) {
                        userCount++;
                        const { name, color } = state.user;
                        // Escape special characters in name for CSS content
                        const escapedName = name ? name.replace(/"/g, '\\"').replace(/\n/g, '') : 'Anonymous';
                        styleContent += `
                            .yRemoteSelection-${clientId} { 
                                background-color: ${color}40 !important; 
                            }
                            .yRemoteSelectionHead-${clientId} { 
                                position: absolute;
                                border-left: 2px solid ${color} !important;
                                border-top: none;
                                border-bottom: none;
                                height: 100%;
                                box-sizing: border-box;
                            }
                            .yRemoteSelectionHead-${clientId}::after {
                                content: "${escapedName}";
                                background: ${color};
                                color: #fff;
                                font-size: 10px;
                                padding: 1px 4px;
                                border-radius: 2px;
                                position: absolute;
                                top: -16px;
                                left: -2px;
                                white-space: nowrap;
                                pointer-events: none;
                                z-index: 100;
                                font-family: sans-serif;
                            }
                        `;
                    }
                });
                console.log(`[Editors] Awareness update: ${userCount} users in room`);
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
        const currentContent = yText.toString();
        if (currentContent.length === 0) { 
            if (activeFile.content) {
                // Normalize line endings to LF to prevent index drift
                const normalizedContent = activeFile.content.replace(/\r\n/g, "\n");
                doc.transact(() => yText.insert(0, normalizedContent));
            }
        } else if (currentContent.includes("\r")) {
             // AUTO-REPAIR: Fix "Poisoned" history with mixed line endings
             console.log("🧹 Repairing Line Endings in Yjs Document...");
             const clean = currentContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
             doc.transact(() => {
                 yText.delete(0, currentContent.length); // Clear
                 yText.insert(0, clean); // Re-insert clean
             });
        }
    };

    if (providerRef.current && providerRef.current.synced) initContent();
    else if (providerRef.current) providerRef.current.once('synced', initContent);
    else initContent(); 

    const binding = new MonacoBinding(yText, editor.getModel(), new Set([editor]), awarenessRef.current);
    bindingRef.current = binding;

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

  // --- PROBLEM PREVIEW MODE ---
  if (activeFile.type === "preview") {
      return (
          <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
               <div style={headerContainerStyle}>
                  {renderTab(<FileCode size={14} color="#facc15"/>, activeFile.name, "#facc15")}
               </div>
               <ProblemPreview problem={activeFile.data} onCodeNow={onCodeNow} />
          </div>
      );
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
        onMount={(editor, monaco) => {
            // FORCE LF (Line Feed) End of Line to prevent index drift
            editor.getModel().setEOL(0); // 0 = LF, 1 = CRLF
            handleMount(editor, monaco);
        }} 
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