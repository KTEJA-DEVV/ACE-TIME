import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Video,
  Phone,
  Search,
  ArrowLeft,
  UserPlus,
  X,
  Check,
  Clock,
  FileText,
  Sparkles,
  MoreVertical,
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

const API_URL = getApiUrl();

interface Friend {
  _id: string;
  friendId: string;
  name: string;
  email: string;
  avatar?: string;
  lastInteraction?: string;
  friendshipId: string;
  isOnline?: boolean;
  lastActive?: string;
  callHistory?: any[];
  conversationId?: string;
}

interface PendingRequest {
  _id: string;
  userId1: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
}

export default function FriendsEnhanced() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendEmail, setAddFriendEmail] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [showFriendMenu, setShowFriendMenu] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) {
      fetchFriends();
      fetchPendingRequests();
    }
  }, [accessToken]);

  const fetchFriends = async () => {
    if (!accessToken) return;
    
    try {
      // Fetch from both friends API and connections API
      const [friendsRes, connectionsRes] = await Promise.all([
        fetch(`${API_URL}/api/friends`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch(`${API_URL}/api/network/connections?status=accepted`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
      ]);

      const friendsList: Friend[] = [];

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        friendsList.push(...(data.friends || []));
      }

      if (connectionsRes.ok) {
        const data = await connectionsRes.json();
        const connections = data.connections || [];
        connections.forEach((conn: any) => {
          if (conn.connectedUserId && !friendsList.find(f => f.friendId === conn.connectedUserId._id)) {
            friendsList.push({
              _id: conn._id,
              friendId: conn.connectedUserId._id,
              name: conn.connectedUserId.name,
              email: conn.connectedUserId.email,
              avatar: conn.connectedUserId.avatar,
              lastInteraction: conn.lastInteractionAt,
              friendshipId: conn._id,
              isOnline: false, // Will be updated via socket
            });
          }
        });
      }

      // Fetch conversation IDs for friends
      const friendsWithConversations = await Promise.all(
        friendsList.map(async (friend) => {
          try {
            const convRes = await fetch(`${API_URL}/api/messages/conversations/private`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ targetUserId: friend.friendId }),
            });
            if (convRes.ok) {
              const convData = await convRes.json();
              return { ...friend, conversationId: convData.conversation._id };
            }
          } catch (error) {
            console.error('Error fetching conversation:', error);
          }
          return friend;
        })
      );

      setFriends(friendsWithConversations);
    } catch (error) {
      console.error('Fetch friends error:', error);
      toast.error('Error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    if (!accessToken) return;
    
    try {
      const response = await fetch(`${API_URL}/api/friends/pending`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Fetch pending requests error:', error);
    }
  };

  const handleAddFriend = async () => {
    if (!addFriendEmail.trim() || !accessToken) return;
    
    setAddingFriend(true);
    try {
      // Navigate to network page to find and connect with users
      toast.info('Info', 'Redirecting to Network page to find users...');
      setShowAddFriend(false);
      setAddFriendEmail('');
      navigate('/network', { state: { searchQuery: addFriendEmail } });
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to add friend. Please use the Network page to find users.');
    } finally {
      setAddingFriend(false);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    if (!accessToken) return;
    
    try {
      const response = await fetch(`${API_URL}/api/friends/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ friendshipId }),
      });

      if (response.ok) {
        toast.success('Accepted', 'Friend request accepted');
        fetchFriends();
        fetchPendingRequests();
      } else {
        throw new Error('Failed to accept request');
      }
    } catch (error) {
      toast.error('Error', 'Failed to accept friend request');
    }
  };

  const handleStartCall = async (friend: Friend, video: boolean = true) => {
    if (!accessToken) return;
    
    try {
      let conversationId = friend.conversationId;
      
      if (!conversationId) {
        const convResponse = await fetch(`${API_URL}/api/messages/conversations/private`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ targetUserId: friend.friendId }),
        });
        
        if (convResponse.ok) {
          const convData = await convResponse.json();
          conversationId = convData.conversation._id;
        }
      }
      
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          audioOnly: !video,
          participants: [friend.friendId],
          conversationId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/private-call/${data.roomId}`, {
          state: { conversationId, fromPrivateChat: true },
        });
      } else {
        toast.error('Error', 'Failed to start call');
      }
    } catch (error) {
      console.error('Start call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  const handleOpenChat = async (friend: Friend) => {
    if (!accessToken) return;
    
    try {
      let conversationId = friend.conversationId;
      
      if (!conversationId) {
        const response = await fetch(`${API_URL}/api/messages/conversations/private`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ targetUserId: friend.friendId }),
        });
        
        if (response.ok) {
          const data = await response.json();
          conversationId = data.conversation._id;
        }
      }
      
      if (conversationId) {
        navigate(`/friends/chat/${conversationId}`);
      }
    } catch (error) {
      toast.error('Error', 'Failed to open chat');
    }
  };

  const handleViewHistory = (friend: Friend) => {
    // Navigate to friend chat which shows call history
    if (friend.conversationId) {
      navigate(`/friends/chat/${friend.conversationId}`);
    } else {
      handleOpenChat(friend);
    }
  };

  const formatLastActive = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredFriends = friends.filter(friend => {
    const matchesSearch = !searchQuery || 
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filter === 'all' ||
      (filter === 'online' && friend.isOnline) ||
      (filter === 'offline' && !friend.isOnline);
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 bg-animated flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

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
              <h1 className="text-white font-semibold text-lg">Friends</h1>
              <p className="text-dark-400 text-xs">
                {friends.length} {friends.length === 1 ? 'friend' : 'friends'} connected
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddFriend(true)}
            className="p-2 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg transition flex items-center space-x-2"
            title="Add Friend"
          >
            <UserPlus className="w-5 h-5 text-primary-400" />
            <span className="hidden md:inline text-primary-400 text-sm">Add Friend</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="px-4 pb-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
              className="w-full pl-10 pr-4 py-2.5 bg-dark-800/70 border border-dark-700/50 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 focus:bg-dark-800 transition"
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('online')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === 'online'
                  ? 'bg-green-500 text-white'
                  : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50'
              }`}
            >
              Online
            </button>
            <button
              onClick={() => setFilter('offline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === 'offline'
                  ? 'bg-dark-700 text-white'
                  : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50'
              }`}
            >
              Offline
            </button>
          </div>
        </div>
      </header>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
          <h3 className="text-yellow-400 text-sm font-semibold mb-2">
            Pending Friend Requests ({pendingRequests.length})
          </h3>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div
                key={request._id}
                className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center">
                    {request.userId1.avatar ? (
                      <img
                        src={request.userId1.avatar}
                        alt={request.userId1.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold">
                        {request.userId1.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{request.userId1.name}</p>
                    <p className="text-dark-400 text-xs">{request.userId1.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAcceptRequest(request._id)}
                    className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition"
                    title="Accept"
                  >
                    <Check className="w-4 h-4 text-green-400" />
                  </button>
                  <button
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition"
                    title="Decline"
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends Grid */}
      <div className="p-4 pb-20">
        {filteredFriends.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            {searchQuery ? (
              <>
                <div className="w-20 h-20 bg-dark-800/50 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-10 h-10 text-dark-600" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">No friends found</h3>
                <p className="text-dark-400 text-sm max-w-xs">
                  Try a different search term or filter
                </p>
              </>
            ) : (
              <>
                <div className="relative mb-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-full flex items-center justify-center animate-pulse">
                    <Users className="w-12 h-12 text-primary-400" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
                <h3 className="text-white font-semibold text-xl mb-3">No friends yet</h3>
                <p className="text-dark-400 text-sm max-w-sm mb-6 leading-relaxed">
                  Start building your network! Add friends by email or connect with people from your network.
                </p>
                <button
                  onClick={() => setShowAddFriend(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-primary-500/25"
                >
                  <UserPlus className="w-5 h-5" />
                  Add Your First Friend
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFriends.map((friend) => (
              <div
                key={friend._id}
                className="glass-card rounded-xl p-4 border border-dark-800/50 hover:border-primary-500/50 transition group relative"
              >
                {/* Friend Avatar */}
                <div className="relative mb-3">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center overflow-hidden">
                    {friend.avatar ? (
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold text-2xl">
                        {friend.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Online Indicator */}
                  <div
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-dark-950 ${
                      friend.isOnline ? 'bg-green-500' : 'bg-dark-600'
                    }`}
                  />
                </div>

                {/* Friend Info */}
                <div className="text-center mb-3">
                  <h3 className="text-white font-semibold text-base mb-1">{friend.name}</h3>
                  <p className="text-dark-400 text-xs mb-2">{friend.email}</p>
                  <p className="text-dark-500 text-xs flex items-center justify-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {friend.isOnline ? 'Active now' : `Active ${formatLastActive(friend.lastActive || friend.lastInteraction)}`}
                    </span>
                  </p>
                </div>

                {/* Quick Actions - Show on hover */}
                <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleStartCall(friend, true)}
                    className="p-2.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition"
                    title="Video call"
                  >
                    <Video className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleStartCall(friend, false)}
                    className="p-2.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition"
                    title="Audio call"
                  >
                    <Phone className="w-4 h-4 text-green-400" />
                  </button>
                  <button
                    onClick={() => handleOpenChat(friend)}
                    className="p-2.5 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg transition"
                    title="Chat"
                  >
                    <MessageSquare className="w-4 h-4 text-primary-400" />
                  </button>
                  <button
                    onClick={() => {
                      setShowFriendMenu(showFriendMenu === friend._id ? null : friend._id);
                    }}
                    className="p-2.5 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition relative"
                    title="More options"
                  >
                    <MoreVertical className="w-4 h-4 text-dark-400" />
                    {showFriendMenu === friend._id && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-10">
                        <button
                          onClick={() => {
                            handleViewHistory(friend);
                            setShowFriendMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left text-white text-sm hover:bg-dark-700 flex items-center space-x-2"
                        >
                          <FileText className="w-4 h-4" />
                          <span>View History</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowFriendMenu(null);
                            toast.info('Coming Soon', 'Relationship insights feature coming soon');
                          }}
                          className="w-full px-4 py-2 text-left text-white text-sm hover:bg-dark-700 flex items-center space-x-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>AI Insights</span>
                        </button>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-6 max-w-md w-full border border-dark-800/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Add Friend</h2>
              <button
                onClick={() => {
                  setShowAddFriend(false);
                  setAddFriendEmail('');
                }}
                className="p-2 hover:bg-dark-800/50 rounded-lg transition"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-dark-400 text-sm mb-2 block">Email or Username</label>
                <input
                  type="text"
                  value={addFriendEmail}
                  onChange={(e) => setAddFriendEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500/50"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddFriend();
                    }
                  }}
                />
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleAddFriend}
                  disabled={!addFriendEmail.trim() || addingFriend}
                  className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 rounded-lg text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingFriend ? 'Sending...' : 'Send Request'}
                </button>
                <button
                  onClick={() => {
                    setShowAddFriend(false);
                    setAddFriendEmail('');
                  }}
                  className="px-4 py-2.5 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg text-white font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
