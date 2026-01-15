import React, { useRef, useState, useEffect, useCallback } from "react";
import { X, Eraser, MousePointer2, Type, Hand, Pen, Minus, Plus, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut, Move } from "lucide-react";

// Helper to determine text color based on background
const getContrastColor = (hexColor) => {
    if (!hexColor) return '#000000';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
};

// Minimum and maximum sizes
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

export default function Whiteboard({ socket, roomId, username, onClose }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // -- STATE --
  const [activeTool, setActiveTool] = useState("pen"); // pen, eraser, text, hand
  const [color, setColor] = useState("#ffffff");
  const [lineWidth, setLineWidth] = useState(2);
  const [history, setHistory] = useState([]); // Array of { type, ... }
  
  // Viewport
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });

  // Text Tool
  const [textInput, setTextInput] = useState(null);

  // Window Position & Size
  const [windowPos, setWindowPos] = useState({ x: 50, y: 50 });
  const [windowSize, setWindowSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [windowDragOffset, setWindowDragOffset] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [preFullscreenState, setPreFullscreenState] = useState(null);

  // Resizing
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState(null); // 'e', 'w', 's', 'n', 'ne', 'nw', 'se', 'sw'
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

  // Cursors
  const [remoteCursors, setRemoteCursors] = useState({});

  // Canvas size (updates with window)
  const canvasWidth = windowSize.width;
  const canvasHeight = windowSize.height - 90; // Account for header + toolbar

  // --- ZOOM HELPERS ---
  const zoomIn = useCallback(() => {
    setScale(s => Math.min(s * 1.2, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(s => Math.max(s / 1.2, 0.1));
  }, []);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }, []);

  // --- FULLSCREEN TOGGLE ---
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      // Restore previous state
      if (preFullscreenState) {
        setWindowPos(preFullscreenState.pos);
        setWindowSize(preFullscreenState.size);
      }
      setIsFullscreen(false);
    } else {
      // Save current state and go fullscreen
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

      // Clear Screen (Reset transform first)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid pattern for infinite canvas feel
      ctx.save();
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 1;
      const gridSize = 50 * scale;
      const offsetX = pan.x % gridSize;
      const offsetY = pan.y % gridSize;
      
      for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.restore();

      // Apply Viewport Transform
      ctx.translate(pan.x, pan.y);
      ctx.scale(scale, scale);

      // Draw All History
      history.forEach(item => {
          if (item.type === "line" || !item.type) { 
               ctx.beginPath();
               ctx.lineCap = "round";
               ctx.lineJoin = "round";
               ctx.moveTo(item.prev.x, item.prev.y);
               ctx.lineTo(item.curr.x, item.curr.y);
               ctx.strokeStyle = item.color;
               ctx.lineWidth = item.width;
               ctx.stroke();
          } else if (item.type === "text") {
               ctx.font = `${item.fontSize || 16}px 'JetBrains Mono', monospace`;
               ctx.fillStyle = item.color;
               ctx.fillText(item.text, item.x, item.y);
          }
      });
  }, [history, pan, scale]);

  // Redraw whenever history or view changes
  useEffect(() => {
      redraw();
  }, [redraw, canvasWidth, canvasHeight]);

  // --- WHEEL EVENT (non-passive to allow preventDefault) ---
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleWheel = (e) => {
          e.preventDefault();
          
          if (e.ctrlKey || e.metaKey) {
              // Zoom with Ctrl/Cmd + Scroll
              const delta = e.deltaY > 0 ? 0.9 : 1.1;
              const newScale = Math.min(Math.max(scale * delta, 0.1), 5);
              
              // Zoom toward mouse position
              const rect = canvas.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;
              
              const scaleDiff = newScale - scale;
              const newPanX = pan.x - (mouseX - pan.x) * (scaleDiff / scale);
              const newPanY = pan.y - (mouseY - pan.y) * (scaleDiff / scale);
              
              setPan({ x: newPanX, y: newPanY });
              setScale(newScale);
              
              if (socket && roomId) {
                  socket.emit("wb_view", { roomId, pan: { x: newPanX, y: newPanY }, scale: newScale });
              }
          } else if (e.shiftKey) {
              // Horizontal scroll with Shift
              const newPan = { x: pan.x - e.deltaY, y: pan.y };
              setPan(newPan);
              if (socket && roomId) {
                  socket.emit("wb_view", { roomId, pan: newPan, scale });
              }
          } else {
              // Normal pan
              const newPan = { x: pan.x - e.deltaX, y: pan.y - e.deltaY };
              setPan(newPan);
              if (socket && roomId) {
                  socket.emit("wb_view", { roomId, pan: newPan, scale });
              }
          }
      };

      canvas.addEventListener("wheel", handleWheel, { passive: false });
      return () => canvas.removeEventListener("wheel", handleWheel);
  }, [scale, pan, socket, roomId]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
      if (!socket) return;

      const handleRemoteDrawLine = (data) => {
          setHistory(prev => [...prev, { type: "line", ...data }]);
      };
      
      const handleRemoteDrawText = (data) => {
          setHistory(prev => [...prev, { type: "text", ...data }]);
      };

      const handleClear = () => {
          setHistory([]);
      };

      const handleStateSync = (serverHistory) => {
          const normalized = serverHistory.map(item => ({
              ...item,
              type: item.type || "line" 
          }));
          setHistory(normalized);
      };

      const handleCursor = ({ x, y, username: rUser, color: rColor }) => {
        setRemoteCursors(prev => ({
            ...prev,
            [rUser]: { x, y, color: rColor }
        }));
      };

      const handleRemoteView = ({ pan: rPan, scale: rScale }) => {
          if (rPan) setPan(rPan);
          if (rScale) setScale(rScale);
      };

      socket.on("draw_line", handleRemoteDrawLine);
      socket.on("draw_text", handleRemoteDrawText);
      socket.on("clear_board", handleClear);
      socket.on("whiteboard_state", handleStateSync);
      socket.on("wb_cursor", handleCursor);
      socket.on("wb_view", handleRemoteView);

      socket.emit("request_whiteboard_state", { roomId });

      return () => {
          socket.off("draw_line", handleRemoteDrawLine);
          socket.off("draw_text", handleRemoteDrawText);
          socket.off("clear_board", handleClear);
          socket.off("whiteboard_state", handleStateSync);
          socket.off("wb_cursor", handleCursor);
          socket.off("wb_view", handleRemoteView);
      };
  }, [socket, roomId]);

  // --- MOUSE HANDLERS ---
  const getWorldPos = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      return {
          x: (screenX - pan.x) / scale,
          y: (screenY - pan.y) / scale
      };
  };

  const onMouseDown = (e) => {
      if (activeTool === "hand" || e.button === 1) { 
          setIsPanning(true);
          setDragStart({ x: e.clientX, y: e.clientY });
          return;
      }

      if (activeTool === "text") {
          const rect = canvasRef.current.getBoundingClientRect();
          const wPos = getWorldPos(e);
          setTextInput({ 
              x: e.clientX - rect.left, 
              y: e.clientY - rect.top,
              worldX: wPos.x,
              worldY: wPos.y 
            });
          return;
      }

      setIsDrawing(true);
      setPrevPos(getWorldPos(e));
  };

  const onMouseMove = (e) => {
      const wPos = getWorldPos(e);
      if (socket && roomId && username) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            socket.emit("wb_cursor", { roomId, x: e.clientX - rect.left, y: e.clientY - rect.top, username, color });
          }
      }

      if (isPanning) {
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          const newPan = { x: pan.x + dx, y: pan.y + dy };
          
          setPan(newPan);
          setDragStart({ x: e.clientX, y: e.clientY });

          if (socket && roomId) {
              socket.emit("wb_view", { roomId, pan: newPan, scale });
          }
          return;
      }

      if (!isDrawing) return;
      if (activeTool === "text") return;

      const currPos = wPos;
      
      const drawColor = activeTool === "eraser" ? "#1a1a1a" : color; 
      const drawWidth = activeTool === "eraser" ? 20 : lineWidth;

      const newItem = { type: "line", prev: prevPos, curr: currPos, color: drawColor, width: drawWidth };
      setHistory(prev => [...prev, newItem]);

      if (socket) {
          socket.emit("draw_line", { roomId, ...newItem });
      }

      setPrevPos(currPos);
  };

  const onMouseUp = () => {
      setIsDrawing(false);
      setIsPanning(false);
  };

  const handleTextSubmit = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
          const text = e.target.value;
          if (text.trim()) {
              const newItem = { 
                  type: "text", 
                  x: textInput.worldX, 
                  y: textInput.worldY, 
                  text, 
                  color: color, 
                  fontSize: 16 
              };
              setHistory(prev => [...prev, newItem]);
              socket.emit("draw_text", { roomId, ...newItem });
          }
          setTextInput(null);
      }
      if (e.key === "Escape") {
          setTextInput(null);
      }
  };

  // --- WINDOW DRAG ---
  const handleWindowMouseDown = (e) => {
      if (isFullscreen) return;
      setIsWindowDragging(true);
      setWindowDragOffset({ x: e.clientX - windowPos.x, y: e.clientY - windowPos.y });
  };

  // --- RESIZE HANDLERS ---
  const handleResizeMouseDown = (edge) => (e) => {
      if (isFullscreen) return;
      e.stopPropagation();
      setIsResizing(true);
      setResizeEdge(edge);
      setResizeStart({
          x: e.clientX,
          y: e.clientY,
          width: windowSize.width,
          height: windowSize.height,
          posX: windowPos.x,
          posY: windowPos.y
      });
  };

  useEffect(() => {
      const handleMouseMove = (e) => {
          if (isWindowDragging && !isFullscreen) {
              setWindowPos({ 
                  x: Math.max(0, e.clientX - windowDragOffset.x), 
                  y: Math.max(0, e.clientY - windowDragOffset.y) 
              });
          }
          
          if (isResizing && resizeEdge) {
              const dx = e.clientX - resizeStart.x;
              const dy = e.clientY - resizeStart.y;
              
              let newWidth = resizeStart.width;
              let newHeight = resizeStart.height;
              let newX = resizeStart.posX;
              let newY = resizeStart.posY;
              
              if (resizeEdge.includes('e')) {
                  newWidth = Math.max(MIN_WIDTH, resizeStart.width + dx);
              }
              if (resizeEdge.includes('w')) {
                  const proposedWidth = resizeStart.width - dx;
                  if (proposedWidth >= MIN_WIDTH) {
                      newWidth = proposedWidth;
                      newX = resizeStart.posX + dx;
                  }
              }
              if (resizeEdge.includes('s')) {
                  newHeight = Math.max(MIN_HEIGHT, resizeStart.height + dy);
              }
              if (resizeEdge.includes('n')) {
                  const proposedHeight = resizeStart.height - dy;
                  if (proposedHeight >= MIN_HEIGHT) {
                      newHeight = proposedHeight;
                      newY = resizeStart.posY + dy;
                  }
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

  // Keyboard shortcuts
  useEffect(() => {
      const handleKeyDown = (e) => {
          if (e.key === "Escape" && isFullscreen) {
              toggleFullscreen();
          }
          if (e.key === "+" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              zoomIn();
          }
          if (e.key === "-" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              zoomOut();
          }
          if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              resetView();
          }
      };
      
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, toggleFullscreen, zoomIn, zoomOut, resetView]);

  const resizeHandleStyle = (cursor) => ({
      position: "absolute",
      background: "transparent",
      zIndex: 5001,
      ...(cursor === "ew-resize" && { width: "8px", height: "100%", top: 0, cursor }),
      ...(cursor === "ns-resize" && { height: "8px", width: "100%", left: 0, cursor }),
      ...(cursor === "nwse-resize" || cursor === "nesw-resize" ? { width: "12px", height: "12px", cursor } : {}),
  });

  return (
    <div 
      ref={containerRef}
      style={{
        position: "fixed", 
        left: windowPos.x, 
        top: windowPos.y,
        width: windowSize.width, 
        height: windowSize.height,
        background: "#1a1a1a", 
        borderRadius: isFullscreen ? 0 : "12px", 
        border: isFullscreen ? "none" : "1px solid #333",
        boxShadow: isFullscreen ? "none" : "0 20px 60px rgba(0,0,0,0.6)", 
        zIndex: 5000,
        display: "flex", 
        flexDirection: "column",
        overflow: "hidden"
      }}
    >
      {/* RESIZE HANDLES (only when not fullscreen) */}
      {!isFullscreen && (
          <>
              {/* Edges */}
              <div style={{ ...resizeHandleStyle("ew-resize"), right: 0 }} onMouseDown={handleResizeMouseDown('e')} />
              <div style={{ ...resizeHandleStyle("ew-resize"), left: 0 }} onMouseDown={handleResizeMouseDown('w')} />
              <div style={{ ...resizeHandleStyle("ns-resize"), bottom: 0 }} onMouseDown={handleResizeMouseDown('s')} />
              <div style={{ ...resizeHandleStyle("ns-resize"), top: 0 }} onMouseDown={handleResizeMouseDown('n')} />
              {/* Corners */}
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
          padding: "10px 12px", 
          background: "#252525", 
          borderBottom: "1px solid #333",
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          cursor: isFullscreen ? "default" : "grab", 
          userSelect: "none",
          minHeight: "40px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "600", color: "#ddd" }}>
           <Move size={16} style={{ opacity: 0.6 }} /> 
           <span>Infinite Whiteboard</span>
           <span style={{ fontSize: "11px", color: "#666", fontWeight: "normal" }}>
               {Math.round(scale * 100)}%
           </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button 
                onClick={toggleFullscreen} 
                style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: "4px", display: "flex" }}
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
            >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button 
                onClick={onClose} 
                style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: "4px", display: "flex" }}
                title="Close"
            >
                <X size={18} />
            </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ 
          padding: "8px 12px", 
          display: "flex", 
          gap: "6px", 
          alignItems: "center", 
          background: "#1e1e1e", 
          borderBottom: "1px solid #333",
          flexWrap: "wrap"
      }}>
          {/* TOOLS */}
          <ToolBtn active={activeTool === "pen"} onClick={() => setActiveTool("pen")} icon={<Pen size={15} />} title="Pen (Draw)" />
          <ToolBtn active={activeTool === "text"} onClick={() => setActiveTool("text")} icon={<Type size={15} />} title="Text" />
          <ToolBtn active={activeTool === "eraser"} onClick={() => setActiveTool("eraser")} icon={<Eraser size={15} />} title="Eraser" />
          <ToolBtn active={activeTool === "hand"} onClick={() => setActiveTool("hand")} icon={<Hand size={15} />} title="Pan (Space + Drag)" />

          <Divider />

          {/* ATTRIBUTES */}
          <input 
              type="color" 
              value={color} 
              onChange={(e) => setColor(e.target.value)} 
              style={{ width: "28px", height: "28px", border: "none", background: "none", padding: 0, cursor: "pointer", borderRadius: "4px" }} 
              title="Color"
          />
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "11px", color: "#666" }}>Size:</span>
              <input 
                  type="range" 
                  min="1" 
                  max="30" 
                  value={lineWidth} 
                  onChange={(e) => setLineWidth(parseInt(e.target.value))} 
                  style={{ width: "80px", cursor: "pointer" }} 
              />
              <span style={{ fontSize: "11px", color: "#888", width: "20px" }}>{lineWidth}</span>
          </div>

          <Divider />
          
          {/* ZOOM CONTROLS */}
          <ToolBtn onClick={zoomOut} icon={<ZoomOut size={15} />} title="Zoom Out (Ctrl -)" />
          <div style={{ 
              background: "#2a2a2a", 
              padding: "4px 10px", 
              borderRadius: "4px", 
              fontSize: "12px", 
              color: "#aaa",
              minWidth: "50px",
              textAlign: "center",
              cursor: "pointer"
          }} onClick={resetView} title="Reset View (Ctrl 0)">
              {Math.round(scale * 100)}%
          </div>
          <ToolBtn onClick={zoomIn} icon={<ZoomIn size={15} />} title="Zoom In (Ctrl +)" />
          <ToolBtn onClick={resetView} icon={<RotateCcw size={15} />} title="Reset View" />

          <div style={{ flex: 1 }} />
          
          {/* ACTIONS */}
          <ToolBtn 
              onClick={() => { setHistory([]); socket?.emit("clear_board", { roomId }); }} 
              icon={<X size={15} color="#ef5350" />} 
              title="Clear All" 
              danger
          />
      </div>

      {/* CANVAS AREA */}
      <div style={{ flex: 1, position: "relative", background: "#1a1a1a", overflow: "hidden" }}>
        <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight > 0 ? canvasHeight : 400}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ 
                display: "block", 
                cursor: isPanning ? "grabbing" : (activeTool === "hand" ? "grab" : (activeTool === "text" ? "text" : "crosshair")),
                touchAction: "none"
            }}
        />

        {/* Text Input Overlay */}
        {textInput && (
            <input 
                autoFocus
                placeholder="Type & Enter..."
                onKeyDown={handleTextSubmit}
                style={{
                    position: "absolute", 
                    left: textInput.x, 
                    top: textInput.y,
                    background: "rgba(0,0,0,0.9)", 
                    color: color,
                    border: "1px solid var(--accent-primary)", 
                    borderRadius: "4px", 
                    padding: "6px 10px",
                    outline: "none", 
                    minWidth: "200px", 
                    zIndex: 6000,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "14px"
                }}
            />
        )}

        {/* Cursors Overlay */}
        {Object.entries(remoteCursors).map(([rUser, pos]) => (
            <div key={rUser} style={{ 
                position: "absolute", 
                left: pos.x, 
                top: pos.y, 
                pointerEvents: "none", 
                transform: "translate(-50%, -50%)", 
                zIndex: 4000,
                transition: "left 0.05s, top 0.05s"
            }}>
                <MousePointer2 size={18} fill={pos.color} color={pos.color} />
                <span style={{ 
                    position: "absolute", 
                    left: 14, 
                    top: 14, 
                    background: pos.color, 
                    color: getContrastColor(pos.color), 
                    padding: "2px 8px", 
                    borderRadius: "4px", 
                    fontSize: "11px", 
                    whiteSpace: "nowrap", 
                    fontWeight: "600",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                }}>
                    {rUser}
                </span>
            </div>
        ))}

        {/* Help Overlay */}
        <div style={{ 
            position: "absolute", 
            bottom: "12px", 
            left: "12px", 
            fontSize: "11px", 
            color: "#555", 
            pointerEvents: "none",
            display: "flex",
            gap: "16px"
        }}>
            <span>Scroll: Pan</span>
            <span>Shift+Scroll: Horizontal</span>
            <span>Ctrl+Scroll: Zoom</span>
        </div>

        {/* Position Info */}
        <div style={{ 
            position: "absolute", 
            bottom: "12px", 
            right: "12px", 
            fontSize: "11px", 
            color: "#555", 
            pointerEvents: "none",
            background: "rgba(0,0,0,0.5)",
            padding: "4px 8px",
            borderRadius: "4px"
        }}>
            Pan: {Math.round(pan.x)}, {Math.round(pan.y)} | Zoom: {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}

const ToolBtn = ({ active, onClick, icon, title, danger }) => (
    <button 
        onClick={onClick} 
        title={title}
        style={{
            background: active ? "var(--accent-primary)" : (danger ? "rgba(239, 83, 80, 0.1)" : "rgba(255,255,255,0.05)"),
            color: active ? "white" : (danger ? "#ef5350" : "var(--text-muted)"),
            border: "1px solid", 
            borderColor: active ? "var(--accent-primary)" : (danger ? "rgba(239, 83, 80, 0.3)" : "transparent"),
            borderRadius: "6px", 
            padding: "6px 8px", 
            cursor: "pointer", 
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s"
        }}
    >
        {icon}
    </button>
);

const Divider = () => (
    <div style={{ width: "1px", height: "24px", background: "#333", margin: "0 4px" }} />
);
