import React, { memo, useState, useRef, useEffect } from "react";
import { 
  Video, VideoOff, Pause, Play, Square, Download, Trash2, 
  Mic, MicOff, Monitor, AppWindow, Chrome, X, Settings,
  Circle, Volume2, Eye, Check, ChevronDown, Sparkles
} from "lucide-react";
import { useScreenRecording } from "../hooks/useScreenRecording";

// Recording quality options
const QUALITY_OPTIONS = [
  { id: "low", label: "720p", desc: "Good for smaller file size" },
  { id: "medium", label: "1080p", desc: "Balanced quality & size" },
  { id: "high", label: "1080p HD", desc: "Best quality" }
];

// Capture mode options
const CAPTURE_MODES = [
  { id: "tab", label: "This Tab", icon: Chrome, desc: "Record CodePlay (recommended)", recommended: true },
  { id: "screen", label: "Full Screen", icon: Monitor, desc: "Record entire display" },
  { id: "window", label: "Application", icon: AppWindow, desc: "Record a specific app" }
];

// Animated recording indicator
const RecordingPulse = memo(function RecordingPulse({ active }) {
  return (
    <div style={{ position: "relative", width: "12px", height: "12px" }}>
      <div 
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: active ? "#ef4444" : "#6b7280",
          transition: "background 0.3s"
        }}
      />
      {active && (
        <>
          <div 
            style={{
              position: "absolute",
              inset: "-4px",
              borderRadius: "50%",
              border: "2px solid #ef4444",
              animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"
            }}
          />
          <div 
            style={{
              position: "absolute",
              inset: "-8px",
              borderRadius: "50%",
              border: "1px solid #ef4444",
              opacity: 0.5,
              animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s"
            }}
          />
        </>
      )}
    </div>
  );
});

// Audio level meter
const AudioMeter = memo(function AudioMeter({ level }) {
  const bars = 12;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "20px" }}>
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i / bars) * 100;
        const isActive = level > threshold;
        const isHigh = i >= bars * 0.7;
        const isMedium = i >= bars * 0.4;
        
        return (
          <div
            key={i}
            style={{
              width: "3px",
              height: `${40 + (i * 5)}%`,
              borderRadius: "2px",
              background: isActive 
                ? (isHigh ? "#ef4444" : isMedium ? "#eab308" : "#22c55e") 
                : "rgba(255,255,255,0.1)",
              transition: "background 0.05s, height 0.1s",
              transform: isActive ? "scaleY(1)" : "scaleY(0.6)",
              transformOrigin: "bottom"
            }}
          />
        );
      })}
    </div>
  );
});

// Countdown overlay
const CountdownOverlay = memo(function CountdownOverlay({ count, active }) {
  if (!active) return null;
  
  return (
    <div 
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000
      }}
    >
      <div 
        key={count}
        style={{
          fontSize: "120px",
          fontWeight: "bold",
          color: "white",
          textShadow: "0 0 60px rgba(139, 92, 246, 0.8)",
          animation: "countdownPop 1s ease-out"
        }}
      >
        {count}
      </div>
    </div>
  );
});

// Recording preview modal
const RecordingPreview = memo(function RecordingPreview({ 
  blob, 
  isOpen, 
  onClose, 
  onDownload, 
  onDiscard,
  duration 
}) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (blob && videoRef.current) {
      videoRef.current.src = URL.createObjectURL(blob);
    }
    return () => {
      if (videoRef.current?.src) {
        URL.revokeObjectURL(videoRef.current.src);
      }
    };
  }, [blob]);

  if (!isOpen || !blob) return null;

  const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);

  return (
    <div 
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        animation: "fadeIn 0.3s ease"
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: "90%",
          maxWidth: "900px",
          background: "linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
          boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 60px rgba(139, 92, 246, 0.1)",
          animation: "modalSlideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Video size={20} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "white" }}>
                Recording Complete
              </h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#a1a1aa" }}>
                {duration} • {fileSizeMB} MB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              borderRadius: "8px",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#a1a1aa",
              transition: "all 0.2s"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Preview */}
        <div style={{ padding: "24px", position: "relative" }}>
          <div style={{
            borderRadius: "12px",
            overflow: "hidden",
            background: "#000",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
          }}>
            <video
              ref={videoRef}
              controls
              style={{
                width: "100%",
                display: "block",
                maxHeight: "400px"
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "16px 24px 24px",
          display: "flex",
          gap: "12px",
          justifyContent: "flex-end"
        }}>
          <button
            onClick={onDiscard}
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
          >
            <Trash2 size={16} /> Discard
          </button>
          <button
            onClick={onDownload}
            style={{
              padding: "12px 28px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              color: "white",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
              transition: "all 0.2s"
            }}
          >
            <Download size={16} /> Download Video
          </button>
        </div>
      </div>
    </div>
  );
});

// Settings dropdown
const SettingsDropdown = memo(function SettingsDropdown({
  isOpen,
  onClose,
  quality,
  setQuality,
  captureMode,
  setCaptureMode,
  includeAudio,
  setIncludeAudio,
  includeSystemAudio,
  setIncludeSystemAudio
}) {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        right: 0,
        marginBottom: "12px",
        background: "linear-gradient(180deg, #1f1f2e 0%, #1a1a28 100%)",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        overflow: "hidden",
        animation: "slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "#a1a1aa", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Monitor size={14} /> Capture Mode
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {CAPTURE_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setCaptureMode(mode.id)}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: "10px",
                border: captureMode === mode.id 
                  ? "1px solid #8b5cf6" 
                  : mode.recommended 
                    ? "1px solid rgba(139, 92, 246, 0.3)" 
                    : "1px solid rgba(255,255,255,0.1)",
                background: captureMode === mode.id 
                  ? "rgba(139, 92, 246, 0.15)" 
                  : mode.recommended && captureMode !== mode.id
                    ? "rgba(139, 92, 246, 0.05)"
                    : "rgba(255,255,255,0.03)",
                color: captureMode === mode.id ? "#a78bfa" : "#a1a1aa",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                position: "relative"
              }}
            >
              {mode.recommended && (
                <span style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-4px",
                  background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                  color: "white",
                  fontSize: "8px",
                  fontWeight: "bold",
                  padding: "2px 6px",
                  borderRadius: "8px",
                  textTransform: "uppercase"
                }}>
                  Best
                </span>
              )}
              <mode.icon size={18} />
              <span style={{ fontWeight: "500" }}>{mode.label}</span>
            </button>
          ))}
        </div>
        <p style={{ 
          margin: "10px 0 0", 
          fontSize: "11px", 
          color: "#6b7280",
          textAlign: "center"
        }}>
          💡 "This Tab" lets you record your CodePlay coding session
        </p>
      </div>

      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "#a1a1aa", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={14} /> Quality
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {QUALITY_OPTIONS.map(q => (
            <button
              key={q.id}
              onClick={() => setQuality(q.id)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                border: quality === q.id ? "1px solid #22c55e" : "1px solid rgba(255,255,255,0.1)",
                background: quality === q.id ? "rgba(34, 197, 94, 0.15)" : "rgba(255,255,255,0.03)",
                color: quality === q.id ? "#4ade80" : "#a1a1aa",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "#a1a1aa", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Volume2 size={14} /> Audio
        </div>
        
        <label style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.03)",
          cursor: "pointer",
          marginBottom: "8px"
        }}>
          <span style={{ fontSize: "13px", color: "#e4e4e7" }}>Microphone</span>
          <div 
            onClick={(e) => { e.preventDefault(); setIncludeAudio(!includeAudio); }}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              background: includeAudio ? "#8b5cf6" : "rgba(255,255,255,0.1)",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.2s"
            }}
          >
            <div style={{
              position: "absolute",
              top: "2px",
              left: includeAudio ? "22px" : "2px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "white",
              transition: "left 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }} />
          </div>
        </label>

        <label style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.03)",
          cursor: "pointer",
          opacity: includeAudio ? 1 : 0.5
        }}>
          <span style={{ fontSize: "13px", color: "#e4e4e7" }}>System Audio</span>
          <div 
            onClick={(e) => { e.preventDefault(); if (includeAudio) setIncludeSystemAudio(!includeSystemAudio); }}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              background: includeSystemAudio && includeAudio ? "#8b5cf6" : "rgba(255,255,255,0.1)",
              position: "relative",
              cursor: includeAudio ? "pointer" : "not-allowed",
              transition: "background 0.2s"
            }}
          >
            <div style={{
              position: "absolute",
              top: "2px",
              left: (includeSystemAudio && includeAudio) ? "22px" : "2px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "white",
              transition: "left 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }} />
          </div>
        </label>
      </div>
    </div>
  );
});

// Main Recording Panel
const RecordingPanel = memo(function RecordingPanel({ onClose }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quality, setQuality] = useState("medium");
  const [captureMode, setCaptureMode] = useState("tab"); // Default to current tab
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);

  const {
    isRecording,
    isPaused,
    formattedTime,
    recordedBlob,
    recordingError,
    audioLevel,
    isPreviewOpen,
    countdownActive,
    countdown,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    downloadRecording,
    discardRecording,
    setIsPreviewOpen
  } = useScreenRecording();

  const handleStartRecording = () => {
    startRecording({
      includeAudio,
      includeSystemAudio,
      captureMode,
      quality,
      showCountdown: true
    });
    setSettingsOpen(false);
  };

  return (
    <>
      {/* Countdown Overlay */}
      <CountdownOverlay count={countdown} active={countdownActive} />

      {/* Recording Preview Modal */}
      <RecordingPreview
        blob={recordedBlob}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onDownload={() => {
          downloadRecording("codeplay-solution");
          setIsPreviewOpen(false);
        }}
        onDiscard={() => {
          discardRecording();
          setIsPreviewOpen(false);
        }}
        duration={formattedTime}
      />

      {/* Main Panel */}
      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-panel)"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: isRecording 
                ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" 
                : "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isRecording 
                ? "0 4px 20px rgba(239, 68, 68, 0.4)"
                : "0 4px 20px rgba(139, 92, 246, 0.3)"
            }}>
              {isRecording ? <Circle size={18} fill="white" color="white" /> : <Video size={18} color="white" />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "bold", color: "white" }}>
                {isRecording ? "Recording..." : "Solution Recording"}
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>
                {isRecording ? formattedTime : "Record your coding session"}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#666",
                cursor: "pointer",
                padding: "4px"
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Recording Status Card */}
          <div style={{
            background: isRecording 
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)"
              : "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)",
            borderRadius: "16px",
            padding: "24px",
            border: isRecording 
              ? "1px solid rgba(239, 68, 68, 0.2)"
              : "1px solid rgba(139, 92, 246, 0.2)",
            transition: "all 0.3s"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <RecordingPulse active={isRecording && !isPaused} />
                <span style={{ 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: isRecording ? "#fca5a5" : "#c4b5fd"
                }}>
                  {isRecording ? (isPaused ? "Paused" : "Recording") : "Ready"}
                </span>
              </div>
              
              {isRecording && (
                <div style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  fontFamily: "var(--font-mono)",
                  color: "white",
                  textShadow: isRecording && !isPaused ? "0 0 20px rgba(239, 68, 68, 0.5)" : "none"
                }}>
                  {formattedTime}
                </div>
              )}
            </div>

            {/* Audio Level Meter (when recording) */}
            {isRecording && includeAudio && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "10px"
              }}>
                <Mic size={16} color="#a1a1aa" />
                <AudioMeter level={audioLevel} />
                <span style={{ fontSize: "11px", color: "#a1a1aa", marginLeft: "auto" }}>
                  {Math.round(audioLevel)}%
                </span>
              </div>
            )}

            {/* Pre-recording info */}
            {!isRecording && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a1a1aa" }}>
                  <Check size={14} color="#22c55e" />
                  <span>
                    {captureMode === "tab" 
                      ? "📹 Record this CodePlay tab" 
                      : CAPTURE_MODES.find(m => m.id === captureMode)?.label || "Screen"} capture
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a1a1aa" }}>
                  <Check size={14} color="#22c55e" />
                  <span>
                    {QUALITY_OPTIONS.find(q => q.id === quality)?.label || "1080p"} quality
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a1a1aa" }}>
                  {includeAudio ? (
                    <>
                      <Check size={14} color="#22c55e" />
                      <span>🎤 Microphone {includeSystemAudio ? "& system audio" : "audio"}</span>
                    </>
                  ) : (
                    <>
                      <MicOff size={14} color="#ef4444" />
                      <span>No audio</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {recordingError && (
            <div style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "10px",
              padding: "12px 16px",
              fontSize: "13px",
              color: "#fca5a5",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <VideoOff size={16} />
              {recordingError}
            </div>
          )}

          {/* Tips (when not recording) */}
          {!isRecording && (
            <div style={{
              background: "rgba(255,255,255,0.02)",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid rgba(255,255,255,0.05)"
            }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "600", color: "#e4e4e7" }}>
                💡 How to record your solution
              </h4>
              <ul style={{ margin: 0, padding: "0 0 0 20px", fontSize: "12px", color: "#a1a1aa", lineHeight: "1.8" }}>
                <li>Click <strong>Start Recording</strong> below</li>
                <li>Select <strong>"This Tab"</strong> when the browser prompt appears</li>
                <li>Check <strong>"Share tab audio"</strong> if you want system sounds</li>
                <li>Code and explain your solution!</li>
              </ul>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Control Buttons */}
          <div style={{ position: "relative" }}>
            {/* Settings Dropdown */}
            <SettingsDropdown
              isOpen={settingsOpen && !isRecording}
              onClose={() => setSettingsOpen(false)}
              quality={quality}
              setQuality={setQuality}
              captureMode={captureMode}
              setCaptureMode={setCaptureMode}
              includeAudio={includeAudio}
              setIncludeAudio={setIncludeAudio}
              includeSystemAudio={includeSystemAudio}
              setIncludeSystemAudio={setIncludeSystemAudio}
            />

            {isRecording ? (
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.2s"
                  }}
                >
                  {isPaused ? <Play size={18} /> : <Pause size={18} />}
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={stopRecording}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 20px rgba(239, 68, 68, 0.4)",
                    transition: "all 0.2s"
                  }}
                >
                  <Square size={16} fill="white" />
                  Stop
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: settingsOpen ? "rgba(139, 92, 246, 0.15)" : "rgba(255,255,255,0.05)",
                    color: settingsOpen ? "#a78bfa" : "#a1a1aa",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <Settings size={18} />
                </button>
                <button
                  onClick={handleStartRecording}
                  style={{
                    flex: 1,
                    padding: "14px 24px",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
                    transition: "all 0.2s, transform 0.1s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <Video size={18} />
                  Start Recording
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 1; }
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        
        @keyframes countdownPop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes modalSlideIn {
          from { transform: translateY(30px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
});

export default RecordingPanel;
