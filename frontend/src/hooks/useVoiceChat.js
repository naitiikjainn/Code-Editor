import { useState, useEffect, useRef } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

export const useVoiceChat = (socket, roomId) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    // Peer Object: { peerId, stream, username }
    const [peers, setPeers] = useState([]);
    const [speakingPeers, setSpeakingPeers] = useState(new Set());

    // ANALYSER STATE
    const audioContextRef = useRef(null);
    const analysersRef = useRef(new Map());
    const animationFrameRef = useRef(null);

    const localStreamRef = useRef(null);
    const peersRef = useRef(new Map());
    const iceQueueRef = useRef(new Map());

    // METADATA MAP (peerId -> username)
    const peerMetadataRef = useRef(new Map());

    // --- SPEAKING DETECTION ---
    useEffect(() => {
        if (!isConnected) return;
        const checkSpeaking = () => {
            const speaking = new Set();
            analysersRef.current.forEach((analyser, peerId) => {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                if (avg > 15) speaking.add(peerId);
            });
            setSpeakingPeers(prev => {
                if (prev.size !== speaking.size) return speaking;
                for (let elem of speaking) if (!prev.has(elem)) return speaking;
                return prev;
            });
            animationFrameRef.current = requestAnimationFrame(checkSpeaking);
        };
        checkSpeaking();
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [isConnected, peers]);

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
                const source = ctx.createMediaStreamSource(remoteStream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 32;
                source.connect(analyser);
                analysersRef.current.set(peerId, analyser);
            } catch (e) { console.error("Audio Context Error", e); }
        };

        pc.onconnectionstatechange = () => {
            if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
                cleanUpPeer(peerId);
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
        setPeers(prev => prev.filter(p => p.peerId !== peerId));
        analysersRef.current.delete(peerId);
    };

    const joinVoice = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            setIsConnected(true);
            setIsMuted(false);
            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

            socket.emit('voice-join-request', { roomId });

        } catch (e) {
            console.error("Failed to access microphone", e);
            alert("Could not access microphone.");
        }
    };

    const leaveVoice = () => {
        socket.emit("voice-leave", { roomId });
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        peersRef.current.forEach(pc => pc.close());
        peersRef.current.clear();
        setPeers([]);
        setIsConnected(false);
        setIsMuted(false);
        iceQueueRef.current.clear();
        peerMetadataRef.current.clear();
        analysersRef.current.clear();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close().then(() => audioContextRef.current = null);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    return { isConnected, isMuted, joinVoice, leaveVoice, toggleMute, peers, speakingPeers };
};
