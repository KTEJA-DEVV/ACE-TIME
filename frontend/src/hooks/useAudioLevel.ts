import { useEffect, useRef, useState } from 'react';

interface UseAudioLevelOptions {
  stream: MediaStream | null;
  threshold?: number; // Audio level threshold (0-1)
  smoothing?: number; // Smoothing factor (0-1)
  enabled?: boolean; // Enable/disable detection
}

/**
 * Hook to detect audio levels from a MediaStream
 * Returns the current audio level (0-1) and whether the person is speaking
 */
export function useAudioLevel({
  stream,
  threshold = 0.01,
  smoothing = 0.7,
  enabled = true,
}: UseAudioLevelOptions) {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastLevelRef = useRef(0);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!enabled || !stream) {
      setAudioLevel(0);
      setIsSpeaking(false);
      return;
    }

    // Get audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setAudioLevel(0);
      setIsSpeaking(false);
      return;
    }

    // Check if audio track is enabled and not muted
    const audioTrack = audioTracks[0];
    if (!audioTrack.enabled || audioTrack.muted) {
      setAudioLevel(0);
      setIsSpeaking(false);
      return;
    }

    // Initialize Web Audio API
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      // Create analyser node
      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = smoothing;
      }

      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      
      // Create or update data array
      if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
        dataArrayRef.current = new Uint8Array(bufferLength);
      }

      // Create media stream source
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      sourceRef.current = audioContext.createMediaStreamSource(stream);
      sourceRef.current.connect(analyser);

      // Function to analyze audio level
      const analyzeAudio = () => {
        if (!analyser || !dataArrayRef.current) return;

        // Use getByteFrequencyData with proper typing
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        const arrayLength = dataArray.length;
        for (let i = 0; i < arrayLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / arrayLength;
        const normalizedLevel = average / 255; // Normalize to 0-1

        // Apply smoothing
        const smoothedLevel = lastLevelRef.current * smoothing + normalizedLevel * (1 - smoothing);
        lastLevelRef.current = smoothedLevel;

        setAudioLevel(smoothedLevel);
        setIsSpeaking(smoothedLevel > threshold);

        // Continue analyzing
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };

      // Start analyzing
      analyzeAudio();

      // Cleanup
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (sourceRef.current) {
          try {
            sourceRef.current.disconnect();
            sourceRef.current = null;
          } catch (e) {
            // Ignore disconnect errors
          }
        }
      };
    } catch (error) {
      console.error('[AUDIO LEVEL] Error setting up audio analysis:', error);
      setAudioLevel(0);
      setIsSpeaking(false);
    }
  }, [stream, threshold, smoothing, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  return { audioLevel, isSpeaking };
}

