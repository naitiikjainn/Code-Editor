import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

// Audio constraints for better quality
const AUDIO_CONSTRAINTS = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
    },
    video: false
};

export const useVoiceChat = (socket, roomId) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [volume, setVolume] = useState(100); // 0-100
    const [connectionQuality, setConnectionQuality] = useState('good'); // good, medium, poor
    // Peer Object: { peerId, stream, username, volume, muted }
    const [peers, setPeers] = useState([]);
    const [speakingPeers, setSpeakingPeers] = useState(new Set());
    const [isSpeaking, setIsSpeaking] = useState(false); // local speaking indicator

    // ANALYSER STATE
    const audioContextRef = useRef(null);
    const analysersRef = useRef(new Map());
    const animationFrameRef = useRef(null);
    const localAnalyserRef = useRef(null);

    const localStreamRef = useRef(null);
    const peersRef = useRef(new Map());
    const iceQueueRef = useRef(new Map());
    
    // Audio element refs for volume control
    const audioElementsRef = useRef(new Map());
    const gainNodesRef = useRef(new Map());

    // METADATA MAP (peerId -> username)
    const peerMetadataRef = useRef(new Map());
    
    // Reconnection state
    const reconnectAttemptsRef = useRef(new Map());
    const maxReconnectAttempts = 3;

    // --- SPEAKING DETECTION (includes local user) ---
    useEffect(() => {
        if (!isConnected) return;
        const SPEAKING_THRESHOLD = 15;
        const checkSpeaking = () => {
            const speaking = new Set();
            
            // Check remote peers
            analysersRef.current.forEach((analyser, peerId) => {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                if (avg > SPEAKING_THRESHOLD) speaking.add(peerId);
            });
            
            // Check local user speaking
            if (localAnalyserRef.current && !isMuted) {
                const dataArray = new Uint8Array(localAnalyserRef.current.frequencyBinCount);
                localAnalyserRef.current.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setIsSpeaking(avg > SPEAKING_THRESHOLD);
            } else {
                setIsSpeaking(false);
            }
            
            setSpeakingPeers(prev => {
                if (prev.size !== speaking.size) return speaking;
                for (let elem of speaking) if (!prev.has(elem)) return speaking;
                return prev;
            });
            animationFrameRef.current = requestAnimationFrame(checkSpeaking);
        };
        checkSpeaking();
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [isConnected, peers, isMuted]);

    // --- CORE WEBRTC LOGIC ---
    useEffect(() => {
        if (!socket || !roomId) return;

        const initiateCallIfNeeded = async (targetId) => {
            const myId = socket.id;
            if (peersRef.current.has(targetId)) return;

            if (myId > targetId) {
                const pc = createPeerConnection(targetId, socket);
                addLocalTracks(pc);
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('voice-signal', { targetId, signal: { type: 'offer', sdp: pc.localDescription } });
                } catch (e) { console.error("Offer Error", e); }
            }
        };

        const addLocalTracks = (pc) => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
            }
        };

        const processIceQueue = async (peerId, pc) => {
            const queue = iceQueueRef.current.get(peerId) || [];
            if (queue.length > 0) {
                for (const candidate of queue) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error("Failed to add queued ICE", e);
                    }
                }
                iceQueueRef.current.delete(peerId);
            }
        };

        const handleNewPeer = ({ peerId, username }) => {
            // console.log(`🎤 Event: New Peer ${peerId} (${username})`);
            peerMetadataRef.current.set(peerId, username);
            initiateCallIfNeeded(peerId);
        };

        const handleExistingUsers = ({ users }) => {
            // console.log(`📋 Event: Existing Users:`, users);
            users.forEach(u => {
                peerMetadataRef.current.set(u.id, u.username);
                initiateCallIfNeeded(u.id);
            });
        };

        const handleSignal = async ({ callerId, signal, callerUsername }) => {
            if (callerUsername) peerMetadataRef.current.set(callerId, callerUsername);

            let pc = peersRef.current.get(callerId);

            // 1. Handle Offer (Receiver)
            if (signal.type === 'offer') {
                if (!pc) {
                    pc = createPeerConnection(callerId, socket);
                    addLocalTracks(pc);
                }

                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    await processIceQueue(callerId, pc);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('voice-signal', { targetId: callerId, signal: { type: 'answer', sdp: pc.localDescription } });
                } catch (e) { console.error("Offer Handling Error", e); }
                return;
            }

            // 2. Handle Answer (Caller)
            if (signal.type === 'answer') {
                if (pc) {
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                        await processIceQueue(callerId, pc);
                    } catch (e) { console.error("Answer Handling Error", e); }
                }
                return;
            }

            // 3. Handle ICE Candidate
            if (signal.candidate) {
                if (pc && pc.remoteDescription) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    } catch (e) { console.error("ICE Error", e); }
                } else {
                    if (!iceQueueRef.current.has(callerId)) iceQueueRef.current.set(callerId, []);
                    iceQueueRef.current.get(callerId).push(signal.candidate);
                }
            }
        };

        socket.on('voice-new-peer', handleNewPeer);
        socket.on('voice-existing-users', handleExistingUsers);
        socket.on('voice-signal', handleSignal);

        return () => {
            socket.off('voice-new-peer', handleNewPeer);
            socket.off('voice-existing-users', handleExistingUsers);
            socket.off('voice-signal', handleSignal);
        };
    }, [socket, roomId]);

    const createPeerConnection = (peerId, socket) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current.set(peerId, pc);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('voice-signal', { targetId: peerId, signal: { candidate: event.candidate } });
            }
        };

        pc.ontrack = (event) => {
            const [remoteStream] = event.streams[0] ? event.streams : [new MediaStream([event.track])];
            const username = peerMetadataRef.current.get(peerId) || "Unknown";

            setPeers(prev => {
                if (prev.find(p => p.peerId === peerId)) return prev;
                return [...prev, { peerId, stream: remoteStream, username }];
            });

            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioContextRef.current;
            try {
                if (ctx.state === 'suspended') ctx.resume();
                
                // Create audio element for playback with volume control
                const audioEl = new Audio();
                audioEl.srcObject = remoteStream;
                audioEl.autoplay = true;
                audioEl.volume = volume / 100;
                audioElementsRef.current.set(peerId, audioEl);
                
                // Create analyser for speaking detection
                const source = ctx.createMediaStreamSource(remoteStream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 32;
                source.connect(analyser);
                analysersRef.current.set(peerId, analyser);
                
                // Create gain node for individual volume control
                const gainNode = ctx.createGain();
                gainNode.gain.value = volume / 100;
                gainNodesRef.current.set(peerId, gainNode);
                
            } catch (e) { console.error("Audio Context Error", e); }
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            if (['disconnected', 'failed'].includes(state)) {
                // Try to reconnect
                const attempts = reconnectAttemptsRef.current.get(peerId) || 0;
                if (attempts < maxReconnectAttempts) {
                    reconnectAttemptsRef.current.set(peerId, attempts + 1);
                    console.log(`🔄 Attempting reconnection to ${peerId} (${attempts + 1}/${maxReconnectAttempts})`);
                    // ICE restart
                    pc.restartIce();
                } else {
                    cleanUpPeer(peerId);
                }
            } else if (state === 'connected') {
                reconnectAttemptsRef.current.delete(peerId);
                setConnectionQuality('good');
            } else if (state === 'closed') {
                cleanUpPeer(peerId);
            }
        };
        
        // Monitor connection quality via stats
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'checking') {
                setConnectionQuality('medium');
            } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                setConnectionQuality('good');
            } else if (pc.iceConnectionState === 'disconnected') {
                setConnectionQuality('poor');
            }
        };

        return pc;
    };

    const cleanUpPeer = (peerId) => {
        const pc = peersRef.current.get(peerId);
        if (pc) {
            pc.close();
            peersRef.current.delete(peerId);
        }
        
        // Clean up audio element
        const audioEl = audioElementsRef.current.get(peerId);
        if (audioEl) {
            audioEl.pause();
            audioEl.srcObject = null;
            audioElementsRef.current.delete(peerId);
        }
        
        gainNodesRef.current.delete(peerId);
        setPeers(prev => prev.filter(p => p.peerId !== peerId));
        analysersRef.current.delete(peerId);
        reconnectAttemptsRef.current.delete(peerId);
    };

    const joinVoice = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            localStreamRef.current = stream;
            setIsConnected(true);
            setIsMuted(false);
            setIsDeafened(false);
            
            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') ctx.resume();
            
            // Set up local analyser for speaking indicator
            try {
                const localSource = ctx.createMediaStreamSource(stream);
                const localAnalyser = ctx.createAnalyser();
                localAnalyser.fftSize = 32;
                localSource.connect(localAnalyser);
                localAnalyserRef.current = localAnalyser;
            } catch (e) {
                console.error("Local analyser setup error:", e);
            }

            socket.emit('voice-join-request', { roomId });

        } catch (e) {
            console.error("Failed to access microphone", e);
            if (e.name === 'NotAllowedError') {
                alert("Microphone access denied. Please allow microphone access and try again.");
            } else if (e.name === 'NotFoundError') {
                alert("No microphone found. Please connect a microphone and try again.");
            } else {
                alert("Could not access microphone: " + e.message);
            }
        }
    };

    const leaveVoice = () => {
        socket.emit("voice-leave", { roomId });
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        
        // Clean up all audio elements
        audioElementsRef.current.forEach((audioEl, peerId) => {
            audioEl.pause();
            audioEl.srcObject = null;
        });
        audioElementsRef.current.clear();
        gainNodesRef.current.clear();
        
        peersRef.current.forEach(pc => pc.close());
        peersRef.current.clear();
        setPeers([]);
        setIsConnected(false);
        setIsMuted(false);
        setIsDeafened(false);
        setIsSpeaking(false);
        iceQueueRef.current.clear();
        peerMetadataRef.current.clear();
        analysersRef.current.clear();
        reconnectAttemptsRef.current.clear();
        localAnalyserRef.current = null;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close().then(() => audioContextRef.current = null);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
                // If unmuting while deafened, undeafen too
                if (audioTrack.enabled && isDeafened) {
                    setIsDeafened(false);
                    updateAllVolumes(volume);
                }
            }
        }
    };
    
    const toggleDeafen = () => {
        const newDeafened = !isDeafened;
        setIsDeafened(newDeafened);
        
        if (newDeafened) {
            // Mute self and mute all incoming audio
            if (localStreamRef.current) {
                const audioTrack = localStreamRef.current.getAudioTracks()[0];
                if (audioTrack) audioTrack.enabled = false;
            }
            setIsMuted(true);
            updateAllVolumes(0);
        } else {
            // Restore volumes
            updateAllVolumes(volume);
        }
    };
    
    const updateAllVolumes = useCallback((newVolume) => {
        const vol = newVolume / 100;
        audioElementsRef.current.forEach((audioEl) => {
            audioEl.volume = vol;
        });
        gainNodesRef.current.forEach((gainNode) => {
            gainNode.gain.value = vol;
        });
    }, []);
    
    const setMasterVolume = useCallback((newVolume) => {
        setVolume(newVolume);
        if (!isDeafened) {
            updateAllVolumes(newVolume);
        }
    }, [isDeafened, updateAllVolumes]);
    
    const setPeerVolume = useCallback((peerId, peerVolume) => {
        const audioEl = audioElementsRef.current.get(peerId);
        if (audioEl) {
            audioEl.volume = isDeafened ? 0 : (peerVolume / 100);
        }
        const gainNode = gainNodesRef.current.get(peerId);
        if (gainNode) {
            gainNode.gain.value = isDeafened ? 0 : (peerVolume / 100);
        }
        // Update peer state
        setPeers(prev => prev.map(p => 
            p.peerId === peerId ? { ...p, volume: peerVolume } : p
        ));
    }, [isDeafened]);
    
    const mutePeer = useCallback((peerId, muted) => {
        const audioEl = audioElementsRef.current.get(peerId);
        if (audioEl) {
            audioEl.muted = muted;
        }
        setPeers(prev => prev.map(p => 
            p.peerId === peerId ? { ...p, muted } : p
        ));
    }, []);

    return { 
        isConnected, 
        isMuted, 
        isDeafened,
        isSpeaking,
        volume,
        connectionQuality,
        joinVoice, 
        leaveVoice, 
        toggleMute, 
        toggleDeafen,
        setMasterVolume,
        setPeerVolume,
        mutePeer,
        peers, 
        speakingPeers 
    };
};
