import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Video,
  Plus,
  LogIn,
  Clock,
  LogOut,
  Mic,
  Sparkles,
  X,
  MessageSquare,
  Target,
  Wand2,
  Users,
  ChevronRight,
  UserPlus,
  Menu,
  User,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useCallStore } from '../store/call';
import GlobalSearch from '../components/GlobalSearch';

export default function Home() {
  const navigate = useNavigate();
  const { user, accessToken, logout, refreshAccessToken } = useAuthStore();
  const { createRoom, initSocket, clearCall } = useCallStore();

  // Cleanup any leftover media when returning to home
  useEffect(() => {
    clearCall();
  }, []);
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-menu-container') && !target.closest('.profile-button')) {
        setProfileMenuOpen(false);
      }
      if (!target.closest('.mobile-menu-container') && !target.closest('.mobile-menu-button')) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen || profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [mobileMenuOpen, profileMenuOpen]);

  const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    if (import.meta.env.PROD) {
      return window.location.origin;
    }
    return 'http://localhost:3001';
  };

  // Fetch friends on mount
  useEffect(() => {
    if (accessToken) {
      fetchFriends();
    }
  }, [accessToken]);

  const fetchFriends = async () => {
    if (!accessToken) return;
    setFriendsLoading(true);
    try {
      const API_URL = getApiUrl();
      const response = await fetch(`${API_URL}/api/network/connections?status=accepted`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data.connections || []);
      } else {
        console.warn('Failed to fetch friends:', response.status, response.statusText);
      }
    } catch (error: any) {
      // Network error - backend might be down
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.warn('Fetch friends error: Backend server may not be running on', getApiUrl());
        // Don't show error to user, just log it
      } else {
        console.error('Fetch friends error:', error);
      }
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleStartCall = async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    
    try {
      // Get current token or refresh if needed
      let token = accessToken;
      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          setError('Please login again');
          navigate('/login');
          return;
        }
        token = useAuthStore.getState().accessToken;
      }

      if (!token) {
        setError('Authentication required');
        navigate('/login');
        return;
      }

      initSocket(token, user.name);
      const roomId = await createRoom(token);
      navigate(`/call/${roomId}`);
    } catch (err: any) {
      // If it's a 401, try refreshing token once
      if (err.message?.includes('expired') || err.message?.includes('Session')) {
        try {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            const newToken = useAuthStore.getState().accessToken;
            if (newToken) {
              initSocket(newToken, user.name);
              const roomId = await createRoom(newToken);
              navigate(`/call/${roomId}`);
              return;
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
        setError('Session expired. Please login again.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(err.message || 'Failed to create room');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCall = () => {
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    if (!accessToken || !user) return;

    initSocket(accessToken, user.name);
    setShowJoinModal(false);
    navigate(`/call/${joinCode.trim().toUpperCase()}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-dark-950 bg-animated pb-16 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-dark-800 bg-dark-950/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AceTime</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4 flex-1 max-w-2xl mx-4">
              <GlobalSearch />
              <Link
                to="/messages"
                className="flex items-center space-x-2 text-dark-400 hover:text-white transition px-3 py-2 rounded-lg hover:bg-dark-800/50"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Messages</span>
              </Link>
              <Link
                to="/network"
                className="flex items-center space-x-2 text-dark-400 hover:text-white transition px-3 py-2 rounded-lg hover:bg-dark-800/50"
              >
                <Target className="w-5 h-5" />
                <span>Network</span>
              </Link>
              <Link
                to="/history"
                className="flex items-center space-x-2 text-dark-400 hover:text-white transition px-3 py-2 rounded-lg hover:bg-dark-800/50"
              >
                <Clock className="w-5 h-5" />
                <span>History</span>
              </Link>
            </div>

            {/* Right side: Profile & Mobile Menu */}
            <div className="flex items-center space-x-2">
              {/* Profile Menu */}
              <div className="relative profile-menu-container">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="profile-button w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center hover:bg-primary-600 transition focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <span className="text-white font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </button>

                {/* Profile Dropdown */}
                {profileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-dark-900 rounded-xl shadow-xl border border-dark-800 py-2 z-50">
                      <div className="px-4 py-3 border-b border-dark-800">
                        <p className="text-white font-medium text-sm">{user?.name}</p>
                        <p className="text-dark-400 text-xs truncate">{user?.email}</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center space-x-3 px-4 py-2.5 text-dark-400 hover:text-white hover:bg-dark-800/50 transition"
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">Profile</span>
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center space-x-3 px-4 py-2.5 text-dark-400 hover:text-white hover:bg-dark-800/50 transition"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm">Settings</span>
                      </Link>
                      <div className="border-t border-dark-800 my-1" />
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="mobile-menu-button md:hidden p-2 text-dark-400 hover:text-white transition rounded-lg hover:bg-dark-800/50"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="mobile-menu-container md:hidden border-t border-dark-800 py-3 animate-fade-in">
              <div className="flex flex-col space-y-1">
                <Link
                  to="/messages"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-4 py-3 text-dark-400 hover:text-white hover:bg-dark-800/50 rounded-lg transition"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Messages</span>
                </Link>
                <Link
                  to="/network"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-4 py-3 text-dark-400 hover:text-white hover:bg-dark-800/50 rounded-lg transition"
                >
                  <Target className="w-5 h-5" />
                  <span>Network</span>
                </Link>
                <Link
                  to="/history"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-3 px-4 py-3 text-dark-400 hover:text-white hover:bg-dark-800/50 rounded-lg transition"
                >
                  <Clock className="w-5 h-5" />
                  <span>History</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Welcome */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-dark-400 text-lg">
            Start a new call or join an existing one
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Start Call */}
          <button
            onClick={handleStartCall}
            disabled={loading}
            className="glass rounded-2xl p-8 text-left hover:border-primary-500/50 transition group disabled:opacity-50"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
              <Plus className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Start New Call</h2>
            <p className="text-dark-400">
              Create a room and invite others to join your call
            </p>
          </button>

          {/* Join Call */}
          <button
            onClick={() => setShowJoinModal(true)}
            className="glass rounded-2xl p-8 text-left hover:border-primary-500/50 transition group"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Join Call</h2>
            <p className="text-dark-400">
              Enter a room code to join an existing call
            </p>
          </button>
        </div>


        {/* Quick Access Features */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link
            to="/messages"
            className="glass rounded-2xl p-6 hover:border-primary-500/50 transition-all group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg mb-1">Messages</h3>
                <p className="text-dark-400 text-sm">Chat with AI in the loop</p>
              </div>
              <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-primary-400 transition" />
            </div>
          </Link>

          <Link
            to="/network"
            className="glass rounded-2xl p-6 hover:border-primary-500/50 transition-all group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Target className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg mb-1">Network Hub</h3>
                <p className="text-dark-400 text-sm">Connect visions, leads & offers</p>
              </div>
              <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-primary-400 transition" />
            </div>
          </Link>
        </div>

        {/* Friends Section */}
        <div className="glass rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Friends</h3>
                <p className="text-dark-400 text-xs">{friends.length} connected</p>
              </div>
            </div>
            <Link
              to="/friends"
              className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center space-x-1"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {friendsLoading ? (
            <div className="text-center py-8 text-dark-400 text-sm">Loading friends...</div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="w-12 h-12 text-dark-700 mx-auto mb-3" />
              <p className="text-dark-400 text-sm mb-2">No friends yet</p>
              <Link
                to="/network"
                className="text-primary-400 hover:text-primary-300 text-sm font-medium"
              >
                Connect with people →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {friends.slice(0, 8).map((friend) => (
                <button
                  key={friend._id}
                  onClick={async () => {
                    if (!accessToken || !user) return;
                    try {
                      const API_URL = getApiUrl();
                      const response = await fetch(`${API_URL}/api/messages/conversations/private`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          targetUserId: friend.connectedUserId._id,
                        }),
                      });
                      if (response.ok) {
                        const data = await response.json();
                        // Navigate to dedicated Friend Chat page (WhatsApp-style)
                        navigate(`/friends/chat/${data.conversation._id}`);
                      }
                    } catch (error) {
                      console.error('Start private chat error:', error);
                    }
                  }}
                  className="flex flex-col items-center space-y-2 p-3 glass-card rounded-xl hover:bg-dark-800/50 transition group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {friend.connectedUserId?.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <p className="text-white text-xs font-medium truncate w-full text-center">
                    {friend.connectedUserId?.name || 'Unknown'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="glass rounded-2xl p-8">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-primary-400" />
            <span>Powered by AI</span>
          </h3>
          <div className="grid sm:grid-cols-4 gap-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mic className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Live Transcription</h4>
                <p className="text-dark-400 text-sm mt-1">
                  Real-time speech-to-text
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">AI Notes</h4>
                <p className="text-dark-400 text-sm mt-1">
                  Summaries & action items
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Wand2 className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Dream Weaver</h4>
                <p className="text-dark-400 text-sm mt-1">
                  Real-time image generation
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Smart Matching</h4>
                <p className="text-dark-400 text-sm mt-1">
                  AI-powered connections
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="glass rounded-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Join a Call</h2>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-dark-400 hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-dark-300 text-sm font-medium mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white text-center text-2xl tracking-widest placeholder-dark-500 focus:outline-none focus:border-primary-500 transition"
                placeholder="ABCDEF"
                maxLength={6}
              />
            </div>

            <button
              onClick={handleJoinCall}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-semibold transition"
            >
              Join Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

