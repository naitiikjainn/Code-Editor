import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Custom hook for screen/tab recording with audio support
 * Features:
 * - Screen/Tab/Window capture
 * - Microphone audio overlay
 * - System audio capture (when supported)
 * - Recording timer
 * - Download/Preview functionality
 */
export function useScreenRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingError, setRecordingError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Audio level visualization
  const startAudioVisualization = useCallback((stream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(100, (average / 128) * 100));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.warn("Audio visualization not supported:", e);
    }
  }, []);

  const stopAudioVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Start countdown before recording
  const startCountdown = useCallback(() => {
    return new Promise((resolve) => {
      setCountdownActive(true);
      setCountdown(3);
      
      let count = 3;
      const interval = setInterval(() => {
        count--;
        setCountdown(count);
        
        if (count === 0) {
          clearInterval(interval);
          setCountdownActive(false);
          resolve();
        }
      }, 1000);
    });
  }, []);

  // Start recording
  const startRecording = useCallback(async (options = {}) => {
    const {
      includeAudio = true,
      includeSystemAudio = true,
      captureMode = "screen", // "screen" | "window" | "tab"
      quality = "high", // "low" | "medium" | "high"
      showCountdown = true
    } = options;

    try {
      setRecordingError(null);
      chunksRef.current = [];

      // Quality presets
      const qualityPresets = {
        low: { videoBitsPerSecond: 1000000, width: 1280, height: 720 },
        medium: { videoBitsPerSecond: 2500000, width: 1920, height: 1080 },
        high: { videoBitsPerSecond: 5000000, width: 1920, height: 1080 }
      };

      const preset = qualityPresets[quality];

      // Get display media with options that ALLOW current tab capture
      // Key options:
      // - selfBrowserSurface: "include" - Shows the current tab in the picker
      // - preferCurrentTab: true - Preselects the current tab
      // - surfaceSwitching: "include" - Allows switching during recording
      const displayMediaOptions = {
        video: {
          cursor: "always",
          displaySurface: captureMode === "tab" ? "browser" : captureMode,
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: includeSystemAudio,
        // These options allow capturing the CURRENT tab (CodePlay)
        preferCurrentTab: captureMode === "tab",
        selfBrowserSurface: "include", // CRITICAL: Shows current tab in picker
        systemAudio: includeSystemAudio ? "include" : "exclude",
        surfaceSwitching: "include",
        monitorTypeSurfaces: captureMode === "screen" ? "include" : "exclude"
      };

      const displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      // Combine with microphone if requested
      let combinedStream = displayStream;

      if (includeAudio) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          // Create AudioContext to mix audio
          const audioContext = new AudioContext();
          const destination = audioContext.createMediaStreamDestination();

          // Add microphone
          const micSource = audioContext.createMediaStreamSource(audioStream);
          const micGain = audioContext.createGain();
          micGain.gain.value = 1.0;
          micSource.connect(micGain);
          micGain.connect(destination);

          // Add system audio if available
          if (includeSystemAudio && displayStream.getAudioTracks().length > 0) {
            const systemSource = audioContext.createMediaStreamSource(
              new MediaStream(displayStream.getAudioTracks())
            );
            const systemGain = audioContext.createGain();
            systemGain.gain.value = 0.8;
            systemSource.connect(systemGain);
            systemGain.connect(destination);
          }

          // Combine video tracks with mixed audio
          combinedStream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
          ]);

          // Start audio visualization
          startAudioVisualization(audioStream);

        } catch (audioError) {
          console.warn("Could not get microphone access:", audioError);
          // Continue without microphone
        }
      }

      streamRef.current = combinedStream;

      // Handle stream end (user stops sharing)
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

      // Show countdown
      if (showCountdown) {
        await startCountdown();
      }

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";

      mediaRecorderRef.current = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: preset.videoBitsPerSecond
      });

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setIsPreviewOpen(true);
        
        // Cleanup streams
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        stopAudioVisualization();
      };

      mediaRecorderRef.current.onerror = (e) => {
        setRecordingError(e.error?.message || "Recording failed");
        stopRecording();
      };

      // Start recording
      mediaRecorderRef.current.start(1000); // Capture in 1s chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Recording error:", error);
      setRecordingError(error.message || "Failed to start recording");
      setIsRecording(false);
    }
  }, [startCountdown, startAudioVisualization, stopAudioVisualization]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  }, [isRecording, isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  }, [isRecording, isPaused]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    stopAudioVisualization();
    setIsRecording(false);
    setIsPaused(false);
  }, [stopAudioVisualization]);

  // Download recording
  const downloadRecording = useCallback((filename = "codeplay-recording") => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  // Discard recording
  const discardRecording = useCallback(() => {
    setRecordedBlob(null);
    setIsPreviewOpen(false);
    setRecordingTime(0);
    chunksRef.current = [];
  }, []);

  // Format time display
  const formatTime = useCallback((seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    // State
    isRecording,
    isPaused,
    recordingTime,
    formattedTime: formatTime(recordingTime),
    recordedBlob,
    recordingError,
    audioLevel,
    isPreviewOpen,
    countdownActive,
    countdown,

    // Actions
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    downloadRecording,
    discardRecording,
    setIsPreviewOpen
  };
}

export default useScreenRecording;
