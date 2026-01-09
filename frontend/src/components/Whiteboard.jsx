import React, { useRef, useState, useEffect } from "react";
import { X, Eraser, Move, MousePointer2, Type, Hand, Pen, Minus, Plus } from "lucide-react";

// Helper to determine text color based on background
const getContrastColor = (hexColor) => {
    if (!hexColor) return '#000000';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
};

export default function Whiteboard({ socket, roomId, username, onClose }) {
  const canvasRef = useRef(null);
  
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
  const [textInput, setTextInput] = useState(null); // { x, y } screen coords

  // Window Drag
  const [windowPos, setWindowPos] = useState({ x: 100, y: 100 });
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [windowDragOffset, setWindowDragOffset] = useState({ x: 0, y: 0 });

  // Cursors
  const [remoteCursors, setRemoteCursors] = useState({});

  // --- RENDERING LOOP ---
  const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // Clear Screen (Reset transform first)
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Identity
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply Viewport Transform
      ctx.translate(pan.x, pan.y);
      ctx.scale(scale, scale);

      // Draw All History
      history.forEach(item => {
          if (item.type === "line" || !item.type) { 
               ctx.beginPath();
               ctx.lineCap = "round";
               ctx.moveTo(item.prev.x, item.prev.y);
               ctx.lineTo(item.curr.x, item.curr.y);
               ctx.strokeStyle = item.color;
               ctx.lineWidth = item.width;
               ctx.stroke();
          } else if (item.type === "text") {
               ctx.font = `${item.fontSize || 16}px sans-serif`;
               ctx.fillStyle = item.color;
               ctx.fillText(item.text, item.x, item.y);
          }
      });
  };

  // Redraw whenever history or view changes
  useEffect(() => {
      redraw();
  }, [history, pan, scale]);

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
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      // Inverse Transform
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
          const rect = canvasRef.current.getBoundingClientRect();
          socket.emit("wb_cursor", { roomId, x: e.clientX - rect.left, y: e.clientY - rect.top, username, color });
      }

      if (isPanning) {
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          const newPan = { x: pan.x + dx, y: pan.y + dy };
          
          setPan(newPan);
          setDragStart({ x: e.clientX, y: e.clientY });

          // Emit View Sync (Throttled?)
          if (socket && roomId) {
              socket.emit("wb_view", { roomId, pan: newPan, scale });
          }
          return;
      }

      if (!isDrawing) return;
      if (activeTool === "text") return;

      const currPos = wPos;
      
      const drawColor = activeTool === "eraser" ? "#1e1e1e" : color; 
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
      setIsWindowDragging(true);
      setWindowDragOffset({ x: e.clientX - windowPos.x, y: e.clientY - windowPos.y });
  };

  useEffect(() => {
      const handleWinMove = (e) => {
          if (isWindowDragging) {
              setWindowPos({ x: e.clientX - windowDragOffset.x, y: e.clientY - windowDragOffset.y });
          }
      };
      const handleWinUp = () => setIsWindowDragging(false);
      
      if (isWindowDragging) {
          window.addEventListener("mousemove", handleWinMove);
          window.addEventListener("mouseup", handleWinUp);
      }
      return () => {
          window.removeEventListener("mousemove", handleWinMove);
          window.removeEventListener("mouseup", handleWinUp);
      };
  }, [isWindowDragging]);

  return (
    <div 
      style={{
        position: "fixed", left: windowPos.x, top: windowPos.y,
        width: "800px", height: "650px",
        background: "#1e1e1e", borderRadius: "8px", border: "1px solid #333",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)", zIndex: 5000,
        display: "flex", flexDirection: "column"
      }}
    >
      {/* HEADER */}
      <div 
        onMouseDown={handleWindowMouseDown}
        style={{
          padding: "10px", background: "#252525", borderBottom: "1px solid #333",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "grab", userSelect: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", color: "#ddd" }}>
           <Move size={16} /> Infinite Whiteboard
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}><X size={18} /></button>
      </div>

      {/* TOOLBAR */}
      <div style={{ padding: "8px", display: "flex", gap: "8px", alignItems: "center", background: "#1e1e1e", borderBottom: "1px solid #333" }}>
          {/* TOOLS */}
          <ToolBtn active={activeTool === "pen"} onClick={() => setActiveTool("pen")} icon={<Pen size={16} />} title="Pen" />
          <ToolBtn active={activeTool === "text"} onClick={() => setActiveTool("text")} icon={<Type size={16} />} title="Text" />
          <ToolBtn active={activeTool === "eraser"} onClick={() => setActiveTool("eraser")} icon={<Eraser size={16} />} title="Eraser" />
          <ToolBtn active={activeTool === "hand"} onClick={() => setActiveTool("hand")} icon={<Hand size={16} />} title="Shared Pan (Moves everyone)" />

          <div style={{ width: "1px", height: "20px", background: "#444", margin: "0 4px" }} />

          {/* ATTRIBUTES */}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: "24px", height: "24px", border: "none", background: "none", padding: 0, cursor: "pointer" }} />
          <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)} style={{ width: "60px" }} />

          <div style={{ flex: 1 }} />
          
          {/* ACTIONS */}
          <ToolBtn onClick={() => setHistory([]) || socket.emit("clear_board", { roomId })} icon={<X size={16} color="#ef5350" />} title="Clear All" />
      </div>

      {/* CANVAS AREA */}
      <div style={{ flex: 1, position: "relative", background: "#1e1e1e", overflow: "hidden" }}>
        <canvas
            ref={canvasRef}
            width={800} height={600}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ display: "block", cursor: activeTool === "hand" ? "grab" : (activeTool === "text" ? "text" : "crosshair") }}
        />

        {/* Text Input Overlay */}
        {textInput && (
            <input 
                autoFocus
                placeholder="Type & Enter..."
                onKeyDown={handleTextSubmit}
                // Removed onBlur to prevent accidental closing. Use Enter or Escape.
                style={{
                    position: "absolute", left: textInput.x, top: textInput.y,
                    background: "rgba(0,0,0,0.8)", color: color,
                    border: "1px solid var(--accent-primary)", borderRadius: "4px", padding: "4px 8px",
                    outline: "none", minWidth: "150px", zIndex: 6000,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                }}
            />
        )}

        {/* Cursors Overlay */}
        {Object.entries(remoteCursors).map(([rUser, pos]) => (
            <div key={rUser} style={{ position: "absolute", left: pos.x, top: pos.y, pointerEvents: "none", transform: "translate(-50%, -50%)", zIndex: 4000 }}>
                <MousePointer2 size={16} fill={pos.color} color={pos.color} />
                <span style={{ position: "absolute", left: 12, top: 12, background: pos.color, color: getContrastColor(pos.color), padding: "2px 6px", borderRadius: "4px", fontSize: "10px", whiteSpace: "nowrap", fontWeight: "bold" }}>
                    {rUser}
                </span>
            </div>
        ))}

        {/* Info Overlay */}
        <div style={{ position: "absolute", bottom: "8px", right: "8px", fontSize: "11px", color: "#666", pointerEvents: "none" }}>
            Pan: {Math.round(pan.x)},{Math.round(pan.y)}
        </div>
      </div>
    </div>
  );
}

const ToolBtn = ({ active, onClick, icon, title }) => (
    <button 
        onClick={onClick} title={title}
        style={{
            background: active ? "var(--accent-primary)" : "transparent",
            color: active ? "white" : "var(--text-muted)",
            border: "1px solid", borderColor: active ? "var(--accent-primary)" : "transparent",
            borderRadius: "4px", padding: "6px", cursor: "pointer", display: "flex"
        }}
    >
        {icon}
    </button>
);
