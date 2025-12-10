import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Video,
  Phone,
  MoreVertical,
  Paperclip,
  Loader2,
  Check,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useCallStore } from '../store/call';
import { toast } from '../components/Toast';
import { Skeleton, SkeletonMessage } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import { UploadProgress } from '../components/ProgressBar';
import MessageReactions from '../components/MessageReactions';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();
const SOCKET_URL = getSocketUrl();

interface Message {
  _id: string;
  senderId: { _id: string; name: string; avatar?: string };
  content: string;
  type: 'text' | 'image' | 'system';
  createdAt: string;
  conversationId?: string;
  attachments?: Array<{ type: string; url: string; name?: string }>;
  reactions?: Array<{ emoji: string; userId: string | { _id: string } }>;
  readBy?: Array<string | { _id: string }>;
  metadata?: {
    originalMessageId?: string;
    originalConversationId?: string;
    groupName?: string;
    isContext?: boolean;
    isPrivateReply?: boolean;
  };
}

interface Conversation {
  _id: string;
  otherParticipant: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export default function FriendChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, conversationId } = useParams<{ userId?: string; conversationId?: string }>();
  const { accessToken, user } = useAuthStore();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState(location.state?.initialMessage || '');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [calls, setCalls] = useState<any[]>([]);

  // Get return path from location state (for returning to call)
  const returnPath = location.state?.returnPath || '/friends';
  const fromCall = location.state?.fromCall || false;
  const callRoomId = location.state?.callRoomId;
  
  // Ensure call stays alive when navigating from a call
  // This is critical: the call should continue in the background via FloatingCallOverlay
  const { callStatus, isMinimized, minimizeCall, roomId } = useCallStore();
  
  // If we came from a call and call is active, ensure it's minimized (kept alive)
  useEffect(() => {
    // Check if we're coming from a call and the call is still active
    if (fromCall && (callRoomId || roomId) && (callStatus === 'active' || callStatus === 'waiting') && !isMinimized) {
      console.log('[FRIEND CHAT] 📞 Minimizing active call to keep it alive during private chat');
      console.log('[FRIEND CHAT] Call will continue in background via FloatingCallOverlay');
      minimizeCall();
    }
  }, [fromCall, callRoomId, roomId, callStatus, isMinimized, minimizeCall]);

  // Fetch calls for this conversation (one-on-one only)
  useEffect(() => {
    if (!accessToken || !conversationIdRef.current) return;
    
    const fetchCalls = async () => {
      try {
        const response = await fetch(`${API_URL}/api/users/history`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          // Filter to only show calls with this conversation ID
          const conversationCalls = (data.calls || []).filter((call: any) => {
            const callConvId = call.conversationId?.toString();
            const currentConvId = conversationIdRef.current?.toString();
            return callConvId && currentConvId && callConvId === currentConvId;
          });
          setCalls(conversationCalls);
        }
      } catch (error) {
        console.error('Fetch calls error:', error);
      }
    };

    fetchCalls();
  }, [accessToken, conversationIdRef.current]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-focus input when conversation loads (for immediate typing)
  useEffect(() => {
    if (conversation && !loading && inputRef.current) {
      // Small delay to ensure UI is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [conversation, loading]);

  // Fetch messages from server
  const fetchMessages = useCallback(async (convId: string) => {
    if (!accessToken || !user) return;
    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${convId}/messages`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        
        // Mark unread messages as read
        if (data.messages && data.messages.length > 0 && user?._id) {
          const unreadMessages = data.messages.filter((m: Message) => 
            m.senderId?._id && m.senderId._id !== user._id && 
            (!m.readBy || !m.readBy.some((id: any) => {
              const idStr = typeof id === 'string' ? id : id?._id || id?.toString();
              return idStr === user._id.toString();
            }))
          );
          
          // Mark as read in background (don't block UI)
          unreadMessages.forEach((msg: Message) => {
            fetch(`${API_URL}/api/messages/conversations/${convId}/messages/${msg._id}/read`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}` },
            }).catch(err => console.error('[FRIEND CHAT] Mark read error:', err));
          });
        }
      } else {
        console.error('[FRIEND CHAT] Failed to fetch messages');
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    }
  }, [accessToken, user]);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!accessToken || !user) return;

    console.log('[FRIEND CHAT] Initializing socket connection...');
    
    const socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
        userName: user.name,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[FRIEND CHAT] ✅ Socket connected:', socket.id);
      setSocketConnected(true);
      
      // Re-join conversation room if we have a conversation
      if (conversationIdRef.current) {
        console.log('[FRIEND CHAT] Re-joining conversation:', conversationIdRef.current);
        socket.emit('conversation:join', conversationIdRef.current);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[FRIEND CHAT] ❌ Socket disconnected:', reason);
      setSocketConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[FRIEND CHAT] Socket connection error:', error.message);
      setSocketConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[FRIEND CHAT] 🔄 Socket reconnected after', attemptNumber, 'attempts');
      setSocketConnected(true);
      
      // Re-join conversation room
      if (conversationIdRef.current) {
        socket.emit('conversation:join', conversationIdRef.current);
        // Refresh messages to catch any missed during disconnect
        fetchMessages(conversationIdRef.current);
      }
    });

    // Listen for new messages
    socket.on('message:new', (data: { message: Message }) => {
      console.log('[FRIEND CHAT] 📩 Received new message:', data.message._id);
      
      // Handle both string and object conversationId formats
      let msgConvId: string | undefined;
      if (typeof data.message.conversationId === 'string') {
        msgConvId = data.message.conversationId;
      } else if (data.message.conversationId && typeof data.message.conversationId === 'object') {
        msgConvId = (data.message.conversationId as any)?._id?.toString() || (data.message.conversationId as any)?.toString();
      }
      
      const currentConvId = conversationIdRef.current;
      
      if (msgConvId && currentConvId && msgConvId.toString() === currentConvId.toString()) {
        setMessages((prev) => {
          // Prevent duplicates
          const exists = prev.some((m) => m._id === data.message._id);
          if (exists) {
            console.log('[FRIEND CHAT] Message already exists, skipping');
            return prev;
          }
          console.log('[FRIEND CHAT] ✅ Adding new message to state');
          return [...prev, data.message];
        });
      } else {
        console.log('[FRIEND CHAT] ⚠️ Message for different conversation:', msgConvId, 'vs', currentConvId);
      }
    });

    socketRef.current = socket;

    return () => {
      console.log('[FRIEND CHAT] Cleaning up socket connection');
      if (conversationIdRef.current) {
        socket.emit('conversation:leave', conversationIdRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, user, fetchMessages]);

  // Create or get conversation
  useEffect(() => {
    if (!accessToken || !user) return;

    const initializeConversation = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let convId = conversationId;
        let convData: Conversation | null = null;

        // If we have userId but no conversationId, create/get conversation
        if (userId && !convId) {
          console.log('[FRIEND CHAT] Creating/getting conversation with user:', userId);
          
          const response = await fetch(`${API_URL}/api/messages/conversations/private`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ targetUserId: userId }),
          });

          if (response.ok) {
            const data = await response.json();
            convId = data.conversation._id;
            const otherParticipant = data.conversation.participants?.find(
              (p: any) => p?._id?.toString() !== user?._id?.toString()
            );
            
            if (!otherParticipant) {
              throw new Error('Could not find other participant in conversation');
            }
            
            convData = {
              _id: data.conversation._id,
              otherParticipant: {
                _id: otherParticipant._id,
                name: otherParticipant.name || 'Unknown',
                email: otherParticipant.email || '',
                avatar: otherParticipant.avatar,
              },
            };
            console.log('[FRIEND CHAT] Conversation created/retrieved:', convId);
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create conversation');
          }
        } else if (convId) {
          // Fetch existing conversation details
          console.log('[FRIEND CHAT] Fetching conversation:', convId);
          
          const response = await fetch(`${API_URL}/api/messages/conversations/${convId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (response.ok) {
            const data = await response.json();
            const otherParticipant = data.conversation.participants?.find(
              (p: any) => p?._id?.toString() !== user?._id?.toString()
            );
            
            if (!otherParticipant) {
              throw new Error('Could not find other participant in conversation');
            }
            
            convData = {
              _id: data.conversation._id,
              otherParticipant: {
                _id: otherParticipant._id,
                name: otherParticipant.name || 'Unknown',
                email: otherParticipant.email || '',
                avatar: otherParticipant.avatar,
              },
            };
          } else {
            throw new Error('Conversation not found');
          }
        }

        if (convId && convData && convData.otherParticipant) {
          conversationIdRef.current = convId;
          setConversation(convData);
          
          // Fetch messages (this will show chat history if any exists)
          await fetchMessages(convId);
          
          // Join conversation room for real-time updates
          if (socketRef.current?.connected) {
            console.log('[FRIEND CHAT] ✅ Joining conversation room:', convId);
            socketRef.current.emit('conversation:join', convId);
          } else {
            console.warn('[FRIEND CHAT] ⚠️ Socket not connected, will join when connected');
          }
        } else {
          throw new Error('Could not initialize conversation - missing data');
        }
      } catch (err: any) {
        console.error('[FRIEND CHAT] Error initializing conversation:', err);
        setError(err.message || 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    initializeConversation();
  }, [accessToken, user, userId, conversationId, fetchMessages]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!accessToken || !conversationIdRef.current) {
      toast.error('Error', 'Not connected to conversation');
      return;
    }
    
    if (!newMessage.trim() && selectedFiles.length === 0) {
      return;
    }

    const messageContent = newMessage.trim();
    setSending(true);
    
    try {
      // Handle file uploads first if any
      let attachments: any[] = [];
      if (selectedFiles.length > 0) {
        setUploading(true);
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });

        const uploadResponse = await fetch(`${API_URL}/api/images/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          attachments = uploadData.images.map((img: any) => ({
            type: 'image',
            url: img.url,
            name: img.filename,
          }));
        } else {
          throw new Error('Failed to upload files');
        }
        setSelectedFiles([]);
      }

      // Clear input immediately for better UX
      setNewMessage('');

      const response = await fetch(
        `${API_URL}/api/messages/conversations/${conversationIdRef.current}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: messageContent || '',
            requestAiResponse: false,
            attachments: attachments.length > 0 ? attachments : undefined,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Add message to local state (might already be added via socket)
        setMessages((prev) => {
          const exists = prev.some((m) => m._id === data.message._id);
          if (exists) return prev;
          return [...prev, data.message];
        });
        console.log('[FRIEND CHAT] ✅ Message sent successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        // Restore message on error
        setNewMessage(messageContent);
        toast.error('Failed to send', errorData.error || 'Please try again');
      }
    } catch (error: any) {
      console.error('Send message error:', error);
      setNewMessage(messageContent); // Restore on error
      toast.error('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleStartCall = async (video: boolean = true) => {
    if (!accessToken || !user || !conversation?.otherParticipant?._id) return;

    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioOnly: !video,
          participants: [conversation.otherParticipant._id.toString()],
          conversationId: conversationIdRef.current, // Link call to conversation
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Navigate to call with return path to this conversation
        navigate(`/call/${data.roomId}`, { 
          state: { 
            returnPath: `/friends/chat/${conversationIdRef.current}`,
            conversationId: conversationIdRef.current,
            fromPrivateChat: true,
          } 
        });
        toast.success('Call Started', 'Starting call with transcription and recording...');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error', errorData.error || 'Failed to start call');
      }
    } catch (error) {
      console.error('Start call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  // Handle emoji reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!accessToken || !conversationIdRef.current) return;

    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${conversationIdRef.current}/messages/${messageId}/reaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Update message in local state
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? { ...msg, reactions: data.message.reactions || [] }
              : msg
          )
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error', errorData.error || 'Failed to add reaction');
      }
    } catch (error) {
      console.error('Reaction error:', error);
      toast.error('Error', 'Failed to add reaction');
    }
  };

  // Handle remove reaction (same endpoint, toggles)
  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    // Same as handleReaction - the backend toggles
    handleReaction(messageId, emoji);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-3 flex-1">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="150px" height={16} />
                <Skeleton variant="text" width="80px" height={12} />
              </div>
            </div>
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="circular" width={40} height={40} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonMessage key={i} className={i % 2 === 0 ? '' : 'flex-row-reverse'} />
          ))}
        </div>
        <div className="sticky bottom-0 bg-dark-900 border-t border-dark-800/50 p-3">
          <Skeleton variant="rounded" height={44} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50 px-4 py-3">
          <button
            onClick={() => navigate(returnPath)}
            className="p-2 rounded-lg hover:bg-dark-800/50 transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </header>
        <div className="flex-1">
          <ErrorState
            title="Failed to load conversation"
            message={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              // Retry logic will be handled by useEffect
            }}
            variant="default"
          />
        </div>
      </div>
    );
  }

  // No conversation found
  if (!conversation) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center px-6">
          <MessageSquare className="w-16 h-16 text-dark-700 mx-auto mb-4" />
          <p className="text-dark-400 mb-4">Conversation not found</p>
          <button
            onClick={() => navigate(returnPath)}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col pb-16 md:pb-0">
      {/* Header - WhatsApp style */}
      <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button
              onClick={() => {
                if (fromCall && callRoomId) {
                  // Return to call
                  navigate(`/call/${callRoomId}`);
                } else {
                  navigate(returnPath);
                }
              }}
              className="p-2 rounded-lg hover:bg-dark-800/50 transition"
              title={fromCall ? 'Return to call' : 'Go back'}
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            
            {/* Avatar */}
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              {conversation.otherParticipant.avatar ? (
                <img 
                  src={conversation.otherParticipant.avatar} 
                  alt={conversation.otherParticipant.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold">
                  {conversation.otherParticipant.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Name and status */}
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-semibold text-base truncate">
                {conversation.otherParticipant.name}
              </h2>
              <p className="text-dark-400 text-xs truncate flex items-center gap-1">
                {fromCall ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse"></span>
                    <span>In call</span>
                  </>
                ) : socketConnected ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 bg-dark-500 rounded-full"></span>
                    <span>Connecting...</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Call buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleStartCall(false)}
              className="p-2.5 rounded-lg hover:bg-dark-800/50 transition"
              title="Audio call"
            >
              <Phone className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => handleStartCall(true)}
              className="p-2.5 rounded-lg hover:bg-dark-800/50 transition"
              title="Video call"
            >
              <Video className="w-5 h-5 text-white" />
            </button>
            <button
              className="p-2.5 rounded-lg hover:bg-dark-800/50 transition"
              title="More options"
            >
              <MoreVertical className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages area - WhatsApp style */}
      <div className="flex-1 overflow-y-auto bg-dark-950 bg-[url('data:image/svg+xml,%3Csvg%20width=%22100%22%20height=%22100%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cdefs%3E%3Cpattern%20id=%22grid%22%20width=%22100%22%20height=%22100%22%20patternUnits=%22userSpaceOnUse%22%3E%3Cpath%20d=%22M%20100%200%20L%200%200%200%20100%22%20fill=%22none%22%20stroke=%22%231a1a2e%22%20stroke-width=%221%22/%3E%3C/pattern%3E%3C/defs%3E%3Crect%20width=%22100%22%20height=%22100%22%20fill=%22url(%23grid)%22/%3E%3C/svg%3E')] bg-opacity-30">
        <div className="px-4 py-6 space-y-3">
          {/* Call History Section - Only for one-on-one conversations */}
          {calls.length > 0 && (
            <div className="mb-4 pb-4 border-b border-dark-800/50">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center space-x-2">
                <Video className="w-4 h-4 text-primary-400" />
                <span>Call History ({calls.length})</span>
              </h3>
              <div className="space-y-2">
                {calls.map((call) => {
                  const formatDate = (dateString: string) => {
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
                    if (diffHours < 1) return 'Just now';
                    if (diffHours < 24) return `${diffHours}h ago`;
                    if (diffHours < 48) return 'Yesterday';
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  };
                  const formatDuration = (seconds: number) => {
                    if (!seconds) return '0:00';
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                  };
                  
                  return (
                    <div
                      key={call._id}
                      className="glass-card rounded-lg p-3 border border-dark-800/50 hover:border-primary-500/50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Video className="w-4 h-4 text-primary-400" />
                            <span className="text-white text-sm font-medium">
                              {formatDate(call.startedAt)}
                            </span>
                            <span className="text-dark-500">•</span>
                            <span className="text-dark-400 text-xs">
                              {formatDuration(call.duration)}
                            </span>
                          </div>
                          {call.notesId?.summary && (
                            <p className="text-dark-300 text-xs line-clamp-1">
                              {call.notesId.summary}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            window.location.href = `/call/${call._id}/summary`;
                          }}
                          className="ml-3 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg transition text-xs flex items-center space-x-1"
                          title="View call summary"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Summary</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-primary-400" />
              </div>
              <h3 className="text-white font-medium text-lg mb-2">Start a conversation</h3>
              <p className="text-dark-400 text-sm text-center max-w-xs">
                Say hello to {conversation.otherParticipant.name}! Your messages are private and only visible to you two.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.senderId?._id === user?._id;
              
              // System messages
              if (msg.type === 'system') {
                return (
                  <div key={msg._id} className="flex justify-center animate-fade-in my-2">
                    <div className="bg-dark-800/50 border border-primary-500/30 rounded-full px-4 py-1.5 max-w-[80%]">
                      <p className="text-xs text-primary-400 text-center">
                        {msg.content}
                        {msg.metadata?.groupName && (
                          <span className="text-dark-400 ml-1">
                            • Tap to view original
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  key={msg._id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2 shadow-md ${
                      isOwn
                        ? 'bg-primary-500 rounded-tr-sm'
                        : 'bg-dark-800/90 rounded-tl-sm'
                    }`}
                  >
                    {!isOwn && (
                      <div className="text-primary-400 text-xs mb-1 font-medium">
                        {msg.senderId?.name || 'Unknown'}
                      </div>
                    )}
                    {msg.metadata?.isContext && msg.metadata?.groupName && (
                      <div className="mb-2 p-2 bg-dark-700/50 rounded-lg border-l-2 border-primary-500/50">
                        <p className="text-xs text-primary-400 mb-1">
                          Private reply from {msg.metadata.groupName}
                        </p>
                        <p className="text-xs text-dark-300 italic">
                          {msg.content}
                        </p>
                      </div>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {msg.attachments.map((att, idx) => (
                          <div key={idx}>
                            {att.type === 'image' ? (
                              <img
                                src={att.url}
                                alt={att.name || 'Image'}
                                className="max-w-full rounded-lg"
                                loading="lazy"
                              />
                            ) : (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
                              >
                                <Paperclip className="w-4 h-4" />
                                <span className="text-sm">{att.name || 'File'}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.content && !msg.metadata?.isContext && (
                      <p className="text-sm text-white whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}
                    <div className={`flex items-center justify-end gap-1 text-xs mt-1 ${isOwn ? 'text-primary-100' : 'text-dark-400'}`}>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isOwn && (
                        <span 
                          className="ml-1" 
                          title={msg.readBy && conversation?.otherParticipant?._id && msg.readBy.some((id: any) => {
                            const idStr = typeof id === 'string' ? id : id?._id || id?.toString();
                            return idStr === conversation.otherParticipant._id.toString();
                          }) ? "Read" : "Delivered"}
                        >
                          {msg.readBy && conversation?.otherParticipant?._id && msg.readBy.some((id: any) => {
                            const idStr = typeof id === 'string' ? id : id?._id || id?.toString();
                            return idStr === conversation.otherParticipant._id.toString();
                          }) ? (
                            <Check className="w-3 h-3 text-blue-400" />
                          ) : (
                            <Check className="w-3 h-3 text-dark-400" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Message Reactions */}
                    <MessageReactions
                      reactions={msg.reactions}
                      currentUserId={user?._id}
                      onReactionClick={(emoji: string) => handleReaction(msg._id, emoji)}
                      onRemoveReaction={(emoji: string) => handleRemoveReaction(msg._id, emoji)}
                      messageId={msg._id}
                    />
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && selectedFiles.length > 0 && (
        <div className="sticky bottom-16 bg-dark-900 border-t border-dark-800/50 p-3">
          {selectedFiles.map((file, idx) => (
            <UploadProgress
              key={idx}
              progress={50} // TODO: Implement actual upload progress tracking
              fileName={file.name}
              onCancel={() => {
                setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                setUploading(false);
              }}
              className="mb-2"
            />
          ))}
        </div>
      )}

      {/* Input area - WhatsApp style */}
      <div className="sticky bottom-0 bg-dark-900 border-t border-dark-800/50 p-3">
        {selectedFiles.length > 0 && !uploading && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <button
                  onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end space-x-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-lg hover:bg-dark-800/50 transition"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5 text-dark-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              disabled={sending}
              className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-full text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 transition disabled:opacity-50"
              autoFocus
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={sending || uploading || (!newMessage.trim() && selectedFiles.length === 0)}
            className="p-2.5 bg-primary-500 hover:bg-primary-600 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
            title="Send message"
          >
            {uploading || sending ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
