import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
  className?: string;
  variant?: 'default' | 'minimal' | 'full';
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred while loading this content.',
  onRetry,
  showHomeButton = false,
  className,
  variant = 'default',
}: ErrorStateProps) {
  const navigate = useNavigate();

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center space-x-2 text-red-400', className)}>
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-2 text-primary-400 hover:text-primary-300 text-sm underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={cn('min-h-screen flex items-center justify-center bg-dark-950', className)}>
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-white font-semibold text-xl mb-2">{title}</h2>
          <p className="text-dark-400 text-sm mb-6">{message}</p>
          <div className="flex items-center justify-center space-x-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            )}
            {showHomeButton && (
              <button
                onClick={() => navigate('/home')}
                className="px-6 py-3 glass-card border border-dark-700/50 text-white rounded-lg font-medium transition flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>Go Home</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-dark-400 text-sm text-center mb-6 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

