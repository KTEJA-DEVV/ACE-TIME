import { useEffect, useState } from 'react';
import { Sparkles, Bot } from 'lucide-react';

interface AIParticipantProps {
  isSpeaking?: boolean;
  isThinking?: boolean;
  className?: string;
}

export default function AIParticipant({
  isSpeaking = false,
  isThinking = false,
  className = '',
}: AIParticipantProps) {
  const [glowIntensity, setGlowIntensity] = useState(0);

  // Animate glow effect when speaking or thinking
  useEffect(() => {
    if (isSpeaking || isThinking) {
      const interval = setInterval(() => {
        setGlowIntensity((prev) => (prev === 1 ? 0.5 : 1));
      }, 800);
      return () => clearInterval(interval);
    } else {
      setGlowIntensity(0.3);
    }
  }, [isSpeaking, isThinking]);

  return (
    <div className={`relative bg-dark-900 rounded-xl overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
      {/* Animated Background with Gradient - Enhanced */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/30 via-purple-500/30 to-cyan-500/30">
        {/* Pulsing Glow Effect */}
        <div
          className={`absolute inset-0 rounded-xl transition-all duration-800 ${
            isSpeaking || isThinking ? 'animate-pulse-glow' : ''
          }`}
          style={{
            background: isSpeaking
              ? `radial-gradient(circle at center, rgba(139, 92, 246, ${glowIntensity * 0.6}), transparent 70%)`
              : isThinking
              ? `radial-gradient(circle at center, rgba(59, 130, 246, ${glowIntensity * 0.4}), transparent 70%)`
              : 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1), transparent 70%)',
            boxShadow: isSpeaking || isThinking
              ? `0 0 ${60 * glowIntensity}px rgba(139, 92, 246, ${glowIntensity * 0.5}), 0 0 ${120 * glowIntensity}px rgba(59, 130, 246, ${glowIntensity * 0.3})`
              : '0 0 20px rgba(139, 92, 246, 0.2)',
          }}
        />
      </div>

      {/* AI Avatar Container */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Circular Avatar with Animated Icon */}
        <div
          className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center transition-all duration-500 ${
            isSpeaking || isThinking ? 'scale-110' : 'scale-100'
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3))',
            boxShadow: isSpeaking || isThinking
              ? `0 0 ${40 * glowIntensity}px rgba(139, 92, 246, ${glowIntensity}), inset 0 0 ${20 * glowIntensity}px rgba(139, 92, 246, ${glowIntensity * 0.5})`
              : '0 0 30px rgba(139, 92, 246, 0.4), inset 0 0 20px rgba(139, 92, 246, 0.2)',
          }}
        >
          {/* Rotating Sparkles Background */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div
              className={`absolute inset-0 ${
                isSpeaking || isThinking ? 'animate-spin-slow' : ''
              }`}
              style={{
                background: 'conic-gradient(from 0deg, transparent, rgba(139, 92, 246, 0.3), transparent)',
              }}
            />
          </div>

          {/* AI Icon */}
          <div className="relative z-10">
            {isSpeaking || isThinking ? (
              <Sparkles
                className="w-16 h-16 md:w-20 md:h-20 text-primary-400 animate-pulse"
                style={{
                  filter: `drop-shadow(0 0 ${8 * glowIntensity}px rgba(139, 92, 246, ${glowIntensity}))`,
                }}
              />
            ) : (
              <Bot
                className="w-16 h-16 md:w-20 md:h-20 text-primary-400"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))',
                }}
              />
            )}
          </div>

          {/* Speaking Indicator - Enhanced Waveform */}
          {isSpeaking && (
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 flex items-end justify-center gap-0.5 md:gap-1">
              <div className="w-1 md:w-1.5 bg-purple-400 rounded-full animate-sound-wave shadow-lg shadow-purple-400/50" style={{ height: '8px', animationDelay: '0ms' }} />
              <div className="w-1 md:w-1.5 bg-cyan-400 rounded-full animate-sound-wave shadow-lg shadow-cyan-400/50" style={{ height: '12px', animationDelay: '150ms' }} />
              <div className="w-1 md:w-1.5 bg-purple-400 rounded-full animate-sound-wave shadow-lg shadow-purple-400/50" style={{ height: '16px', animationDelay: '300ms' }} />
              <div className="w-1 md:w-1.5 bg-cyan-400 rounded-full animate-sound-wave shadow-lg shadow-cyan-400/50" style={{ height: '20px', animationDelay: '450ms' }} />
              <div className="w-1 md:w-1.5 bg-purple-400 rounded-full animate-sound-wave shadow-lg shadow-purple-400/50" style={{ height: '16px', animationDelay: '600ms' }} />
              <div className="w-1 md:w-1.5 bg-cyan-400 rounded-full animate-sound-wave shadow-lg shadow-cyan-400/50" style={{ height: '12px', animationDelay: '750ms' }} />
              <div className="w-1 md:w-1.5 bg-purple-400 rounded-full animate-sound-wave shadow-lg shadow-purple-400/50" style={{ height: '8px', animationDelay: '900ms' }} />
            </div>
          )}

          {/* Thinking Indicator - Pulsing Dots */}
          {isThinking && !isSpeaking && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          )}
        </div>

        {/* AI Label - Enhanced with brighter badge */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center">
          <div className="bg-dark-900/95 backdrop-blur-lg rounded-full px-4 py-2 border-2 border-purple-500/50 shadow-lg shadow-purple-500/30">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="text-white text-sm md:text-base font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">AceTime AI</span>
            </div>
          </div>
          {(isSpeaking || isThinking) && (
            <div className="mt-2 text-xs text-primary-400 font-medium animate-fade-in">
              {isSpeaking ? 'Speaking...' : 'Thinking...'}
            </div>
          )}
        </div>
      </div>

      {/* Participant Info Overlay (consistent with VideoParticipant) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="text-white text-sm font-medium truncate">AceTime AI</span>
          </div>
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <div className="bg-primary-500/80 rounded-full p-1">
              <Bot className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

