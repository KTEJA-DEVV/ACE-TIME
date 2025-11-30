import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  Plus,
  Search,
  Users,
  Sparkles,
  ArrowLeft,
  Send,
  Bot,
  Video,
  Image as ImageIcon,
  Paperclip,
  Smile,
  X,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

interface Conversation {
  _id: string;
  type: 'direct' | 'group' | 'ai_assisted';
  name?: string;
  participants: Array<{ _id: string; name: string; avatar?: string }>;
  aiEnabled: boolean;
  linkedCallId?: string;
  lastMessage?: {
    content: string;
    timestamp: string;
  };
}

interface Message {
  _id: string;
  senderId: { _id: string; name: string; avatar?: string };
  content: string;
  type: 'text' | 'ai_response' | 'image' | 'system';
  aiGenerated: boolean;
  conversationId?: string;
  attachments?: Array<{ type: 'image' | 'file' | 'audio'; url: string; name: string }>;
  reactions?: Array<{ emoji: string; userId: string }>;
  createdAt: string;
}

export default function Messages() {
  const { accessToken, user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isLongPressing, setIsLongPressing] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!accessToken || !user) return;

    console.log('[MESSAGES] Initializing Socket.IO connection');
    const socket = io(SOCKET_URL, {
      auth: { 
        token: accessToken,
        userName: user.name 
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[MESSAGES] ✅ Socket connected');
    });

    socket.on('connect_error', (error) => {
      console.error('[MESSAGES] ❌ Socket connection error:', error);
    });

    // Listen for new messages
    socket.on('message:new', (data: { message: Message; isAi?: boolean }) => {
      console.log('[MESSAGES] 📨 New message received:', data.message);
      
      // Only add message if it's for the currently selected conversation
      if (data.message.conversationId === currentConversationIdRef.current) {
        setMessages((prev) => {
          // Check if message already exists by ID (most reliable)
          const existsById = prev.some(m => m._id === data.message._id);
          if (existsById) {
            console.log('[MESSAGES] ⚠️ Duplicate message by ID, ignoring');
            return prev;
          }
          
          // Check by content + sender + timestamp to catch duplicates from different sources
          const existsByContent = prev.some(m => 
            m.content.trim() === data.message.content.trim() &&
            m.senderId._id === data.message.senderId._id &&
            Math.abs(new Date(m.createdAt).getTime() - new Date(data.message.createdAt).getTime()) < 3000
          );
          if (existsByContent) {
            console.log('[MESSAGES] ⚠️ Duplicate message by content, ignoring');
            return prev;
          }
          
          console.log('[MESSAGES] ✅ Adding new message to list');
          return [...prev, data.message];
        });
      }

      // Update conversation list to show new message
      setConversations((prev) => {
        return prev.map((conv) => {
          if (conv._id === data.message.conversationId) {
            return {
              ...conv,
              lastMessage: {
                content: data.message.content,
                timestamp: data.message.createdAt,
              },
            };
          }
          return conv;
        });
      });
    });

    // Listen for reaction updates
    socket.on('message:reaction', (data: { messageId: string; reactions: Array<{ emoji: string; userId: string }> }) => {
      console.log('[MESSAGES] 🎭 Reaction update:', data);
      setMessages((prev) => {
        return prev.map((msg) => {
          if (msg._id === data.messageId) {
            return { ...msg, reactions: data.reactions };
          }
          return msg;
        });
      });
    });

    socketRef.current = socket;

    return () => {
      console.log('[MESSAGES] Cleaning up Socket.IO connection');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [accessToken, user]);

  // Join/leave conversation room when selection changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) {
      console.warn('[MESSAGES] Socket not initialized yet');
      return;
    }

    // Wait for socket to connect if not already connected
    if (!socket.connected) {
      console.log('[MESSAGES] Socket not connected, waiting...');
      socket.once('connect', () => {
        // Retry after connection
        if (selectedConversation) {
          console.log('[MESSAGES] Socket connected, joining conversation:', selectedConversation._id);
          socket.emit('conversation:join', selectedConversation._id);
          currentConversationIdRef.current = selectedConversation._id;
        }
      });
      return;
    }

    // Leave previous conversation
    if (currentConversationIdRef.current) {
      console.log('[MESSAGES] Leaving conversation:', currentConversationIdRef.current);
      socket.emit('conversation:leave', currentConversationIdRef.current);
    }

    // Join new conversation
    if (selectedConversation) {
      console.log('[MESSAGES] Joining conversation:', selectedConversation._id);
      socket.emit('conversation:join', selectedConversation._id);
      currentConversationIdRef.current = selectedConversation._id;
    } else {
      currentConversationIdRef.current = null;
    }
  }, [selectedConversation]);

  useEffect(() => {
    fetchConversations();
  }, [accessToken]);

  const fetchConversations = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/messages/conversations`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Fetch conversations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${conversationId}/messages`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    }
  };

  const sendMessage = async () => {
    if (!accessToken || !selectedConversation || (!newMessage.trim() && selectedFiles.length === 0)) return;

    const includeAi = newMessage.includes('@ai');
    const messageContent = newMessage.trim();
    
    // Upload files if any
    let attachments: Array<{ type: string; url: string; name: string }> = [];
    if (selectedFiles.length > 0) {
      setUploading(true);
      try {
        const uploadedUrls = await uploadFiles();
        attachments = selectedFiles.map((file, idx) => ({
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
          url: uploadedUrls[idx] || '',
          name: file.name,
        }));
      } catch (error) {
        console.error('File upload error:', error);
      } finally {
        setUploading(false);
      }
    }
    
    // Clear input immediately for better UX
    setNewMessage('');
    setSelectedFiles([]);
    setReplyingTo(null);

    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${selectedConversation._id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: messageContent || '📎',
            requestAiResponse: includeAi,
            attachments: attachments.length > 0 ? attachments : undefined,
          }),
        }
      );

      if (response.ok) {
        // Message will be added via Socket.IO event - don't refetch to avoid duplicates
        // The Socket.IO event will handle adding the message to the UI
        console.log('[MESSAGES] ✅ Message sent, waiting for Socket.IO event');
      } else {
        // If send failed, restore the message
        setNewMessage(messageContent);
        console.error('Failed to send message:', await response.text());
      }
    } catch (error) {
      console.error('Send message error:', error);
      // Restore message on error
      setNewMessage(messageContent);
    }
  };

  const handleMessageLongPress = (message: Message) => {
    // Only allow long press on messages from other users in group conversations
    if (message.senderId._id === user?._id) return;
    if (selectedConversation?.type !== 'group') return;

    // Show confirmation and create private breakout conversation
    if (confirm(`Create a private conversation with ${message.senderId.name}?`)) {
      createPrivateBreakout(message);
    }
  };

  const createPrivateBreakout = async (message: Message) => {
    if (!accessToken || !selectedConversation) return;

    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${selectedConversation._id}/breakout`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUserId: message.senderId._id,
            originalMessageId: message._id,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('Private Chat Created', `Started a private conversation with ${message.senderId.name}`);
        // Navigate to the new private conversation
        setSelectedConversation(data.conversation);
        fetchMessages(data.conversation._id);
        fetchConversations(); // Refresh list
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error', errorData.error || 'Failed to create private chat');
      }
    } catch (error) {
      console.error('Create breakout error:', error);
      toast.error('Error', 'Failed to create private chat. Please try again.');
    }
  };

  const handleMouseDown = (message: Message) => {
    if (message.senderId._id === user?._id) return;
    if (selectedConversation?.type !== 'group') return;

    // Show visual feedback
    setIsLongPressing(message._id);

    const timer = setTimeout(() => {
      handleMessageLongPress(message);
      setIsLongPressing(null);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressing(null);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!accessToken || !selectedConversation) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${selectedConversation._id}/messages/${messageId}/reaction`,
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
        // Reaction will be updated via Socket.IO event
        console.log('[MESSAGES] ✅ Reaction sent');
      }
    } catch (error) {
      console.error('Reaction error:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (!accessToken || selectedFiles.length === 0) return [];
    
    const uploadedUrls: string[] = [];
    
    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_URL}/api/messages/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          // Use full URL for file access
          uploadedUrls.push(`${API_URL}${data.url}`);
        }
      } catch (error) {
        console.error('File upload error:', error);
      }
    }
    
    return uploadedUrls;
  };

  const selectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    fetchMessages(conv._id);
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    const others = conv.participants.filter(p => p._id !== user?._id);
    return others.map(p => p.name).join(', ') || 'New Conversation';
  };

  // Get all unique participants from existing conversations for group creation
  const getAllParticipants = (): Array<{ _id: string; name: string; avatar?: string }> => {
    const participantMap = new Map<string, { _id: string; name: string; avatar?: string }>();
    
    conversations.forEach(conv => {
      conv.participants.forEach(p => {
        if (p._id !== user?._id && !participantMap.has(p._id)) {
          participantMap.set(p._id, p);
        }
      });
    });
    
    return Array.from(participantMap.values());
  };

  const createGroup = async () => {
    if (!accessToken || selectedParticipants.length === 0) return;
    if (!groupName.trim()) {
      toast.error('Error', 'Please enter a group name');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/messages/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantIds: selectedParticipants,
          type: 'group',
          name: groupName.trim(),
          aiEnabled: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Group Created', `Created group "${groupName}"`);
        setShowCreateGroup(false);
        setGroupName('');
        setSelectedParticipants([]);
        fetchConversations();
        setSelectedConversation(data.conversation);
        fetchMessages(data.conversation._id);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error', errorData.error || 'Failed to create group');
      }
    } catch (error) {
      console.error('Create group error:', error);
      toast.error('Error', 'Failed to create group. Please try again.');
    }
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  return (
    <div className="min-h-screen bg-dark-950 bg-animated flex">
      {/* Sidebar - Conversations */}
      <div className="w-80 bg-dark-900 border-r border-dark-800 flex flex-col">
        <div className="p-4 border-b border-dark-800 bg-dark-800/30">
          <div className="flex items-center justify-between mb-4">
            <Link to="/home" className="text-dark-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-primary-400" />
              <h1 className="text-xl font-semibold text-white">Messages</h1>
            </div>
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="w-8 h-8 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg flex items-center justify-center text-primary-400 hover:text-primary-300 transition"
              title="Create group"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-dark-400">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-dark-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-dark-600" />
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv._id}
                onClick={() => selectConversation(conv)}
                className={`w-full p-4 flex items-center space-x-3 hover:bg-dark-800 transition ${
                  selectedConversation?._id === conv._id ? 'bg-dark-800' : ''
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                  conv.type === 'group' 
                    ? 'bg-blue-500/20' 
                    : conv.aiEnabled 
                    ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' 
                    : 'bg-primary-500/20'
                }`}>
                  {conv.type === 'group' ? (
                    <Users className="w-6 h-6 text-blue-400" />
                  ) : conv.aiEnabled ? (
                    <Bot className="w-6 h-6 text-purple-400" />
                  ) : (
                    <MessageSquare className="w-6 h-6 text-primary-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">
                      {getConversationName(conv)}
                    </span>
                    {conv.linkedCallId && (
                      <Video className="w-3 h-3 text-primary-400" />
                    )}
                    {conv.aiEnabled && (
                      <Sparkles className="w-3 h-3 text-purple-400" />
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-dark-400 text-sm truncate">
                      {conv.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main - Messages */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-dark-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                  {selectedConversation.type === 'group' ? (
                    <Users className="w-5 h-5 text-blue-400" />
                  ) : (
                    <MessageSquare className="w-5 h-5 text-primary-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-white font-medium">
                    {getConversationName(selectedConversation)}
                  </h2>
                  <div className="flex items-center space-x-3 mt-1">
                    {selectedConversation.aiEnabled && (
                      <span className="text-purple-400 text-xs flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI-assisted • Type @ai to ask
                      </span>
                    )}
                    {selectedConversation.type === 'group' && (
                      <span className="text-blue-400 text-xs flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        Press & hold messages to reply privately
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => {
                // Use index as fallback key if _id is missing (for optimistic updates)
                const messageKey = msg._id || `temp-${index}-${msg.content.substring(0, 10)}`;
                return (
                <div
                  key={messageKey}
                  className={`flex relative ${
                    msg.senderId._id === user?._id ? 'justify-end' : 'justify-start'
                  }`}
                  onMouseDown={() => handleMouseDown(msg)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleMouseDown(msg);
                  }}
                  onTouchEnd={handleMouseUp}
                  onTouchCancel={handleMouseUp}
                  style={{ cursor: msg.senderId._id !== user?._id && selectedConversation?.type === 'group' ? 'pointer' : 'default' }}
                >
                  {isLongPressing === msg._id && msg.senderId._id !== user?._id && selectedConversation?.type === 'group' && (
                    <div className={`absolute ${msg.senderId._id === user?._id ? 'right-0' : 'left-0'} -top-10 bg-primary-500 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap animate-fade-in z-10 shadow-lg`}>
                      Release to create private chat
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 transition-all relative ${
                      msg.aiGenerated
                        ? 'bg-purple-500/20 border border-purple-500/30'
                        : msg.senderId._id === user?._id
                        ? 'bg-primary-500'
                        : isLongPressing === msg._id
                        ? 'bg-primary-500/30 border-2 border-primary-400 scale-95'
                        : 'bg-dark-800 hover:bg-dark-700'
                    } ${msg.senderId._id !== user?._id && selectedConversation?.type === 'group' ? 'active:scale-95' : ''}`}
                    title={msg.senderId._id !== user?._id && selectedConversation?.type === 'group' ? 'Press and hold to reply privately' : ''}
                  >
                    {msg.aiGenerated && (
                      <div className="flex items-center space-x-1 text-purple-400 text-xs mb-1">
                        <Bot className="w-3 h-3" />
                        <span>AI Assistant</span>
                      </div>
                    )}
                    {msg.senderId._id !== user?._id && !msg.aiGenerated && (
                      <div className="text-primary-400 text-xs mb-1">
                        {msg.senderId.name}
                      </div>
                    )}
                    <p className="text-white">{msg.content}</p>
                    
                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.attachments.map((att, idx) => (
                          <div key={idx}>
                            {att.type === 'image' ? (
                              <img 
                                src={att.url} 
                                alt={att.name}
                                className="max-w-full rounded-lg"
                                style={{ maxHeight: '300px' }}
                              />
                            ) : (
                              <a 
                                href={att.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
                              >
                                <Paperclip className="w-4 h-4" />
                                <span className="text-sm">{att.name}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(
                          msg.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                            if (!acc[r.emoji]) acc[r.emoji] = [];
                            acc[r.emoji].push(r.userId);
                            return acc;
                          }, {})
                        ).map(([emoji, userIds]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg._id, emoji)}
                            className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 transition ${
                              userIds.includes(user?._id || '')
                                ? 'bg-primary-500/30 text-primary-300'
                                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Reaction button */}
                    <div className="mt-2 flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReactionPicker(showReactionPicker === msg._id ? null : msg._id);
                        }}
                        className="text-dark-400 hover:text-dark-300 transition"
                        title="Add reaction"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      
                      {/* Reaction picker */}
                      {showReactionPicker === msg._id && (
                        <div className="flex items-center space-x-1 bg-dark-800 rounded-lg p-2 border border-dark-700">
                          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReaction(msg._id, emoji);
                                setShowReactionPicker(null);
                              }}
                              className="text-xl hover:scale-125 transition"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-dark-400 text-xs mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-dark-800">
              {replyingTo && (
                <div className="mb-2 p-2 bg-dark-800 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-dark-400">Replying to {replyingTo.senderId.name}</p>
                    <p className="text-sm text-dark-300 truncate">{replyingTo.content}</p>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="ml-2 text-dark-500 hover:text-dark-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {selectedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-dark-800 rounded-lg p-2">
                      {file.type.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4 text-primary-400" />
                      ) : (
                        <Paperclip className="w-4 h-4 text-primary-400" />
                      )}
                      <span className="text-sm text-dark-300 truncate max-w-[150px]">{file.name}</span>
                      <button
                        onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                        className="text-dark-500 hover:text-dark-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center space-x-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,audio/*,.pdf,.doc,.docx"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-dark-800 hover:bg-dark-700 rounded-xl transition"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5 text-dark-400" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !uploading && sendMessage()}
                  placeholder={
                    replyingTo
                      ? `Reply to ${replyingTo.senderId.name}...`
                      : selectedConversation.aiEnabled
                      ? 'Type a message... (use @ai for AI response)'
                      : 'Type a message...'
                  }
                  className="flex-1 px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  disabled={uploading}
                />
                <button
                  onClick={sendMessage}
                  disabled={uploading || (!newMessage.trim() && selectedFiles.length === 0)}
                  className="p-3 bg-primary-500 hover:bg-primary-600 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-dark-700 mx-auto mb-4" />
              <h3 className="text-xl text-white mb-2">Select a conversation</h3>
              <p className="text-dark-400">
                Choose a conversation from the sidebar or start a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-2xl p-6 w-full max-w-md border border-dark-800 glass-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary-400" />
                <span>Create Group</span>
              </h2>
              <button
                onClick={() => {
                  setShowCreateGroup(false);
                  setGroupName('');
                  setSelectedParticipants([]);
                }}
                className="text-dark-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-dark-300 mb-2 block">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="text-sm text-dark-300 mb-2 block">Select Participants</label>
                <div className="max-h-60 overflow-y-auto space-y-2 bg-dark-800 rounded-lg p-3 border border-dark-700">
                  {getAllParticipants().length === 0 ? (
                    <p className="text-dark-500 text-sm text-center py-4">
                      No contacts available. Start conversations to add participants.
                    </p>
                  ) : (
                    getAllParticipants().map((participant) => (
                      <button
                        key={participant._id}
                        onClick={() => toggleParticipant(participant._id)}
                        className={`w-full flex items-center space-x-3 p-2 rounded-lg transition ${
                          selectedParticipants.includes(participant._id)
                            ? 'bg-primary-500/20 border border-primary-500/50'
                            : 'bg-dark-700 hover:bg-dark-600'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          selectedParticipants.includes(participant._id)
                            ? 'bg-primary-500'
                            : 'bg-dark-600'
                        }`}>
                          {selectedParticipants.includes(participant._id) ? (
                            <Check className="w-4 h-4 text-white" />
                          ) : (
                            <span className="text-xs text-dark-300">
                              {participant.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-white text-sm flex-1 text-left">{participant.name}</span>
                      </button>
                    ))
                  )}
                </div>
                {selectedParticipants.length > 0 && (
                  <p className="text-xs text-primary-400 mt-2">
                    {selectedParticipants.length} participant{selectedParticipants.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => {
                    setShowCreateGroup(false);
                    setGroupName('');
                    setSelectedParticipants([]);
                  }}
                  className="flex-1 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createGroup}
                  disabled={!groupName.trim() || selectedParticipants.length === 0}
                  className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

