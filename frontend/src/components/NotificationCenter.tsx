import { useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, Trash2, Phone, MessageSquare, Sparkles, FileVideo, UserPlus } from 'lucide-react';
import { useNotificationStore, Notification, NotificationType } from '../store/notifications';
import { useNavigate } from 'react-router-dom';

const typeIcons: Record<NotificationType, typeof Phone> = {
  incoming_call: Phone,
  new_message: MessageSquare,
  ai_insight: Sparkles,
  call_recording_ready: FileVideo,
  friend_joined: UserPlus,
  info: MessageSquare,
  success: Check,
  warning: MessageSquare,
  error: MessageSquare,
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    showCenter,
    setShowCenter,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotificationStore();

  const centerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) {
        setShowCenter(false);
      }
    };

    if (showCenter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCenter, setShowCenter]);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);

    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setShowCenter(false);
    } else if (notification.metadata) {
      // Handle different notification types
      if (notification.type === 'incoming_call' && notification.metadata.callId) {
        navigate(`/call/${notification.metadata.callId}`);
      } else if (notification.type === 'new_message' && notification.metadata.conversationId) {
        navigate(`/friends/chat/${notification.metadata.conversationId}`);
      } else if (notification.type === 'call_recording_ready' && notification.metadata.callId) {
        navigate(`/call-detail/${notification.metadata.callId}`);
      }
      setShowCenter(false);
    }
  };

  if (!showCenter) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[90] animate-fade-in"
        onClick={() => setShowCenter(false)}
      />

      {/* Notification Center */}
      <div
        ref={centerRef}
        className="fixed top-16 right-4 w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] 
                   glass-card rounded-xl border border-dark-700/50 shadow-2xl z-[100]
                   flex flex-col animate-slide-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800/50">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-primary-400" />
            <h2 className="text-white font-semibold text-lg">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-primary-500 rounded-full text-white text-xs font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="p-2 hover:bg-dark-800/50 rounded-lg transition"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4 text-dark-400 hover:text-white" />
              </button>
            )}
            <button
              onClick={() => setShowCenter(false)}
              className="p-2 hover:bg-dark-800/50 rounded-lg transition"
            >
              <X className="w-4 h-4 text-dark-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="w-12 h-12 text-dark-700 mb-3" />
              <p className="text-dark-400 text-sm text-center">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-800/50">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type];
                return (
                  <div
                    key={notification.id}
                    className={`
                      p-4 hover:bg-dark-800/30 transition cursor-pointer group
                      ${!notification.read ? 'bg-primary-500/5 border-l-2 border-primary-500' : ''}
                    `}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 p-2 rounded-lg ${
                        notification.read ? 'bg-dark-800/50' : 'bg-primary-500/20'
                      }`}>
                        <Icon className={`w-4 h-4 ${notification.read ? 'text-dark-400' : 'text-primary-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className={`text-sm font-medium ${notification.read ? 'text-dark-300' : 'text-white'}`}>
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1.5 ml-2" />
                          )}
                        </div>
                        <p className="text-xs text-dark-400 line-clamp-2 mb-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-dark-500">
                          {new Date(notification.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        className="flex-shrink-0 p-1 hover:bg-dark-700/50 rounded transition opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-dark-500 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-dark-800/50">
            <button
              onClick={clearAll}
              className="w-full px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg 
                       text-dark-300 hover:text-white text-sm font-medium transition"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </>
  );
}

