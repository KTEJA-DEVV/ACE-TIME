import { cn } from '../utils/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({ 
  className, 
  variant = 'rectangular', 
  width, 
  height,
  lines 
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-dark-800/50';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    rounded: 'rounded-xl',
  };

  if (lines && lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              variantClasses[variant],
              i === lines - 1 && 'w-3/4' // Last line shorter
            )}
            style={{ height: height || '1rem' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        className
      )}
      style={{
        width: width || '100%',
        height: height || '1rem',
      }}
    />
  );
}

// Shimmer effect wrapper
export function Shimmer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {children}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

// Pre-built skeleton components
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Shimmer>
      <div className={cn('glass-card rounded-2xl p-6 space-y-4', className)}>
        <div className="flex items-center space-x-4">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={12} />
          </div>
        </div>
        <Skeleton variant="rounded" height={100} />
      </div>
    </Shimmer>
  );
}

export function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i}>
          <div className="glass-card rounded-xl p-4 flex items-center space-x-4">
            <Skeleton variant="circular" width={48} height={48} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="40%" height={16} />
              <Skeleton variant="text" width="70%" height={12} />
            </div>
          </div>
        </Shimmer>
      ))}
    </div>
  );
}

export function SkeletonMessage({ className }: { className?: string }) {
  return (
    <Shimmer>
      <div className={cn('flex items-start space-x-3', className)}>
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="30%" height={12} />
          <Skeleton variant="rounded" width="80%" height={60} />
          <Skeleton variant="text" width="20%" height={10} />
        </div>
      </div>
    </Shimmer>
  );
}

export function SkeletonVideo({ className }: { className?: string }) {
  return (
    <Shimmer>
      <div className={cn('bg-dark-900 rounded-xl overflow-hidden aspect-video', className)}>
        <div className="w-full h-full flex items-center justify-center">
          <Skeleton variant="circular" width={64} height={64} />
        </div>
      </div>
    </Shimmer>
  );
}

