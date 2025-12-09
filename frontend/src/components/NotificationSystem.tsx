import { useRef } from 'react';
import { useNotificationStore } from '../store/notifications';
import ToastNotification from './ToastNotification';
import IncomingCallToast from './IncomingCallToast';
import NotificationCenter from './NotificationCenter';
import { useNavigate } from 'react-router-dom';

export default function NotificationSystem() {
  const navigate = useNavigate();
  const { notifications, removeNotification } = useNotificationStore();
  const toastContainerRef = useRef<HTMLDivElement>(null);

  // Show only unread notifications as toasts (max 3 at a time)
  const unreadToasts = notifications
    .filter(n => !n.read)
    .slice(0, 3)
    .reverse(); // Show newest first

  const handleNotificationClick = (notification: any) => {
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    } else if (notification.metadata) {
      // Handle different notification types
      if (notification.type === 'incoming_call' && notification.metadata.callId) {
        navigate(`/call/${notification.metadata.callId}`);
      } else if (notification.type === 'new_message' && notification.metadata.conversationId) {
        navigate(`/friends/chat/${notification.metadata.conversationId}`);
      } else if (notification.type === 'call_recording_ready' && notification.metadata.callId) {
        navigate(`/call-detail/${notification.metadata.callId}`);
      } else if (notification.type === 'ai_insight' && notification.metadata.callId) {
        navigate(`/call-detail/${notification.metadata.callId}`);
      }
    }
  };

  return (
    <>
      {/* Toast Notifications Container */}
      <div
        ref={toastContainerRef}
        className="fixed top-4 right-4 z-[100] flex flex-col space-y-3 pointer-events-none"
        style={{ maxWidth: '400px' }}
      >
        {unreadToasts.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            {notification.type === 'incoming_call' ? (
              <IncomingCallToast
                notification={notification}
                onDismiss={removeNotification}
              />
            ) : (
              <ToastNotification
                notification={notification}
                onDismiss={removeNotification}
                onClick={handleNotificationClick}
              />
            )}
          </div>
        ))}
      </div>

      {/* Notification Center */}
      <NotificationCenter />
    </>
  );
}

