import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ArrowLeft, UserPlus, Users, Filter } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useCallStore } from '../store/call';
import { toast } from '../components/Toast';
import FriendCard from '../components/FriendCard';
import CallNotification from '../components/CallNotification';

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
  callHistory?: Array<{
    callId: string;
    type: 'video' | 'audio';
    duration: number;
    timestamp: Date;
  }>;
  friendshipId: string;
}

type FilterType = 'all' | 'online' | 'offline';

export default function FriendsEnhanced() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  const callStore = useCallStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [incomingCall, setIncomingCall] = useState<{
    caller: { id: string; name: string; avatar?: string };
    callType: 'video' | 'audio';
    callId: string;
    conversationId?: string;
  } | null>(null);

  // Fetch friends from new API
  const fetchFriends = async () => {
    if (!accessToken || !user) return;

    try {
      const response = await fetch(`${API_URL}/api/friends`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
        
        // Request online status for all friends
        if (callStore.socket && callStore.socket.connected) {
          const friendIds = data.friends.map((f: Friend) => f.friendId);
          callStore.socket.emit('friends:online-status', { friendIds });
        }
      }
    } catch (error) {
      console.error('Fetch friends error:', error);
      toast.error('Error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  // Initialize and listen for Socket.IO events
  useEffect(() => {
    if (!accessToken || !user) return;

    fetchFriends();

    // Initialize socket if needed
    if (!callStore.socket || !callStore.socket.connected) {
      callStore.initSocket(accessToken, user.name);
    }

    const socket = callStore.socket;
    if (!socket) return;

    // Listen for incoming private calls
    const handleIncomingCall = (data: {
      caller: { id: string; name: string; avatar?: string };
      callType: 'video' | 'audio';
      callId: string;
      conversationId?: string;
    }) => {
      console.log('[FRIENDS] 📞 Incoming private call:', data);
      setIncomingCall(data);
    };

    // Listen for online status updates
    const handleOnlineStatus = (status: Record<string, boolean>) => {
      setOnlineStatus((prev) => ({ ...prev, ...status }));
    };

    const handleUserOnline = (data: { userId: string }) => {
      setOnlineStatus((prev) => ({ ...prev, [data.userId]: true }));
    };

    const handleUserOffline = (data: { userId: string }) => {
      setOnlineStatus((prev) => ({ ...prev, [data.userId]: false }));
    };

    socket.on('private-call-incoming', handleIncomingCall);
    socket.on('friends:online-status', handleOnlineStatus);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);

    // Request online status on connect
    if (socket.connected) {
      const friendIds = friends.map((f) => f.friendId);
      if (friendIds.length > 0) {
        socket.emit('friends:online-status', { friendIds });
      }
    }

    return () => {
      socket.off('private-call-incoming', handleIncomingCall);
      socket.off('friends:online-status', handleOnlineStatus);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
    };
  }, [accessToken, user, callStore.socket]);

  // Request online status when friends list changes
  useEffect(() => {
    if (callStore.socket && callStore.socket.connected && friends.length > 0) {
      const friendIds = friends.map((f) => f.friendId);
      callStore.socket.emit('friends:online-status', { friendIds });
    }
  }, [friends, callStore.socket]);

  const handleVideoCall = async (friend: Friend) => {
    if (!accessToken || !user) return;

    try {
      // Create private call
      const response = await fetch(`${API_URL}/api/calls/private`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: friend.friendId,
          type: 'video',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Emit call initiation via socket
        if (callStore.socket) {
          callStore.socket.emit('private-call-initiate', {
            recipientId: friend.friendId,
            callType: 'video',
            callId: data.callId,
          });
        }

        // Navigate to FaceTime interface
        navigate(`/call/private/${data.callId}`, {
          state: {
            recipientId: friend.friendId,
            recipientName: friend.name,
            recipientAvatar: friend.avatar,
          },
        });
      } else {
        const error = await response.json();
        toast.error('Error', error.error || 'Failed to start call');
      }
    } catch (error) {
      console.error('Start video call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  const handleAudioCall = async (friend: Friend) => {
    if (!accessToken || !user) return;

    try {
      const response = await fetch(`${API_URL}/api/calls/private`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: friend.friendId,
          type: 'audio',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (callStore.socket) {
          callStore.socket.emit('private-call-initiate', {
            recipientId: friend.friendId,
            callType: 'audio',
            callId: data.callId,
          });
        }

        navigate(`/call/private/${data.callId}`, {
          state: {
            recipientId: friend.friendId,
            recipientName: friend.name,
            recipientAvatar: friend.avatar,
          },
        });
      } else {
        const error = await response.json();
        toast.error('Error', error.error || 'Failed to start call');
      }
    } catch (error) {
      console.error('Start audio call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  const handleMessage = (friend: Friend) => {
    navigate(`/friends/chat/user/${friend.friendId}`);
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !accessToken) return;

    try {
      // Accept call on backend
      const response = await fetch(`${API_URL}/api/calls/private/${incomingCall.callId}/accept`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        // Emit accept via socket
        if (callStore.socket) {
          callStore.socket.emit('private-call-accept', { callId: incomingCall.callId });
        }

        // Navigate to FaceTime interface
        navigate(`/call/private/${incomingCall.callId}`, {
          state: {
            recipientId: incomingCall.caller.id,
            recipientName: incomingCall.caller.name,
            recipientAvatar: incomingCall.caller.avatar,
            conversationId: incomingCall.conversationId,
          },
        });

        setIncomingCall(null);
      }
    } catch (error) {
      console.error('Accept call error:', error);
      toast.error('Error', 'Failed to accept call');
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall || !accessToken) return;

    try {
      await fetch(`${API_URL}/api/calls/private/${incomingCall.callId}/decline`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (callStore.socket) {
        callStore.socket.emit('private-call-decline', { callId: incomingCall.callId });
      }

      setIncomingCall(null);
    } catch (error) {
      console.error('Decline call error:', error);
    }
  };

  const filteredFriends = friends.filter((friend) => {
    const matchesSearch =
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === 'all') return matchesSearch;
    if (filter === 'online') return matchesSearch && onlineStatus[friend.friendId] === true;
    if (filter === 'offline') return matchesSearch && onlineStatus[friend.friendId] !== true;

    return matchesSearch;
  });

  const onlineCount = friends.filter((f) => onlineStatus[f.friendId] === true).length;

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
      {/* Incoming Call Notification */}
      {incomingCall && (
        <CallNotification
          callData={{
            caller: incomingCall.caller,
            callType: incomingCall.callType,
            callId: incomingCall.callId,
            conversationId: incomingCall.conversationId,
          }}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

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
                {onlineCount > 0 ? `${onlineCount} online` : `${friends.length} friend${friends.length !== 1 ? 's' : ''}`}
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

        {/* Search and Filters */}
        <div className="px-4 pb-3 space-y-2">
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

          {/* Filter Buttons */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-dark-400" />
            {(['all', 'online', 'offline'] as FilterType[]).map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === filterType
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50'
                }`}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Friends Grid */}
      <div className="pb-20 px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6">
              <Users className="w-12 h-12 text-primary-400" />
            </div>
            <h3 className="text-white font-semibold text-xl mb-3">
              {searchQuery || filter !== 'all' ? 'No friends found' : 'No friends yet'}
            </h3>
            <p className="text-dark-400 text-sm max-w-sm mb-6">
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Start connecting with people to build your network'}
            </p>
            <Link
              to="/network"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-primary-500/25"
            >
              <UserPlus className="w-5 h-5" />
              Find Friends
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredFriends.map((friend) => (
              <FriendCard
                key={friend._id}
                friend={{
                  ...friend,
                  isOnline: onlineStatus[friend.friendId] === true,
                }}
                onVideoCall={() => handleVideoCall(friend)}
                onAudioCall={() => handleAudioCall(friend)}
                onMessage={() => handleMessage(friend)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

