import { useEffect, useState } from 'react';
import { X, Phone, MessageSquare, Sparkles, FileVideo, UserPlus, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Notification, NotificationType } from '../store/notifications';
import { soundManager } from '../utils/sounds';

interface ToastNotificationProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

const iconMap: Record<NotificationType, typeof Phone> = {
  incoming_call: Phone,
  new_message: MessageSquare,
  ai_insight: Sparkles,
  call_recording_ready: FileVideo,
  friend_joined: UserPlus,
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const colorMap: Record<NotificationType, string> = {
  incoming_call: 'bg-primary-500/20 border-primary-500/40 text-primary-300',
  new_message: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  ai_insight: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
  call_recording_ready: 'bg-green-500/20 border-green-500/40 text-green-300',
  friend_joined: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  info: 'bg-dark-800/90 border-dark-700 text-white',
  success: 'bg-green-500/20 border-green-500/40 text-green-300',
  warning: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  error: 'bg-red-500/20 border-red-500/40 text-red-300',
};

export default function ToastNotification({ notification, onDismiss, onClick }: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const Icon = iconMap[notification.type] || Info;
  const colors = colorMap[notification.type] || colorMap.info;

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);

    // Play sound
    if (notification.sound) {
      soundManager.playSound(notification.type);
    }

    // Vibrate
    if (notification.vibration) {
      soundManager.vibrate([100, 50, 100]);
    }
  }, []);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  };

  const handleClick = () => {
    if (onClick) {
      onClick(notification);
    }
    handleDismiss();
  };

  return (
    <div
      className={`
        glass-card rounded-xl p-4 border-2 min-w-[320px] max-w-[400px] 
        cursor-pointer transition-all duration-300 ease-out
        ${colors}
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isLeaving ? 'translate-x-full opacity-0' : ''}
        hover:scale-[1.02] hover:shadow-xl
        animate-slide-in
      `}
      onClick={handleClick}
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className={`flex-shrink-0 p-2 rounded-lg ${colors.split(' ')[0]} bg-opacity-30`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1 truncate">{notification.title}</h4>
          <p className="text-xs opacity-90 line-clamp-2">{notification.message}</p>
          {notification.metadata?.callerName && (
            <p className="text-xs mt-1 opacity-75">{notification.metadata.callerName}</p>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded-lg transition"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar for Auto-Dismiss */}
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

