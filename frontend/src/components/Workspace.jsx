import { useState, useEffect, useRef, useCallback } from "react";
import ConfirmModal from "./ConfirmModal";
import Editors from "./Editors";
import Preview from "./Preview";
import AIPanel from "./AIPanel";
import ConsolePanel from "./ConsolePanel";
import ShareModal from "./ShareModal";
import AuthModal from "./AuthModal";
import Sidebar from "./Sidebar";
import FileExplorer from "./FileExplorer";
import ParticipantsPanel from "./ParticipantsPanel";
import TestPanel from "./TestPanel";
import { generateCppRunner } from "../utils/cppRunner"; 
import { generateJavaRunner } from "../utils/javaRunner"; 
import { generatePythonRunner } from "../utils/pythonRunner"; 
import { executeCode } from "../utils/execution"; 
import ProblemBrowser from "./ProblemBrowser"; 
import CP31Browser from "./CP31Browser";
import A2ZBrowser from "./A2ZBrowser";
import ProblemPreview from "./ProblemPreview"; 
import ErrorBoundary from "./ErrorBoundary"; 
import useDebounce from "../hooks/useDebounce"; 
import { useParams, useNavigate } from "react-router-dom"; 
import { API_URL } from "../config"; 
import io from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { Code2, Play, Share2, PanelBottom, Globe, FileCode, ShieldAlert, FlaskConical, X, Settings, Zap, Mic, MicOff, PhoneOff, Headphones, VolumeX, Download, ExternalLink, Puzzle } from "lucide-react"; 
import { useVoiceChat } from "../hooks/useVoiceChat"; 
import SettingsModal from "./SettingsModal";
import SettingsPanel from "./SettingsPanel";
import Whiteboard from "./Whiteboard"; 
import VoicePanel from "./VoicePanel";
import RecordingPanel, { CountdownOverlay, RecordingPreview } from "./RecordingPanel";
import RecordingIndicator from "./RecordingIndicator";
import CSESResultModal from "./CSESResultModal";
import { useScreenRecording } from "../hooks/useScreenRecording";
import { stringToColor } from "../utils/colors";

// Socket connection managed per-component lifecycle
let socketInstance = null;
const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(API_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });
  }
  return socketInstance;
};

const socket = getSocket();

export default function Workspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth(); 

  // --- STATE ---
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [activeCode, setActiveCode] = useState("");
  const debouncedCode = useDebounce(activeCode, 1000); // Autosave delay
  
  // REF for optimization (Stable Callbacks)
  const activeCodeRef = useRef(activeCode);
  useEffect(() => { activeCodeRef.current = activeCode; }, [activeCode]);
  
  // Persist Active File
  useEffect(() => {
    if (activeFile) {
        localStorage.setItem("activeFileId", activeFile._id);
        if (activeFile.type === "preview") {
            // If it's a preview file (virtual), save the whole object
            localStorage.setItem("activePreviewFile", JSON.stringify(activeFile));
        } else {
            localStorage.removeItem("activePreviewFile");
        }
    }
  }, [activeFile]);
  
  const [input, setInput] = useState(""); 
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("viewMode") || "editor"); // "editor" | "problem_full"
  
  // Persist View Mode
  useEffect(() => { localStorage.setItem("viewMode", viewMode); }, [viewMode]);

  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [selectedProblemForCode, setSelectedProblemForCode] = useState(null); 
  
  // UI STATE
  const [activeSidebar, setActiveSidebar] = useState(() => localStorage.getItem("activeSidebar") || "files");
  
  // Persist Sidebar Tab
  useEffect(() => {
    localStorage.setItem("activeSidebar", activeSidebar || "");
  }, [activeSidebar]); 
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(() => parseInt(localStorage.getItem("aiPanelWidth")) || 420);
  const [isAiPanelResizing, setIsAiPanelResizing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  // LAYOUT PERSISTENCE
  const [consoleHeight, setConsoleHeight] = useState(() => parseInt(localStorage.getItem("consoleHeight")) || 250); 
  const [isResizing, setIsResizing] = useState(false); 
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem("sidebarWidth")) || 380);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false); 

  // RIGHT PANEL STATE (CPH Style)
  const [rightPanel, setRightPanel] = useState(() => {
    try {
        const saved = localStorage.getItem("rightPanel");
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }); // { type: 'preview', data: problem } or null 
  const [rightPanelWidth, setRightPanelWidth] = useState(() => parseInt(localStorage.getItem("rightPanelWidth")) || 600);
  const [isRightPanelResizing, setIsRightPanelResizing] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // SAVE LAYOUT CHANGES
  useEffect(() => { localStorage.setItem("consoleHeight", consoleHeight); }, [consoleHeight]);
  useEffect(() => { localStorage.setItem("sidebarWidth", sidebarWidth); }, [sidebarWidth]);
  useEffect(() => { localStorage.setItem("rightPanelWidth", rightPanelWidth); }, [rightPanelWidth]);


  // COLLAB STATE
  const [activeUsers, setActiveUsers] = useState([]); 
  const [hoveredUser, setHoveredUser] = useState(null);
  const [pendingGuests, setPendingGuests] = useState([]);
  
  // Track recent leave events to deduplicate (prevents spam from socket reconnections)
  const recentLeaveEventsRef = useRef(new Map());
  const [hostUserId, setHostUserId] = useState(null); // Host's user ID for fetching their files
  const [isHost, setIsHost] = useState(false); // Am I the host of this room?
  const [hostOnline, setHostOnline] = useState(true); // Is host currently connected?
  const [isReadOnly, setIsReadOnly] = useState(false); // Read-only mode when host is offline

  // TEST CASE STATE
  // TEST CASE STATE
  const [testCases, setTestCases] = useState(() => {
    try {
        const saved = localStorage.getItem("testCases");
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure all test cases have unique IDs (for backwards compatibility)
            return parsed.map((tc, i) => ({
                ...tc,
                id: tc.id || Date.now() + i
            }));
        }
        return [];
    } catch { return []; }
  });
  
  // Persist Test Cases
  useEffect(() => {
    localStorage.setItem("testCases", JSON.stringify(testCases));
  }, [testCases]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csesResultModalOpen, setCSESResultModalOpen] = useState(false);
  const [csesResultModalData, setCSESResultModalData] = useState(null);
  const [csesResultModalSubmissionId, setCSESResultModalSubmissionId] = useState(null);

  // EXTENSION DETECTION
  const EXTENSION_URL = "https://chromewebstore.google.com/detail/codeplay-helper/gnolnmfmmdpfdjilggmgkllbchhmdgpb";
  const [extensionDetected, setExtensionDetected] = useState(null); // null = checking, true/false
  const [extensionBannerDismissed, setExtensionBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem("ext_banner_dismissed") === "1"; } catch { return false; }
  });

  // Detect extension on mount by sending a ping
  useEffect(() => {
    let timeout;
    const handlePong = (event) => {
      if (event.data?.type === "CODEPLAY_PONG" || event.data?.type === "CODEPLAY_COOKIES_RECEIVED" || event.data?.type === "CODEPLAY_SUBMIT_RESULT" || event.data?.type === "CODEPLAY_CF_HANDLE_RESULT") {
        setExtensionDetected(true);
        window.removeEventListener("message", handlePong);
        clearTimeout(timeout);
      }
    };
    window.addEventListener("message", handlePong);
    // Send a ping that the extension content script should respond to
    window.postMessage({ type: "CODEPLAY_PING" }, "*");
    // Also try fetching CF handle as a secondary check
    window.postMessage({ type: "CODEPLAY_FETCH_CF_HANDLE" }, "*");
    timeout = setTimeout(() => {
      setExtensionDetected(prev => prev === null ? false : prev);
      window.removeEventListener("message", handlePong);
    }, 3000);
    return () => {
      window.removeEventListener("message", handlePong);
      clearTimeout(timeout);
    };
  }, []);

  // ACCESS STATE
  const [accessStatus, setAccessStatus] = useState("loading"); // loading, waiting, granted, denied, login_required
  const [waitMessage, setWaitMessage] = useState("Connecting to room...");


  // Persist Right Panel
  useEffect(() => {
    localStorage.setItem("rightPanel", JSON.stringify(rightPanel));
  }, [rightPanel]);

  // --- PROBLEM SYNC (Moved from JSX) ---
  useEffect(() => {
    if (!socket) return;
    
    // Listen for remote problem selection
    const handleSyncProblem = (problem) => {
        console.log(`[DEBUG] 📥 Socket received sync_problem:`, problem?.title);
        console.log(`[DEBUG] Description Length: ${problem?.description?.length}`);
        console.log(`[DEBUG] Full Problem Object:`, problem);
        
        if (problem) {
             setRightPanel({ type: "preview", data: problem });
             // Also switch to full screen problem view to match the sender
             setViewMode("problem_full");
        } else {
            console.log(`[DEBUG] ⚠️ Received null/undefined problem in sync_problem`);
        }
    };

    socket.on("sync_problem", handleSyncProblem);

    // Always request problem state from server when access is granted
    // This ensures we get the host's current problem, not stale localStorage
    if (accessStatus === "granted") {
        console.log("📥 Access granted, requesting current problem state from server...");
        socket.emit("request_problem_state", { roomId: id });
    }

    return () => {
        socket.off("sync_problem", handleSyncProblem);
    };
  }, [socket, id, accessStatus]);

  // --- VOICE CHAT ---
  const { 
    isConnected, isMuted, isDeafened, isSpeaking, volume, connectionQuality,
    joinVoice, leaveVoice, toggleMute, toggleDeafen, setMasterVolume, setPeerVolume, mutePeer,
    peers, speakingPeers 
  } = useVoiceChat(socket, id, user?.username);
  // Helper to map peerId (socketId) to username - now peers already have username from LiveKit
    const getPeerName = useCallback(
        (peerId) => peers.find((p) => p.peerId === peerId)?.username || peerId,
        [peers]
    );
  // isHost is now a state variable set in access_granted

  // --- SCREEN RECORDING ---
  const {
    isRecording,
    isPaused,
    formattedTime: recordingTime,
    recordedBlob,
    recordingError,
    audioLevel: recordingAudioLevel,
    isPreviewOpen: isRecordingPreviewOpen,
    countdownActive,
    countdown,
    // Webcam state
    webcamEnabled,
    webcamStream,
    webcamPosition,
    // Recording actions
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    downloadRecording,
    discardRecording,
    setIsPreviewOpen: setIsRecordingPreviewOpen,
    // Webcam actions
    toggleWebcam,
    startWebcam,
    stopWebcam,
    setWebcamPosition
  } = useScreenRecording();

  // --- AUTO LOGOUT ON TOKEN EXPIRY ---
  useEffect(() => {
      const handleAuthExpired = () => {
          console.log("[Workspace] Token expired, opening auth modal...");
          setAccessStatus("login_required");
          setWaitMessage("Your session has expired. Please sign in again.");
          setAuthModalOpen(true);
      };

      window.addEventListener("auth:expired", handleAuthExpired);
      return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, []);

  // --- SOCKET CONFIG ---
  useEffect(() => {
	  if (!id || authLoading) return; 

	  if (!user) {
		  setAccessStatus("login_required");
		  setWaitMessage("Please sign in to join this room.");
		  setAuthModalOpen(true); 
		  return;
	  }
	  
	  if (accessStatus === "login_required") {
		  setAccessStatus("loading");
	  }

	  const joinRoom = () => {
		  console.log("Joining room:", id, "as", user.username, "userId:", user.id);
		  socket.emit("join_room", { roomId: id, username: user.username, userId: user.id });
	  };

	  joinRoom();
	  socket.on("connect", joinRoom);

	  // Room state with host info
	  socket.on("room_state", ({ users, hostOnline: isHostOnline, hostUserId: hostId, readOnly }) => {
		  setActiveUsers(users);
		  setHostOnline(isHostOnline);
		  setHostUserId(hostId);
		  setIsReadOnly(readOnly);
		  console.log(`[Room] State updated - hostOnline: ${isHostOnline}, readOnly: ${readOnly}`);
	  });
	  
	  socket.on("room_users", (users) => setActiveUsers(users));
	  
	  socket.on("status_update", ({ status, message }) => {
		  setAccessStatus(status); 
		  setWaitMessage(message);
	  });

	  socket.on("access_granted", ({ isHost: amHost, hostUserId: hostId }) => {
		  setAccessStatus("granted");
		  setWaitMessage("");
		  setIsHost(amHost);
		  if (hostId) setHostUserId(hostId);
		  console.log(`[Room] Access granted - isHost: ${amHost}, hostId: ${hostId}`);
	  });

	  socket.on("access_denied", () => {
		  setAccessStatus("denied");
		  setWaitMessage("The host has declined your request to join this room.");
	  });

	  socket.on("host_left", ({ username }) => {
		  // Deduplicate: Skip if we logged this event for this user recently
		  const eventKey = `host_left:${username}`;
		  const lastTime = recentLeaveEventsRef.current.get(eventKey);
		  const now = Date.now();
		  if (lastTime && now - lastTime < 5000) {
			  console.log(`[Dedup] Skipping duplicate host_left for ${username}`);
			  return;
		  }
		  recentLeaveEventsRef.current.set(eventKey, now);
		  
		  setHostOnline(false);
		  setIsReadOnly(true);
          setLogs(prev => [...prev, { type: "warning", message: `⚠️ Host ${username} has left. Files are now read-only.` }]);
	  });

	  socket.on("host_rejoined", ({ username }) => {
		  // Clear any recent leave events for this user when they rejoin
		  recentLeaveEventsRef.current.delete(`host_left:${username}`);
		  recentLeaveEventsRef.current.delete(`user_left:${username}`);
		  
		  setHostOnline(true);
		  setIsReadOnly(false);
          setLogs(prev => [...prev, { type: "success", message: `✅ Host ${username} is back. Editing enabled.` }]);
	  });

	  socket.on("user_left", ({ username, isHost }) => {
		  // Deduplicate: Skip if we logged this event for this user recently
		  const eventKey = `user_left:${username}`;
		  const lastTime = recentLeaveEventsRef.current.get(eventKey);
		  const now = Date.now();
		  if (lastTime && now - lastTime < 5000) {
			  console.log(`[Dedup] Skipping duplicate user_left for ${username}`);
			  return;
		  }
		  recentLeaveEventsRef.current.set(eventKey, now);
		  
          setLogs(prev => [...prev, { type: "info", message: `👋 ${username}${isHost ? " (Host)" : ""} has left the room.` }]);
	  });

	  socket.on("left_room", () => {
		  // We successfully left the room - navigate away
		  navigate("/dashboard");
	  });

	  // Clean disconnect on tab close
	  const handleBeforeUnload = () => {
		  socket.emit("leave_room");
	  };
	  window.addEventListener("beforeunload", handleBeforeUnload);

	  socket.on("request_entry", ({ username, socketId }) => {
		  setPendingGuests(prev => {
			  if (prev.find(p => p.socketId === socketId)) return prev;
			  return [...prev, { username, socketId }];
		  });
	  });

	  socket.on("request_cancelled", ({ socketId }) => {
		  setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
	  });

      // Old sync_problem_state removed - now using sync_problem directly

      // --- FILE SYNC ---
      socket.on("sync_file_created", ({ file }) => {
          console.log(`[DEBUG] 📥 Socket received sync_file_created for: ${file?.name} (ID: ${file?._id})`);
          setFiles(prev => {
              if (prev.find(f => f._id === file._id)) {
                  console.log(`[DEBUG] ⚠️ File already exists in state, skipping.`);
                  return prev;
              }
              console.log(`[DEBUG] ✅ Adding file to state: ${file.name}`);
              return [...prev, file];
          });
      });

      socket.on("sync_file_deleted", ({ fileId }) => {
          console.log(`[DEBUG] 📥 Socket received sync_file_deleted for ID: ${fileId}`);
          setFiles(prev => {
              const exists = prev.find(f => f._id === fileId);
              console.log(`[DEBUG] ${exists ? "✅ Found file to delete" : "⚠️ File not found in state"} for deletion.`);
              return prev.filter(f => f._id !== fileId);
          });
          setActiveFile(prev => prev?._id === fileId ? null : prev);
      });

      // --- ACTIVE FILE SYNC ---
      socket.on("sync_active_file", ({ fileId }) => {
          console.log(`📂 Active file synced: ${fileId}`);
          if (fileId) {
              // Find the file in our list and set it as active
              setFiles(currentFiles => {
                  const targetFile = currentFiles.find(f => f._id === fileId);
                  if (targetFile) {
                      setActiveFile(targetFile);
                  }
                  return currentFiles;
              });
          }
      });

      // Request active file state when joining
      if (accessStatus === "granted") {
          socket.emit("request_active_file", { roomId: id });
      }

	  return () => {
		  window.removeEventListener("beforeunload", handleBeforeUnload);
		  socket.off("connect", joinRoom);
		  socket.off("room_state");
		  socket.off("room_users");
		  socket.off("status_update");
		  socket.off("access_granted");
		  socket.off("access_denied");
		  socket.off("request_entry");
		  socket.off("request_cancelled");
		  socket.off("host_left");
		  socket.off("host_rejoined");
		  socket.off("user_left");
		  socket.off("left_room");
          socket.off("sync_file_created");
          socket.off("sync_file_deleted");
          socket.off("sync_active_file");
	  };
  }, [user, id, navigate, authLoading]);
  
  const handleGrant = (socketId) => {
	  socket.emit("grant_access", { socketId });
	  setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
  };

  const handleDeny = (socketId) => {
	   socket.emit("deny_access", { socketId });
	   setPendingGuests(prev => prev.filter(g => g.socketId !== socketId));
  };
  
  // --- LEAVE ROOM ---
  const handleLeaveRoom = () => {
      console.log("[Room] Leaving room...");
      socket.emit("leave_room");
  };

  // --- FETCH FILES ---
  // Fetch host's files if guest, own files if host
  const fetchFiles = async () => {
      if (!user) return;
      if (accessStatus !== "granted") return; // Wait for room access

	  try {
          const token = localStorage.getItem("codeplay_token");
          
          // Determine whose files to fetch
          // Use explicit isHost flag from server, don't derive from hostUserId
          const fileOwner = isHost ? null : hostUserId;
          
          const url = fileOwner 
              ? `${API_URL}/api/files?hostId=${fileOwner}`
              : `${API_URL}/api/files`;
          
          console.log(`[Files] Fetching files - isHost: ${isHost}, from: ${fileOwner || 'self'}`);
          
		  const res = await fetch(url, {
              headers: { "Authorization": `Bearer ${token}` }
          });
		  const data = await res.json();
          if (Array.isArray(data)) {
		      setFiles(data);
          } else {
              setFiles([]);
          }
		  
          // RESTORE ACTIVE FILE
		  if (!activeFile) {
              const lastId = localStorage.getItem("activeFileId");
              const savedPreview = localStorage.getItem("activePreviewFile");

              if (lastId && lastId.startsWith("preview-") && savedPreview) {
                  // Restore Virtual Preview
                  try {
                      const pf = JSON.parse(savedPreview);
                      setActiveFile(pf);
                      // Don't set activeCode required for preview? Preview uses activeFile.data
                  } catch (e) {}
              } else if (lastId) {
                  // Restore Real File
                  const found = data.find(f => f._id === lastId);
                  if (found) {
                      setActiveFile(found);
                      setActiveCode(found.content || "");
                  } else if (data.length > 0) {
                      // Fallback
                      setActiveFile(data[0]);
                      setActiveCode(data[0].content || "");
                  }
              } else if (data.length > 0) {
				  setActiveFile(data[0]);
				  setActiveCode(data[0].content || "");
			  }
		  }
	  } catch (err) { console.error("Failed to fetch files", err); }
  };

  // Fetch files when access granted or host changes
  useEffect(() => { 
      if (accessStatus === "granted") {
          fetchFiles(); 
      }
  }, [user, accessStatus, hostUserId]);

  useEffect(() => {
    // Backup content to localStorage (debounced, prevents freezing main thread)
    if (!isReadOnly && activeFile && activeFile.type !== "preview" && debouncedCode !== activeFile.content) {
        localStorage.setItem(`file_content_${activeFile._id}`, debouncedCode);
    }
  }, [debouncedCode]);

  // --- RESIZE HANDLER ---
  useEffect(() => {
	  const handleMouseMove = (e) => {
		  if (isResizing) {
			  const newHeight = window.innerHeight - e.clientY;
			  if (newHeight > 50 && newHeight < window.innerHeight - 100) {
				  setConsoleHeight(newHeight);
			  }
		  }
		  if (isSidebarResizing) {
			  const newWidth = e.clientX - 48; // Subtract sidebar icon bar width
			  if (newWidth > 150 && newWidth < 800) {
				  setSidebarWidth(newWidth);
			  }
		  }
		  if (isRightPanelResizing) {
			  const newWidth = window.innerWidth - e.clientX;
			  if (newWidth > 200 && newWidth < window.innerWidth - 300) {
				  setRightPanelWidth(newWidth);
			  }
		  }
	  };
	  const handleMouseUp = () => {
		  setIsResizing(false);
		  setIsSidebarResizing(false);
		  setIsRightPanelResizing(false);
		  document.body.style.cursor = "default";
	  };

	  if (isResizing || isSidebarResizing || isRightPanelResizing) {
		  window.addEventListener("mousemove", handleMouseMove);
		  window.addEventListener("mouseup", handleMouseUp);
	  }
	  return () => {
		  window.removeEventListener("mousemove", handleMouseMove);
		  window.removeEventListener("mouseup", handleMouseUp);
	  };
  }, [isResizing, isSidebarResizing, isRightPanelResizing]);

  // --- HANDLERS ---
  const switchRightPanel = (type, data) => setRightPanel({ type, data });

  const handleFileSelect = useCallback((file) => {
	  setActiveFile(file);
	  setActiveCode(file.content || "");
      // Sync active file to room participants
      if (id && file?._id) {
          socket.emit("sync_active_file", { roomId: id, fileId: file._id });
      }
  }, [id]);

  const handleFileCreate = useCallback(async (name) => {
      if (!user) { setAuthModalOpen(true); return; }
	  const ext = name.split('.').pop();
	  const langMap = { js: "javascript", html: "html", css: "css", py: "python", java: "java", cpp: "cpp" };
	  const language = langMap[ext] || "javascript";
	  
	  try {
          const token = localStorage.getItem("codeplay_token");
		  const res = await fetch(`${API_URL}/api/files`, {
			 method: "POST",
             headers: {
                 "Content-Type": "application/json",
                 "Authorization": `Bearer ${token}`
             },
			 body: JSON.stringify({ name, language, folder: "/", roomId: id || "default" }) 
		  });
		  
		  if (!res.ok) {
		      const errorData = await res.json().catch(() => ({}));
		      console.error("File creation failed:", errorData);
		      setLogs(prev => [...prev, { type: "error", message: `Failed to create file: ${errorData.error || res.statusText}` }]);
		      return;
		  }
		  
		  const newFile = await res.json();
		  setFiles(prev => [...prev, newFile]);
		  setActiveFile(newFile);
		  setActiveCode("");
		  // Sync file creation to other room participants
		  if (id) {
              console.log(`[DEBUG] 📤 Emitting sync_file_created for: ${newFile.name}`);
              socket.emit("sync_file_created", { roomId: id, file: newFile });
          } else {
              console.log(`[DEBUG] ⚠️ No roomId (id is null), cannot emit sync_file_created`);
          }
	  } catch (err) { 
	      console.error("File creation error:", err); 
	      setLogs(prev => [...prev, { type: "error", message: `File creation error: ${err.message}` }]);
	  }
  }, [user, id]);

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, fileId: null, fileName: "" });

  const handleFileDeleteRequest = useCallback((fileId) => {
      if (!user) return;
      const fileToDelete = files.find(f => f._id === fileId);
      setDeleteConfirm({ isOpen: true, fileId, fileName: fileToDelete?.name || "this file" });
  }, [user, files]);

  const handleFileDeleteConfirm = useCallback(async () => {
      const fileId = deleteConfirm.fileId;
      setDeleteConfirm({ isOpen: false, fileId: null, fileName: "" });
      
	  try {
          const token = localStorage.getItem("codeplay_token");
		  const res = await fetch(`${API_URL}/api/files/${fileId}${hostUserId ? `?hostId=${hostUserId}` : ''}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              console.error("Delete failed:", data.error || res.statusText);
              return; // Don't remove from UI if server delete failed
          }
          
		  setFiles(prev => prev.filter(f => f._id !== fileId));
		  setActiveFile(prev => prev?._id === fileId ? null : prev);
		  if (activeFile?._id === fileId) {
			  setActiveCode("");
		  }
		  // Sync file deletion to other room participants
		  if (id) {
              console.log(`[DEBUG] 📤 Emitting sync_file_deleted for ID: ${fileId}`);
              socket.emit("sync_file_deleted", { roomId: id, fileId });
          }
	  } catch (err) { console.error(err); }
  }, [deleteConfirm.fileId, activeFile, id, hostUserId]);

  // --- EXECUTION & TESTS ---
  // --- EXECUTION & TESTS ---
  const handleRun = useCallback(async () => {
    if (!user) { setAuthModalOpen(true); return; }
    if (!activeFile) return;

    setConsoleOpen(true);
    setIsRunning(true);
    setLogs([{ type: "info", message: "Compiling..." }]);

    if (id) socket.emit("sync_run_trigger", { roomId: id, username: user.username });

    // AUTO RUNNER LOGIC - C++ - Use Ref for stable callback
    let codeToRun = activeCodeRef.current;
    if (activeFile.language === "cpp" && codeToRun.includes("class Solution") && !codeToRun.includes("int main")) {
         if (rightPanel?.data) {
             console.log("Injecting C++ Auto-Runner...");
             codeToRun = generateCppRunner(codeToRun, rightPanel.data);
         } else {
             setLogs(prev => [...prev, { type: "warning", message: "Warning: Problem description (Right Panel) is closed. Auto-runner might fail." }]);
         }
    }
    // AUTO RUNNER LOGIC - Java
    if (activeFile.language === "java" && codeToRun.includes("class Solution") && !codeToRun.includes("public static void main")) {
         if (rightPanel?.data) {
             console.log("Injecting Java Auto-Runner...");
             codeToRun = generateJavaRunner(codeToRun, rightPanel.data);
         } else {
             setLogs(prev => [...prev, { type: "warning", message: "Warning: Problem description (Right Panel) is closed. Auto-runner might fail." }]);
         }
    }
    // AUTO RUNNER LOGIC - Python
    if (activeFile.language === "python" && codeToRun.includes("class Solution") && !codeToRun.includes("if __name__")) {
         if (rightPanel?.data) {
             console.log("Injecting Python Auto-Runner...");
             codeToRun = generatePythonRunner(codeToRun, rightPanel.data);
         } else {
             setLogs(prev => [...prev, { type: "warning", message: "Warning: Problem description (Right Panel) is closed. Auto-runner might fail." }]);
         }
    }

    try {
        let data;
        // CLIENT-SIDE EXECUTION FOR JS (Web Worker with TLE)
        if (activeFile.language === "javascript") {
            setLogs(prev => [...prev, { type: "info", message: "Running in browser (Web Worker)..." }]);
            data = await executeCode(codeToRun, input);
        } else {
            const token = localStorage.getItem("codeplay_token");
            const res = await fetch(`${API_URL}/api/code/execute`, {
                method: "POST", 
                headers: { 
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    language: activeFile.language, 
                    code: codeToRun, 
                    stdin: input 
                }),
            });
            data = await res.json();
        }
        const newLogs = [{ type: data.run?.code === 0 ? "log" : "error", message: data.run?.output || "Execution finished." }];
        setLogs(prev => [...prev, ...newLogs]);

        if (id) socket.emit("sync_run_result", { roomId: id, logs: newLogs });

    } catch (err) { 
        const errorLog = [{ type: "error", message: "Server Error." }];
        setLogs(prev => [...prev, ...errorLog]);
        if (id) socket.emit("sync_run_result", { roomId: id, logs: errorLog });
    }
    finally { setIsRunning(false); }
  }, [user, activeFile, id, rightPanel, input]); // Dependencies (input still needed for console typing)

  const runTests = useCallback(async () => {
    if (!activeFile) return;
    setIsRunningTests(true);
    
    // AUTO RUNNER LOGIC - C++
    let codeToRun = activeCodeRef.current; // Use Ref
    if (activeFile.language === "cpp" && codeToRun.includes("class Solution") && !codeToRun.includes("int main")) {
         if (rightPanel?.data) {
             codeToRun = generateCppRunner(codeToRun, rightPanel.data);
         }
    }
    // AUTO RUNNER LOGIC - Java
    if (activeFile.language === "java" && codeToRun.includes("class Solution") && !codeToRun.includes("public static void main")) {
         if (rightPanel?.data) {
             codeToRun = generateJavaRunner(codeToRun, rightPanel.data);
         }
    }
    
    const newTestCases = [...testCases];
    
    for (let i = 0; i < newTestCases.length; i++) {
        const test = newTestCases[i];
        newTestCases[i] = { ...test, status: "running", actualOutput: "" };
        setTestCases([...newTestCases]); 

        try {
            let data;
            if (activeFile.language === "javascript") {
                data = await executeCode(codeToRun, test.input);
            } else {
            const token = localStorage.getItem("codeplay_token");
                const res = await fetch(`${API_URL}/api/code/execute`, {
                    method: "POST", 
                    headers: { 
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ 
                        language: activeFile.language, 
                        code: codeToRun, 
                        stdin: test.input 
                    }),
                });
                data = await res.json();
            }
            const output = data.run?.output?.trim() || "";
            
            newTestCases[i].actualOutput = output;
            if (output === test.expectedOutput?.trim()) {
                newTestCases[i].status = "accepted";
            } else {
                newTestCases[i].status = "wrong_answer";
            }
        } catch (err) {
            newTestCases[i].status = "error";
            newTestCases[i].actualOutput = "Execution Error";
        }
        setTestCases([...newTestCases]);
    }
    setIsRunningTests(false);
  }, [activeFile, rightPanel, testCases]); // Removed activeCode dependency

  // Run a single test case by ID
  const runSingleTest = useCallback(async (testId) => {
    if (!activeFile) {
        setLogs(prev => [...prev, { type: "error", message: "No file selected to run test." }]);
        return;
    }
    if (!user) {
        setAuthModalOpen(true);
        return;
    }
    
    // AUTO RUNNER LOGIC - C++
    let codeToRun = activeCodeRef.current;
    if (activeFile.language === "cpp" && codeToRun.includes("class Solution") && !codeToRun.includes("int main")) {
         if (rightPanel?.data) {
             codeToRun = generateCppRunner(codeToRun, rightPanel.data);
         }
    }
    // AUTO RUNNER LOGIC - Java
    if (activeFile.language === "java" && codeToRun.includes("class Solution") && !codeToRun.includes("public static void main")) {
         if (rightPanel?.data) {
             codeToRun = generateJavaRunner(codeToRun, rightPanel.data);
         }
    }
    
    const testIndex = testCases.findIndex(t => t.id === testId);
    if (testIndex === -1) {
        setLogs(prev => [...prev, { type: "error", message: "Test case not found." }]);
        return;
    }
    
    const test = testCases[testIndex];
    const testNumber = testIndex + 1;
    
    // Set running state for this test
    setTestCases(prev => prev.map(t => 
        t.id === testId ? { ...t, status: "running", actualOutput: "" } : t
    ));
    
    // Show in console
    setConsoleOpen(true);
    setLogs(prev => [...prev, { type: "info", message: `Running Test ${testNumber}...` }]);

    const startTime = Date.now();

    try {
        let data;
        if (activeFile.language === "javascript") {
            data = await executeCode(codeToRun, test.input);
        } else {
            const token = localStorage.getItem("codeplay_token");
            const res = await fetch(`${API_URL}/api/code/execute`, {
                method: "POST", 
                headers: { 
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    language: activeFile.language, 
                    code: codeToRun, 
                    stdin: test.input 
                }),
            });
            data = await res.json();
        }
        
        const executionTime = Date.now() - startTime;
        const output = data.run?.output?.trim() || "";
        const isAccepted = output === test.expectedOutput?.trim();
        
        setTestCases(prev => prev.map(t => 
            t.id === testId ? { 
                ...t, 
                actualOutput: output,
                status: isAccepted ? "accepted" : "wrong_answer"
            } : t
        ));
        
        // Log result to console
        if (isAccepted) {
            setLogs(prev => [...prev, { 
                type: "success", 
                message: `✓ Test ${testNumber} PASSED (${executionTime}ms)` 
            }]);
        } else {
            setLogs(prev => [...prev, { 
                type: "error", 
                message: `✗ Test ${testNumber} FAILED (${executionTime}ms)\nExpected: ${test.expectedOutput?.trim()}\nGot: ${output}` 
            }]);
        }
    } catch (err) {
        const executionTime = Date.now() - startTime;
        setTestCases(prev => prev.map(t => 
            t.id === testId ? { ...t, status: "error", actualOutput: err.message || "Execution Error" } : t
        ));
        setLogs(prev => [...prev, { 
            type: "error", 
            message: `✗ Test ${testNumber} ERROR (${executionTime}ms): ${err.message || "Execution failed"}` 
        }]);
    }
  }, [activeFile, rightPanel, testCases, user]);

    // --- AUTOSAVE & STATE SYNC (Moved to top level) ---
    useEffect(() => {
        if (!activeFile || !activeFile._id || activeFile.type === "preview") return;

        const timeout = setTimeout(async () => {
            // 1. Update local files array so switching files preserves content
            setFiles(prev => prev.map(f => 
                f._id === activeFile._id ? { ...f, content: activeCode } : f
            ));

            // 2. Persist to Database
            try {
                const token = localStorage.getItem("codeplay_token");
                // If guest, we are editing Host's file, so we pass hostId
                const targetHostId = isHost ? null : hostUserId;
                
                await fetch(`${API_URL}/api/files/${activeFile._id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        content: activeCode,
                        hostId: targetHostId
                    })
                });
                // console.log("[Autosave] Saved:", activeFile.name); 
            } catch (e) {
                console.error("Autosave failed", e);
            }
        }, 3000); // 3 seconds debounce

        return () => clearTimeout(timeout);
    }, [activeCode, activeFile?._id, isHost, hostUserId]); // Only re-run if code or file changes


  // Track if submission is in progress to prevent double submissions
  const submissionInProgressRef = useRef(false);
  const submissionIdRef = useRef(0); // Track which submission we're waiting for

  const handleSubmit = async () => {
    // IMMEDIATELY check and set the lock before anything else
    if (submissionInProgressRef.current || isSubmitting) {
        console.log("[Submit] Already submitting, ignoring duplicate click");
        return;
    }
    
    // Set BOTH lock and state immediately - before ANY async operation
    submissionInProgressRef.current = true;
    setIsSubmitting(true); // Set state immediately to disable button
    const currentSubmissionId = ++submissionIdRef.current;
    console.log(`[Submit] Starting submission #${currentSubmissionId}`);
    
    if (!rightPanel?.data) {
        submissionInProgressRef.current = false;
        setIsSubmitting(false);
        return;
    }

    // --- CSES SUBMISSION ---
    if (rightPanel.data.provider === "cses") {
        const problemId = rightPanel.data.id || rightPanel.data.index;
        const problemName = rightPanel.data.title || rightPanel.data.name || `CSES Task ${problemId}`;
        const lang = activeFile?.language || "cpp";
        const token = localStorage.getItem("codeplay_token");

        if (!token) {
            setLogs(prev => [...prev, { type: "error", message: "Please log in to submit CSES solutions." }]);
            setConsoleOpen(true);
            submissionInProgressRef.current = false;
            setIsSubmitting(false);
            return;
        }

        setLogs(prev => [...prev, { type: "info", message: `[CSES Judge] Submitting ${problemName}...` }]);
        setConsoleOpen(true);

        try {
            const res = await fetch(`${API_URL}/api/cses/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    taskId: String(problemId),
                    code: activeCode,
                    language: lang,
                    problemName,
                    timeLimit: rightPanel.data.timeLimit,
                    memoryLimit: rightPanel.data.memoryLimit,
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setLogs(prev => [...prev, { type: "error", message: `CSES Submit Failed: ${data.error || "Unknown error"}` }]);
                submissionInProgressRef.current = false;
                setIsSubmitting(false);
                return;
            }

            const submissionId = data.submissionId;
            setLogs(prev => [...prev, { type: "info", message: `[CSES Judge] Judging started (ID: ${submissionId.slice(-6)})...` }]);

            // Join user room for real-time updates
            if (user?.id) {
                socket.emit("join_user_room", { userId: user.id });
            }

            // Listen for progress updates
            const handleProgress = (progressData) => {
                if (progressData.submissionId !== submissionId) return;
                const { testNumber, totalTests, verdict, passed, time } = progressData;
                if (testNumber === 0) return; // Initial "Judging" event

                const icon = verdict === "AC" ? "\u2713" : "\u2717";
                const type = verdict === "AC" ? "success" : "error";
                const verdictText = verdict === "AC" ? "Accepted" : verdict === "WA" ? "Wrong Answer" : verdict === "TLE" ? "Time Limit Exceeded" : verdict === "MLE" ? "Memory Limit Exceeded" : verdict === "RE" ? "Runtime Error" : verdict === "CE" ? "Compilation Error" : verdict;

                setLogs(prev => [...prev, {
                    type,
                    message: `[Test ${testNumber}/${totalTests}] ${icon} ${verdictText}${time ? ` (${time}ms)` : ""}`
                }]);
            };

            const handleResult = (resultData) => {
                if (resultData.submissionId !== submissionId) return;

                // Clean up listeners
                socket.off("cses:judge:progress", handleProgress);
                socket.off("cses:judge:result", handleResult);

                const { verdict, judgeResult } = resultData;
                const isAccepted = verdict === "Accepted";

                setLogs(prev => [...prev, {
                    type: isAccepted ? "success" : "error",
                    message: `\n${"─".repeat(40)}\n[CSES Judge] Final Verdict: ${verdict}${judgeResult ? ` (${judgeResult.passedTests}/${judgeResult.totalTests} tests passed)` : ""}${judgeResult?.executionTime ? ` | Max time: ${judgeResult.executionTime}ms` : ""}${judgeResult?.error ? `\n${judgeResult.error}` : ""}`
                }]);

                // Show first failed test details on failure
                if (!isAccepted && judgeResult?.firstFailedInput) {
                    setLogs(prev => [...prev, {
                        type: "info",
                        message: `\u2500\u2500 First Failed Test (#${judgeResult.firstFailedTest}) \u2500\u2500\nInput:    ${judgeResult.firstFailedInput}\nExpected: ${judgeResult.firstFailedExpected}\nGot:      ${judgeResult.firstFailedActual}`
                    }]);
                }

                // Open CSES Result Modal
                setCSESResultModalData({
                    _id: submissionId,
                    problemId: String(problemId),
                    problemName,
                    code: activeCodeRef.current,
                    language: lang,
                    verdict,
                    judgeResult,
                    createdAt: new Date().toISOString(),
                });
                setCSESResultModalOpen(true);

                submissionInProgressRef.current = false;
                setIsSubmitting(false);
            };

            socket.on("cses:judge:progress", handleProgress);
            socket.on("cses:judge:result", handleResult);

            // Timeout fallback (5 minutes)
            setTimeout(() => {
                socket.off("cses:judge:progress", handleProgress);
                socket.off("cses:judge:result", handleResult);
                if (submissionInProgressRef.current) {
                    setLogs(prev => [...prev, { type: "error", message: "[CSES Judge] Judging timed out. Check your submissions page." }]);
                    submissionInProgressRef.current = false;
                    setIsSubmitting(false);
                }
            }, 5 * 60 * 1000);

        } catch (err) {
            setLogs(prev => [...prev, { type: "error", message: `CSES Submit Error: ${err.message}` }]);
            submissionInProgressRef.current = false;
            setIsSubmitting(false);
        }

        return;
    }

    // --- CODEFORCES SUBMISSION ---
    if (rightPanel.data.provider === "codeforces") {
        const { contestId, index } = rightPanel.data;
        
        if (!contestId || !index) {
            setLogs(prev => [...prev, { type: "error", message: "Cannot submit: Problem ID invalid (Fetch failed?)." }]);
            submissionInProgressRef.current = false;
            setIsSubmitting(false);
            return;
        }

        // Get the absolute latest code from state
        const codeToSubmit = activeCode;
        
        if (!codeToSubmit || codeToSubmit.trim().length === 0) {
            setLogs(prev => [...prev, { type: "error", message: "Cannot submit: Code is empty." }]);
            submissionInProgressRef.current = false;
            setIsSubmitting(false);
            return;
        }

        setLogs(prev => [...prev, { type: "info", message: `Submitting problem ${contestId}${index} to Codeforces...` }]);
        setConsoleOpen(true);

        // Debug: Log code hash to verify it's different
        const codeHash = codeToSubmit.length + '-' + codeToSubmit.slice(0, 50).replace(/\s/g, '');
        console.log(`[Submit] Code signature: ${codeHash}`);

        const langMap = {
            cpp: "54",      // GNU C++17
            python: "31",   // Python 3.8.10
            java: "36",     // Java 1.8
            javascript: "34" // Node.js
        };
        const langId = langMap[activeFile?.language] || "54";

        const payload = {
            contestId,
            problemIndex: index,
            code: codeToSubmit,
            languageId: langId 
        };

        // Capture the submission ID for this specific handler
        const handlerSubmissionId = currentSubmissionId;
        const handleResult = (event) => {
            if (event.data.type === "CODEPLAY_SUBMIT_RESULT") {
                window.removeEventListener("message", handleResult);
                
                // Ignore if this is a stale handler from an old submission
                if (submissionIdRef.current !== handlerSubmissionId) {
                    console.log(`[Submit] Ignoring stale result for submission #${handlerSubmissionId}`);
                    return;
                }
                
                const res = event.data.payload || { success: false, error: "No response from extension" };
                setIsSubmitting(false);
                submissionInProgressRef.current = false;
                
                if (res.success) {
                    const msg = typeof res.message === 'object' ? JSON.stringify(res.message) : String(res.message || "Unknown Success");
                    setLogs(prev => [...prev, { type: "success", message: `Codeforces: ${msg}` }]);
                    
                    // --- POLL FOR VERDICT ---
                    const startPolling = (targetHandle) => {
                         if (!targetHandle) return;
                         setLogs(prev => [...prev, { type: "info", message: `Polling verdict for ${targetHandle}...` }]);
                         let attempts = 0;
                         const pollInterval = setInterval(() => {
                            attempts++;
                            if (attempts > 30) { clearInterval(pollInterval); return; } 

                            fetch(`https://codeforces.com/api/user.status?handle=${targetHandle}&from=1&count=5`)
                                .then(r => r.json())
                                .then(data => {
                                    if (data.status === "OK") {
                                        const submission = data.result.find(s => 
                                            s.contestId == contestId && s.problem.index == index
                                        );
                                        if (submission) {

                                            const verdict = submission.verdict;
                                            if (verdict === "TESTING") {
                                                 const testCount = submission.passedTestCount + 1;
                                                 setLogs(prev => {
                                                     // Remove previous "Running on test" logs to avoid clutter
                                                     const filtered = prev.filter(l => !String(l?.message ?? l ?? "").startsWith("Running on test"));
                                                     return [...filtered, { type: "info", message: `Running on test ${testCount}...` }];
                                                 });
                                            } else {
                                                clearInterval(pollInterval);
                                                const isAc = verdict === "OK";
                                                setLogs(prev => {
                                                     const filtered = prev.filter(l => !String(l?.message ?? l ?? "").startsWith("Running on test"));
                                                     return [...filtered, { 
                                                        type: isAc ? "success" : "error", 
                                                        message: `Verdict: ${verdict === "OK" ? "ACCEPTED" : verdict} (${submission.timeConsumedMillis}ms) [Tests: ${submission.passedTestCount}]` 
                                                    }];
                                                });

                                                // SAVE TO DB
                                                fetch(`${API_URL}/api/submissions`, {
                                                    method: "POST",
                                                    headers: { 
                                                        "Content-Type": "application/json",
                                                        Authorization: `Bearer ${localStorage.getItem("codeplay_token")}`
                                                    },
                                                    body: JSON.stringify({
                                                        problemId: `${contestId}${index}`,
                                                        problemName: rightPanel.data.name || `Problem ${contestId}${index}`,
                                                        platform: "codeforces",
                                                        code: activeCode,
                                                        language: activeFile?.language || "cpp",
                                                        verdict: isAc ? "Accepted" : verdict,
                                                        visibility: "public"
                                                    })
                                                }).catch(e => console.error("Failed to save submission:", e));
                                            }
                                        }
                                    }
                                })
                                .catch(e => console.error(e));
                         }, 2000);
                    };

                    let handle = localStorage.getItem("cf_handle");
                    if (handle) {
                        startPolling(handle);
                    } else {
                        // Try Fetching from Extension
                        // setLogs(prev => [...prev, { type: "info", message: "Fetching Codeforces handle from Extension..." }]);
                        const hHandler = (evt) => {
                            if (evt.data.type === "CODEPLAY_CF_HANDLE_RESULT") {
                                window.removeEventListener("message", hHandler);
                                const res = evt.data.payload;
                                if (res.success && res.handle) {
                                    localStorage.setItem("cf_handle", res.handle);
                                    startPolling(res.handle);
                                } else {
                                    // Fallback
                                    startPolling(user?.username);
                                }
                            }
                        };
                        window.addEventListener("message", hHandler);
                        window.postMessage({ type: "CODEPLAY_FETCH_CF_HANDLE" }, "*");
                        // Timeout Fallback
                        setTimeout(() => {
                            window.removeEventListener("message", hHandler);
                            if (!handle) startPolling(user?.username);
                        }, 3000);
                    }


                } else {
                    const err = typeof res.error === 'object' ? JSON.stringify(res.error) : String(res.error || "Unknown Error");
                    setLogs(prev => [...prev, { type: "error", message: `Codeforces Error: ${err}` }]);
                }
            }
        };

        window.addEventListener("message", handleResult);
        window.postMessage({ type: "CODEPLAY_SUBMIT_CODEFORCES", payload }, "*");
        
        // Store the submission ID for this timeout
        const timeoutSubmissionId = currentSubmissionId;
        setTimeout(() => {
             window.removeEventListener("message", handleResult);
             // Only reset if this is still the same submission
             if (submissionIdRef.current === timeoutSubmissionId) {
                 submissionInProgressRef.current = false;
                 setIsSubmitting(prev => {
                     if (prev) { 
                         setLogs(p => [...p, { type: "error", message: "Submission Timeout: Extension took too long to respond. The code might have been submitted." }]);
                         return false;
                     }
                     return prev;
                 });
             }
        }, 60000); // Increased to 60s for Codeforces latency
        
        return;
    }

    // --- AUTOSAVE & STATE SYNC ---


    let cookie = null;
    let csrfToken = null;
    
    // ALWAYS fetch fresh credentials from extension for LeetCode submissions
    setLogs(prev => [...prev, { type: "info", message: "Fetching LeetCode credentials from extension..." }]);
    setConsoleOpen(true);

    try {
        const data = await new Promise((resolve, reject) => {
            const handler = (event) => {
                if (event.data.type === "CODEPLAY_COOKIES_RECEIVED") {
                    window.removeEventListener("message", handler);
                    resolve(event.data.payload);
                }
            };
            window.addEventListener("message", handler);
            window.postMessage({ type: "CODEPLAY_FETCH_COOKIES" }, "*");
            setTimeout(() => {
                window.removeEventListener("message", handler);
                reject(new Error("Timeout: Extension not responding."));
            }, 5000);
        });

        if (data.success) {
            cookie = data.cookie;
            csrfToken = data.csrfToken;
            console.log("[LeetCode] Got fresh credentials from extension");
        } else {
            throw new Error(data.error || "Extension returned failure.");
        }
    } catch (e) {
        console.error(e);
        setLogs(prev => [...prev, { type: "error", message: `Failed to get LeetCode credentials: ${e.message}. Make sure extension is installed and you're logged into LeetCode.` }]);
        submissionInProgressRef.current = false;
        setIsSubmitting(false);
        return;
    }
    
    setLogs(prev => [...prev, { type: "info", message: "Submitting to LeetCode..." }]);
    setConsoleOpen(true);

    try {
        const problem = rightPanel.data;
        
        // Validate required fields for LeetCode submission
        if (!problem.titleSlug || !problem.questionId) {
            setLogs(prev => [...prev, { type: "error", message: `Missing LeetCode data: titleSlug=${problem.titleSlug}, questionId=${problem.questionId}. Try reloading the problem.` }]);
            setIsSubmitting(false);
            submissionInProgressRef.current = false;
            return;
        }
        
        let codeToSubmit = activeCode;
        
        if (codeToSubmit.includes("int main() {")) {
             codeToSubmit = codeToSubmit.split("int main() {")[0];
        }

        // Map internal language names to LeetCode's expected lang slugs
        const leetcodeLangMap = {
            cpp: "cpp",
            java: "java",
            python: "python3",
            javascript: "javascript"
        };
        const leetcodeLang = leetcodeLangMap[activeFile?.language] || "cpp";

        const authToken = localStorage.getItem("codeplay_token");
        const res = await fetch(`${API_URL}/api/leettools/submit`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify({
                slug: problem.titleSlug,
                questionId: problem.questionId,
                lang: leetcodeLang,
                code: codeToSubmit,
                cookie,
                csrfToken
            })
        });
        
        const data = await res.json();
        
        if (res.status === 403 || (data.error && data.error.includes("authenticated"))) {
             setLogs(prev => [...prev, { type: "error", message: "LeetCode Authentication Failed (403). Please make sure you're logged into LeetCode in your browser, then try again." }]);
             setIsSubmitting(false);
             submissionInProgressRef.current = false;
             return;
        }

        if (data.success) {
             const result = data.result;
             const isSuccess = result.status_msg === "Accepted";
             
             let message = `LeetCode Verdict: ${result.status_msg}`;
             
             if (isSuccess) {
                 message += `\n✅ Runtime: ${result.status_runtime} (Beats ${result.runtime_percentile?.toFixed(1) || '?'}%)`;
                 message += `\n✅ Memory: ${result.status_memory} (Beats ${result.memory_percentile?.toFixed(1) || '?'}%)`;
             } else {
                 // Show failed test case details
                 if (result.status_msg === "Wrong Answer") {
                     message += `\n\n❌ Failed Test Case:`;
                     if (result.input_formatted || result.input) {
                         message += `\n📥 Input:\n${result.input_formatted || result.input}`;
                     }
                     if (result.expected_output) {
                         message += `\n\n✅ Expected Output:\n${result.expected_output}`;
                     }
                     if (result.code_output) {
                         message += `\n\n❌ Your Output:\n${result.code_output}`;
                     }
                     if (result.total_testcases && result.total_correct) {
                         message += `\n\n📊 Passed: ${result.total_correct}/${result.total_testcases} test cases`;
                     }
                 } else if (result.status_msg === "Runtime Error") {
                     message += `\n\n💥 Runtime Error:`;
                     if (result.runtime_error) {
                         message += `\n${result.runtime_error}`;
                     }
                     if (result.last_testcase) {
                         message += `\n\n📥 Last Test Case:\n${result.last_testcase}`;
                     }
                 } else if (result.status_msg === "Compile Error") {
                     message += `\n\n🔧 Compile Error:`;
                     if (result.compile_error) {
                         message += `\n${result.compile_error}`;
                     }
                 } else if (result.status_msg === "Time Limit Exceeded") {
                     message += `\n\n⏱️ Time Limit Exceeded`;
                     if (result.last_testcase) {
                         message += `\n📥 Last Test Case:\n${result.last_testcase}`;
                     }
                     if (result.total_testcases && result.total_correct) {
                         message += `\n\n📊 Passed: ${result.total_correct}/${result.total_testcases} test cases`;
                     }
                 } else if (result.status_msg === "Memory Limit Exceeded") {
                     message += `\n\n💾 Memory Limit Exceeded`;
                     if (result.last_testcase) {
                         message += `\n📥 Last Test Case:\n${result.last_testcase}`;
                     }
                 }
             }
             
             setLogs(prev => [...prev, { 
                 type: isSuccess ? "success" : "error", 
                 message 
             }]);
             
             // Also log the full result for debugging
             console.log("[LeetCode] Full result:", result);
             
             // SAVE TO DB (just like Codeforces)
             const token = localStorage.getItem("codeplay_token");
             if (token) {
                 fetch(`${API_URL}/api/submissions`, {
                     method: "POST",
                     headers: { 
                         "Content-Type": "application/json",
                         Authorization: `Bearer ${token}`
                     },
                     body: JSON.stringify({
                         problemId: problem.titleSlug,
                         problemName: problem.title || problem.titleSlug,
                         platform: "leetcode",
                         code: codeToSubmit,
                         language: activeFile?.language || "cpp",
                         verdict: isSuccess ? "Accepted" : result.status_msg,
                         visibility: "public"
                     })
                 }).catch(e => console.error("Failed to save LeetCode submission:", e));
             }
        } else {
             setLogs(prev => [...prev, { type: "error", message: `Submission Error: ${data.error || "Unknown error"}` }]);
        }

    } catch (err) {
        console.error(err);
        setLogs(prev => [...prev, { type: "error", message: "Submission Failed." }]);
    } finally {
        setIsSubmitting(false);
        submissionInProgressRef.current = false;
    }
  };

  function handleCopyLink() {
      const url = window.location.href.replace('editor', 'share');
      setShareUrl(window.location.href);
      setShareModalOpen(true);
  }

  async function handleAskAI(userPrompt) {
    if (!activeFile) return "Please select a file first.";
    const codeContext = { [activeFile.language]: activeCode };
    
    // Build problem context if a problem is open
    let problemContext = null;
    if (rightPanel?.data) {
      const problem = rightPanel.data;
      problemContext = {
        title: problem.title || problem.name || `Problem ${problem.contestId}${problem.index}`,
        provider: problem.provider || "unknown",
        difficulty: problem.difficulty || problem.rating || null,
        description: problem.description || problem.content || null,
        examples: problem.examples || problem.sampleTests || null,
        constraints: problem.constraints || null,
        tags: problem.tags || problem.topicTags || null
      };
    }
    
    try {
        const res = await fetch(`${API_URL}/api/ai/assist`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ 
              prompt: userPrompt, 
              code: codeContext,
              problem: problemContext 
            })
        });
        const data = await res.json();
        return data.result || "AI is thinking...";
    } catch (error) { return "Error: Could not reach the AI server."; }
  }

    const handleCodeNow = async (problem) => {
        // Open Language Selection Modal instead of auto-creating
        setSelectedProblemForCode(problem);
        setLanguageModalOpen(true);
    };

    const confirmCodeNow = async (language) => {
        setLanguageModalOpen(false);
        const problem = selectedProblemForCode;
        if (!problem) return;

        // Switch View Back
        setViewMode("editor");
        
        // 1. Prepare Content & Tests based on Language
        let initialCode = "";
        let initialTests = [];
        
        console.log("Code Now Triggered for:", problem, "Language:", language);

        // 0. Ensure we have snippets (LeetCode specific)
        let fullProblem = problem;
        if (problem.provider === "leetcode" && !problem.snippets) {
                 // ... Fetch logic remains similar but maybe adapt for language ...
        }

        // --- FOR LEETCODE: Use starter code from snippets ---
        if (problem.provider === "leetcode" && problem.snippets && Array.isArray(problem.snippets)) {
            // Map our language names to LeetCode's langSlug
            const langSlugMap = {
                "cpp": "cpp",
                "java": "java", 
                "python": "python3",
                "javascript": "javascript"
            };
            const targetSlug = langSlugMap[language] || language;
            
            // Find the matching snippet
            const snippet = problem.snippets.find(s => s.langSlug === targetSlug || s.lang?.toLowerCase().includes(language));
            
            if (snippet && snippet.code) {
                // LeetCode snippets don't include headers - add them for C++
                if (language === "cpp") {
                    initialCode = `#include <bits/stdc++.h>
using namespace std;

${snippet.code}`;
                } else {
                    initialCode = snippet.code;
                }
                console.log("[LeetCode] Using starter code for", language);
            }
        }
        
        // --- FALLBACK: Use CP template if no LeetCode snippet found ---
        if (!initialCode || initialCode.trim().length === 0) {
            if (language === "cpp") {
                 const userTmp = localStorage.getItem("user_cpp_template");
                 if (userTmp && userTmp.trim().length > 0) {
                     initialCode = userTmp;
                 } else {
                     initialCode = `#include <bits/stdc++.h>
using namespace std;

void solve() {
    // Write your solution here
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    solve();
    return 0;
}
`;
                 }
            } else if (language === "java") {
                initialCode = `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
    }
}
`;
            } else if (language === "python") {
                initialCode = `import sys

def solve():
    # Write your solution here
    pass

if __name__ == "__main__":
    solve()
`;
            } else if (language === "javascript") {
                initialCode = `const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    // Write your solution here
    console.log(line);
});
`;
            }
        }

        // 2. Create File
        const extMap = { cpp: "cpp", java: "java", python: "py", javascript: "js" };
        const ext = extMap[language] || "txt";
        
        // Generate unique file name based on problem
        let fileName;
        if (language === "java") {
            // For Java, create unique filename based on problem slug
            // Convert slug like "two-sum" to "TwoSum.java"
            const slug = problem.titleSlug || problem.id || "Solution";
            const javaClassName = slug
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join('');
            fileName = `${javaClassName}.java`;
        } else {
            // For other languages, use solution_<problem_id>.<ext>
            fileName = `solution_${problem.titleSlug || problem.id}.${ext}`;
        }
        
        let targetFile = files.find(f => f.name === fileName);
        
        if (!targetFile) {
            try {
                const token = localStorage.getItem("codeplay_token");
                const res = await fetch(`${API_URL}/api/files`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        name: fileName, 
                        language: language, 
                        folder: "/", 
                        roomId: id || "default",
                        content: initialCode 
                    }) 
                });
                targetFile = await res.json();
                setFiles(prev => [...prev, targetFile]);
                
                // SYNC TO ROOM
                if (id) {
                    console.log("[CodeNow] Broadcasting new file:", targetFile.name);
                    socket.emit("sync_file_created", { roomId: id, file: targetFile });
                }
            } catch (e) {
                console.error("Failed to create file", e);
                return;
            }
        } 
        
        // 3. Switch to File
        if (targetFile) {
            // FIX: Editors.jsx uses activeFile.content to init YJS.
            // If the file is new or empty, we MUST ensure the object passed to setActiveFile has content.
            if (!targetFile.content || targetFile.content.trim().length === 0) {
                 // Create a copy to avoid mutating state directly if it came from 'files'
                 targetFile = { ...targetFile, content: initialCode };
            }
            
            setActiveFile(targetFile);
            setActiveCode(targetFile.content);
        }

        // 5. ENSURE PREVIEW IS AVAILABLE (Right Panel)
        setRightPanel({ type: "preview", data: problem });

        // 6. SYNC TEST CASES (Handle both Codeforces and LeetCode formats)
        if (problem.provider === "leetcode") {
            // LeetCode: test cases come from 'examples' field (exampleTestcases)
            // Format: inputs are on separate lines, grouped by number of function arguments
            // Example for twoSum(nums, target): "[2,7,11,15]\n9\n[3,2,4]\n6\n[3,3]\n6"
            if (problem.examples && typeof problem.examples === 'string' && problem.snippets) {
                // Count number of arguments from the snippet
                const snippet = problem.snippets.find(s => s.langSlug === "cpp");
                let argCount = 1;
                if (snippet) {
                    const signatureMatch = snippet.code.match(/\((.*)\)/);
                    if (signatureMatch) {
                        // Count commas at depth 0
                        let depth = 0;
                        let commas = 0;
                        for (const c of signatureMatch[1]) {
                            if (c === '<') depth++;
                            if (c === '>') depth--;
                            if (c === ',' && depth === 0) commas++;
                        }
                        argCount = commas + 1;
                    }
                }
                
                const lines = problem.examples.split('\n').filter(l => l.trim());
                const parsedTests = [];
                
                // Extract expected outputs from problem description
                const expectedOutputs = [];
                if (problem.description) {
                    const outputMatches = problem.description.match(/<strong>Output:<\/strong>\s*([^<]+)/g);
                    if (outputMatches) {
                        outputMatches.forEach(m => {
                            const val = m.replace(/<strong>Output:<\/strong>\s*/, '').trim();
                            expectedOutputs.push(val);
                        });
                    }
                }
                
                // Group lines by argCount
                let testIndex = 0;
                for (let i = 0; i < lines.length; i += argCount) {
                    const inputLines = lines.slice(i, i + argCount);
                    if (inputLines.length === argCount) {
                        parsedTests.push({
                            id: Date.now() + testIndex,
                            input: inputLines.join('\n'),
                            expectedOutput: expectedOutputs[testIndex] || "",
                            status: "idle",
                            actualOutput: "",
                            expanded: true
                        });
                        testIndex++;
                    }
                }
                
                setTestCases(parsedTests.length > 0 ? parsedTests : [{ id: Date.now(), input: "", expectedOutput: "", status: "idle", actualOutput: "", expanded: true }]);
                console.log("[LeetCode] Parsed", parsedTests.length, "test cases with", argCount, "args each, found", expectedOutputs.length, "expected outputs");
            } else if (problem.testCases && Array.isArray(problem.testCases)) {
                setTestCases(problem.testCases.map((tc, idx) => ({
                    id: Date.now() + idx,
                    input: tc.input || "",
                    expectedOutput: tc.expectedOutput || tc.output || "",
                    status: "idle",
                    actualOutput: "",
                    expanded: true
                })));
            } else {
                setTestCases([{ id: Date.now(), input: "", expectedOutput: "", status: "idle", actualOutput: "", expanded: true }]);
            }
        } else if (problem.testCases && Array.isArray(problem.testCases)) {
            // Codeforces/GFG: standard format
            setTestCases(problem.testCases.map((tc, idx) => ({
                id: Date.now() + idx,
                input: tc.input || "",
                expectedOutput: tc.expectedOutput || tc.output || "",
                status: "idle",
                actualOutput: "",
                expanded: true
            })));
        } else {
            setTestCases([]);
        }
    };



    return (
    <ErrorBoundary>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-dark)", color: "var(--text-main)" }}>
        
        {/* HEADER */}
        <div style={{ height: "48px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "rgba(17,17,17,0.85)", backdropFilter: "blur(20px) saturate(180%)", borderBottom: "1px solid rgba(255,255,255,0.06)", WebkitAppRegion: "drag" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", WebkitAppRegion: "no-drag" }}>
                 <div onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "opacity 0.2s" }} onMouseEnter={e => e.currentTarget.style.opacity = "0.7"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                    <Code2 size={18} color="var(--accent-primary)" />
                    <span style={{ fontWeight: "600", fontSize: "15px", letterSpacing: "-0.01em" }}>CodePlay</span>
                </div>
                {activeFile && activeFile.type !== "preview" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", background: "rgba(255,255,255,0.04)", padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: activeFile.language === "html" ? "#e34c26" : activeFile.language === "css" ? "#563d7c" : (activeFile.language === "javascript" ? "#f1e05a" : activeFile.language === "python" ? "#3572A5" : activeFile.language === "java" ? "#b07219" : activeFile.language === "cpp" ? "#f34b7d" : "var(--accent-primary)") }}></span>
                        <span style={{ color: "var(--text-muted)", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.5px" }}>{activeFile.language}</span>
                    </div>
                )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                
                <div style={{ display: "flex", alignItems: "center", paddingLeft: "8px" }}>
                    {activeUsers.map((u, i) => (
                        <div 
                            key={i} 
                            onMouseEnter={() => setHoveredUser(u.username)}
                            onMouseLeave={() => setHoveredUser(null)}
                            style={{ 
                                width: "28px", height: "28px", borderRadius: "50%", 
                                background: stringToColor(u.username || "User"), 
                                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", 
                                fontSize: "12px", fontWeight: "600", 
                                border: "2px solid rgba(17,17,17,0.9)", 
                                marginLeft: i === 0 ? 0 : "-8px", 
                                cursor: "pointer",
                                position: "relative",
                                zIndex: 10 + i,
                                transition: "transform 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
                            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        >
                            {(u.username || "U")[0].toUpperCase()}
                            {hoveredUser === u.username && (
                                <div style={{
                                    position: "absolute",
                                    top: "36px", left: "50%", transform: "translateX(-50%)",
                                    background: "rgba(28,28,30,0.95)", color: "white", padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "500", whiteSpace: "nowrap", zIndex: 1000, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)"
                                }}>
                                    {u.username}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <button onClick={handleRun} disabled={isRunning} className="btn-primary" style={{ padding: "6px 16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                     {isRunning ? "..." : <><Play size={14} fill="white" /> Run</>}
                </button>
                {rightPanel?.data && (
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "4px" }}>
                        <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary" title={extensionDetected === false ? "⚠️ Extension not detected — Install CodePlay Helper to submit" : "Submit code"} style={{ padding: "6px 16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", background: "linear-gradient(135deg, #16a34a, #15803d)" }}>
                             {isSubmitting ? "..." : <><Zap size={14} fill="white" /> Submit</>}
                        </button>
                        {extensionDetected === false && (
                            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" title="Install CodePlay Helper Extension" style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s", textDecoration: "none" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(251,146,60,0.2)"; e.currentTarget.style.transform = "scale(1.05)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(251,146,60,0.12)"; e.currentTarget.style.transform = "scale(1)"; }}>
                                <Puzzle size={13} style={{ color: "#fb923c" }} />
                            </a>
                        )}
                    </div>
                )}
                <button onClick={handleCopyLink} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}><Share2 size={14} /></button>
                
                {/* Gemini AI Button - Official Logo */}
                <button 
                  onClick={() => setAiPanelOpen(!aiPanelOpen)}
                  title="Gemini AI"
                  style={{ 
                    width: "36px",
                    height: "36px",
                    padding: 0,
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    background: aiPanelOpen ? "rgba(66, 133, 244, 0.15)" : "transparent",
                    border: "none",
                    borderRadius: "50%",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    position: "relative"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(66, 133, 244, 0.15)"}
                  onMouseLeave={e => { if(!aiPanelOpen) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Official Google Gemini Logo */}
                  <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" fill="url(#geminiGradIcon)"/>
                    <defs>
                      <linearGradient id="geminiGradIcon" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#1C7DFF"/>
                        <stop offset="0.52" stopColor="#A87FFE"/>
                        <stop offset="1" stopColor="#D96570"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  {rightPanel?.data && (
                    <span style={{ 
                      position: "absolute", top: "2px", right: "2px",
                      width: "8px", height: "8px", borderRadius: "50%", 
                      background: "#4ade80", border: "2px solid #111" 
                    }} />
                  )}
                </button>
                
                {!user && <button onClick={() => setAuthModalOpen(true)} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}>Login</button>}
            
                {/* FORCE SEPARATOR */}
                <div style={{ width: "1px", height: "24px", background: "var(--border-subtle)", margin: "0 4px" }}></div>

                {/* VOICE CONTROLS */}
                {!isConnected ? (
                    <button 
                        onClick={joinVoice} 
                        className="btn-secondary" 
                        style={{ padding: "6px 12px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", borderColor: "var(--accent-primary)", color: "var(--accent-primary)" }}
                        title="Join Voice Chat"
                    >
                        <MicOff size={14} /> Join Voice
                    </button>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#333", borderRadius: "6px", padding: "2px", border: `1px solid ${isSpeaking ? '#22c55e' : '#444'}`, transition: "border-color 0.15s" }}>
                         <button 
                            onClick={toggleMute}
                            style={{ 
                                background: isMuted ? "#ef5350" : "#22c55e", 
                                border: "none", borderRadius: "4px", 
                                width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s",
                                boxShadow: isSpeaking && !isMuted ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none'
                            }}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? <MicOff size={14} color="white" /> : <Mic size={14} color="white" />}
                        </button>
                        <button 
                            onClick={toggleDeafen}
                            style={{ 
                                background: isDeafened ? "#ef5350" : "transparent", 
                                border: "none", borderRadius: "4px", 
                                width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s"
                            }}
                            title={isDeafened ? "Undeafen" : "Deafen (mute all audio)"}
                        >
                            {isDeafened ? <VolumeX size={14} color="white" /> : <Headphones size={14} color="#aaa" />}
                        </button>
                        <button 
                            onClick={leaveVoice}
                            style={{ 
                                background: "transparent", 
                                border: "none", borderRadius: "4px", 
                                width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" 
                            }}
                            className="hover-bg-red"
                            title="Disconnect Voice"
                        >
                            <PhoneOff size={14} color="#aaa" />
                        </button>
                        {/* Connection quality indicator */}
                        <div style={{ 
                            width: "8px", height: "8px", borderRadius: "50%", marginLeft: "4px",
                            background: connectionQuality === 'good' ? '#22c55e' : connectionQuality === 'medium' ? '#f59e0b' : '#ef5350'
                        }} title={`Connection: ${connectionQuality}`} />
                    </div>
                )}
            </div>
        </div>
        </div>

        {/* EXTENSION INSTALL BANNER */}
        {extensionDetected === false && !extensionBannerDismissed && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "8px 16px",
            background: "linear-gradient(90deg, rgba(251,146,60,0.08), rgba(249,115,22,0.12), rgba(251,146,60,0.08))",
            borderBottom: "1px solid rgba(251,146,60,0.2)",
            fontSize: "13px",
            color: "#fbbf24",
            fontWeight: 500,
            flexShrink: 0,
            animation: "fadeIn 0.3s ease"
          }}>
            <Puzzle size={15} style={{ color: "#fb923c", flexShrink: 0 }} />
            <span style={{ color: "var(--text-muted)" }}>
              <strong style={{ color: "#fb923c" }}>CodePlay Helper Extension</strong> is required to submit code to Codeforces &amp; LeetCode.
            </span>
            <a
              href={EXTENSION_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 14px",
                background: "linear-gradient(135deg, #fb923c, #f97316)",
                color: "#fff",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(251,146,60,0.25)"
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(251,146,60,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(251,146,60,0.25)"; }}
            >
              <Download size={12} />
              Install Extension
              <ExternalLink size={10} style={{ opacity: 0.7 }} />
            </a>
            <button
              onClick={() => { setExtensionBannerDismissed(true); try { sessionStorage.setItem("ext_banner_dismissed", "1"); } catch {} }}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.3)",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                transition: "color 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* WORKSPACE BODY */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            
            {/* 1. SIDEBAR NAVIGATION */}
            <Sidebar activeTab={activeSidebar} setActiveTab={setActiveSidebar} isOpen={!!activeSidebar} />

            {/* 2. SIDEBAR PANEL (Only if active and NOT whiteboard which is floating) */}
            {activeSidebar && activeSidebar !== "whiteboard" && (
                <>
                    <div style={{ width: sidebarWidth, height: "100%", overflow: "hidden", background: "var(--bg-panel)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column" }}>
                    {activeSidebar === "files" && (
                        <FileExplorer 
                            files={files} 
                            activeFileId={activeFile?._id} 
                            onSelect={handleFileSelect} 
                            onCreate={handleFileCreate} 
                            onDelete={handleFileDeleteRequest}
                        />
                    )}
                    {activeSidebar === "participants" && (
                        <ParticipantsPanel 
                            users={activeUsers} 
                            hostOnline={hostOnline}
                            isReadOnly={isReadOnly}
                            onLeaveRoom={handleLeaveRoom}
                            currentUsername={user?.username}
                        />
                    )}
                    {activeSidebar === "tests" && (
                        <TestPanel 
                            testCases={testCases} 
                            setTestCases={setTestCases} 
                            runTests={runTests}
                            runSingleTest={runSingleTest}
                            isRunningTests={isRunningTests || isSubmitting}
                            language={activeFile?.language || "text"} // Pass language
                        />
                    )}
                    
                    {/* NEW CP PANELS */}

                    {/* NEW CP PANELS */}
                    {activeSidebar === "codeforces" && (
                        <ProblemBrowser 
                            provider="codeforces" 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode on Click
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                            activeSheet={null} 
                        />
                    )}
                    {activeSidebar === "cses" && (
                         <ProblemBrowser 
                            provider="cses" 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                        />
                    )}
                    {activeSidebar === "leetcode" && (
                         <ProblemBrowser 
                            provider="leetcode" 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                        />
                    )}
                    {activeSidebar === "cp31" && (
                         <CP31Browser 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                        />
                    )}
                    {activeSidebar === "a2z" && (
                         <A2ZBrowser 
                            user={user}
                            onOpenProblem={(p) => {
                                // Full Screen Mode
                                setRightPanel({ type: "preview", data: p });
                                setViewMode("problem_full");
                                socket.emit("sync_problem", { roomId: id, problem: p });
                            }} 
                        />
                    )}
                    {activeSidebar === "settings" && <SettingsPanel />}
                    {activeSidebar === "recording" && (
                        <RecordingPanel 
                          onClose={() => setActiveSidebar(null)}
                          isRecording={isRecording}
                          isPaused={isPaused}
                          formattedTime={recordingTime}
                          recordedBlob={recordedBlob}
                          recordingError={recordingError}
                          audioLevel={recordingAudioLevel}
                          isPreviewOpen={isRecordingPreviewOpen}
                          countdownActive={countdownActive}
                          countdown={countdown}
                          // Webcam state
                          webcamEnabled={webcamEnabled}
                          webcamStream={webcamStream}
                          webcamPosition={webcamPosition}
                          // Recording actions
                          startRecording={startRecording}
                          pauseRecording={pauseRecording}
                          resumeRecording={resumeRecording}
                          stopRecording={stopRecording}
                          downloadRecording={downloadRecording}
                          discardRecording={discardRecording}
                          setIsPreviewOpen={setIsRecordingPreviewOpen}
                          // Webcam actions
                          toggleWebcam={toggleWebcam}
                          setWebcamPosition={setWebcamPosition}
                        />
                    )}
                </div>
                    {/* RESIZE HANDLE */}
                    <div 
                        onMouseDown={(e) => { e.preventDefault(); setIsSidebarResizing(true); document.body.style.cursor = "col-resize"; }}
                        className="resize-handle-vertical"
                        style={{ 
                            width: "4px", cursor: "col-resize", background: isSidebarResizing ? "var(--accent-primary)" : "transparent", 
                            transition: "background 0.2s", zIndex: 10, position: "relative", right: "2px"
                        }}
                    />
                </>
            )}

            {/* 3. FLOATABLE WHITEBOARD */}
            {/* 3. FLOATABLE WHITEBOARD */}
            {activeSidebar === "whiteboard" && (
                <Whiteboard 
                    socket={socket} 
                    roomId={id} 
                    username={user?.username}
                    onClose={() => setActiveSidebar(null)} 
                />
            )}

            {/* 3. MAIN EDITOR AREA */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* Coding Area + Right Panel Split */}
                <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", borderBottom: consoleOpen ? "1px solid var(--border-subtle)" : "none" }}>
                   
                   {/* EDITOR AREA or FULL SCREEN PROBLEM */}
                   <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                       {viewMode === "problem_full" ? (
                           // FULL SCREEN PROBLEM VIEW
                            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                                {rightPanel?.data && (
                                    <ProblemPreview 
                                        problem={rightPanel.data} 
                                        onCodeNow={handleCodeNow} 
                                    />
                                )}
                                {/* Close Full Screen Button */}
                                <button 
                                    onClick={() => setViewMode("editor")}
                                    style={{
                                        position: "absolute", top: "20px", right: "20px",
                                        background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)",
                                        color: "white", borderRadius: "50%", width: "32px", height: "32px",
                                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                       ) : (
                           // NORMAL EDITOR
                           accessStatus === "granted" && (
                               <Editors
                                    activeFile={activeFile}
                                        onCodeChange={setActiveCode}
                                        socket={socket}
                                        roomId={id}
                                        username={user?.username} 
                                        readOnly={isReadOnly}
                                        onCodeNow={handleCodeNow}
                               />
                           )
                       )}
                   </div>

                   {/* RIGHT PANEL (SPLIT VIEW) */}
                   {activeFile?.language === "html" && (
                       <>
                           <div 
                               onMouseDown={(e) => { e.preventDefault(); setIsRightPanelResizing(true); document.body.style.cursor = "col-resize"; }}
                               style={{ width: "4px", cursor: "col-resize", background: isRightPanelResizing ? "var(--accent-primary)" : "var(--border-subtle)", transition: "background 0.2s", zIndex: 10 }}
                           />
                           <div style={{ width: rightPanelWidth, display: "flex", flexDirection: "column" }}>
                                <div style={{ padding: "8px", background: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)", fontSize: "12px", fontWeight: "bold" }}>PREVIEW</div>
                                <div style={{ flex: 1, background: "white" }}>
                                    <Preview html={activeCode} />
                                </div>
                           </div>
                       </>
                   )}
                   
                   {rightPanel?.type === "preview" && activeFile?.type !== "preview" && viewMode !== "problem_full" && (
                        <>
                           <div 
                               onMouseDown={(e) => { e.preventDefault(); setIsRightPanelResizing(true); document.body.style.cursor = "col-resize"; }}
                               style={{ width: "4px", cursor: "col-resize", background: isRightPanelResizing ? "var(--accent-primary)" : "var(--border-subtle)", transition: "background 0.2s", zIndex: 10 }}
                           />
                            <div style={{ width: rightPanelWidth, display: "flex", flexDirection: "column" }}>
                                 {/* Tabs / Header */}
                                 <div style={{ height: "36px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "var(--bg-panel)", borderBottom: "1px solid var(--border-subtle)" }}>
                                    <span style={{ fontSize: "13px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Globe size={13}/> Description
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                         {rightPanel.data.provider === "leetcode" && (
                                            <>
                                            <button 
                                                onClick={handleSubmit}
                                                disabled={isSubmitting}
                                                className="btn-primary"
                                                title={extensionDetected === false ? "⚠️ Extension required — Install CodePlay Helper first" : "Submit to LeetCode"}
                                                style={{ padding: "4px 12px", fontSize: "11px", height: "24px", display: "flex", alignItems: "center", gap: "4px" }}
                                            >
                                                {isSubmitting ? "Submitting..." : "Submit to LeetCode"}
                                            </button>
                                            {extensionDetected === false && (
                                                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" title="Install extension to enable submissions" style={{ height: "24px", padding: "0 8px", borderRadius: "6px", background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", textDecoration: "none", fontSize: "11px", color: "#fb923c", fontWeight: 600, transition: "all 0.2s", whiteSpace: "nowrap" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(251,146,60,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(251,146,60,0.12)"}>
                                                    <Puzzle size={11} /> Get Extension
                                                </a>
                                            )}
                                            </>
                                         )}
                                        <button 
                                            onClick={() => setRightPanel(null)}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                 </div>
                                 
                                 <div style={{ flex: 1, overflow: "hidden" }}>
                                     <ProblemPreview problem={rightPanel.data} onCodeNow={handleCodeNow} />
                                 </div>
                            </div>
                        </>
                   )}
                </div>

                {/* Bottom Terminal */}
                {consoleOpen && (
                    <>
                        <div 
                           onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                           style={{ height: "4px", cursor: "ns-resize", background: isResizing ? "var(--accent-primary)" : "var(--border-subtle)", transition: "background 0.2s" }} 
                        />
                        <ConsolePanel 
                            logs={logs} 
                            isOpen={consoleOpen} 
                            onClose={() => setConsoleOpen(false)} 
                            onClear={() => setLogs([])} 
                            input={input}
                            setInput={setInput}
                            height={consoleHeight}
                        />
                    </>
                )}
                {!consoleOpen && (
                    <div style={{ height: "30px", background: "var(--bg-panel)", display: "flex", alignItems: "center", padding: "0 16px", cursor: "pointer", borderTop: "1px solid var(--border-subtle)" }} onClick={() => setConsoleOpen(true)}>
                        <PanelBottom size={14} style={{ marginRight: "8px" }} />
                        <span style={{ fontSize: "12px" }}>Terminal</span>
                    </div>
                )}
            </div>

        </div>
      </div>

      
      
      {/* OVERLAYS */}
      
      {/* Recording Countdown Overlay - Always rendered at top level */}
      <CountdownOverlay count={countdown} active={countdownActive} />
      
      {/* Recording Preview Modal - Only when not recording */}
      {!isRecording && (
      <RecordingPreview
        blob={recordedBlob}
        isOpen={isRecordingPreviewOpen}
                isRecording={isRecording}
        onClose={() => setIsRecordingPreviewOpen(false)}
        onDownload={() => {
          downloadRecording("codeplay-solution");
          setIsRecordingPreviewOpen(false);
        }}
        onDiscard={() => {
          discardRecording();
          setIsRecordingPreviewOpen(false);
        }}
        duration={recordingTime}
      />
      )}

      {(accessStatus === "waiting" || accessStatus === "loading" || accessStatus === "login_required" || accessStatus === "denied") && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(24px) saturate(180%)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white" }}>
              <div style={{ 
                width: "72px", height: "72px", borderRadius: "20px", 
                background: accessStatus === "denied" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)", 
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px",
                border: `1px solid ${accessStatus === "denied" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
                animation: accessStatus === "loading" ? "pulse 2s ease-in-out infinite" : "none"
              }}>
                  {accessStatus === "login_required" ? <span style={{ fontSize: "32px" }}>🔑</span> : 
                   (accessStatus === "denied" ? <ShieldAlert size={32} color="#ef5350" /> : 
                   (accessStatus === "loading" ? <span style={{ fontSize: "32px" }}>⏳</span> : <span style={{ fontSize: "32px" }}>🔒</span>))}
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "600", marginBottom: "8px", letterSpacing: "-0.02em", color: accessStatus === "denied" ? "#ef5350" : "white" }}>
                  {accessStatus === "login_required" ? "Authentication Required" : 
                   (accessStatus === "denied" ? "Access Denied" : 
                   (accessStatus === "loading" ? "Connecting..." : "Waiting for Host"))}
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "15px", marginBottom: "28px", maxWidth: "400px", textAlign: "center", lineHeight: "1.5" }}>{waitMessage}</p>
              
              {accessStatus === "login_required" && (
                  <button onClick={() => setAuthModalOpen(true)} className="btn-primary" style={{ padding: "12px 28px", fontSize: "15px", borderRadius: "12px" }}>Sign In to Join</button>
              )}
              {accessStatus === "denied" && (
                  <button onClick={() => navigate("/")} className="btn-secondary" style={{ padding: "12px 28px", fontSize: "15px", borderRadius: "12px", borderColor: "#ef5350", color: "#ef5350" }}>Return to Dashboard</button>
              )}
          </div>
      )}

      {pendingGuests.length > 0 && (
          <div style={{ position: "fixed", top: "60px", right: "16px", width: "300px", zIndex: 2000 }}>
              {pendingGuests.map((guest, i) => (
                  <div key={guest.socketId} style={{ padding: "16px", marginBottom: "8px", borderRadius: "14px", background: "rgba(28,28,30,0.95)", border: "1px solid rgba(124,92,252,0.25)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", backdropFilter: "blur(20px)", animation: "slideUp 0.3s ease-out" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: stringToColor(guest.username), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "14px", fontWeight: "600" }}>
                              {guest.username[0]?.toUpperCase()}
                          </div>
                          <div>
                              <div style={{ fontWeight: "600", color: "white", fontSize: "14px" }}>{guest.username}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>wants to join</div>
                          </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => handleGrant(guest.socketId)} className="btn-primary" style={{ flex: 1, padding: "8px", fontSize: "13px", borderRadius: "10px" }}>Accept</button>
                          <button onClick={() => handleDeny(guest.socketId)} className="btn-secondary" style={{ flex: 1, padding: "8px", fontSize: "13px", borderRadius: "10px", color: "#ef5350", borderColor: "rgba(239,68,68,0.3)" }}>Deny</button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      <VoicePanel
        isConnected={isConnected}
        connectionQuality={connectionQuality}
        user={user}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isSpeaking={isSpeaking}
        volume={volume}
        onMasterVolumeChange={setMasterVolume}
        peers={peers}
        speakingPeers={speakingPeers}
        onTogglePeerMute={mutePeer}
        onPeerVolumeChange={setPeerVolume}
        resolvePeerName={getPeerName}
      />

      {/* Floating Recording Indicator - Shows when recording but panel is closed */}
      {isRecording && activeSidebar !== "recording" && (
        <RecordingIndicator
          isRecording={isRecording}
          isPaused={isPaused}
          formattedTime={recordingTime}
          audioLevel={recordingAudioLevel}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          onExpand={() => setActiveSidebar("recording")}
          webcamEnabled={webcamEnabled}
          webcamStream={webcamStream}
          webcamPosition={webcamPosition}
                    isPreviewOpen={isRecordingPreviewOpen}
        />
      )}

      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} url={shareUrl} />
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      
      {/* LANGUAGE SELECTION MODAL */}
      {languageModalOpen && (
        <div style={{
            position: "fixed", inset: 0, 
            background: "rgba(0,0,0,0.65)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", animation: "fadeInScale 0.25s ease-out"
        }}>
            <div style={{ 
                width: "400px", maxWidth: "90%", background: "rgba(28,28,30,0.95)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", 
                padding: "28px", display: "flex", flexDirection: "column", gap: "18px",
                boxShadow: "0 24px 48px rgba(0,0,0,0.5)", backdropFilter: "blur(40px)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "17px", fontWeight: "600", color: "white", letterSpacing: "-0.02em" }}>Choose Language</h3>
                    <button onClick={() => setLanguageModalOpen(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: "var(--text-muted)", width: "28px", height: "28px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}><X size={16}/></button>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.5", margin: 0 }}>Select the language for <strong style={{ color: "#fff" }}>{selectedProblemForCode?.title}</strong></p>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {[
                        { id: "cpp", name: "C++", color: "#f34b7d" },
                        { id: "java", name: "Java", color: "#b07219" },
                        { id: "python", name: "Python", color: "#3572A5" },
                        { id: "javascript", name: "JavaScript", color: "#f1e05a" }
                    ].map(lang => (
                        <button
                            key={lang.id}
                            onClick={() => confirmCodeNow(lang.id)}
                            style={{
                                padding: "14px 16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)",
                                background: "rgba(255,255,255,0.03)", color: "white", cursor: "pointer",
                                display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "500",
                                transition: "all 0.2s ease"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${lang.color}60`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: lang.color, flexShrink: 0 }}></span>
                            {lang.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal 
          isOpen={deleteConfirm.isOpen}
          title="Delete File"
          message={`Are you sure you want to delete "${deleteConfirm.fileName}"? This action cannot be undone.`}
          onConfirm={handleFileDeleteConfirm}
          onCancel={() => setDeleteConfirm({ isOpen: false, fileId: null, fileName: "" })}
          confirmText="Delete"
          danger={true}
      />
      
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {aiPanelOpen && (
        <div style={{
            position: "fixed", 
            top: 0, 
            right: 0, 
            width: `${aiPanelWidth}px`, 
            minWidth: "320px",
            maxWidth: "50vw",
            height: "100vh", 
            zIndex: 99,
            borderLeft: "1px solid var(--border-subtle)", 
            background: "var(--bg-panel)",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
            animation: isAiPanelResizing ? "none" : "slideInRight 0.25s ease-out",
            display: "flex",
            flexDirection: "row"
        }}>
            {/* Resize Handle */}
            <div
              style={{
                width: "6px",
                cursor: "ew-resize",
                background: isAiPanelResizing ? "linear-gradient(135deg, #4285f4, #9b72cb)" : "transparent",
                transition: "background 0.2s",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, #4285f440, #9b72cb40)"}
              onMouseLeave={e => { if(!isAiPanelResizing) e.currentTarget.style.background = "transparent"; }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsAiPanelResizing(true);
                const startX = e.clientX;
                const startWidth = aiPanelWidth;
                
                const onMouseMove = (moveEvent) => {
                  const delta = startX - moveEvent.clientX;
                  const newWidth = Math.min(Math.max(startWidth + delta, 320), window.innerWidth * 0.5);
                  setAiPanelWidth(newWidth);
                };
                
                const onMouseUp = () => {
                  setIsAiPanelResizing(false);
                  localStorage.setItem("aiPanelWidth", aiPanelWidth.toString());
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);
                };
                
                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
              }}
            >
              <div style={{ width: "2px", height: "40px", borderRadius: "2px", background: "var(--text-muted)", opacity: 0.3 }} />
            </div>
            
            {/* Panel Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <AIPanel 
                open={true} 
                onClose={() => setAiPanelOpen(false)} 
                onAsk={handleAskAI}
                currentProblem={rightPanel?.data ? (rightPanel.data.title || rightPanel.data.name || `Problem ${rightPanel.data.contestId}${rightPanel.data.index}`) : null}
              />
            </div>
        </div>
      )}
      
      {/* AI Panel slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* CSES Result Modal */}
      <CSESResultModal
        isOpen={csesResultModalOpen}
        onClose={() => {
          setCSESResultModalOpen(false);
          setCSESResultModalData(null);
          setCSESResultModalSubmissionId(null);
        }}
        submission={csesResultModalData}
        submissionId={csesResultModalSubmissionId}
        problemId={csesResultModalData?.problemId || null}
        user={user}
      />
    </ErrorBoundary>
  );
}
