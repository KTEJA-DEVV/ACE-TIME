import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/auth';
import { toast } from './Toast';

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

interface AddFriendPromptProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddFriendPrompt({
  userId,
  userName,
  userAvatar,
  onClose,
  onAdded,
}: AddFriendPromptProps) {
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleAddFriend = async () => {
    if (!accessToken) {
      toast.error('Error', 'Please login to add friends');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/friends/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId: userId }),
      });

      if (response.ok) {
        toast.success('Friend Request Sent', `Friend request sent to ${userName}`);
        onAdded?.();
        onClose();
      } else {
        const error = await response.json();
        if (error.error?.includes('already')) {
          toast.info('Already Friends', `You're already friends with ${userName}`);
        } else {
          toast.error('Error', error.error || 'Failed to send friend request');
        }
      }
    } catch (error) {
      console.error('Add friend error:', error);
      toast.error('Error', 'Failed to send friend request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card rounded-2xl p-6 max-w-md w-full mx-4 border border-primary-500/30"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">Add Friend</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-dark-800/50 transition"
            >
              <X className="w-5 h-5 text-dark-400" />
            </button>
          </div>

          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center overflow-hidden">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-2xl">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-white font-medium">{userName}</p>
              <p className="text-dark-400 text-sm">Would you like to add as a friend?</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg text-white font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddFriend}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 rounded-lg text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Add Friend</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

