import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MessageSquare, Video, Phone, Search, ArrowLeft, Sparkles, Users, PhoneCall } from 'lucide-react';
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

const API_URL = getApiUrl();

interface PrivateConversation {
  _id: string;
  otherParticipant: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  lastMessage?: {
    content: string;
    senderId: { _id: string; name: string };
    timestamp: string;
  };
  updatedAt: string;
}

export default function PrivateMessages() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Check URL params for conversation ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conversation');
    if (convId) {
      // Navigate to dedicated Friend Chat page (WhatsApp-style)
      navigate(`/friends/chat/${convId}`);
    }
  }, [navigate]);

  useEffect(() => {
    if (accessToken) {
      fetchPrivateConversations();
    }
  }, [accessToken]);

  const fetchPrivateConversations = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/messages/conversations/private`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Fetch private conversations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCall = async (_conversation: PrivateConversation | null, video: boolean = true) => {
    if (!accessToken || !user) return;
    
    try {
      // Create a room for the call
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioOnly: !video }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/call/${data.roomId}`);
      }
    } catch (error) {
      console.error('Start call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  const filteredConversations = conversations
    .filter(conv => conv.otherParticipant) // Filter out conversations without otherParticipant
    .filter(conv => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        conv.otherParticipant?.name?.toLowerCase().includes(query) ||
        conv.lastMessage?.content?.toLowerCase().includes(query)
      );
    });

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-dark-800/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/home')}
              className="p-2 glass-card rounded-lg hover:bg-dark-800/50"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white font-semibold text-lg">Private Messages</h1>
              <p className="text-dark-400 text-xs">{conversations.length} conversations</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleStartCall(null, true)}
              className="p-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition"
              title="Start video call"
            >
              <Video className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => handleStartCall(null, false)}
              className="p-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition"
              title="Start audio call"
            >
              <Phone className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 glass-card"
            />
          </div>
        </div>
      </header>

      {/* Conversations List */}
      <div className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-dark-400">Loading conversations...</div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            {searchQuery ? (
              <>
                <div className="w-20 h-20 bg-dark-800/50 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-10 h-10 text-dark-600" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">No results found</h3>
                <p className="text-dark-400 text-sm max-w-xs">
                  Try a different search term to find your conversations
                </p>
              </>
            ) : (
              <>
                <div className="relative mb-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-full flex items-center justify-center animate-pulse">
                    <MessageSquare className="w-12 h-12 text-primary-400" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
                <h3 className="text-white font-semibold text-xl mb-3">You have no private chats yet</h3>
                <p className="text-dark-400 text-sm max-w-sm mb-6 leading-relaxed">
                  Start a new session from a group chat or call! Private conversations are created when you connect with someone during a call.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/friends"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-primary-500/25"
                  >
                    <Users className="w-5 h-5" />
                    View Friends
                  </Link>
                  <Link
                    to="/messages"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-white font-medium rounded-xl transition-all border border-dark-700"
                  >
                    <PhoneCall className="w-5 h-5" />
                    Start a Call
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-dark-800/50">
            {filteredConversations.map((conv) => (
              <div
                key={conv._id}
                onClick={() => {
                  // Navigate to dedicated Friend Chat page (WhatsApp-style)
                  navigate(`/friends/chat/${conv._id}`);
                }}
                className="px-4 py-3 glass-card-hover cursor-pointer active:bg-dark-800/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-lg">
                        {conv.otherParticipant?.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white font-medium text-sm truncate">
                          {conv.otherParticipant?.name || 'Unknown User'}
                        </h3>
                        {conv.lastMessage && (
                          <span className="text-dark-500 text-xs flex-shrink-0 ml-2">
                            {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage ? (
                        <p className="text-dark-400 text-sm truncate">
                          {conv.lastMessage.senderId._id === user?._id ? 'You: ' : ''}
                          {conv.lastMessage.content}
                        </p>
                      ) : (
                        <p className="text-dark-500 text-xs">No messages yet</p>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCall(conv, false);
                      }}
                      className="p-2 bg-dark-800/50 hover:bg-primary-500/20 rounded-lg transition"
                      title="Audio call"
                    >
                      <Phone className="w-4 h-4 text-dark-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCall(conv, true);
                      }}
                      className="p-2 bg-dark-800/50 hover:bg-primary-500/20 rounded-lg transition"
                      title="Video call"
                    >
                      <Video className="w-4 h-4 text-dark-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

