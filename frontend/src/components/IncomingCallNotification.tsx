import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface IncomingCallNotificationProps {
  callData: {
    roomId: string;
    callerName: string;
    callerId: string;
    isVideo: boolean;
    conversationId?: string;
  };
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallNotification({
  callData,
  onAccept,
  onDecline,
}: IncomingCallNotificationProps) {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 30 seconds if not answered
    const timeout = setTimeout(() => {
      if (isVisible) {
        handleDecline();
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isVisible]);

  const handleAccept = async () => {
    setIsVisible(false);
    // Join the call room
    navigate(`/call/${callData.roomId}`, {
      state: {
        conversationId: callData.conversationId,
        fromIncomingCall: true,
      },
    });
    onAccept();
  };

  const handleDecline = async () => {
    setIsVisible(false);
    // Notify backend that call was declined
    if (accessToken) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/rooms/${callData.roomId}/decline`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Error declining call:', error);
      }
    }
    onDecline();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card rounded-2xl p-6 max-w-md w-full mx-4 border-2 border-primary-500/50 shadow-2xl animate-scale-in">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            {callData.isVideo ? (
              <Video className="w-10 h-10 text-white" />
            ) : (
              <Phone className="w-10 h-10 text-white" />
            )}
          </div>
          <h3 className="text-white font-semibold text-xl mb-1">
            Incoming {callData.isVideo ? 'Video' : 'Audio'} Call
          </h3>
          <p className="text-primary-300 text-lg">{callData.callerName}</p>
        </div>

        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handleDecline}
            className="w-16 h-16 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
            aria-label="Decline call"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <button
            onClick={handleAccept}
            className="w-16 h-16 bg-green-500/90 hover:bg-green-600 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
            aria-label="Accept call"
          >
            {callData.isVideo ? (
              <Video className="w-7 h-7 text-white" />
            ) : (
              <Phone className="w-7 h-7 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
