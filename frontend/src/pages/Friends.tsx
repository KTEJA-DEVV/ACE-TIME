import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, MessageSquare, Video, Phone, Search, ArrowLeft, UserPlus, Sparkles, PhoneCall } from 'lucide-react';
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

// Friend from network connections
interface NetworkFriend {
  _id: string;
  connectedUserId: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  status: string;
  lastInteractionAt?: string;
}

// Private conversation
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
  unreadCount?: number;
}

// Combined friend item for display
interface FriendItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  conversationId?: string;
  lastMessage?: {
    content: string;
    isOwn: boolean;
    timestamp: string;
  };
  hasConversation: boolean;
  updatedAt: string;
  unreadCount?: number;
}

export default function Friends() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (accessToken && user) {
      fetchAllFriends();
    }
    
    // Listen for conversation updates (when new chats are created)
    const handleConversationUpdate = () => {
      console.log('[FRIENDS] 🔄 Conversation updated, refreshing list...');
      // Small delay to ensure backend has processed the update
      setTimeout(() => {
        fetchAllFriends();
      }, 500);
    };
    
    window.addEventListener('conversationUpdated', handleConversationUpdate);
    
    // Also refresh periodically to catch any missed updates
    const refreshInterval = setInterval(() => {
      if (accessToken && user) {
        fetchAllFriends();
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      window.removeEventListener('conversationUpdated', handleConversationUpdate);
      clearInterval(refreshInterval);
    };
  }, [accessToken, user]);

  const fetchAllFriends = async () => {
    if (!accessToken || !user) return;
    
    try {
      // Fetch both private conversations and network connections in parallel
      const [conversationsRes, connectionsRes] = await Promise.all([
        fetch(`${API_URL}/api/messages/conversations/private`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch(`${API_URL}/api/network/connections?status=accepted`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
      ]);

      const friendsMap = new Map<string, FriendItem>();

      // Process private conversations first (higher priority - they have chat history)
      if (conversationsRes.ok) {
        const convData = await conversationsRes.json();
        const conversations: PrivateConversation[] = convData.conversations || [];
        
        conversations.forEach((conv) => {
          if (conv.otherParticipant) {
            friendsMap.set(conv.otherParticipant._id, {
              id: conv._id,
              userId: conv.otherParticipant._id,
              name: conv.otherParticipant.name,
              email: conv.otherParticipant.email,
              avatar: conv.otherParticipant.avatar,
              conversationId: conv._id,
              lastMessage: conv.lastMessage ? {
                content: conv.lastMessage.content,
                isOwn: conv.lastMessage.senderId._id === user._id,
                timestamp: conv.lastMessage.timestamp,
              } : undefined,
              hasConversation: true,
              updatedAt: conv.lastMessage?.timestamp || conv.updatedAt,
              unreadCount: conv.unreadCount || 0,
            });
          }
        });
      }

      // Add network connections that don't have conversations yet
      if (connectionsRes.ok) {
        const connData = await connectionsRes.json();
        const connections: NetworkFriend[] = connData.connections || [];
        
        connections.forEach((conn) => {
          if (conn.connectedUserId && !friendsMap.has(conn.connectedUserId._id)) {
            friendsMap.set(conn.connectedUserId._id, {
              id: conn._id,
              userId: conn.connectedUserId._id,
              name: conn.connectedUserId.name,
              email: conn.connectedUserId.email,
              avatar: conn.connectedUserId.avatar,
              conversationId: undefined,
              lastMessage: undefined,
              hasConversation: false,
              updatedAt: conn.lastInteractionAt || new Date().toISOString(),
            });
          }
        });
      }

      // Convert to array and sort by most recent activity
      const friendsList = Array.from(friendsMap.values()).sort((a, b) => {
        // Conversations with messages come first, sorted by recency
        if (a.hasConversation && !b.hasConversation) return -1;
        if (!a.hasConversation && b.hasConversation) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      setFriends(friendsList);
    } catch (error) {
      console.error('Fetch friends error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = async (friend: FriendItem, e?: React.MouseEvent) => {
    if (!accessToken || !user) return;
    
    // Prevent navigation if clicking on call buttons
    if (e) {
      const target = e.target as HTMLElement;
      if (target.closest('button[title="Audio call"]') || target.closest('button[title="Video call"]')) {
        return;
      }
    }
    
    if (friend.conversationId) {
      // Open existing conversation directly
      navigate(`/friends/chat/${friend.conversationId}`);
    } else {
      // Navigate to FriendChat with userId - it will create the conversation
      // This is more reliable than creating here and then navigating
      navigate(`/friends/chat/user/${friend.userId}`);
    }
  };

  const handleStartCall = async (friend: FriendItem, video: boolean = true) => {
    if (!accessToken || !user) return;
    
    try {
      // First, ensure we have a conversation ID (create if needed)
      let conversationId = friend.conversationId;
      
      if (!conversationId) {
        // Create a direct conversation first
        const convResponse = await fetch(`${API_URL}/api/messages/conversations/private`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUserId: friend.userId,
          }),
        });
        
        if (convResponse.ok) {
          const convData = await convResponse.json();
          conversationId = convData.conversation._id;
        }
      }
      
      // Create the call room
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          audioOnly: !video,
          participants: [friend.userId],
          conversationId: conversationId, // Link call to conversation
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Emit call invitation to the target user via socket
        // This will be handled by the socket connection in the app
        // Navigate to private call interface (lighter interface for 1-on-1)
        navigate(`/private-call/${data.roomId}`, {
          state: {
            conversationId: conversationId,
            fromPrivateChat: true,
          },
        });
      } else {
        toast.error('Error', 'Failed to start call');
      }
    } catch (error) {
      console.error('Start call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  // Format timestamp like WhatsApp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (friend.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Count conversations with messages
  const conversationCount = friends.filter(f => f.hasConversation).length;

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
              <h1 className="text-white font-semibold text-lg">Chats</h1>
              <p className="text-dark-400 text-xs">
                {conversationCount > 0 
                  ? `${conversationCount} conversation${conversationCount !== 1 ? 's' : ''}`
                  : `${friends.length} friend${friends.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>
          <Link
            to="/network"
            className="p-2 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg transition"
            title="Find new friends"
          >
            <UserPlus className="w-5 h-5 text-primary-400" />
          </Link>
        </div>

        {/* Search - WhatsApp Style */}
        <div className="px-4 pb-3 bg-dark-900">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or start new chat"
              className="w-full pl-10 pr-4 py-2.5 bg-dark-800/70 border border-dark-700/50 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 focus:bg-dark-800 transition"
            />
          </div>
        </div>
      </header>

      {/* Friends/Chats List */}
      <div className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            {searchQuery ? (
              <>
                <div className="w-20 h-20 bg-dark-800/50 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-10 h-10 text-dark-600" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">No results found</h3>
                <p className="text-dark-400 text-sm max-w-xs">
                  Try a different search term to find your chats
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
                  You have no private conversations yet. Start one from a group chat or call to see it here! 
                  <br /><br />
                  <span className="text-primary-400 font-medium">💡 Tip:</span> During a group chat or live call, 
                  tap a participant's name and select "Reply in private" to start a private conversation.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/network"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-primary-500/25"
                  >
                    <UserPlus className="w-5 h-5" />
                    Find Friends
                  </Link>
                  <Link
                    to="/messages"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-dark-800/50 hover:bg-dark-700/50 text-white font-medium rounded-xl transition-all border border-dark-700"
                  >
                    <PhoneCall className="w-5 h-5" />
                    Join a Call
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-dark-800/30">
            {filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className="px-4 py-3 hover:bg-dark-800/40 active:bg-dark-800/60 cursor-pointer transition-colors bg-dark-950/50 group"
                onClick={(e) => handleOpenChat(friend, e)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar - WhatsApp Style */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center overflow-hidden">
                      {friend.avatar ? (
                        <img 
                          src={friend.avatar} 
                          alt={friend.name} 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-semibold text-xl">
                          {friend.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* Online indicator - could add later */}
                  </div>

                  {/* Content - WhatsApp Style */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white font-medium text-[15px] truncate">
                        {friend.name}
                      </h3>
                      {friend.lastMessage && (
                        <span className="text-dark-500 text-xs flex-shrink-0 ml-2">
                          {formatTimestamp(friend.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {friend.lastMessage ? (
                        <p className="text-dark-400 text-sm truncate flex-1 min-w-0">
                          {friend.lastMessage.isOwn && (
                            <span className="text-dark-500 mr-1">You: </span>
                          )}
                          <span className="truncate">{friend.lastMessage.content}</span>
                        </p>
                      ) : friend.hasConversation ? (
                        <p className="text-dark-500 text-sm italic">No messages yet</p>
                      ) : (
                        <p className="text-dark-500 text-sm flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>Tap to start chatting</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions - WhatsApp Style (Always Visible) */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCall(friend, false);
                      }}
                      className="p-2.5 bg-dark-800/50 hover:bg-green-500/20 rounded-full transition group"
                      title="Audio call"
                    >
                      <Phone className="w-4 h-4 text-dark-400 group-hover:text-green-400 transition" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCall(friend, true);
                      }}
                      className="p-2.5 bg-dark-800/50 hover:bg-blue-500/20 rounded-full transition group"
                      title="Video call"
                    >
                      <Video className="w-4 h-4 text-dark-400 group-hover:text-blue-400 transition" />
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
