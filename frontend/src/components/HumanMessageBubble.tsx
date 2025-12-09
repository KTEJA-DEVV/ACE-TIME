import { User } from 'lucide-react';

interface HumanMessageBubbleProps {
  content: string;
  avatar?: string;
  userName?: string;
  className?: string;
}

export default function HumanMessageBubble({
  content,
  avatar,
  userName = 'You',
  className = '',
}: HumanMessageBubbleProps) {
  return (
    <div className={`flex items-start space-x-3 justify-end ${className}`}>
      {/* Message Bubble */}
      <div className="flex-1 min-w-0 flex justify-end">
        <div className="inline-block max-w-[85%] md:max-w-[70%] rounded-2xl rounded-tr-sm px-4 py-3 bg-primary-500 shadow-md">
          <div className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      </div>

      {/* User Avatar */}
      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
        {avatar ? (
          <img
            src={avatar}
            alt={userName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <User className="w-4 h-4 text-white" />
        )}
      </div>
    </div>
  );
}

