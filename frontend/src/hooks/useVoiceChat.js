import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Room,
    RoomEvent,
    Track,
    ConnectionState,
    ConnectionQuality,
    createLocalAudioTrack
} from 'livekit-client';
import { API_URL } from '../config';

export const useVoiceChat = (socket, roomId, username) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [volume, setVolume] = useState(100);
    const [connectionQuality, setConnectionQuality] = useState('good');
    const [peers, setPeers] = useState([]);
    const [speakingPeers, setSpeakingPeers] = useState(new Set());
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const roomRef = useRef(null);
    const localTrackRef = useRef(null);
    const audioElementsRef = useRef(new Map());
    const volumeRef = useRef(volume);
    const isDeafenedRef = useRef(isDeafened);

    // Keep refs in sync
    useEffect(() => { volumeRef.current = volume; }, [volume]);
    useEffect(() => { isDeafenedRef.current = isDeafened; }, [isDeafened]);

    // Map connection quality from LiveKit
    const mapConnectionQuality = (quality) => {
        switch (quality) {
            case ConnectionQuality.Excellent:
            case ConnectionQuality.Good:
                return 'good';
            case ConnectionQuality.Poor:
                return 'medium';
            case ConnectionQuality.Lost:
                return 'poor';
            default:
                return 'good';
        }
    };

    // Get token from backend
    const getToken = async (roomName, participantName) => {
        const token = localStorage.getItem('codeplay_token');
        const response = await fetch(`${API_URL}/api/livekit/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({ roomName, participantName })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to get voice token');
        }

        const data = await response.json();
        return data.token;
    };

    // Update all volumes helper
    const updateAllVolumes = useCallback((newVolume) => {
        const vol = Math.max(0, Math.min(1, newVolume / 100));
        audioElementsRef.current.forEach((audioEl) => {
            audioEl.volume = vol;
        });
    }, []);

    // Update peers list from room participants
    const updatePeers = useCallback(() => {
        if (!roomRef.current) return;

        const room = roomRef.current;
        const newPeers = [];

        room.remoteParticipants.forEach((participant) => {
            newPeers.push({
                peerId: participant.identity,
                username: participant.name || participant.identity,
                volume: 100,
                muted: false,
                isSpeaking: participant.isSpeaking
            });
        });

        setPeers(newPeers);
    }, []);

    // Join voice chat
    const joinVoice = useCallback(async () => {
        if (isConnected || isConnecting) return;
        
        setError(null);
        setIsConnecting(true);
        
        try {
            // Use provided username or fallback
            const participantName = username || 'Guest';
            console.log(`[LiveKit] Joining as: ${participantName} (username prop: ${username})`);
            
            // Get LiveKit token from backend
            const token = await getToken(roomId, participantName);
            
            // Get LiveKit URL from env
            const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
            
            if (!livekitUrl) {
                throw new Error('LiveKit URL not configured');
            }
            
            // Create room instance
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
                audioCaptureDefaults: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            roomRef.current = room;
            
            // Track subscribed - audio from remote peer
            room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                if (track.kind === Track.Kind.Audio) {
                    console.log(`[LiveKit] Audio from ${participant.identity}`);
                    const audioEl = track.attach();
                    audioEl.volume = isDeafenedRef.current ? 0 : volumeRef.current / 100;
                    audioElementsRef.current.set(participant.identity, audioEl);
                    updatePeers();
                }
            });
            
            // Track unsubscribed
            room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                if (track.kind === Track.Kind.Audio) {
                    console.log(`[LiveKit] Audio removed from ${participant.identity}`);
                    const audioEl = audioElementsRef.current.get(participant.identity);
                    if (audioEl) {
                        track.detach(audioEl);
                        audioElementsRef.current.delete(participant.identity);
                    }
                    updatePeers();
                }
            });
            
            // Active speakers changed
            room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
                const speakingIds = new Set(speakers.map(s => s.identity));
                setSpeakingPeers(speakingIds);
                
                if (room.localParticipant) {
                    setIsSpeaking(speakers.some(s => s.identity === room.localParticipant.identity));
                }
            });
            
            // Participant events
            room.on(RoomEvent.ParticipantConnected, (participant) => {
                console.log(`[LiveKit] Participant joined: ${participant.identity}`);
                updatePeers();
            });
            
            room.on(RoomEvent.ParticipantDisconnected, (participant) => {
                console.log(`[LiveKit] Participant left: ${participant.identity}`);
                const audioEl = audioElementsRef.current.get(participant.identity);
                if (audioEl) {
                    audioEl.pause();
                    audioEl.srcObject = null;
                    audioElementsRef.current.delete(participant.identity);
                }
                updatePeers();
            });
            
            // Connection quality
            room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
                if (participant === room.localParticipant) {
                    setConnectionQuality(mapConnectionQuality(quality));
                }
            });
            
            // Connection state
            room.on(RoomEvent.ConnectionStateChanged, (state) => {
                console.log(`[LiveKit] State: ${state}`);
                if (state === ConnectionState.Connected) {
                    setIsConnected(true);
                    setIsConnecting(false);
                    setError(null);
                } else if (state === ConnectionState.Disconnected) {
                    setIsConnected(false);
                    setIsConnecting(false);
                } else if (state === ConnectionState.Reconnecting) {
                    setConnectionQuality('medium');
                }
            });
            
            // Disconnected
            room.on(RoomEvent.Disconnected, () => {
                console.log('[LiveKit] Disconnected');
                setIsConnected(false);
                setPeers([]);
                setSpeakingPeers(new Set());
                setIsSpeaking(false);
            });
            
            // Media device error
            room.on(RoomEvent.MediaDevicesError, (e) => {
                console.error('[LiveKit] Media error:', e);
                setError('Microphone error: ' + e.message);
            });
            
            // Connect to room
            console.log('[LiveKit] Connecting to:', roomId);
            await room.connect(livekitUrl, token);
            
            // Create and publish local audio
            const localTrack = await createLocalAudioTrack({
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            });
            
            localTrackRef.current = localTrack;
            await room.localParticipant.publishTrack(localTrack);
            
            console.log('[LiveKit] Joined successfully');
            setIsConnected(true);
            setIsConnecting(false);
            setIsMuted(false);
            setIsDeafened(false);
            
        } catch (e) {
            console.error('[LiveKit] Join error:', e);
            setIsConnecting(false);
            
            if (e.name === 'NotAllowedError') {
                setError('Microphone access denied.');
            } else if (e.name === 'NotFoundError') {
                setError('No microphone found.');
            } else {
                setError(e.message || 'Failed to join voice chat');
            }
            
            if (roomRef.current) {
                roomRef.current.disconnect();
                roomRef.current = null;
            }
        }
    }, [roomId, socket, isConnected, isConnecting, updatePeers, username]);

    // Leave voice chat
    const leaveVoice = useCallback(() => {
        console.log('[LiveKit] Leaving...');
        
        if (localTrackRef.current) {
            localTrackRef.current.stop();
            localTrackRef.current = null;
        }
        
        if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
        }
        
        audioElementsRef.current.forEach((audioEl) => {
            audioEl.pause();
            audioEl.srcObject = null;
        });
        audioElementsRef.current.clear();
        
        setPeers([]);
        setIsConnected(false);
        setIsMuted(false);
        setIsDeafened(false);
        setIsSpeaking(false);
        setSpeakingPeers(new Set());
        setError(null);
    }, []);

    // Toggle mute
    const toggleMute = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;
        
        const newMuted = !isMuted;
        
        try {
            await room.localParticipant.setMicrophoneEnabled(!newMuted);
            setIsMuted(newMuted);
            
            if (!newMuted && isDeafened) {
                setIsDeafened(false);
                updateAllVolumes(volume);
            }
        } catch (e) {
            console.error('[LiveKit] Mute error:', e);
        }
    }, [isMuted, isDeafened, volume, updateAllVolumes]);

    // Toggle deafen
    const toggleDeafen = useCallback(async () => {
        const room = roomRef.current;
        const newDeafened = !isDeafened;
        
        setIsDeafened(newDeafened);
        
        if (newDeafened) {
            if (room) {
                await room.localParticipant.setMicrophoneEnabled(false);
            }
            setIsMuted(true);
            updateAllVolumes(0);
        } else {
            updateAllVolumes(volume);
        }
    }, [isDeafened, volume, updateAllVolumes]);

    // Set master volume
    const setMasterVolume = useCallback((newVolume) => {
        setVolume(newVolume);
        if (!isDeafened) {
            updateAllVolumes(newVolume);
        }
    }, [isDeafened, updateAllVolumes]);

    // Set peer volume
    const setPeerVolume = useCallback((peerId, peerVolume) => {
        const audioEl = audioElementsRef.current.get(peerId);
        if (audioEl) {
            audioEl.volume = isDeafened ? 0 : Math.max(0, Math.min(1, peerVolume / 100));
        }
        setPeers(prev => prev.map(p =>
            p.peerId === peerId ? { ...p, volume: peerVolume } : p
        ));
    }, [isDeafened]);

    // Mute peer
    const mutePeer = useCallback((peerId, muted) => {
        const audioEl = audioElementsRef.current.get(peerId);
        if (audioEl) {
            audioEl.muted = muted;
        }
        setPeers(prev => prev.map(p =>
            p.peerId === peerId ? { ...p, muted } : p
        ));
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (localTrackRef.current) {
                localTrackRef.current.stop();
            }
            if (roomRef.current) {
                roomRef.current.disconnect();
            }
            audioElementsRef.current.forEach((audioEl) => {
                audioEl.pause();
                audioEl.srcObject = null;
            });
        };
    }, []);

    return {
        isConnected,
        isConnecting,
        isMuted,
        isDeafened,
        isSpeaking,
        volume,
        connectionQuality,
        error,
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
