import { useState, useEffect, useCallback, useRef } from "react";
import { API_URL } from "../config";
import useDebounce from "./useDebounce";

export function useWorkspaceFiles({ id, user, socket, accessStatus, isHost, hostUserId, isReadOnly, setLogs, setAuthModalOpen }) {
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [activeCode, setActiveCode] = useState("");
    const debouncedCode = useDebounce(activeCode, 1000);

    // REF for optimization (Stable Callbacks)
    const activeCodeRef = useRef(activeCode);
    useEffect(() => { activeCodeRef.current = activeCode; }, [activeCode]);

    // Persist Active File
    useEffect(() => {
        if (activeFile) {
            localStorage.setItem("activeFileId", activeFile._id);
            if (activeFile.type === "preview") {
                localStorage.setItem("activePreviewFile", JSON.stringify(activeFile));
            } else {
                localStorage.removeItem("activePreviewFile");
            }
        }
    }, [activeFile]);

    // Fetch Files
    const fetchFiles = async () => {
        if (!user || accessStatus !== "granted") return;

        try {
            const token = localStorage.getItem("codeplay_token");
            const fileOwner = isHost ? null : hostUserId;
            const url = fileOwner ? `${API_URL}/api/files?hostId=${fileOwner}` : `${API_URL}/api/files`;

            console.log(`[Files] Fetching files - isHost: ${isHost}, from: ${fileOwner || 'self'}`);

            const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();

            if (Array.isArray(data)) {
                setFiles(data);
            } else {
                setFiles([]);
            }

            // Restore active file
            if (!activeFile) {
                const lastId = localStorage.getItem("activeFileId");
                const savedPreview = localStorage.getItem("activePreviewFile");

                if (lastId && lastId.startsWith("preview-") && savedPreview) {
                    try {
                        const pf = JSON.parse(savedPreview);
                        setActiveFile(pf);
                    } catch (e) { }
                } else if (lastId) {
                    const found = data.find(f => f._id === lastId);
                    if (found) {
                        setActiveFile(found);
                        setActiveCode(found.content || "");
                    } else if (data.length > 0) {
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

    // Fetch on access granted / host change
    useEffect(() => {
        if (accessStatus === "granted") {
            fetchFiles();
        }
    }, [user, accessStatus, hostUserId]);

    // Local Storage Backup
    useEffect(() => {
        if (!isReadOnly && activeFile && activeFile.type !== "preview" && debouncedCode !== activeFile.content) {
            localStorage.setItem(`file_content_${activeFile._id}`, debouncedCode);
        }
    }, [debouncedCode, isReadOnly, activeFile]);

    // File Synchronization Events
    useEffect(() => {
        if (!socket) return;

        const handleSyncFileCreated = ({ file }) => {
            setFiles(prev => {
                if (prev.find(f => f._id === file._id)) return prev;
                return [...prev, file];
            });
        };

        const handleSyncFileDeleted = ({ fileId }) => {
            setFiles(prev => prev.filter(f => f._id !== fileId));
            setActiveFile(prev => prev?._id === fileId ? null : prev);
        };

        const handleSyncActiveFile = ({ fileId }) => {
            if (fileId) {
                setFiles(currentFiles => {
                    const targetFile = currentFiles.find(f => f._id === fileId);
                    if (targetFile) setActiveFile(targetFile);
                    return currentFiles;
                });
            }
        };

        socket.on("sync_file_created", handleSyncFileCreated);
        socket.on("sync_file_deleted", handleSyncFileDeleted);
        socket.on("sync_active_file", handleSyncActiveFile);

        if (accessStatus === "granted") {
            socket.emit("request_active_file", { roomId: id });
        }

        return () => {
            socket.off("sync_file_created", handleSyncFileCreated);
            socket.off("sync_file_deleted", handleSyncFileDeleted);
            socket.off("sync_active_file", handleSyncActiveFile);
        };
    }, [socket, id, accessStatus]);

    // Actions
    const handleFileSelect = useCallback((file) => {
        setActiveFile(file);
        setActiveCode(file.content || "");
        if (id && file?._id) {
            socket.emit("sync_active_file", { roomId: id, fileId: file._id });
        }
    }, [id, socket]);

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
                setLogs?.(prev => [...prev, { type: "error", message: `Failed to create file: ${errorData.error || res.statusText}` }]);
                return;
            }

            const newFile = await res.json();
            setFiles(prev => [...prev, newFile]);
            setActiveFile(newFile);
            setActiveCode("");

            if (id) socket.emit("sync_file_created", { roomId: id, file: newFile });
        } catch (err) {
            setLogs?.(prev => [...prev, { type: "error", message: `File creation error: ${err.message}` }]);
        }
    }, [user, id, socket, setAuthModalOpen, setLogs]);

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

            if (!res.ok) return;

            setFiles(prev => prev.filter(f => f._id !== fileId));
            setActiveFile(prev => prev?._id === fileId ? null : prev);
            if (activeFile?._id === fileId) setActiveCode("");

            if (id) socket.emit("sync_file_deleted", { roomId: id, fileId });
        } catch (err) { console.error(err); }
    }, [deleteConfirm.fileId, activeFile, id, hostUserId, socket]);

    return {
        files, setFiles,
        activeFile, setActiveFile,
        activeCode, setActiveCode,
        activeCodeRef, debouncedCode,
        handleFileSelect,
        handleFileCreate,
        handleFileDeleteRequest,
        handleFileDeleteConfirm,
        deleteConfirm, setDeleteConfirm
    };
}
