import { useEffect, useState } from 'react';
// X icon removed - not used in component

interface TapHintProps {
  message: string;
  duration?: number;
  position?: { x: number; y: number };
  onDismiss?: () => void;
}

export default function TapHint({ 
  message, 
  duration = 2500, 
  position,
  onDismiss 
}: TapHintProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-[200] pointer-events-none animate-fade-in"
      style={{
        left: position?.x ? `${position.x}px` : '50%',
        top: position?.y ? `${position.y - 50}px` : 'auto',
        transform: position?.x ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      }}
      role="tooltip"
      aria-label={message}
    >
      <div className="bg-dark-800/95 backdrop-blur-sm border border-primary-500/50 rounded-lg px-3 py-2 shadow-2xl">
        <p className="text-white text-xs font-medium whitespace-nowrap">
          {message}
        </p>
        {/* Arrow pointing down */}
        {position && (
          <div className="absolute left-1/2 -bottom-1 transform -translate-x-1/2">
            <div className="w-2 h-2 bg-dark-800/95 border-r border-b border-primary-500/50 transform rotate-45"></div>
          </div>
        )}
      </div>
    </div>
  );
}

