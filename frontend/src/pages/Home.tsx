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
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useCallStore } from '../store/call';

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
    <div className="min-h-screen bg-dark-950 bg-animated">
      {/* Header */}
      <header className="border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AceTime</span>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                to="/messages"
                className="flex items-center space-x-2 text-dark-400 hover:text-white transition px-3 py-2"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Messages</span>
              </Link>
              <Link
                to="/network"
                className="flex items-center space-x-2 text-dark-400 hover:text-white transition px-3 py-2"
              >
                <Target className="w-5 h-5" />
                <span>Network</span>
              </Link>
              <Link
                to="/history"
                className="flex items-center space-x-2 text-dark-400 hover:text-white transition px-3 py-2"
              >
                <Clock className="w-5 h-5" />
                <span>History</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-dark-400 hover:text-white transition px-3 py-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
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

