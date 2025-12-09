import { useEffect, useRef } from 'react';
import { Phone, Video, PhoneOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface CallNotificationProps {
  callData: {
    caller: {
      id: string;
      name: string;
      avatar?: string;
    };
    callType: 'video' | 'audio';
    callId: string;
    conversationId?: string;
  };
  onAccept: () => void;
  onDecline: () => void;
  onDismiss?: () => void;
  timeout?: number; // Auto-dismiss after timeout (default 30s)
}

export default function CallNotification({
  callData,
  onAccept,
  onDecline,
  onDismiss,
  timeout = 30000,
}: CallNotificationProps) {
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play ringtone
    try {
      // Create audio element for ringtone
      const audio = new Audio('/ringtone.mp3'); // You can add a custom ringtone file
      audio.loop = true;
      audio.volume = 0.7;
      audioRef.current = audio;
      
      // Try to play (may fail if user hasn't interacted)
      audio.play().catch((err) => {
        console.log('Could not play ringtone:', err);
      });
    } catch (error) {
      console.log('Ringtone not available');
    }

    // Auto-dismiss after timeout
    timeoutRef.current = setTimeout(() => {
      onDecline();
    }, timeout);

    // Vibrate on mobile (if supported)
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [timeout, onDecline]);

  const handleAccept = async () => {
    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Stop vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    onAccept();
  };

  const handleDecline = () => {
    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Stop vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    onDecline();
  };

  const isMobile = window.innerWidth < 768;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[200] flex items-center justify-center ${
          isMobile ? 'bg-black/90' : 'bg-black/60'
        } backdrop-blur-sm`}
      >
        {/* Full-screen modal for mobile, centered card for desktop */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`glass-card rounded-2xl p-8 max-w-md w-full mx-4 border-2 border-primary-500/50 shadow-2xl ${
            isMobile ? 'rounded-none max-w-none mx-0' : ''
          }`}
        >
          {/* Caller Avatar */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center mx-auto overflow-hidden ring-4 ring-primary-500/30 animate-pulse">
                {callData.caller.avatar ? (
                  <img
                    src={callData.caller.avatar}
                    alt={callData.caller.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-3xl">
                    {callData.caller.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {/* Pulsing ring animation */}
              <div className="absolute inset-0 rounded-full border-4 border-primary-500/50 animate-ping" />
            </div>

            <h3 className="text-white font-semibold text-xl mb-1">
              {callData.caller.name}
            </h3>
            <p className="text-primary-300 text-base">
              {callData.callType === 'video' ? 'Video' : 'Audio'} Call
            </p>
            <p className="text-dark-400 text-sm mt-2">
              {callData.callType === 'video' ? '📹' : '📞'} Incoming call...
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center space-x-6">
            {/* Decline Button */}
            <button
              onClick={handleDecline}
              className="w-16 h-16 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
              aria-label="Decline call"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>

            {/* Accept Button */}
            <button
              onClick={handleAccept}
              className="w-16 h-16 bg-green-500/90 hover:bg-green-600 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
              aria-label="Accept call"
            >
              {callData.callType === 'video' ? (
                <Video className="w-7 h-7 text-white" />
              ) : (
                <Phone className="w-7 h-7 text-white" />
              )}
            </button>
          </div>

          {/* Dismiss button (desktop only) */}
          {!isMobile && onDismiss && (
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-dark-800/50 transition"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5 text-dark-400" />
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

