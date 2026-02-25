import React, { useRef, useState, useEffect, useCallback } from "react";
import { X, Eraser, Type, Pen, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut, Move, MousePointer2 } from "lucide-react";

// Helper to determine text color based on background
const getContrastColor = (hexColor) => {
    if (!hexColor) return '#000000';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
};

// Preset colors
const PRESET_COLORS = ["#ffffff", "#ff6b6b", "#feca57", "#48dbfb", "#1dd1a1", "#5f27cd"];

// Font sizes
const FONT_SIZES = [14, 18, 24, 32, 48];

// Minimum and maximum sizes
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 600;

export default function Whiteboard({ socket, roomId, username, onClose }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const textInputRef = useRef(null);
    const lastCursorEmitRef = useRef(0);

    // -- STATE --
    const [activeTool, setActiveTool] = useState("pen"); // pen, eraser, text
    const [color, setColor] = useState("#ffffff");
    const [penSize, setPenSize] = useState(3);
    const [eraserSize, setEraserSize] = useState(20);
    const [fontSize, setFontSize] = useState(18);
    const [history, setHistory] = useState([]);

    // Viewport
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Drawing
    const [isDrawing, setIsDrawing] = useState(false);
    const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });

    // Text Tool - inline editing
    const [activeTextItem, setActiveTextItem] = useState(null);

    // Window Position & Size
    const [windowPos, setWindowPos] = useState({ x: 50, y: 50 });
    const [windowSize, setWindowSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    const [isWindowDragging, setIsWindowDragging] = useState(false);
    const [windowDragOffset, setWindowDragOffset] = useState({ x: 0, y: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [preFullscreenState, setPreFullscreenState] = useState(null);

    // Resizing
    const [isResizing, setIsResizing] = useState(false);
    const [resizeEdge, setResizeEdge] = useState(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

    // Remote cursors
    const [remoteCursors, setRemoteCursors] = useState({});

    // Canvas size
    const canvasWidth = windowSize.width;
    const canvasHeight = windowSize.height - 80;

    // --- ZOOM HELPERS ---
    const zoomIn = useCallback(() => setScale(s => Math.min(s * 1.2, 5)), []);
    const zoomOut = useCallback(() => setScale(s => Math.max(s / 1.2, 0.1)), []);
    const resetView = useCallback(() => { setPan({ x: 0, y: 0 }); setScale(1); }, []);

    // --- FULLSCREEN TOGGLE ---
    const toggleFullscreen = useCallback(() => {
        if (isFullscreen) {
            if (preFullscreenState) {
                setWindowPos(preFullscreenState.pos);
                setWindowSize(preFullscreenState.size);
            }
            setIsFullscreen(false);
        } else {
            setPreFullscreenState({ pos: windowPos, size: windowSize });
            setWindowPos({ x: 0, y: 0 });
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
            setIsFullscreen(true);
        }
    }, [isFullscreen, windowPos, windowSize, preFullscreenState]);

    // --- RENDERING LOOP ---
    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply viewport transform
        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(scale, scale);

        // Draw all history items
        history.forEach((item) => {
            if (item.type === "line" || !item.type) {
                ctx.beginPath();
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.moveTo(item.prev.x, item.prev.y);
                ctx.lineTo(item.curr.x, item.curr.y);
                ctx.strokeStyle = item.color;
                ctx.lineWidth = item.width;
                ctx.stroke();
            } else if (item.type === "erase") {
                ctx.beginPath();
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.moveTo(item.prev.x, item.prev.y);
                ctx.lineTo(item.curr.x, item.curr.y);
                ctx.strokeStyle = "#1a1a1a";
                ctx.lineWidth = item.width;
                ctx.globalCompositeOperation = "destination-out";
                ctx.stroke();
                ctx.globalCompositeOperation = "source-over";
            } else if (item.type === "text") {
                ctx.font = `${item.fontSize || 18}px 'Inter', 'Segoe UI', sans-serif`;
                ctx.fillStyle = item.color;
                const lines = (item.text || "").split('\n');
                lines.forEach((line, i) => {
                    ctx.fillText(line, item.x, item.y + (i * (item.fontSize || 18) * 1.3));
                });
            }
        });

        ctx.restore();
    }, [history, pan, scale]);

    // Redraw on changes
    useEffect(() => { redraw(); }, [redraw, canvasWidth, canvasHeight]);

    // --- WHEEL EVENT ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newScale = Math.min(Math.max(scale * delta, 0.1), 5);
                setPan(p => ({
                    x: p.x - (e.clientX - canvas.getBoundingClientRect().left - p.x) * ((newScale - scale) / scale),
                    y: p.y - (e.clientY - canvas.getBoundingClientRect().top - p.y) * ((newScale - scale) / scale)
                }));
                setScale(newScale);
            } else {
                setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
            }
        };

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", handleWheel);
    }, [scale]);

    // --- SOCKET LISTENERS ---
    useEffect(() => {
        if (!socket) return;

        const handleRemoteItem = (data) => setHistory(prev => [...prev, data]);
        const handleClear = () => setHistory([]);
        const handleStateSync = (serverHistory) => setHistory(serverHistory.map(item => ({ ...item, type: item.type || "line" })));
        const handleCursor = ({ x, y, username: rUser, color: rColor }) => {
            setRemoteCursors(prev => ({ ...prev, [rUser]: { x, y, color: rColor } }));
        };

        socket.on("draw_line", handleRemoteItem);
        socket.on("draw_text", handleRemoteItem);
        socket.on("clear_board", handleClear);
        socket.on("whiteboard_state", handleStateSync);
        socket.on("wb_cursor", handleCursor);

        socket.emit("request_whiteboard_state", { roomId });

        return () => {
            socket.off("draw_line", handleRemoteItem);
            socket.off("draw_text", handleRemoteItem);
            socket.off("clear_board", handleClear);
            socket.off("whiteboard_state", handleStateSync);
            socket.off("wb_cursor", handleCursor);
        };
    }, [socket, roomId]);

    // --- WORLD POSITION ---
    const getWorldPos = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - pan.x) / scale,
            y: (e.clientY - rect.top - pan.y) / scale
        };
    }, [pan, scale]);

    // --- Commit text ---
    const commitTextItem = useCallback(() => {
        if (activeTextItem && activeTextItem.text && activeTextItem.text.trim()) {
            const newItem = {
                type: "text",
                x: activeTextItem.x,
                y: activeTextItem.y,
                text: activeTextItem.text,
                color: activeTextItem.color,
                fontSize: activeTextItem.fontSize
            };
            setHistory(prev => [...prev, newItem]);
            socket?.emit("draw_text", { roomId, ...newItem });
        }
        setActiveTextItem(null);
    }, [activeTextItem, socket, roomId]);

    // --- MOUSE HANDLERS ---
    const onMouseDown = useCallback((e) => {
        const wPos = getWorldPos(e);

        // Commit any active text first
        if (activeTextItem) {
            commitTextItem();
        }

        // Middle mouse for panning
        if (e.button === 1) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Text tool
        if (activeTool === "text") {
            setActiveTextItem({
                x: wPos.x,
                y: wPos.y,
                text: "",
                fontSize,
                color,
                isNew: true
            });
            return;
        }

        // Pen/Eraser
        setIsDrawing(true);
        setPrevPos(wPos);
    }, [activeTool, getWorldPos, fontSize, color, activeTextItem, commitTextItem]);

    const onMouseMove = useCallback((e) => {
        const wPos = getWorldPos(e);

        // Emit cursor
        if (socket && roomId && username) {
            const now = Date.now();
            if (now - lastCursorEmitRef.current > 50) {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                    socket.emit("wb_cursor", { roomId, x: e.clientX - rect.left, y: e.clientY - rect.top, username, color });
                }
                lastCursorEmitRef.current = now;
            }
        }

        // Panning
        if (isPanning) {
            setPan(p => ({ x: p.x + e.clientX - panStart.x, y: p.y + e.clientY - panStart.y }));
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if (!isDrawing || activeTool === "text") return;

        const dist = Math.hypot(wPos.x - prevPos.x, wPos.y - prevPos.y);
        if (dist < 2) return;

        const itemType = activeTool === "eraser" ? "erase" : "line";
        const drawColor = activeTool === "eraser" ? "#1a1a1a" : color;
        const drawWidth = activeTool === "eraser" ? eraserSize : penSize;

        const newItem = { type: itemType, prev: prevPos, curr: wPos, color: drawColor, width: drawWidth };
        setHistory(prev => [...prev, newItem]);
        socket?.emit("draw_line", { roomId, ...newItem });
        setPrevPos(wPos);
    }, [activeTool, getWorldPos, isPanning, panStart, isDrawing, prevPos, color, penSize, eraserSize, socket, roomId, username]);

    const onMouseUp = useCallback(() => {
        setIsDrawing(false);
        setIsPanning(false);
    }, []);

    // --- WINDOW DRAG ---
    const handleWindowMouseDown = (e) => {
        if (isFullscreen) return;
        setIsWindowDragging(true);
        setWindowDragOffset({ x: e.clientX - windowPos.x, y: e.clientY - windowPos.y });
    };

    // --- RESIZE ---
    const handleResizeMouseDown = (edge) => (e) => {
        if (isFullscreen) return;
        e.stopPropagation();
        setIsResizing(true);
        setResizeEdge(edge);
        setResizeStart({ x: e.clientX, y: e.clientY, width: windowSize.width, height: windowSize.height, posX: windowPos.x, posY: windowPos.y });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isWindowDragging && !isFullscreen) {
                setWindowPos({ x: Math.max(0, e.clientX - windowDragOffset.x), y: Math.max(0, e.clientY - windowDragOffset.y) });
            }
            if (isResizing && resizeEdge) {
                const dx = e.clientX - resizeStart.x;
                const dy = e.clientY - resizeStart.y;
                let newWidth = resizeStart.width, newHeight = resizeStart.height;
                let newX = resizeStart.posX, newY = resizeStart.posY;

                if (resizeEdge.includes('e')) newWidth = Math.max(MIN_WIDTH, resizeStart.width + dx);
                if (resizeEdge.includes('w')) {
                    const proposed = resizeStart.width - dx;
                    if (proposed >= MIN_WIDTH) { newWidth = proposed; newX = resizeStart.posX + dx; }
                }
                if (resizeEdge.includes('s')) newHeight = Math.max(MIN_HEIGHT, resizeStart.height + dy);
                if (resizeEdge.includes('n')) {
                    const proposed = resizeStart.height - dy;
                    if (proposed >= MIN_HEIGHT) { newHeight = proposed; newY = resizeStart.posY + dy; }
                }
                setWindowSize({ width: newWidth, height: newHeight });
                setWindowPos({ x: newX, y: newY });
            }
        };

        const handleMouseUp = () => {
            setIsWindowDragging(false);
            setIsResizing(false);
            setResizeEdge(null);
        };

        if (isWindowDragging || isResizing) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isWindowDragging, isResizing, resizeEdge, windowDragOffset, resizeStart, isFullscreen]);

    // Focus text input
    useEffect(() => {
        if (activeTextItem && textInputRef.current) {
            textInputRef.current.focus();
        }
    }, [activeTextItem]);

    const resizeHandleStyle = (cursor) => ({
        position: "absolute", background: "transparent", zIndex: 5001,
        ...(cursor === "ew-resize" && { width: "8px", height: "100%", top: 0, cursor }),
        ...(cursor === "ns-resize" && { height: "8px", width: "100%", left: 0, cursor }),
        ...(["nwse-resize", "nesw-resize"].includes(cursor) && { width: "12px", height: "12px", cursor }),
    });

    const getCursor = () => {
        if (isPanning) return "grabbing";
        if (activeTool === "text") return "text";
        return "crosshair";
    };

    const getScreenPos = (worldX, worldY) => ({
        x: worldX * scale + pan.x,
        y: worldY * scale + pan.y
    });

    return (
        <div
            ref={containerRef}
            style={{
                position: "fixed", left: windowPos.x, top: windowPos.y,
                width: windowSize.width, height: windowSize.height,
                background: "#1a1a1a", borderRadius: isFullscreen ? 0 : "12px",
                border: isFullscreen ? "none" : "1px solid #333",
                boxShadow: isFullscreen ? "none" : "0 20px 60px rgba(0,0,0,0.6)",
                zIndex: 5000, display: "flex", flexDirection: "column", overflow: "hidden"
            }}
        >
            {/* RESIZE HANDLES */}
            {!isFullscreen && (
                <>
                    <div style={{ ...resizeHandleStyle("ew-resize"), right: 0 }} onMouseDown={handleResizeMouseDown('e')} />
                    <div style={{ ...resizeHandleStyle("ew-resize"), left: 0 }} onMouseDown={handleResizeMouseDown('w')} />
                    <div style={{ ...resizeHandleStyle("ns-resize"), bottom: 0 }} onMouseDown={handleResizeMouseDown('s')} />
                    <div style={{ ...resizeHandleStyle("ns-resize"), top: 0 }} onMouseDown={handleResizeMouseDown('n')} />
                    <div style={{ ...resizeHandleStyle("nwse-resize"), bottom: 0, right: 0 }} onMouseDown={handleResizeMouseDown('se')} />
                    <div style={{ ...resizeHandleStyle("nesw-resize"), bottom: 0, left: 0 }} onMouseDown={handleResizeMouseDown('sw')} />
                    <div style={{ ...resizeHandleStyle("nesw-resize"), top: 0, right: 0 }} onMouseDown={handleResizeMouseDown('ne')} />
                    <div style={{ ...resizeHandleStyle("nwse-resize"), top: 0, left: 0 }} onMouseDown={handleResizeMouseDown('nw')} />
                </>
            )}

            {/* HEADER */}
            <div
                onMouseDown={handleWindowMouseDown}
                style={{
                    padding: "10px 12px", background: "#252525", borderBottom: "1px solid #333",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    cursor: isFullscreen ? "default" : "grab", userSelect: "none"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "600", color: "#ddd" }}>
                    <Move size={16} style={{ opacity: 0.6 }} />
                    <span>Whiteboard</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button onClick={toggleFullscreen} style={headerBtnStyle} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button onClick={onClose} style={headerBtnStyle} title="Close">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* TOOLBAR - Simple */}
            <div style={{ padding: "8px 12px", display: "flex", gap: "8px", alignItems: "center", background: "#1e1e1e", borderBottom: "1px solid #333", flexWrap: "wrap" }}>
                {/* TOOLS */}
                <ToolBtn active={activeTool === "pen"} onClick={() => setActiveTool("pen")} icon={<Pen size={16} />} title="Pen" />
                <ToolBtn active={activeTool === "text"} onClick={() => setActiveTool("text")} icon={<Type size={16} />} title="Text" />
                <ToolBtn active={activeTool === "eraser"} onClick={() => setActiveTool("eraser")} icon={<Eraser size={16} />} title="Eraser" />

                <Divider />

                {/* COLOR */}
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ width: "28px", height: "28px", border: "none", background: "none", cursor: "pointer", borderRadius: "4px" }}
                    title="Color"
                />
                {PRESET_COLORS.map(c => (
                    <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{
                            width: "20px", height: "20px", borderRadius: "4px",
                            background: c, border: color === c ? "2px solid #00d4ff" : "1px solid #444",
                            cursor: "pointer"
                        }}
                    />
                ))}

                <Divider />

                {/* PEN SIZE */}
                {activeTool === "pen" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "12px", color: "#888" }}>Size:</span>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={penSize}
                            onChange={(e) => setPenSize(parseInt(e.target.value))}
                            style={{ width: "80px", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "12px", color: "#aaa", width: "20px" }}>{penSize}</span>
                    </div>
                )}

                {/* ERASER SIZE */}
                {activeTool === "eraser" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "12px", color: "#888" }}>Size:</span>
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={eraserSize}
                            onChange={(e) => setEraserSize(parseInt(e.target.value))}
                            style={{ width: "100px", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "12px", color: "#aaa", width: "24px" }}>{eraserSize}</span>
                    </div>
                )}

                {/* FONT SIZE */}
                {activeTool === "text" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "12px", color: "#888" }}>Font:</span>
                        <select
                            value={fontSize}
                            onChange={(e) => setFontSize(parseInt(e.target.value))}
                            style={{ background: "#2a2a2a", color: "#ddd", border: "1px solid #444", borderRadius: "4px", padding: "4px 8px" }}
                        >
                            {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                    </div>
                )}

                <div style={{ flex: 1 }} />

                {/* ZOOM */}
                <button onClick={zoomOut} style={smallBtnStyle} title="Zoom Out"><ZoomOut size={14} /></button>
                <span style={{ fontSize: "12px", color: "#888", cursor: "pointer" }} onClick={resetView}>{Math.round(scale * 100)}%</span>
                <button onClick={zoomIn} style={smallBtnStyle} title="Zoom In"><ZoomIn size={14} /></button>
                <button onClick={resetView} style={smallBtnStyle} title="Reset"><RotateCcw size={14} /></button>

                <Divider />

                {/* CLEAR */}
                <button
                    onClick={() => { setHistory([]); socket?.emit("clear_board", { roomId }); }}
                    style={{ ...smallBtnStyle, color: "#ef5350" }}
                    title="Clear All"
                >
                    <X size={14} />
                </button>
            </div>

            {/* CANVAS */}
            <div style={{ flex: 1, position: "relative", background: "#1a1a1a", overflow: "hidden" }}>
                <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight > 0 ? canvasHeight : 400}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    style={{ display: "block", cursor: getCursor(), touchAction: "none" }}
                />

                {/* INLINE TEXT INPUT */}
                {activeTextItem && (() => {
                    const screenPos = getScreenPos(activeTextItem.x, activeTextItem.y);
                    return (
                        <div
                            style={{
                                position: "absolute",
                                left: screenPos.x,
                                top: screenPos.y,
                                zIndex: 6000
                            }}
                        >
                            <textarea
                                ref={textInputRef}
                                value={activeTextItem.text}
                                onChange={(e) => setActiveTextItem(prev => ({ ...prev, text: e.target.value }))}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        commitTextItem();
                                    }
                                    if (e.key === "Escape") {
                                        setActiveTextItem(null);
                                    }
                                }}
                                placeholder="Type and press Enter..."
                                autoFocus
                                style={{
                                    minWidth: "200px",
                                    minHeight: "40px",
                                    background: "rgba(30, 30, 30, 0.95)",
                                    border: "2px solid #00d4ff",
                                    borderRadius: "6px",
                                    outline: "none",
                                    color: activeTextItem.color,
                                    fontSize: `${activeTextItem.fontSize}px`,
                                    fontFamily: "'Inter', 'Segoe UI', sans-serif",
                                    resize: "both",
                                    padding: "8px",
                                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
                                }}
                            />
                            <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>
                                Enter to add • Shift+Enter for newline • Esc to cancel
                            </div>
                        </div>
                    );
                })()}

                {/* Remote Cursors */}
                {Object.entries(remoteCursors).map(([rUser, pos]) => (
                    <div key={rUser} style={{
                        position: "absolute", left: pos.x, top: pos.y, pointerEvents: "none",
                        transform: "translate(-50%, -50%)", zIndex: 4000
                    }}>
                        <MousePointer2 size={16} fill={pos.color} color={pos.color} />
                        <span style={{
                            position: "absolute", left: 12, top: 12, background: pos.color,
                            color: getContrastColor(pos.color), padding: "2px 6px", borderRadius: "4px",
                            fontSize: "10px", whiteSpace: "nowrap", fontWeight: "600"
                        }}>
                            {rUser}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- STYLES ---
const headerBtnStyle = { background: "none", border: "none", color: "#888", cursor: "pointer", padding: "4px", display: "flex" };
const smallBtnStyle = { background: "rgba(255,255,255,0.05)", border: "none", color: "#888", cursor: "pointer", padding: "6px", borderRadius: "4px", display: "flex" };

const ToolBtn = ({ active, onClick, icon, title }) => (
    <button
        onClick={onClick}
        title={title}
        style={{
            background: active ? "#00d4ff" : "rgba(255,255,255,0.08)",
            color: active ? "#000" : "#aaa",
            border: "none",
            borderRadius: "6px", padding: "8px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px"
        }}
    >
        {icon}
    </button>
);

const Divider = () => <div style={{ width: "1px", height: "24px", background: "#333", margin: "0 4px" }} />;
