import { create } from 'zustand';

export type NotificationType = 
  | 'incoming_call'
  | 'new_message'
  | 'ai_insight'
  | 'call_recording_ready'
  | 'friend_joined'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string; // URL to navigate to when clicked
  actionData?: any; // Additional data for the action
  metadata?: {
    callerId?: string;
    callerName?: string;
    isVideo?: boolean;
    conversationId?: string;
    messageId?: string;
    callId?: string;
    recordingUrl?: string;
    friendId?: string;
    friendName?: string;
    senderName?: string;
  };
  duration?: number; // Auto-dismiss duration in ms (default: 5000)
  sound?: boolean; // Play sound (default: true)
  vibration?: boolean; // Vibrate (default: false)
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  showCenter: boolean;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleCenter: () => void;
  setShowCenter: (show: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  showCenter: false,

  addNotification: (notificationData) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: Notification = {
      ...notificationData,
      id,
      timestamp: new Date(),
      read: false,
      duration: notificationData.duration ?? 5000,
      sound: notificationData.sound ?? true,
      vibration: notificationData.vibration ?? false,
    };

    set((state) => {
      const newNotifications = [notification, ...state.notifications].slice(0, 50); // Keep last 50
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length,
      };
    });

    // Auto-dismiss
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, notification.duration);
    }

    return id;
  },

  removeNotification: (id) => {
    set((state) => {
      const newNotifications = state.notifications.filter(n => n.id !== id);
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length,
      };
    });
  },

  markAsRead: (id) => {
    set((state) => {
      const newNotifications = state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length,
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },

  toggleCenter: () => {
    set((state) => ({
      showCenter: !state.showCenter,
    }));
  },

  setShowCenter: (show) => {
    set({ showCenter: show });
  },
}));

