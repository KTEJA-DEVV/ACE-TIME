import { cn } from '../utils/cn';

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  showLabel?: boolean;
  label?: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
  animated?: boolean;
}

const colorClasses = {
  primary: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
};

export default function ProgressBar({
  progress,
  className,
  showLabel = false,
  label,
  color = 'primary',
  animated = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-dark-400 text-sm">{label || 'Progress'}</span>
          <span className="text-white text-sm font-medium">{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-dark-800 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            colorClasses[color],
            animated && 'animate-pulse'
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

// Upload progress with cancel
interface UploadProgressProps {
  progress: number;
  fileName: string;
  onCancel?: () => void;
  className?: string;
}

export function UploadProgress({ progress, fileName, onCancel, className }: UploadProgressProps) {
  return (
    <div className={cn('glass-card rounded-lg p-4 space-y-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-white text-sm truncate flex-1 mr-2">{fileName}</p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-dark-400 hover:text-white transition p-1"
            aria-label="Cancel upload"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <ProgressBar progress={progress} showLabel={false} />
      <p className="text-dark-400 text-xs">{Math.round(progress)}% uploaded</p>
    </div>
  );
}

