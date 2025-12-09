import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  ArrowLeft,
  Send,
  Phone,
  Video,
  Search,
  FileText,
  Play,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';
import ContactContextCard from '../components/ContactContextCard';
import { Skeleton, SkeletonMessage, SkeletonCard } from '../components/Skeleton';
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

interface ThreadItem {
  _id: string;
  type: 'text' | 'ai_response' | 'image' | 'system' | 'call_summary' | 'call_transcript' | 'ai_notes' | 'call';
  content?: string;
  sender?: {
    _id: string;
    name: string;
    avatar?: string;
  };
  reactions?: Array<{ emoji: string; userId: string | { _id: string } }>;
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
    size?: number;
    duration?: number;
  }>;
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
  // Call-specific fields
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  recordingUrl?: string;
  transcriptId?: string;
  notesId?: string;
  participants?: Array<{
    _id: string;
    name: string;
    avatar?: string;
  }>;
}

interface Contact {
  _id: string;
  contact: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  conversationId: string;
  nickname?: string;
  tags: string[];
  aiContext?: {
    summary?: string;
    keyTopics?: string[];
    relationship?: string;
    lastDiscussion?: string;
    suggestedTopics?: string[];
    lastUpdated?: string;
  };
}

export default function ContactChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { contactId } = useParams<{ contactId: string }>();
  const { accessToken, user } = useAuthStore();

  const [contact, setContact] = useState<Contact | null>(null);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<ThreadItem[]>([]);
  const [aiContext, setAiContext] = useState<any>(null);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get contact from location state or fetch
  useEffect(() => {
    if (location.state?.contact) {
      setContact(location.state.contact);
      conversationIdRef.current = location.state.conversationId;
    } else if (contactId && accessToken) {
      fetchContact();
    }
  }, [contactId, accessToken, location.state]);

  // Fetch contact details
  const fetchContact = async () => {
    if (!accessToken || !contactId) return;

    try {
      const response = await fetch(`${API_URL}/api/contacts/${contactId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setContact(data.contact);
        conversationIdRef.current = data.contact.conversationId._id;
      }
    } catch (error) {
      console.error('Fetch contact error:', error);
    }
  };

  // Fetch thread
  const fetchThread = useCallback(async () => {
    if (!accessToken || !contactId) return;

    try {
      const response = await fetch(`${API_URL}/api/contacts/${contactId}/thread`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setThread(data.thread || []);
        setContact(data.contact);
        // Fetch AI context if available
        if (data.contact?.aiContext) {
          setAiContext(data.contact.aiContext);
        }
      }
    } catch (error) {
      console.error('Fetch thread error:', error);
    } finally {
      setLoading(false);
    }
  }, [accessToken, contactId]);

  useEffect(() => {
    if (accessToken && contactId) {
      fetchThread();
    }
  }, [accessToken, contactId, fetchThread]);

  // Initialize Socket.IO
  useEffect(() => {
    if (!accessToken || !user || !conversationIdRef.current) return;

    const socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
        userName: user.name,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[CONTACT CHAT] Socket connected');
      if (conversationIdRef.current) {
        socket.emit('conversation:join', conversationIdRef.current);
      }
    });

    socket.on('message:new', (data: { message: any }) => {
      const msg = data.message;
      if (msg.conversationId?.toString() === conversationIdRef.current?.toString()) {
        setThread((prev) => {
          const exists = prev.some((item) => item._id === msg._id);
          if (exists) return prev;
          return [...prev, {
            _id: msg._id,
            type: msg.type,
            content: msg.content,
            sender: msg.senderId,
            attachments: msg.attachments,
            metadata: msg.metadata,
            createdAt: msg.createdAt,
          }].sort((a: ThreadItem, b: ThreadItem) => {
            const timeA = a.createdAt || a.startedAt || '';
            const timeB = b.createdAt || b.startedAt || '';
            return new Date(timeA).getTime() - new Date(timeB).getTime();
          });
        });
      }
    });

    socketRef.current = socket;

    return () => {
      if (conversationIdRef.current) {
        socket.emit('conversation:leave', conversationIdRef.current);
      }
      socket.disconnect();
    };
  }, [accessToken, user]);

  // Generate or refresh AI context
  const generateContext = useCallback(async () => {
    if (!accessToken || !contactId || isRefreshingContext) return;

    setIsRefreshingContext(true);
    try {
      const response = await fetch(`${API_URL}/api/contacts/${contactId}/generate-context`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAiContext(data.context);
      }
    } catch (error) {
      console.error('Generate context error:', error);
    } finally {
      setIsRefreshingContext(false);
    }
  }, [accessToken, contactId, isRefreshingContext]);

  // Fetch AI context on mount
  useEffect(() => {
    if (contact && contact.aiContext) {
      setAiContext(contact.aiContext);
    } else if (contactId && accessToken && !isRefreshingContext) {
      // Auto-generate if not exists
      generateContext();
    }
  }, [contact, contactId, accessToken, generateContext, isRefreshingContext]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  // Auto-focus input
  useEffect(() => {
    if (contact && !loading && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [contact, loading]);

  // Send message
  const handleSendMessage = async () => {
    if (!accessToken || !conversationIdRef.current || !newMessage.trim()) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${conversationIdRef.current}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: messageContent,
            requestAiResponse: false,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setThread((prev) => {
          const exists = prev.some((item) => item._id === data.message._id);
          if (exists) return prev;
          return [...prev, {
            _id: data.message._id,
            type: data.message.type,
            content: data.message.content,
            sender: data.message.senderId,
            createdAt: data.message.createdAt,
          }];
        });
      } else {
        setNewMessage(messageContent); // Restore on error
        const errorData = await response.json().catch(() => ({}));
        toast.error('Failed to send', errorData.error || 'Please try again');
      }
    } catch (error: any) {
      console.error('Send message error:', error);
      setNewMessage(messageContent);
      toast.error('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Search messages
  const handleSearch = async () => {
    if (!accessToken || !contactId || !searchQuery.trim()) return;

    try {
      const response = await fetch(
        `${API_URL}/api/contacts/${contactId}/thread/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
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
        setThread((prev) =>
          prev.map((item) =>
            item._id === messageId
              ? { ...item, reactions: data.message.reactions || [] }
              : item
          )
        );
      }
    } catch (error) {
      console.error('Reaction error:', error);
    }
  };

  // Handle remove reaction (same endpoint, toggles)
  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    handleReaction(messageId, emoji);
  };

  // Start call
  const handleStartCall = async (video: boolean = true) => {
    if (!accessToken || !contact) return;

    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioOnly: !video,
          participants: [contact.contact._id],
          conversationId: conversationIdRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/call/${data.roomId}`, {
          state: {
            returnPath: `/contacts/${contactId}/chat`,
            conversationId: conversationIdRef.current,
            fromContacts: true,
          },
        });
        toast.success('Call Started', 'Starting call with transcription...');
      }
    } catch (error) {
      console.error('Start call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  // Format timestamp
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format call duration
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-3 flex-1">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="150px" height={16} />
                <Skeleton variant="text" width="200px" height={12} />
              </div>
            </div>
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="circular" width={40} height={40} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {aiContext && <SkeletonCard className="mb-4" />}
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

  if (!contact) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-dark-400 mb-4">Contact not found</p>
          <button
            onClick={() => navigate('/contacts')}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white"
          >
            Back to Contacts
          </button>
        </div>
      </div>
    );
  }

  const displayItems = showSearch && searchQuery ? searchResults : thread;

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <button
              onClick={() => navigate('/contacts')}
              className="p-2 rounded-lg hover:bg-dark-800/50 transition"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            {/* Avatar */}
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
              {contact.contact.avatar ? (
                <img
                  src={contact.contact.avatar}
                  alt={contact.contact.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold">
                  {(contact.nickname || contact.contact.name).charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-semibold text-base truncate">
                {contact.nickname || contact.contact.name}
              </h2>
              <p className="text-dark-400 text-xs truncate">
                {contact.contact.email}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2.5 rounded-lg hover:bg-dark-800/50 transition"
              title="Search"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
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
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="w-full pl-10 pr-4 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 transition"
              />
            </div>
          </div>
        )}
      </header>

      {/* Thread Content */}
      <div className="flex-1 overflow-y-auto bg-dark-950 bg-[url('data:image/svg+xml,%3Csvg%20width=%22100%22%20height=%22100%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cdefs%3E%3Cpattern%20id=%22grid%22%20width=%22100%22%20height=%22100%22%20patternUnits=%22userSpaceOnUse%22%3E%3Cpath%20d=%22M%20100%200%20L%200%200%200%20100%22%20fill=%22none%22%20stroke=%22%231a1a2e%22%20stroke-width=%221%22/%3E%3C/pattern%3E%3C/defs%3E%3Crect%20width=%22100%22%20height=%22100%22%20fill=%22url(%23grid)%22/%3E%3C/svg%3E')] bg-opacity-30">
        <div className="px-4 py-6 space-y-3">
          {/* AI Context Card */}
          {contactId && (
            <ContactContextCard
              context={aiContext}
              onRefresh={generateContext}
              isRefreshing={isRefreshingContext}
            />
          )}
          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <MessageSquare className="w-20 h-20 text-dark-700 mb-4" />
              <h3 className="text-white font-medium text-lg mb-2">Start a conversation</h3>
              <p className="text-dark-400 text-sm text-center max-w-xs">
                Say hello to {contact.nickname || contact.contact.name}! Your messages are private.
              </p>
            </div>
          ) : (
            displayItems.map((item) => {
              // Call item
              if (item.type === 'call') {
                return (
                  <div key={item._id} className="flex justify-center animate-fade-in my-2">
                    <div className="glass-card rounded-xl p-4 border border-primary-500/30 max-w-[80%]">
                      <div className="flex items-center space-x-2 mb-2">
                        <Phone className="w-4 h-4 text-primary-400" />
                        <span className="text-primary-400 text-sm font-semibold">Call</span>
                        {item.duration && (
                          <span className="text-dark-400 text-xs">
                            • {formatDuration(item.duration)}
                          </span>
                        )}
                      </div>
                      <div className="text-dark-300 text-xs mb-2">
                        {item.startedAt && formatTime(item.startedAt)}
                        {item.endedAt && ` - ${formatTime(item.endedAt)}`}
                      </div>
                      {item.recordingUrl && (
                        <a
                          href={`${API_URL}${item.recordingUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 text-sm mt-2"
                        >
                          <Play className="w-4 h-4" />
                          <span>Play Recording</span>
                        </a>
                      )}
                      {item.transcriptId && (
                        <button
                          onClick={() => navigate(`/calls/${item._id}`)}
                          className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300 text-sm mt-2 ml-4"
                        >
                          <FileText className="w-4 h-4" />
                          <span>View Transcript</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // AI Notes item
              if (item.type === 'ai_notes' || item.metadata?.aiSummary) {
                return (
                  <div key={item._id} className="flex justify-center animate-fade-in my-2">
                    <div className="glass-card rounded-xl p-4 border border-purple-500/30 max-w-[85%] bg-purple-500/10">
                      <div className="flex items-center space-x-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-400 text-sm font-semibold">AI Summary</span>
                      </div>
                      {item.metadata?.aiSummary && (
                        <p className="text-white text-sm mb-2">{item.metadata.aiSummary}</p>
                      )}
                      {item.metadata?.aiKeyTopics && item.metadata.aiKeyTopics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.metadata.aiKeyTopics.map((topic: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded border border-purple-500/30"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Regular message
              const isOwn = item.sender?._id === user?._id;
              const isSystem = item.type === 'system';
              const itemTime = (item as any).createdAt || (item as any).startedAt || '';

              return (
                <div
                  key={item._id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2 shadow-md ${
                      isOwn
                        ? 'bg-primary-500 rounded-tr-sm'
                        : isSystem
                        ? 'bg-dark-800/50 border border-primary-500/30'
                        : 'bg-dark-800/90 rounded-tl-sm'
                    }`}
                  >
                    {!isOwn && !isSystem && item.sender && (
                      <div className="text-primary-400 text-xs mb-1 font-medium">
                        {item.sender.name}
                      </div>
                    )}
                    {item.content && (
                      <p className="text-sm text-white whitespace-pre-wrap break-words">
                        {item.content}
                      </p>
                    )}
                    {item.attachments && item.attachments.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {item.attachments.map((att, idx) => (
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
                                <FileText className="w-4 h-4" />
                                <span className="text-sm">{att.name || 'File'}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center justify-end gap-1 text-xs mt-1 ${isOwn ? 'text-primary-100' : 'text-dark-400'}`}>
                      <span>{itemTime && formatTime(itemTime)}</span>
                    </div>

                    {/* Message Reactions - only for text messages */}
                    {item.type === 'text' && (
                      <MessageReactions
                        reactions={item.reactions}
                        currentUserId={user?._id}
                        onReactionClick={(emoji) => handleReaction(item._id, emoji)}
                        onRemoveReaction={(emoji) => handleRemoveReaction(item._id, emoji)}
                        messageId={item._id}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-dark-900 border-t border-dark-800/50 p-3">
        <div className="flex items-end space-x-2">
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
            disabled={sending || !newMessage.trim()}
            className="p-2.5 bg-primary-500 hover:bg-primary-600 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px]"
            title="Send message"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

