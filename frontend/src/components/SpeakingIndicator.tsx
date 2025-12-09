import { useEffect, useState } from 'react';

interface SpeakingIndicatorProps {
  isSpeaking: boolean;
  audioLevel?: number; // 0-1
  className?: string;
}

/**
 * Audio waveform animation component
 */
export function AudioWaveform({ isSpeaking, audioLevel = 0, className = '' }: SpeakingIndicatorProps) {
  const [waveformHeights, setWaveformHeights] = useState<number[]>([0.3, 0.5, 0.4, 0.6, 0.3]);

  useEffect(() => {
    if (!isSpeaking) {
      // Fade out when not speaking
      setWaveformHeights([0.3, 0.3, 0.3, 0.3, 0.3]);
      return;
    }

    // Update waveform based on audio level
    const interval = setInterval(() => {
      const baseHeight = 0.3;
      const maxHeight = 0.3 + audioLevel * 0.7;
      
      setWaveformHeights(
        Array.from({ length: 5 }, () => {
          // Random variation around the audio level
          const variation = (Math.random() - 0.5) * 0.2;
          return Math.max(baseHeight, Math.min(1, maxHeight + variation));
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isSpeaking, audioLevel]);

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {waveformHeights.map((height, index) => (
        <div
          key={index}
          className="w-1 bg-green-400 rounded-full transition-all duration-150"
          style={{
            height: `${height * 100}%`,
            minHeight: '4px',
            maxHeight: '16px',
            opacity: isSpeaking ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Pulse effect component for avatars
 */
export function SpeakingPulse({ isSpeaking, className = '' }: { isSpeaking: boolean; className?: string }) {
  return (
    <div
      className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
        isSpeaking ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      <div className="absolute inset-0 bg-green-400/30 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
      <div className="absolute inset-0 bg-green-400/20 rounded-full animate-pulse" />
    </div>
  );
}

/**
 * Green glowing border component
 */
export function SpeakingBorder({ isSpeaking, className = '' }: { isSpeaking: boolean; className?: string }) {
  return (
    <div
      className={`absolute inset-0 rounded-xl pointer-events-none transition-all duration-300 ${
        isSpeaking
          ? 'border-2 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.6)] opacity-100'
          : 'border-2 border-transparent opacity-0'
      } ${className}`}
      style={{
        boxShadow: isSpeaking
          ? '0 0 20px rgba(74, 222, 128, 0.6), 0 0 40px rgba(74, 222, 128, 0.3)'
          : 'none',
      }}
    />
  );
}

