import { cn } from '../utils/cn';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export default function LoadingSpinner({ 
  size = 'md', 
  className,
  text,
  fullScreen = false 
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-primary-400', sizeClasses[size])} />
      {text && (
        <p className="mt-2 text-dark-400 text-sm">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
}

// Pulse dots loading
export function PulseDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center space-x-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

// AI Thinking animation
export function AIThinking({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center space-x-3', className)}>
      <div className="relative">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center animate-pulse">
          <span className="text-white text-lg font-bold">AI</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full animate-ping opacity-75" />
      </div>
      <div className="flex flex-col">
        <p className="text-white text-sm font-medium">AI is thinking...</p>
        <PulseDots className="mt-1" />
      </div>
    </div>
  );
}

