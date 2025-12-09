import { cn } from '../utils/cn';
import { InlineEmojiPicker } from './EmojiPicker';

interface Reaction {
  emoji: string;
  userId: string | { _id: string };
}

interface MessageReactionsProps {
  reactions?: Reaction[];
  currentUserId?: string;
  onReactionClick: (emoji: string) => void;
  onRemoveReaction: (emoji: string) => void;
  messageId: string;
  className?: string;
}

export default function MessageReactions({
  reactions = [],
  currentUserId,
  onReactionClick,
  onRemoveReaction,
  className,
}: MessageReactionsProps) {

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const emoji = reaction.emoji;
    const userId = typeof reaction.userId === 'string' ? reaction.userId : reaction.userId._id;
    
    if (!acc[emoji]) {
      acc[emoji] = [];
    }
    acc[emoji].push(userId);
    return acc;
  }, {} as Record<string, string[]>);

  const handleReactionClick = (emoji: string) => {
    const userId = typeof currentUserId === 'string' ? currentUserId : currentUserId;
    const userReactions = groupedReactions[emoji] || [];
    const hasReacted = userId && userReactions.includes(userId);

    if (hasReacted) {
      onRemoveReaction(emoji);
    } else {
      onReactionClick(emoji);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    onReactionClick(emoji);
  };

  if (Object.keys(groupedReactions).length === 0) {
    return (
      <div className={cn('flex items-center gap-1 mt-1', className)}>
        <InlineEmojiPicker onEmojiClick={handleEmojiSelect} />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 mt-2 flex-wrap', className)}>
      {/* Existing reactions */}
      {Object.entries(groupedReactions).map(([emoji, userIds]) => {
        const hasReacted = currentUserId && userIds.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className={cn(
              'px-2 py-1 rounded-full text-xs flex items-center space-x-1 transition-all hover:scale-110',
              hasReacted
                ? 'bg-primary-500/30 text-primary-300 border border-primary-500/50'
                : 'bg-dark-700/50 text-dark-300 hover:bg-dark-600/50 border border-dark-700/50'
            )}
            title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
          >
            <span className="text-sm">{emoji}</span>
            <span className="text-xs font-medium">{userIds.length}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <InlineEmojiPicker onEmojiClick={handleEmojiSelect} />
    </div>
  );
}

