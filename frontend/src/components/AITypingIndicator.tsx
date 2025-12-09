import { Sparkles } from 'lucide-react';

export default function AITypingIndicator() {
  return (
    <div className="flex items-start space-x-3 animate-fade-in">
      {/* AI Avatar */}
      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
        <Sparkles className="w-4 h-4 text-white animate-pulse" />
      </div>

      {/* Typing Bubble */}
      <div className="flex-1 min-w-0">
        <div className="inline-block max-w-[85%] md:max-w-[70%] rounded-2xl rounded-tl-sm px-4 py-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 shadow-md backdrop-blur-sm">
          <div className="flex items-center space-x-1 mb-1.5">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-purple-400 text-xs font-semibold">AceTime AI</span>
            <span className="text-purple-300 text-xs ml-2 animate-pulse">thinking...</span>
          </div>

          {/* Typing Dots */}
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

