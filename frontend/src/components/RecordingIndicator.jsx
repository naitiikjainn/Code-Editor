import React, { memo, useState, useEffect } from "react";
import { Circle, Pause, Square, ChevronUp, ChevronDown, Mic, MicOff, X } from "lucide-react";

/**
 * Floating Recording Indicator
 * Shows a compact recording status that can be minimized
 * Appears when recording is active and the sidebar is closed
 */
const RecordingIndicator = memo(function RecordingIndicator({
  isRecording,
  isPaused,
  formattedTime,
  audioLevel,
  onPause,
  onResume,
  onStop,
  onExpand
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Don't render if not recording
  if (!isRecording) return null;

  // Minimized compact view
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: "fixed",
          top: "80px",
          right: "20px",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: isPaused 
            ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          boxShadow: isPaused 
            ? "0 4px 20px rgba(245, 158, 11, 0.5)"
            : "0 4px 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 9999,
          animation: !isPaused ? "recordingPulse 2s ease-in-out infinite" : "none",
          transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isPaused ? (
          <Pause size={20} color="white" />
        ) : (
          <Circle size={20} fill="white" color="white" />
        )}
        
        {/* Expand hint on hover */}
        {isHovered && (
          <div style={{
            position: "absolute",
            top: "100%",
            marginTop: "8px",
            background: "rgba(0,0,0,0.9)",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            color: "white",
            whiteSpace: "nowrap",
            animation: "fadeIn 0.2s ease"
          }}>
            {formattedTime}
          </div>
        )}
      </div>
    );
  }

  // Expanded floating panel
  return (
    <div
      style={{
        position: "fixed",
        top: "80px",
        right: "20px",
        width: "280px",
        background: "linear-gradient(180deg, rgba(20, 20, 30, 0.98) 0%, rgba(15, 15, 25, 0.98) 100%)",
        borderRadius: "16px",
        border: isPaused 
          ? "1px solid rgba(245, 158, 11, 0.3)"
          : "1px solid rgba(239, 68, 68, 0.3)",
        boxShadow: isPaused
          ? "0 8px 32px rgba(245, 158, 11, 0.2)"
          : "0 8px 32px rgba(239, 68, 68, 0.2), 0 0 60px rgba(239, 68, 68, 0.1)",
        overflow: "hidden",
        zIndex: 9999,
        animation: "slideInFromRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.05)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Animated recording dot */}
          <div style={{ position: "relative" }}>
            <div style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: isPaused ? "#f59e0b" : "#ef4444"
            }} />
            {!isPaused && (
              <div style={{
                position: "absolute",
                inset: "-6px",
                borderRadius: "50%",
                border: "2px solid #ef4444",
                animation: "recordingRing 1.5s ease-out infinite"
              }} />
            )}
          </div>
          <span style={{ 
            fontSize: "13px", 
            fontWeight: "600", 
            color: isPaused ? "#fcd34d" : "#fca5a5"
          }}>
            {isPaused ? "Paused" : "Recording"}
          </span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              borderRadius: "6px",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#a1a1aa",
              transition: "all 0.2s"
            }}
          >
            <ChevronUp size={16} />
          </button>
        </div>
      </div>

      {/* Timer Display */}
      <div style={{
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isPaused 
          ? "linear-gradient(180deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%)"
          : "linear-gradient(180deg, rgba(239, 68, 68, 0.1) 0%, transparent 100%)"
      }}>
        <div style={{
          fontSize: "36px",
          fontWeight: "bold",
          fontFamily: "var(--font-mono)",
          color: "white",
          letterSpacing: "2px",
          textShadow: isPaused 
            ? "0 0 30px rgba(245, 158, 11, 0.5)"
            : "0 0 30px rgba(239, 68, 68, 0.5)"
        }}>
          {formattedTime}
        </div>
      </div>

      {/* Audio Level (if available) */}
      {audioLevel > 0 && (
        <div style={{
          padding: "0 20px 12px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <Mic size={14} color={audioLevel > 50 ? "#22c55e" : "#a1a1aa"} />
          <div style={{
            flex: 1,
            height: "4px",
            borderRadius: "2px",
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden"
          }}>
            <div style={{
              width: `${audioLevel}%`,
              height: "100%",
              borderRadius: "2px",
              background: audioLevel > 70 
                ? "linear-gradient(90deg, #22c55e, #ef4444)"
                : audioLevel > 40 
                  ? "linear-gradient(90deg, #22c55e, #eab308)"
                  : "#22c55e",
              transition: "width 0.1s ease"
            }} />
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        padding: "12px 16px",
        display: "flex",
        gap: "8px",
        borderTop: "1px solid rgba(255,255,255,0.05)"
      }}>
        <button
          onClick={isPaused ? onResume : onPause}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "white",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.2s"
          }}
        >
          {isPaused ? <Circle size={14} /> : <Pause size={14} />}
          {isPaused ? "Resume" : "Pause"}
        </button>
        
        <button
          onClick={onStop}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "white",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            boxShadow: "0 4px 16px rgba(239, 68, 68, 0.3)",
            transition: "all 0.2s"
          }}
        >
          <Square size={12} fill="white" />
          Stop
        </button>
      </div>

      {/* Expand to full panel option */}
      {onExpand && (
        <button
          onClick={onExpand}
          style={{
            width: "100%",
            padding: "10px",
            background: "rgba(255,255,255,0.02)",
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            color: "#a1a1aa",
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.2s"
          }}
        >
          <ChevronDown size={14} />
          Open Recording Panel
        </button>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes recordingPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5); }
          50% { transform: scale(1.05); box-shadow: 0 6px 30px rgba(239, 68, 68, 0.7); }
        }
        
        @keyframes recordingRing {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        
        @keyframes slideInFromRight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
});

export default RecordingIndicator;
