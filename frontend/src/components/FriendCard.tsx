import { useState } from 'react';
import { Video, Phone, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

interface FriendCardProps {
  friend: {
    _id?: string;
    friendId: string;
    name: string;
    email: string;
    avatar?: string;
    lastInteraction?: string;
    isOnline?: boolean;
    conversationId?: string;
  };
  onVideoCall: () => void;
  onAudioCall: () => void;
  onMessage: () => void;
}

export default function FriendCard({
  friend,
  onVideoCall,
  onAudioCall,
  onMessage,
}: FriendCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatLastActive = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative glass-card rounded-2xl p-4 cursor-pointer transition-all group"
    >
      {/* Avatar */}
      <div className="relative mb-3">
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center overflow-hidden mx-auto">
          {friend.avatar ? (
            <img
              src={friend.avatar}
              alt={friend.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white font-bold text-2xl">
              {friend.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Online Status Indicator */}
        {friend.isOnline && (
          <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 rounded-full border-4 border-dark-950 ring-2 ring-green-500/50 animate-pulse" />
        )}
      </div>

      {/* Name */}
      <h3 className="text-white font-semibold text-center mb-1 truncate">
        {friend.name}
      </h3>

      {/* Last Active */}
      <p className="text-dark-400 text-xs text-center mb-3">
        {friend.isOnline ? 'Online' : formatLastActive(friend.lastInteraction)}
      </p>

      {/* Quick Actions - Show on Hover */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
        className="flex items-center justify-center space-x-2"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAudioCall();
          }}
          className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-full transition group-hover:scale-110"
          title="Audio call"
        >
          <Phone className="w-4 h-4 text-green-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onVideoCall();
          }}
          className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-full transition group-hover:scale-110"
          title="Video call"
        >
          <Video className="w-4 h-4 text-blue-400" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMessage();
          }}
          className="p-2 bg-primary-500/20 hover:bg-primary-500/30 rounded-full transition group-hover:scale-110"
          title="Message"
        >
          <MessageSquare className="w-4 h-4 text-primary-400" />
        </button>
      </motion.div>
    </motion.div>
  );
}

