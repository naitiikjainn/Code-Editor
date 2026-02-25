import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Code2, Play, Zap, Puzzle, Share2, Mic, MicOff, Headphones, VolumeX, PhoneOff, Download, ExternalLink, X } from "lucide-react";
import { stringToColor } from "../utils/colors";

export function WorkspaceHeader({
    activeFile,
    activeUsers,
    isRunning,
    handleRun,
    handleCancel,
    isSubmitting,
    handleSubmit,
    extensionDetected,
    EXTENSION_URL,
    handleCopyLink,
    aiPanelOpen,
    setAiPanelOpen,
    rightPanel,
    user,
    setAuthModalOpen,
    isConnected,
    joinVoice,
    isSpeaking,
    isMuted,
    toggleMute,
    isDeafened,
    toggleDeafen,
    leaveVoice,
    connectionQuality,
    extensionBannerDismissed,
    setExtensionBannerDismissed
}) {
    const navigate = useNavigate();
    const [hoveredUser, setHoveredUser] = useState(null);

    return (
        <>
            {/* HEADER */}
            <div style={{ height: "48px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "rgba(17,17,17,0.85)", backdropFilter: "blur(20px) saturate(180%)", borderBottom: "1px solid rgba(255,255,255,0.06)", WebkitAppRegion: "drag", flexShrink: 0 }}>
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

                <div style={{ display: "flex", alignItems: "center", gap: "12px", WebkitAppRegion: "no-drag" }}>
                    
                    {/* Active Users Avatars */}
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

                {isRunning ? (
                    <button onClick={handleCancel} className="btn-danger" style={{ padding: "6px 16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", fontWeight: "500", cursor: "pointer" }}>
                         <X size={14} color="white" /> Stop
                    </button>
                ) : (
                    <button onClick={handleRun} disabled={isRunning} className="btn-primary" style={{ padding: "6px 16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                         <Play size={14} fill="white" /> Run
                    </button>
                )}
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
                animation: "fadeIn 0.3s ease",
                WebkitAppRegion: "no-drag"
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
        </>
    );
}

export default WorkspaceHeader;
