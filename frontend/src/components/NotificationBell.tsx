import { Bell } from 'lucide-react';
import { useNotificationStore } from '../store/notifications';
import { useAuthStore } from '../store/auth';

export default function NotificationBell() {
  const { unreadCount, toggleCenter } = useNotificationStore();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return null;

  return (
    <button
      onClick={toggleCenter}
      className="fixed top-4 right-4 z-50 p-3 glass-card rounded-full border border-dark-700/50 
                 hover:bg-dark-800/50 transition-all duration-300 hover:scale-110 
                 shadow-lg hover:shadow-xl group"
      title="Notifications"
    >
      <div className="relative">
        <Bell className="w-5 h-5 text-white group-hover:text-primary-400 transition" />
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center 
                           text-white text-xs font-bold animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
            <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
          </>
        )}
      </div>
    </button>
  );
}
