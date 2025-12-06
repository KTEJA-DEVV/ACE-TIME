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
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';

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
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Get return path from location state (for returning to call)
  const returnPath = location.state?.returnPath || '/friends';

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch messages from server
  const fetchMessages = useCallback(async (convId: string) => {
    if (!accessToken) return;
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
      } else {
        console.error('[FRIEND CHAT] Failed to fetch messages');
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    }
  }, [accessToken]);

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
      
      const msgConvId = data.message.conversationId;
      if (msgConvId === conversationIdRef.current) {
        setMessages((prev) => {
          // Prevent duplicates
          const exists = prev.some((m) => m._id === data.message._id);
          if (exists) {
            console.log('[FRIEND CHAT] Message already exists, skipping');
            return prev;
          }
          console.log('[FRIEND CHAT] Adding new message to state');
          return [...prev, data.message];
        });
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
            const otherParticipant = data.conversation.participants.find(
              (p: any) => p._id.toString() !== user._id
            );
            convData = {
              _id: data.conversation._id,
              otherParticipant,
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
            const otherParticipant = data.conversation.participants.find(
              (p: any) => p._id.toString() !== user._id
            );
            convData = {
              _id: data.conversation._id,
              otherParticipant,
            };
          } else {
            throw new Error('Conversation not found');
          }
        }

        if (convId && convData) {
          conversationIdRef.current = convId;
          setConversation(convData);
          
          // Fetch messages
          await fetchMessages(convId);
          
          // Join conversation room for real-time updates
          if (socketRef.current?.connected) {
            console.log('[FRIEND CHAT] Joining conversation room:', convId);
            socketRef.current.emit('conversation:join', convId);
          }
        } else {
          throw new Error('Could not initialize conversation');
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
    if (!accessToken || !user || !conversation?.otherParticipant) return;

    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioOnly: !video,
          participants: [conversation.otherParticipant._id],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/call/${data.roomId}`, { 
          state: { returnPath: `/friends/chat/${conversationIdRef.current}` } 
        });
      } else {
        toast.error('Error', 'Failed to start call');
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

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // Trigger re-initialization
    window.location.reload();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          <p className="text-dark-400 text-sm">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Something went wrong</h3>
          <p className="text-dark-400 text-sm mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(returnPath)}
              className="px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-white transition"
            >
              Go Back
            </button>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white flex items-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
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
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header - WhatsApp style */}
      <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button
              onClick={() => navigate(returnPath)}
              className="p-2 rounded-lg hover:bg-dark-800/50 transition"
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
                {socketConnected ? (
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
              const isOwn = msg.senderId._id === user?._id;
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
                        {msg.senderId.name}
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
                    {msg.content && (
                      <p className="text-sm text-white whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}
                    <div className={`text-xs mt-1 ${isOwn ? 'text-primary-100' : 'text-dark-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area - WhatsApp style */}
      <div className="sticky bottom-0 bg-dark-900 border-t border-dark-800/50 p-3">
        {selectedFiles.length > 0 && (
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
