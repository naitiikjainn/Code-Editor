import React, { memo, useState, useRef, useEffect } from "react";
import { 
  Video, VideoOff, Pause, Play, Square, Download, Trash2, 
  Mic, MicOff, Monitor, AppWindow, Chrome, X, Settings,
  Circle, Volume2, VolumeX, Check, Sparkles,
  Camera, CameraOff, Move, Clock, HardDrive,
  RotateCcw, Maximize2, Zap
} from "lucide-react";

// Recording quality options
const QUALITY_OPTIONS = [
  { id: "low", label: "720p", bitrate: "1 Mbps", icon: "📱" },
  { id: "medium", label: "1080p", bitrate: "2.5 Mbps", icon: "💻" },
  { id: "high", label: "1080p HD", bitrate: "5 Mbps", icon: "🎬" }
];

// Capture mode options
const CAPTURE_MODES = [
  { id: "tab", label: "This Tab", icon: Chrome, recommended: true },
  { id: "screen", label: "Full Screen", icon: Monitor },
  { id: "window", label: "Application", icon: AppWindow }
];

// Animated recording indicator
const RecordingPulse = memo(function RecordingPulse({ active }) {
  return (
    <div style={{ position: "relative", width: "12px", height: "12px" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: active ? "#ef4444" : "#6b7280", transition: "background 0.3s" }} />
      {active && (
        <>
          <div style={{ position: "absolute", inset: "-4px", borderRadius: "50%", border: "2px solid #ef4444", animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }} />
          <div style={{ position: "absolute", inset: "-8px", borderRadius: "50%", border: "1px solid #ef4444", opacity: 0.5, animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s" }} />
        </>
      )}
    </div>
  );
});

// Audio level meter with wave effect
const AudioMeter = memo(function AudioMeter({ level }) {
  const bars = 16;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "24px" }}>
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i / bars) * 100;
        const isActive = level > threshold;
        const isHigh = i >= bars * 0.75;
        const isMedium = i >= bars * 0.45;
        return (
          <div key={i} style={{
            width: "3px", height: `${30 + (i * (70 / bars))}%`, borderRadius: "2px",
            background: isActive ? (isHigh ? "#ef4444" : isMedium ? "#eab308" : "#22c55e") : "rgba(255,255,255,0.08)",
            transition: "background 0.05s, transform 0.08s",
            transform: isActive ? "scaleY(1)" : "scaleY(0.5)", transformOrigin: "bottom"
          }} />
        );
      })}
    </div>
  );
});

// Countdown overlay
const CountdownOverlay = memo(function CountdownOverlay({ count, active }) {
  if (!active) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10000, gap: "20px"
    }}>
      <div key={count} style={{
        fontSize: "140px", fontWeight: "800", color: "white",
        textShadow: "0 0 80px rgba(139, 92, 246, 0.8), 0 0 40px rgba(236, 72, 153, 0.5)",
        animation: "countdownPop 1s ease-out", lineHeight: 1, fontFamily: "var(--font-mono)"
      }}>{count}</div>
      <div style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", fontWeight: "500", letterSpacing: "3px", textTransform: "uppercase" }}>
        Get Ready
      </div>
    </div>
  );
});

// Control button style helper
const ctrlBtn = {
  background: "transparent", border: "none", borderRadius: "8px", width: "34px", height: "34px",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white", transition: "background 0.15s", padding: 0
};

// Enhanced Recording preview modal
const RecordingPreview = memo(function RecordingPreview({ blob, isOpen, onClose, onDownload, onDiscard, duration, isRecording }) {
  const videoRef = useRef(null);
  const durationFixRef = useRef(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setIsLoaded(false); setCurrentTime(0); setVideoDuration(0); setIsPlaying(false);
      durationFixRef.current = false;
      return () => { URL.revokeObjectURL(url); setVideoUrl(null); };
    }
  }, [blob]);

  useEffect(() => { if (videoUrl && videoRef.current) videoRef.current.load(); }, [videoUrl]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    if (isFinite(videoRef.current.currentTime)) setCurrentTime(videoRef.current.currentTime);
    const dur = videoRef.current.duration;
    if ((!isFinite(videoDuration) || videoDuration <= 0) && isFinite(dur) && dur > 0) { setVideoDuration(dur); setIsLoaded(true); }
    if (durationFixRef.current && isFinite(dur) && dur > 0 && videoRef.current.currentTime > dur) {
      durationFixRef.current = false; videoRef.current.currentTime = 0; setCurrentTime(0); videoRef.current.pause(); setIsPlaying(false);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (isFinite(dur) && dur > 0) { setVideoDuration(dur); setIsLoaded(true); return; }
    if (!durationFixRef.current) { durationFixRef.current = true; try { videoRef.current.currentTime = 1e101; } catch {} }
  };

  const handleSeeked = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (durationFixRef.current && isFinite(dur) && dur > 0) {
      durationFixRef.current = false; setVideoDuration(dur); videoRef.current.currentTime = 0;
      setCurrentTime(0); videoRef.current.pause(); setIsPlaying(false); setIsLoaded(true);
    }
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const d = (isFinite(videoRef.current.duration) && videoRef.current.duration > 0) ? videoRef.current.duration : videoDuration;
    if (!isFinite(d) || d <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * d;
    if (isFinite(newTime)) { videoRef.current.currentTime = newTime; setCurrentTime(newTime); }
  };

  const togglePlay = () => { if (videoRef.current && isLoaded) { isPlaying ? videoRef.current.pause() : videoRef.current.play(); } };
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } };

  const changeSpeed = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  const skipBack = () => { if (videoRef.current) { const t = Math.max(videoRef.current.currentTime - 10, 0); videoRef.current.currentTime = t; setCurrentTime(t); } };
  const skipFwd = () => { if (videoRef.current) { const t = Math.min(videoRef.current.currentTime + 10, videoDuration); videoRef.current.currentTime = t; setCurrentTime(t); } };

  const handleVolChange = (e) => {
    const v = parseFloat(e.target.value); setVolume(v);
    if (videoRef.current) { videoRef.current.volume = v; setIsMuted(v === 0); }
  };

  const goFullscreen = () => {
    if (videoRef.current?.requestFullscreen) videoRef.current.requestFullscreen();
    else if (videoRef.current?.webkitRequestFullscreen) videoRef.current.webkitRequestFullscreen();
  };

  const fmt = (t) => { if (!isFinite(t) || t < 0) return "0:00"; return `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`; };

  if (isRecording || !isOpen || !blob) return null;

  const mb = (blob.size / (1024 * 1024)).toFixed(2);
  const eff = (isFinite(videoDuration) && videoDuration > 0) ? videoDuration : (videoRef.current && isFinite(videoRef.current.duration) ? videoRef.current.duration : 0);
  const pct = (isFinite(eff) && eff > 0 && isFinite(currentTime)) ? Math.min(100, Math.max(0, (currentTime / eff) * 100)) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, animation: "fadeIn 0.3s ease" }} onClick={onClose}>
      <div style={{
        width: "92%", maxWidth: "960px", background: "linear-gradient(180deg, #111117 0%, #0d0d14 100%)",
        borderRadius: "24px", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
        boxShadow: "0 30px 100px rgba(0,0,0,0.6), 0 0 80px rgba(139, 92, 246, 0.08)",
        animation: "modalSlideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "14px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)"
            }}>
              <Video size={22} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "white", letterSpacing: "-0.02em" }}>Recording Complete ✨</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "3px" }}>
                <span style={{ fontSize: "13px", color: "#a1a1aa", display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {duration}</span>
                <span style={{ fontSize: "13px", color: "#a1a1aa", display: "flex", alignItems: "center", gap: "4px" }}><HardDrive size={12} /> {mb} MB</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: "10px", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#71717a" }}><X size={18} /></button>
        </div>

        {/* Video */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ borderRadius: "16px", overflow: "hidden", background: "#000", boxShadow: "0 12px 40px rgba(0,0,0,0.4)", position: "relative", minHeight: "300px" }}
            onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
            {videoUrl ? (
              <video ref={videoRef} src={videoUrl} preload="auto" playsInline
                style={{ width: "100%", display: "block", maxHeight: "480px", minHeight: "300px", cursor: "pointer", objectFit: "contain", background: "#000" }}
                onClick={togglePlay} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={() => { if (videoRef.current) { const d = videoRef.current.duration; if (isFinite(d) && d > 0) { setVideoDuration(d); setIsLoaded(true); } } }}
                onCanPlay={() => setIsLoaded(true)}
                onDurationChange={() => { if (videoRef.current) { const d = videoRef.current.duration; if (isFinite(d) && d > 0) setVideoDuration(d); } }}
                onSeeked={handleSeeked} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
            ) : (
              <div style={{ minHeight: "300px", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>Loading video...</div>
            )}
            
            {videoUrl && !isLoaded && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
                <div style={{ color: "#fff", fontSize: "14px" }}>Loading...</div>
              </div>
            )}
            
            {/* Controls overlay */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
              padding: "30px 16px 14px",
              opacity: isHovering || !isPlaying ? 1 : 0, transition: "opacity 0.3s"
            }}>
              {/* Progress */}
              <div onClick={handleSeek} style={{
                height: "5px", background: "rgba(255,255,255,0.15)", borderRadius: "3px",
                cursor: isLoaded ? "pointer" : "not-allowed", marginBottom: "12px",
                position: "relative", opacity: isLoaded ? 1 : 0.5
              }}
                onMouseEnter={e => e.currentTarget.style.height = "8px"}
                onMouseLeave={e => e.currentTarget.style.height = "5px"}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #8b5cf6, #ec4899)", borderRadius: "3px" }} />
                <div style={{
                  position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)",
                  width: "14px", height: "14px", background: "white", borderRadius: "50%", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  opacity: isHovering ? 1 : 0, transition: "opacity 0.2s"
                }} />
              </div>
              
              {/* Controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button onClick={skipBack} style={ctrlBtn} title="Back 10s"><RotateCcw size={16} /></button>
                  <button onClick={togglePlay} style={{ ...ctrlBtn, width: "40px", height: "40px", background: "rgba(255,255,255,0.15)", borderRadius: "50%" }}>
                    {isPlaying ? <Pause size={18} /> : <Play size={18} fill="white" style={{ marginLeft: "2px" }} />}
                  </button>
                  <button onClick={skipFwd} style={ctrlBtn} title="Forward 10s"><RotateCcw size={16} style={{ transform: "scaleX(-1)" }} /></button>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "4px" }}>
                    <button onClick={toggleMute} style={ctrlBtn}>{isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
                    <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolChange}
                      style={{ width: "60px", accentColor: "#8b5cf6", cursor: "pointer" }} />
                  </div>
                  <span style={{ fontSize: "13px", color: "white", fontFamily: "var(--font-mono)", marginLeft: "8px" }}>{fmt(currentTime)} / {fmt(videoDuration)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button onClick={changeSpeed} style={{ ...ctrlBtn, fontSize: "12px", fontWeight: "700", minWidth: "40px", fontFamily: "var(--font-mono)" }}>{playbackSpeed}x</button>
                  <button onClick={goFullscreen} style={ctrlBtn} title="Fullscreen"><Maximize2 size={16} /></button>
                </div>
              </div>
            </div>
            
            {/* Center play */}
            {!isPlaying && isLoaded && (
              <div onClick={togglePlay} style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                width: "72px", height: "72px", borderRadius: "50%",
                background: "rgba(139, 92, 246, 0.9)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                boxShadow: "0 8px 30px rgba(139, 92, 246, 0.5)"
              }}>
                <Play size={30} fill="white" color="white" style={{ marginLeft: "4px" }} />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "16px 24px 24px", display: "flex", gap: "12px", justifyContent: "flex-end", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "12px", color: "#52525b", background: "rgba(255,255,255,0.03)", padding: "6px 12px", borderRadius: "8px" }}>WebM • {QUALITY_OPTIONS.find(q => q.id === "medium")?.label}</span>
          </div>
          <button onClick={onDiscard} style={{
            padding: "12px 24px", borderRadius: "12px", border: "1px solid rgba(239, 68, 68, 0.25)",
            background: "rgba(239, 68, 68, 0.08)", color: "#ef4444", fontSize: "14px", fontWeight: "600",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
          }}><Trash2 size={16} /> Discard</button>
          <button onClick={onDownload} style={{
            padding: "12px 32px", borderRadius: "12px", border: "none",
            background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            color: "white", fontSize: "14px", fontWeight: "600", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "8px",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)"
          }}><Download size={16} /> Download Video</button>
        </div>
      </div>
    </div>
  );
});

// Toggle Switch component
const ToggleSwitch = ({ enabled, onChange, color = "#8b5cf6" }) => (
  <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(!enabled); }}
    style={{
      width: "44px", height: "24px", borderRadius: "12px",
      background: enabled ? `linear-gradient(135deg, ${color}, ${color}dd)` : "rgba(255,255,255,0.08)",
      position: "relative", cursor: "pointer", transition: "background 0.25s",
      boxShadow: enabled ? `0 2px 12px ${color}40` : "none"
    }}>
    <div style={{
      position: "absolute", top: "2px", left: enabled ? "22px" : "2px",
      width: "20px", height: "20px", borderRadius: "50%", background: "white",
      transition: "left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
    }} />
  </div>
);

// Settings dropdown
const SettingsDropdown = memo(function SettingsDropdown({
  isOpen, onClose, quality, setQuality, captureMode, setCaptureMode,
  includeAudio, setIncludeAudio, includeSystemAudio, setIncludeSystemAudio,
  includeWebcam, setIncludeWebcam, webcamEnabled, toggleWebcam,
  webcamPosition, setWebcamPosition, webcamStream, webcamPreviewRef
}) {
  if (!isOpen) return null;

  const positions = [
    { id: "bottom-right", label: "↘️" }, { id: "bottom-left", label: "↙️" },
    { id: "top-right", label: "↗️" }, { id: "top-left", label: "↖️" }
  ];

  const sectionLabel = { fontSize: "12px", fontWeight: "700", color: "#52525b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px", textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <div style={{
      position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: "12px",
      background: "linear-gradient(180deg, #18181f 0%, #141418 100%)",
      borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 24px 60px rgba(0,0,0,0.6)", overflow: "hidden",
      animation: "slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      maxHeight: "70vh", overflowY: "auto"
    }} onClick={e => e.stopPropagation()}>

      {/* Capture Mode */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={sectionLabel}><Monitor size={13} /> Capture Source</div>
        <div style={{ display: "flex", gap: "8px" }}>
          {CAPTURE_MODES.map(mode => (
            <button key={mode.id} onClick={() => setCaptureMode(mode.id)}
              style={{
                flex: 1, padding: "12px 8px", borderRadius: "12px",
                border: captureMode === mode.id ? "1px solid rgba(139, 92, 246, 0.5)" : "1px solid rgba(255,255,255,0.06)",
                background: captureMode === mode.id ? "rgba(139, 92, 246, 0.12)" : "rgba(255,255,255,0.02)",
                color: captureMode === mode.id ? "#c4b5fd" : "#71717a",
                fontSize: "12px", cursor: "pointer", transition: "all 0.2s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", position: "relative"
              }}>
              {mode.recommended && (
                <span style={{
                  position: "absolute", top: "-7px", right: "-4px",
                  background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                  color: "white", fontSize: "7px", fontWeight: "800",
                  padding: "2px 6px", borderRadius: "8px", textTransform: "uppercase"
                }}>Best</span>
              )}
              <mode.icon size={18} />
              <span style={{ fontWeight: "600" }}>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Camera PiP */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={sectionLabel}><Camera size={13} /> Camera Overlay</div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderRadius: "10px",
          background: includeWebcam ? "rgba(139, 92, 246, 0.08)" : "rgba(255,255,255,0.02)",
          border: includeWebcam ? "1px solid rgba(139, 92, 246, 0.2)" : "1px solid transparent",
          marginBottom: includeWebcam ? "12px" : 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {includeWebcam ? <Camera size={16} color="#a78bfa" /> : <CameraOff size={16} color="#52525b" />}
            <span style={{ fontSize: "13px", color: includeWebcam ? "#e4e4e7" : "#71717a", fontWeight: "500" }}>Picture-in-Picture</span>
          </div>
          <ToggleSwitch enabled={includeWebcam} onChange={(val) => { setIncludeWebcam(val); if (val && !webcamEnabled) toggleWebcam(); }} />
        </div>
        {includeWebcam && (
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "12px", animation: "fadeIn 0.3s ease" }}>
            <div style={{ position: "relative", width: "100%", height: "110px", borderRadius: "10px", overflow: "hidden", background: "#000", marginBottom: "10px" }}>
              {webcamStream ? (
                <video ref={webcamPreviewRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#52525b", fontSize: "12px" }}><CameraOff size={20} style={{ marginRight: "8px" }} /> No camera</div>
              )}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <div style={{
                  position: "absolute", width: "40px", height: "30px", border: "2px dashed rgba(139, 92, 246, 0.6)", borderRadius: "4px",
                  ...(webcamPosition === "bottom-right" && { bottom: "8px", right: "8px" }),
                  ...(webcamPosition === "bottom-left" && { bottom: "8px", left: "8px" }),
                  ...(webcamPosition === "top-right" && { top: "8px", right: "8px" }),
                  ...(webcamPosition === "top-left" && { top: "8px", left: "8px" })
                }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {positions.map(pos => (
                <button key={pos.id} onClick={() => setWebcamPosition(pos.id)} style={{
                  flex: 1, padding: "8px", borderRadius: "8px",
                  border: webcamPosition === pos.id ? "1px solid rgba(139, 92, 246, 0.5)" : "1px solid rgba(255,255,255,0.06)",
                  background: webcamPosition === pos.id ? "rgba(139, 92, 246, 0.15)" : "rgba(255,255,255,0.02)",
                  fontSize: "16px", cursor: "pointer"
                }}>{pos.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quality */}
      <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={sectionLabel}><Sparkles size={13} /> Quality</div>
        <div style={{ display: "flex", gap: "8px" }}>
          {QUALITY_OPTIONS.map(q => (
            <button key={q.id} onClick={() => setQuality(q.id)} style={{
              flex: 1, padding: "10px 8px", borderRadius: "10px",
              border: quality === q.id ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(255,255,255,0.06)",
              background: quality === q.id ? "rgba(34, 197, 94, 0.1)" : "rgba(255,255,255,0.02)",
              color: quality === q.id ? "#4ade80" : "#71717a",
              fontSize: "12px", fontWeight: "600", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "4px"
            }}>
              <span style={{ fontSize: "16px" }}>{q.icon}</span>
              <span>{q.label}</span>
              <span style={{ fontSize: "9px", color: "#3f3f46" }}>{q.bitrate}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Audio */}
      <div style={{ padding: "18px 20px" }}>
        <div style={sectionLabel}><Volume2 size={13} /> Audio</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {includeAudio ? <Mic size={15} color="#22c55e" /> : <MicOff size={15} color="#52525b" />}
            <span style={{ fontSize: "13px", color: "#e4e4e7", fontWeight: "500" }}>Microphone</span>
          </div>
          <ToggleSwitch enabled={includeAudio} onChange={setIncludeAudio} color="#22c55e" />
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)",
          opacity: includeAudio ? 1 : 0.4, pointerEvents: includeAudio ? "auto" : "none"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Volume2 size={15} color={includeSystemAudio && includeAudio ? "#3b82f6" : "#52525b"} />
            <span style={{ fontSize: "13px", color: "#e4e4e7", fontWeight: "500" }}>System Audio</span>
          </div>
          <ToggleSwitch enabled={includeSystemAudio && includeAudio} onChange={setIncludeSystemAudio} color="#3b82f6" />
        </div>
      </div>
    </div>
  );
});

// Main Recording Panel
const RecordingPanel = memo(function RecordingPanel({ 
  onClose, isRecording, isPaused, formattedTime, recordedBlob, recordingError,
  audioLevel, isPreviewOpen, countdownActive, countdown,
  webcamEnabled, webcamStream, webcamPosition,
  startRecording, pauseRecording, resumeRecording, stopRecording,
  downloadRecording, discardRecording, setIsPreviewOpen,
  toggleWebcam, setWebcamPosition
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quality, setQuality] = useState("medium");
  const [captureMode, setCaptureMode] = useState("tab");
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [includeWebcam, setIncludeWebcam] = useState(false);
  const webcamPreviewRef = useRef(null);

  useEffect(() => {
    if (webcamPreviewRef.current && webcamStream) webcamPreviewRef.current.srcObject = webcamStream;
  }, [webcamStream]);

  const handleStart = () => {
    startRecording({ includeAudio, includeSystemAudio, captureMode, quality, showCountdown: true, includeWebcam });
    setSettingsOpen(false);
  };

  const estMB = { low: 7.5, medium: 18.75, high: 37.5 }[quality] || 18.75;

  return (
    <>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-panel)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "12px",
              background: isRecording ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: isRecording ? "0 4px 24px rgba(239, 68, 68, 0.4)" : "0 4px 20px rgba(139, 92, 246, 0.3)",
              transition: "all 0.3s"
            }}>
              {isRecording ? <Circle size={18} fill="white" color="white" /> : <Video size={18} color="white" />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "white" }}>
                {isRecording ? (isPaused ? "Paused" : "Recording") : "Screen Recorder"}
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#71717a" }}>
                {isRecording ? formattedTime : "Record your coding session"}
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.04)", border: "none", color: "#52525b", cursor: "pointer", padding: "6px", borderRadius: "8px" }}><X size={16} /></button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
          
          {/* Status Card */}
          <div style={{
            background: isRecording 
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.03))"
              : "linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(124, 58, 237, 0.03))",
            borderRadius: "16px", padding: "20px",
            border: isRecording ? "1px solid rgba(239, 68, 68, 0.15)" : "1px solid rgba(139, 92, 246, 0.15)"
          }}>
            {isRecording ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <RecordingPulse active={!isPaused} />
                    <span style={{ fontSize: "13px", fontWeight: "600", color: isPaused ? "#fcd34d" : "#fca5a5" }}>
                      {isPaused ? "Paused" : "Recording"}
                    </span>
                  </div>
                  <div style={{
                    fontSize: "32px", fontWeight: "800", fontFamily: "var(--font-mono)",
                    color: "white", letterSpacing: "1px", lineHeight: 1,
                    textShadow: !isPaused ? "0 0 30px rgba(239, 68, 68, 0.4)" : "none"
                  }}>{formattedTime}</div>
                </div>
                {includeAudio && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "rgba(0,0,0,0.15)", borderRadius: "10px" }}>
                    <Mic size={14} color={audioLevel > 30 ? "#22c55e" : "#52525b"} />
                    <AudioMeter level={audioLevel} />
                    <span style={{ fontSize: "10px", color: "#52525b", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>{Math.round(audioLevel)}%</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { ok: true, text: captureMode === "tab" ? "📹 Current tab (CodePlay)" : `${CAPTURE_MODES.find(m => m.id === captureMode)?.label} capture` },
                    { ok: true, text: `${QUALITY_OPTIONS.find(q => q.id === quality)?.label} • ${QUALITY_OPTIONS.find(q => q.id === quality)?.bitrate}` },
                    { ok: includeAudio, text: includeAudio ? `🎤 Mic${includeSystemAudio ? " + 🔊 System" : ""}` : "No audio", icon: includeAudio ? null : MicOff },
                    { ok: includeWebcam, text: includeWebcam ? "📷 Camera PiP enabled" : "No camera overlay", icon: includeWebcam ? null : CameraOff },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a1a1aa" }}>
                      {item.ok ? <Check size={13} color="#22c55e" /> : (item.icon ? <item.icon size={13} color="#52525b" /> : <Check size={13} color="#52525b" />)}
                      <span style={{ color: item.ok ? "#a1a1aa" : "#52525b" }}>{item.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: "12px", padding: "8px 12px", borderRadius: "8px",
                  background: "rgba(255,255,255,0.02)", fontSize: "11px", color: "#3f3f46",
                  display: "flex", alignItems: "center", gap: "6px"
                }}>
                  <HardDrive size={11} /> ~{estMB} MB/min estimated
                </div>
              </>
            )}
          </div>

          {/* Error */}
          {recordingError && (
            <div style={{
              background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "12px", padding: "12px 16px",
              fontSize: "13px", color: "#fca5a5", display: "flex", alignItems: "center", gap: "8px"
            }}><VideoOff size={16} /> {recordingError}</div>
          )}

          {/* Quick Guide */}
          {!isRecording && (
            <div style={{ background: "rgba(255,255,255,0.015)", borderRadius: "14px", padding: "16px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "700", color: "#e4e4e7", display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={14} color="#fbbf24" /> Quick Guide
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {["Configure settings below", "Click Start Recording", "Pick your tab/screen", "Code & explain your approach!"].map((text, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#a1a1aa" }}>
                    <div style={{
                      width: "22px", height: "22px", borderRadius: "7px",
                      background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", fontWeight: "700", color: "#a78bfa", flexShrink: 0
                    }}>{i + 1}</div>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recording tips */}
          {isRecording && (
            <div style={{ background: "rgba(255,255,255,0.015)", borderRadius: "12px", padding: "12px 16px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: "11px", color: "#3f3f46", marginBottom: "4px", fontWeight: "600" }}>💡 Tip</div>
              <div style={{ fontSize: "12px", color: "#52525b", lineHeight: "1.5" }}>
                Stop screen share or click Stop to finish. Your video will be saved as WebM.
              </div>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Controls */}
          <div style={{ position: "relative" }}>
            <SettingsDropdown
              isOpen={settingsOpen && !isRecording} onClose={() => setSettingsOpen(false)}
              quality={quality} setQuality={setQuality}
              captureMode={captureMode} setCaptureMode={setCaptureMode}
              includeAudio={includeAudio} setIncludeAudio={setIncludeAudio}
              includeSystemAudio={includeSystemAudio} setIncludeSystemAudio={setIncludeSystemAudio}
              includeWebcam={includeWebcam} setIncludeWebcam={setIncludeWebcam}
              webcamEnabled={webcamEnabled} toggleWebcam={toggleWebcam}
              webcamPosition={webcamPosition} setWebcamPosition={setWebcamPosition}
              webcamStream={webcamStream} webcamPreviewRef={webcamPreviewRef}
            />

            {isRecording ? (
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={isPaused ? resumeRecording : pauseRecording}
                  style={{
                    flex: 1, padding: "14px", borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                    color: "white", fontSize: "14px", fontWeight: "600", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                  }}>
                  {isPaused ? <Play size={18} /> : <Pause size={18} />}
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button onClick={stopRecording}
                  style={{
                    flex: 1, padding: "14px", borderRadius: "12px", border: "none",
                    background: "linear-gradient(135deg, #ef4444, #dc2626)",
                    color: "white", fontSize: "14px", fontWeight: "600", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    boxShadow: "0 4px 20px rgba(239, 68, 68, 0.4)"
                  }}>
                  <Square size={16} fill="white" /> Stop
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setSettingsOpen(!settingsOpen)}
                  style={{
                    padding: "14px", borderRadius: "12px",
                    border: settingsOpen ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid rgba(255,255,255,0.08)",
                    background: settingsOpen ? "rgba(139, 92, 246, 0.12)" : "rgba(255,255,255,0.04)",
                    color: settingsOpen ? "#a78bfa" : "#71717a", cursor: "pointer"
                  }}><Settings size={18} /></button>
                <button onClick={handleStart}
                  style={{
                    flex: 1, padding: "14px 24px", borderRadius: "12px", border: "none",
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    color: "white", fontSize: "14px", fontWeight: "700", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    boxShadow: "0 4px 24px rgba(139, 92, 246, 0.4)",
                    transition: "all 0.2s, transform 0.1s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(139, 92, 246, 0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(139, 92, 246, 0.4)"; }}>
                  <Video size={18} /> Start Recording
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping { 0% { transform: scale(1); opacity: 1; } 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes countdownPop { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes modalSlideIn { from { transform: translateY(30px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
});

export { CountdownOverlay, RecordingPreview };
export default RecordingPanel;
