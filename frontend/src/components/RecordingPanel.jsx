import React, { memo, useState, useRef, useEffect } from "react";
import { 
  Video, VideoOff, Pause, Play, Square, Download, Trash2, 
  Mic, MicOff, Monitor, AppWindow, Chrome, X, Settings,
  Circle, Volume2, VolumeX, Eye, Check, ChevronDown, Sparkles,
  Camera, CameraOff, Move
} from "lucide-react";

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
  duration,
  isRecording
}) {
  const videoRef = useRef(null);
  const durationFixRef = useRef(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Create blob URL when blob changes
  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setIsLoaded(false);
      setCurrentTime(0);
      setVideoDuration(0);
      setIsPlaying(false);
      durationFixRef.current = false;
      
      return () => {
        URL.revokeObjectURL(url);
        setVideoUrl(null);
      };
    }
  }, [blob]);

  // Load video when URL is ready
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    if (isFinite(videoRef.current.currentTime)) {
      setCurrentTime(videoRef.current.currentTime);
    }

    const dur = videoRef.current.duration;
    if ((!isFinite(videoDuration) || videoDuration <= 0) && isFinite(dur) && dur > 0) {
      setVideoDuration(dur);
      setIsLoaded(true);
    }

    if (durationFixRef.current && isFinite(dur) && dur > 0 && videoRef.current.currentTime > dur) {
      durationFixRef.current = false;
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (isFinite(dur) && dur > 0) {
      setVideoDuration(dur);
      setIsLoaded(true);
      return;
    }
    if (!durationFixRef.current) {
      durationFixRef.current = true;
      try {
        videoRef.current.currentTime = 1e101;
      } catch {}
    }
  };

  const handleLoadedData = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (isFinite(dur) && dur > 0) {
      setVideoDuration(dur);
      setIsLoaded(true);
    }
  };

  const handleCanPlay = () => {
    setIsLoaded(true);
  };

  const handleDurationChange = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (isFinite(dur) && dur > 0) {
      setVideoDuration(dur);
    }
  };

  const handleSeeked = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (durationFixRef.current && isFinite(dur) && dur > 0) {
      durationFixRef.current = false;
      setVideoDuration(dur);
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      videoRef.current.pause();
      setIsPlaying(false);
      setIsLoaded(true);
    }
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;

    const duration = (isFinite(videoRef.current.duration) && videoRef.current.duration > 0)
      ? videoRef.current.duration
      : videoDuration;

    if (!isFinite(duration) || duration <= 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    
    if (isFinite(newTime)) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current && isLoaded) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time) => {
    if (!isFinite(time) || time < 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording || !isOpen || !blob) return null;

  const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
  const effectiveDuration = (isFinite(videoDuration) && videoDuration > 0)
    ? videoDuration
    : (videoRef.current && isFinite(videoRef.current.duration) ? videoRef.current.duration : 0);
  const progress = (isFinite(effectiveDuration) && effectiveDuration > 0 && isFinite(currentTime)) 
    ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) 
    : 0;

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

        {/* Video Preview with Custom Controls */}
        <div style={{ padding: "24px", position: "relative" }}>
          <div style={{
            borderRadius: "12px",
            overflow: "hidden",
            background: "#000",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            position: "relative",
            minHeight: "300px"
          }}>
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                preload="auto"
                playsInline
                style={{
                  width: "100%",
                  display: "block",
                  maxHeight: "450px",
                  minHeight: "300px",
                  cursor: "pointer",
                  objectFit: "contain",
                  background: "#000"
                }}
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={handleLoadedData}
                onCanPlay={handleCanPlay}
                onDurationChange={handleDurationChange}
                onSeeked={handleSeeked}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              <div style={{
                minHeight: "300px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666"
              }}>
                Loading video...
              </div>
            )}
            
            {/* Loading indicator */}
            {videoUrl && !isLoaded && (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.5)"
              }}>
                <div style={{ color: "#fff", fontSize: "14px" }}>Loading video...</div>
              </div>
            )}
            
            {/* Custom Controls Overlay */}
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
              padding: "20px 16px 12px"
            }}>
              {/* Progress Bar */}
              <div 
                onClick={handleSeek}
                style={{
                  height: "6px",
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: "3px",
                  cursor: isLoaded ? "pointer" : "not-allowed",
                  marginBottom: "12px",
                  position: "relative",
                  opacity: isLoaded ? 1 : 0.5,
                  pointerEvents: isLoaded ? "auto" : "none"
                }}
              >
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #8b5cf6, #ec4899)",
                  borderRadius: "3px",
                  transition: "width 0.1s linear"
                }} />
                <div style={{
                  position: "absolute",
                  left: `${progress}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "14px",
                  height: "14px",
                  background: "white",
                  borderRadius: "50%",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
                }} />
              </div>
              
              {/* Controls */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    onClick={togglePlay}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      border: "none",
                      borderRadius: "50%",
                      width: "36px",
                      height: "36px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "white"
                    }}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} fill="white" />}
                  </button>
                  
                  <button
                    onClick={toggleMute}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "white",
                      padding: "4px"
                    }}
                  >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  
                  <span style={{ fontSize: "13px", color: "white", fontFamily: "var(--font-mono)" }}>
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Play Button Overlay (when paused) */}
            {!isPlaying && (
              <div 
                onClick={togglePlay}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "70px",
                  height: "70px",
                  borderRadius: "50%",
                  background: "rgba(139, 92, 246, 0.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isLoaded ? "pointer" : "not-allowed",
                  boxShadow: "0 4px 20px rgba(139, 92, 246, 0.5)"
                }}
              >
                <Play size={30} fill="white" color="white" style={{ marginLeft: "4px" }} />
              </div>
            )}
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
  setIncludeSystemAudio,
  includeWebcam,
  setIncludeWebcam,
  webcamEnabled,
  toggleWebcam,
  webcamPosition,
  setWebcamPosition,
  webcamStream,
  webcamPreviewRef
}) {
  if (!isOpen) return null;

  const webcamPositions = [
    { id: "bottom-right", label: "↘️" },
    { id: "bottom-left", label: "↙️" },
    { id: "top-right", label: "↗️" },
    { id: "top-left", label: "↖️" }
  ];

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
        animation: "slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        maxHeight: "70vh",
        overflowY: "auto"
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

      {/* Webcam / Camera Section */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "#a1a1aa", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Camera size={14} /> Camera (Picture-in-Picture)
        </div>
        
        <label style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: "8px",
          background: includeWebcam ? "rgba(139, 92, 246, 0.1)" : "rgba(255,255,255,0.03)",
          cursor: "pointer",
          marginBottom: "12px",
          border: includeWebcam ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid transparent"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {includeWebcam ? <Camera size={16} color="#a78bfa" /> : <CameraOff size={16} color="#6b7280" />}
            <span style={{ fontSize: "13px", color: includeWebcam ? "#e4e4e7" : "#a1a1aa" }}>
              Show Webcam
            </span>
          </div>
          <div 
            onClick={(e) => { 
              e.preventDefault(); 
              setIncludeWebcam(!includeWebcam);
              if (!includeWebcam && !webcamEnabled) {
                toggleWebcam();
              }
            }}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              background: includeWebcam ? "linear-gradient(135deg, #8b5cf6, #ec4899)" : "rgba(255,255,255,0.1)",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.2s"
            }}
          >
            <div style={{
              position: "absolute",
              top: "2px",
              left: includeWebcam ? "22px" : "2px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "white",
              transition: "left 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }} />
          </div>
        </label>

        {/* Webcam Preview & Position */}
        {includeWebcam && (
          <div style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: "12px",
            padding: "12px",
            animation: "fadeIn 0.3s ease"
          }}>
            {/* Preview */}
            <div style={{
              position: "relative",
              width: "100%",
              height: "120px",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#000",
              marginBottom: "12px"
            }}>
              {webcamStream ? (
                <video
                  ref={webcamPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)" // Mirror effect
                  }}
                />
              ) : (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#6b7280",
                  fontSize: "12px"
                }}>
                  <CameraOff size={24} style={{ marginRight: "8px" }} />
                  Camera not available
                </div>
              )}
              
              {/* Position indicator overlay */}
              <div style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none"
              }}>
                <div style={{
                  position: "absolute",
                  width: "40px",
                  height: "30px",
                  border: "2px dashed rgba(139, 92, 246, 0.6)",
                  borderRadius: "4px",
                  ...(webcamPosition === "bottom-right" && { bottom: "8px", right: "8px" }),
                  ...(webcamPosition === "bottom-left" && { bottom: "8px", left: "8px" }),
                  ...(webcamPosition === "top-right" && { top: "8px", right: "8px" }),
                  ...(webcamPosition === "top-left" && { top: "8px", left: "8px" })
                }} />
              </div>
            </div>

            {/* Position Selector */}
            <div>
              <div style={{ 
                fontSize: "11px", 
                color: "#6b7280", 
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <Move size={12} /> Position
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {webcamPositions.map(pos => (
                  <button
                    key={pos.id}
                    onClick={() => setWebcamPosition(pos.id)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: "8px",
                      border: webcamPosition === pos.id 
                        ? "1px solid #8b5cf6" 
                        : "1px solid rgba(255,255,255,0.1)",
                      background: webcamPosition === pos.id 
                        ? "rgba(139, 92, 246, 0.2)" 
                        : "rgba(255,255,255,0.03)",
                      fontSize: "16px",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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

// Main Recording Panel - Now receives recording state as props
const RecordingPanel = memo(function RecordingPanel({ 
  onClose,
  // Recording state from parent
  isRecording,
  isPaused,
  formattedTime,
  recordedBlob,
  recordingError,
  audioLevel,
  isPreviewOpen,
  countdownActive,
  countdown,
  // Webcam state from parent
  webcamEnabled,
  webcamStream,
  webcamPosition,
  // Recording actions from parent
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  downloadRecording,
  discardRecording,
  setIsPreviewOpen,
  // Webcam actions from parent
  toggleWebcam,
  setWebcamPosition
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quality, setQuality] = useState("medium");
  const [captureMode, setCaptureMode] = useState("tab"); // Default to current tab
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [includeWebcam, setIncludeWebcam] = useState(false);
  const webcamPreviewRef = useRef(null);

  // Update webcam preview
  useEffect(() => {
    if (webcamPreviewRef.current && webcamStream) {
      webcamPreviewRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  const handleStartRecording = () => {
    startRecording({
      includeAudio,
      includeSystemAudio,
      captureMode,
      quality,
      showCountdown: true,
      includeWebcam
    });
    setSettingsOpen(false);
  };

  return (
    <>
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a1a1aa" }}>
                  {includeWebcam ? (
                    <>
                      <Check size={14} color="#22c55e" />
                      <span>📷 Camera overlay enabled</span>
                    </>
                  ) : (
                    <>
                      <CameraOff size={14} color="#6b7280" />
                      <span>No camera</span>
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
              includeWebcam={includeWebcam}
              setIncludeWebcam={setIncludeWebcam}
              webcamEnabled={webcamEnabled}
              toggleWebcam={toggleWebcam}
              webcamPosition={webcamPosition}
              setWebcamPosition={setWebcamPosition}
              webcamStream={webcamStream}
              webcamPreviewRef={webcamPreviewRef}
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

// Export components for use in Workspace
export { CountdownOverlay, RecordingPreview };
export default RecordingPanel;