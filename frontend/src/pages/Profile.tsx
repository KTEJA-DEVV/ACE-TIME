import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Phone,
  Video,
  MessageSquare,
  Bot,
  Clock,
  Users,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';
import EditProfileModal from '../components/EditProfileModal';
import { motion } from 'framer-motion';
import { Skeleton } from '../components/Skeleton';

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

interface ProfileData {
  user: {
    _id: string;
    name: string;
    email?: string;
    avatar?: string;
    bio?: string;
    createdAt: string;
  };
  stats: {
    totalCalls: number;
    totalMessages: number;
    totalAIChats: number;
    totalDuration: number;
  };
  recentActivity: any[];
  commonContacts: Array<{
    _id: string;
    name: string;
    avatar?: string;
  }>;
  callHistoryWithUser: any[];
  mutualTopics: string[];
  isOwnProfile: boolean;
}

export default function Profile() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { user: currentUser, accessToken } = useAuthStore();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const targetUserId = userId || currentUser?._id;
  const isOwnProfile = !userId || userId === currentUser?._id;

  useEffect(() => {
    fetchProfile();
  }, [targetUserId, accessToken]);

  const fetchProfile = async () => {
    if (!accessToken || !targetUserId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/users/${targetUserId}/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Failed to load profile');
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (data: { name: string; bio: string; avatar?: string }) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        useAuthStore.getState().setUser(result.user);
        toast.success('Profile Updated', 'Your profile has been saved successfully');
        fetchProfile(); // Refresh profile data
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error', errorData.error || 'Failed to update profile');
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <header className="sticky top-0 z-50 glass-card border-b border-dark-800/50">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="space-y-2">
                <Skeleton variant="text" width="150px" height={20} />
                <Skeleton variant="text" width="100px" height={14} />
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton variant="rounded" height={200} />
            <Skeleton variant="rounded" height={300} />
            <Skeleton variant="rounded" height={200} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Profile not found'}</p>
          <button
            onClick={() => navigate('/home')}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { user, stats, recentActivity, commonContacts, callHistoryWithUser, mutualTopics } = profileData;

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-dark-800/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-dark-800/50 transition"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white font-semibold text-lg">Profile</h1>
              <p className="text-dark-400 text-xs">
                {isOwnProfile ? 'Your profile' : `${user.name}'s profile`}
              </p>
            </div>
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded-lg hover:bg-dark-800/50 transition"
            >
              <Edit className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Profile Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8 text-center"
        >
          <div className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center mb-4 overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-4xl">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{user.name}</h2>
            {user.email && (
              <p className="text-dark-400 text-sm mb-3">{user.email}</p>
            )}
            {user.bio ? (
              <p className="text-dark-300 text-sm max-w-md">{user.bio}</p>
            ) : (
              <p className="text-dark-500 text-sm italic">No bio yet</p>
            )}
            <div className="flex items-center space-x-2 mt-4 text-dark-400 text-xs">
              <Calendar className="w-4 h-4" />
              <span>Joined {formatDate(user.createdAt)}</span>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <Phone className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalCalls}</p>
                <p className="text-xs text-dark-400">Total Calls</p>
              </div>
            </div>
            <p className="text-xs text-dark-500">{formatDuration(stats.totalDuration)}</p>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalMessages}</p>
                <p className="text-xs text-dark-400">Messages</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-pink-500/20 rounded-lg">
                <Bot className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalAIChats}</p>
                <p className="text-xs text-dark-400">AI Chats</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {Math.round((stats.totalCalls + stats.totalMessages) / 10)}
                </p>
                <p className="text-xs text-dark-400">Activity Score</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-6"
          >
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary-400" />
              <span>Recent Activity</span>
            </h3>
            <div className="space-y-3">
              {recentActivity.slice(0, 5).map((activity: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center space-x-3 p-3 bg-dark-800/30 rounded-lg"
                >
                  {activity.type === 'call' || activity.roomId ? (
                    <Video className="w-4 h-4 text-primary-400" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      {activity.type === 'call' || activity.roomId
                        ? `Call - ${formatDuration(activity.duration || 0)}`
                        : activity.content?.substring(0, 50) || 'Message'}
                    </p>
                    <p className="text-dark-500 text-xs">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Common Contacts (only for other users) */}
        {!isOwnProfile && commonContacts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-2xl p-6"
          >
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary-400" />
              <span>Common Contacts</span>
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {commonContacts.map((contact) => (
                <div
                  key={contact._id}
                  className="flex flex-col items-center space-y-2 cursor-pointer hover:opacity-80 transition"
                  onClick={() => navigate(`/profile/${contact._id}`)}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                    {contact.avatar ? (
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-xs text-center truncate w-full">
                    {contact.name}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Call History with User (only for other users) */}
        {!isOwnProfile && callHistoryWithUser.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card rounded-2xl p-6"
          >
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center space-x-2">
              <Video className="w-5 h-5 text-primary-400" />
              <span>Call History</span>
            </h3>
            <div className="space-y-3">
              {callHistoryWithUser.map((call: any) => (
                <div
                  key={call._id}
                  className="flex items-center justify-between p-3 bg-dark-800/30 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Video className="w-4 h-4 text-primary-400" />
                    <div>
                      <p className="text-white text-sm">
                        {call.type === 'video' ? 'Video Call' : 'Audio Call'}
                      </p>
                      <p className="text-dark-500 text-xs">
                        {new Date(call.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-dark-400 text-sm">
                    {formatDuration(call.duration || 0)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Mutual Topics (only for other users) */}
        {!isOwnProfile && mutualTopics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card rounded-2xl p-6"
          >
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary-400" />
              <span>Mutual Topics</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {mutualTopics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-primary-500/20 text-primary-300 rounded-full text-sm border border-primary-500/30"
                >
                  {topic}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isOwnProfile && currentUser && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          user={currentUser}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
