import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notifications';

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const SOCKET_URL = getSocketUrl();

/**
 * Hook to set up Socket.IO listeners for notifications
 */
export function useNotifications() {
  const { accessToken, user } = useAuthStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!accessToken || !user) return;

    const socket: Socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
        userName: user.name,
      },
      transports: ['websocket', 'polling'],
    });

    // NOTE: Incoming call notifications are handled by GlobalCallHandler component
    // to avoid duplicate notifications. This hook only handles other notification types.

    // New message notification
    socket.on('message:new', (data: { message: any }) => {
      const message = data.message;
      
      // Only show notification if not in the same conversation
      // This will be handled by individual pages, but we can add a global one here
      if (message.senderId?._id !== user._id) {
        addNotification({
          type: 'new_message',
          title: 'New Message',
          message: message.content || '📎 Attachment',
          metadata: {
            conversationId: message.conversationId?.toString(),
            messageId: message._id,
            senderName: message.senderId?.name || 'Someone',
          },
          actionUrl: message.conversationId ? `/friends/chat/${message.conversationId}` : undefined,
          duration: 5000,
          sound: true,
        });
      }
    });

    // AI insight available
    socket.on('ai:insight:ready', (data: {
      callId: string;
      conversationId?: string;
      summary?: string;
    }) => {
      addNotification({
        type: 'ai_insight',
        title: 'AI Insights Available',
        message: data.summary || 'AI generated notes from your last call',
        metadata: {
          callId: data.callId,
          conversationId: data.conversationId,
        },
        actionUrl: data.callId ? `/call-detail/${data.callId}` : undefined,
        duration: 8000,
        sound: true,
      });
    });

    // Call recording ready
    socket.on('call:recording:ready', (data: {
      callId: string;
      recordingUrl: string;
      duration?: number;
    }) => {
      addNotification({
        type: 'call_recording_ready',
        title: 'Call Recording Ready',
        message: `Your call recording is ready to view`,
        metadata: {
          callId: data.callId,
          recordingUrl: data.recordingUrl,
        },
        actionUrl: data.callId ? `/call-detail/${data.callId}` : undefined,
        duration: 10000,
        sound: true,
      });
    });

    // Friend joined chat
    socket.on('friend:joined', (data: {
      friendId: string;
      friendName: string;
      conversationId?: string;
    }) => {
      addNotification({
        type: 'friend_joined',
        title: 'Friend Joined',
        message: `${data.friendName} joined the chat`,
        metadata: {
          friendId: data.friendId,
          friendName: data.friendName,
          conversationId: data.conversationId,
        },
        actionUrl: data.conversationId ? `/friends/chat/${data.conversationId}` : undefined,
        duration: 5000,
        sound: false, // Less intrusive
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, user, addNotification]);
}

