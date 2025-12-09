import { Bot, Sparkles } from 'lucide-react';

interface AIMessageBubbleProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export default function AIMessageBubble({
  content,
  isStreaming = false,
  className = '',
}: AIMessageBubbleProps) {
  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      {/* AI Avatar */}
      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
        {isStreaming ? (
          <Sparkles className="w-4 h-4 text-white animate-pulse" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Bubble */}
      <div className="flex-1 min-w-0">
        <div className="inline-block max-w-[85%] md:max-w-[70%] rounded-2xl rounded-tl-sm px-4 py-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 shadow-md backdrop-blur-sm">
          {/* AI Label */}
          <div className="flex items-center space-x-1 mb-1.5">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-purple-400 text-xs font-semibold">AceTime AI</span>
            {isStreaming && (
              <span className="text-purple-300 text-xs ml-2 animate-pulse">typing...</span>
            )}
          </div>

          {/* Message Content */}
          <div className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
            {content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-purple-400 ml-1 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

