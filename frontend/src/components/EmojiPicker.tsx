import { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import { cn } from '../utils/cn';

interface EmojiPickerButtonProps {
  onEmojiClick: (emoji: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const POPULAR_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯'];

export function EmojiPickerButton({ onEmojiClick, className, size = 'md' }: EmojiPickerButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiClick(emojiData.emoji);
    setShowPicker(false);
  };

  const handleQuickEmoji = (emoji: string) => {
    onEmojiClick(emoji);
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        onClick={() => setShowPicker(!showPicker)}
        className={cn(
          'rounded-lg hover:bg-dark-800/50 transition flex items-center justify-center',
          sizeClasses[size],
          showPicker && 'bg-dark-800/50'
        )}
        title="Add emoji"
      >
        <Smile className={cn('text-dark-400 hover:text-white transition', size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6')} />
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full right-0 mb-2 z-50 animate-fade-in"
        >
          <div className="glass-card rounded-2xl p-3 border border-dark-800/50 shadow-2xl">
            {/* Quick emoji shortcuts */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-dark-800/50">
              <span className="text-xs text-dark-400 font-medium">Quick:</span>
              <div className="flex items-center gap-1.5">
                {POPULAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleQuickEmoji(emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-800/50 transition text-lg"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Emoji Picker */}
            <div className="relative">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width={350}
                height={400}
                previewConfig={{
                  showPreview: false,
                }}
                searchDisabled={false}
                theme={"dark" as any}
                lazyLoadEmojis={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function InlineEmojiPicker({ onEmojiClick, className }: { onEmojiClick: (emoji: string) => void; className?: string }) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiClick(emojiData.emoji);
    setShowPicker(false);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-1.5 rounded-lg hover:bg-dark-800/50 transition"
        title="Add emoji"
      >
        <Smile className="w-4 h-4 text-dark-400 hover:text-white" />
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full left-0 mb-2 z-50 animate-fade-in"
        >
          <div className="glass-card rounded-xl p-2 border border-dark-800/50 shadow-2xl">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={300}
              height={350}
              previewConfig={{ showPreview: false }}
              searchDisabled={false}
              theme={"dark" as any}
              lazyLoadEmojis={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}

