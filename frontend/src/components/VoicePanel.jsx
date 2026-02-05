import { memo, useMemo, useState } from "react";
import { Volume2, VolumeX, MicOff, ChevronDown, ChevronUp } from "lucide-react";
import { stringToColor } from "../utils/colors";

const getConnectionStatus = (quality) => {
    if (quality === "good") {
        return { label: "Connected", color: "#22c55e" };
    }
    if (quality === "medium") {
        return { label: "Connecting...", color: "#f59e0b" };
    }
    return { label: "Poor", color: "#ef5350" };
};

const VoicePeerRow = memo(function VoicePeerRow({
    peerId,
    displayName,
    isSpeaking,
    volume,
    isMuted,
    onToggleMute,
    onVolumeChange,
}) {
    return (
        <div style={{ marginBottom: "8px", padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: stringToColor(displayName),
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: "bold",
                        border: isSpeaking ? "2px solid #22c55e" : "2px solid transparent",
                        boxShadow: isSpeaking ? "0 0 10px rgba(34,197,94,0.5)" : "none",
                        transition: "all 0.15s",
                    }}>
                        {displayName[0]?.toUpperCase()}
                    </div>
                    <span style={{ color: "white", fontWeight: "500" }}>{displayName}</span>
                </div>
                <button
                    onClick={() => onToggleMute(peerId, !isMuted)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                    title={isMuted ? "Unmute user" : "Mute user (only for you)"}
                >
                    {isMuted ? <VolumeX size={14} color="#ef5350" /> : <Volume2 size={14} color="#888" />}
                </button>
            </div>
            <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onVolumeChange(peerId, parseInt(e.target.value, 10))}
                style={{ width: "100%", height: "4px", cursor: "pointer" }}
            />
        </div>
    );
});

const VoicePanel = memo(function VoicePanel({
    isConnected,
    connectionQuality,
    user,
    isMuted,
    isDeafened,
    isSpeaking,
    volume,
    onMasterVolumeChange,
    peers,
    speakingPeers,
    onTogglePeerMute,
    onPeerVolumeChange,
    resolvePeerName,
}) {
    const connectionState = getConnectionStatus(connectionQuality);
    const [isMinimized, setIsMinimized] = useState(false);

    const speakingPeerSet = useMemo(() => {
        if (!speakingPeers) {
            return new Set();
        }
        if (speakingPeers instanceof Set) {
            return speakingPeers;
        }
        return new Set(speakingPeers);
    }, [speakingPeers]);

    const memoizedPeers = useMemo(() => peers.map((peer) => ({
        peerId: peer.peerId,
        displayName: peer.username || resolvePeerName(peer.peerId),
        volume: peer.volume ?? 100,
        isMuted: peer.muted ?? false,
        isSpeaking: speakingPeerSet.has(peer.peerId),
    })), [peers, resolvePeerName, speakingPeerSet]);

    if (!isConnected) {
        return null;
    }

    if (isMinimized) {
        return (
            <div
                style={{
                    position: "fixed",
                    top: "60px",
                    right: "16px",
                    width: "200px",
                    background: "rgba(28, 28, 30, 0.9)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "14px",
                    padding: "10px 14px",
                    zIndex: 1000,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                }}
                onClick={() => setIsMinimized(false)}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                        style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: connectionState.color,
                            animation: "pulse 2s infinite",
                        }}
                    />
                    <span style={{ color: "#ddd", fontSize: "12px", fontWeight: "600" }}>
                        Voice Chat ({memoizedPeers.length + 1})
                    </span>
                </div>
                <ChevronDown size={16} color="#aaa" />
            </div>
        );
    }

    return (
        <div
            style={{
                position: "fixed",
                top: "60px",
                right: "16px",
                width: "260px",
                background: "rgba(28, 28, 30, 0.9)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "16px",
                zIndex: 1000,
                boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
                backdropFilter: "blur(24px) saturate(180%)",
            }}
        >
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#aaa", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>VOICE CHAT ({memoizedPeers.length + 1})</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div
                        style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: connectionState.color,
                            animation: "pulse 2s infinite",
                        }}
                    />
                    <span style={{ color: connectionState.color, fontSize: "10px" }}>{connectionState.label}</span>
                    <button
                        onClick={() => setIsMinimized(true)}
                        style={{
                            marginLeft: "6px",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center"
                        }}
                        title="Minimize"
                    >
                        <ChevronUp size={14} color="#aaa" />
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: "12px", padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <Volume2 size={14} color="#888" />
                    <span style={{ fontSize: "11px", color: "#888" }}>Master Volume</span>
                    <span style={{ fontSize: "11px", color: "#666", marginLeft: "auto" }}>{volume}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => onMasterVolumeChange(parseInt(e.target.value, 10))}
                    style={{ width: "100%", height: "4px", cursor: "pointer" }}
                />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                        style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: stringToColor(user?.username),
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: "bold",
                            border: isSpeaking && !isMuted ? "2px solid #22c55e" : isMuted ? "2px solid #ef5350" : "2px solid transparent",
                            boxShadow: isSpeaking && !isMuted ? "0 0 10px rgba(34,197,94,0.5)" : "none",
                            transition: "all 0.15s",
                        }}
                    >
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <div style={{ color: "white", fontWeight: "500" }}>{user?.username}</div>
                        <div style={{ fontSize: "10px", color: "#666" }}>You</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {isMuted && <MicOff size={14} color="#ef5350" />}
                    {isDeafened && <VolumeX size={14} color="#ef5350" />}
                </div>
            </div>

            {memoizedPeers.map((peer) => (
                <VoicePeerRow
                    key={peer.peerId}
                    peerId={peer.peerId}
                    displayName={peer.displayName}
                    isSpeaking={peer.isSpeaking}
                    volume={peer.volume}
                    isMuted={peer.isMuted}
                    onToggleMute={onTogglePeerMute}
                    onVolumeChange={onPeerVolumeChange}
                />
            ))}
        </div>
    );
});

export default VoicePanel;
