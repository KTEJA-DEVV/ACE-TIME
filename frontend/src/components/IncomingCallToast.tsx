import { useState } from 'react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { Notification } from '../store/notifications';
import { useNavigate } from 'react-router-dom';
import { useCallStore } from '../store/call';

interface IncomingCallToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onAccept?: () => void;
  onReject?: () => void;
}

export default function IncomingCallToast({
  notification,
  onDismiss,
  onAccept,
  onReject,
}: IncomingCallToastProps) {
  const navigate = useNavigate();
  const callStore = useCallStore();
  const [isLeaving, setIsLeaving] = useState(false);
  const isVideo = notification.metadata?.isVideo ?? false;

  const handleAccept = async () => {
    if (onAccept) {
      onAccept();
    } else if (notification.metadata?.callId) {
      // Navigate to call room
      navigate(`/call/${notification.metadata.callId}`);
    }
    onDismiss(notification.id);
  };

  const handleReject = () => {
    if (onReject) {
      onReject();
    } else if (notification.metadata?.callId) {
      // Emit reject event
      const socket = callStore.socket;
      if (socket) {
        socket.emit('call:reject', { roomId: notification.metadata.callId });
      }
    }
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  };

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  };

  return (
    <div
      className={`
        glass-card rounded-xl p-4 border-2 min-w-[320px] max-w-[400px] 
        bg-primary-500/20 border-primary-500/40 text-primary-300
        transition-all duration-300 ease-out
        ${isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        hover:scale-[1.02] hover:shadow-xl
        animate-slide-in
      `}
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0 p-2 rounded-lg bg-primary-500/30">
          {isVideo ? (
            <Video className="w-5 h-5 text-primary-300" />
          ) : (
            <Phone className="w-5 h-5 text-primary-300" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1">{notification.title}</h4>
          <p className="text-xs opacity-90 mb-3">
            {notification.metadata?.callerName || 'Someone'} is calling you
          </p>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAccept}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 
                       bg-green-500 hover:bg-green-600 rounded-lg text-white font-medium 
                       transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Phone className="w-4 h-4" />
              <span>Accept</span>
            </button>
            <button
              onClick={handleReject}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 
                       bg-red-500 hover:bg-red-600 rounded-lg text-white font-medium 
                       transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Reject</span>
            </button>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded-lg transition"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      {notification.duration && notification.duration > 0 && (
        <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/30 rounded-full animate-progress-shrink"
            style={{
              animationDuration: `${notification.duration}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}

