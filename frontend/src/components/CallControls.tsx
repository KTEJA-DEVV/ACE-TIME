import { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor,
  UserPlus, 
  Settings, 
  PhoneOff
} from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  onScreenShare?: () => void;
  onAddParticipant?: () => void;
  onSettings?: () => void;
  isScreenSharing?: boolean;
  className?: string;
}

export default function CallControls({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onScreenShare,
  onAddParticipant,
  onSettings,
  isScreenSharing = false,
  className = '',
}: CallControlsProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoreMenu]);

  // Detect screen size for responsive sizing
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 640 && window.innerWidth < 1024);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Responsive button sizes
  const buttonSize = isMobile ? '40px' : isTablet ? '48px' : '56px';
  const endCallSize = isMobile ? '48px' : isTablet ? '56px' : '64px';
  const iconSize = isMobile ? 18 : isTablet ? 20 : 24;
  const gapSize = isMobile ? '8px' : isTablet ? '12px' : '16px';
  const paddingSize = isMobile ? '8px 12px' : isTablet ? '10px 16px' : '12px 20px';

  return (
    <>
      {/* Call Controls Container - Responsive positioning and sizing */}
      <div
        className={`flex items-center justify-center backdrop-blur-lg bg-dark-900/80 rounded-full border border-white/10 shadow-2xl ${className}`}
        style={{ 
          isolation: 'isolate',
          gap: gapSize,
          padding: paddingSize,
          paddingBottom: isMobile 
            ? 'calc(env(safe-area-inset-bottom, 0px) + 8px)' 
            : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        }}
      >
        {/* Mute/Unmute Button - Responsive size */}
        <button
          onClick={onToggleMute}
          className={`relative rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 active:scale-95 shadow-2xl border-2 ${
            isMuted
              ? 'bg-red-500/95 hover:bg-red-600 border-red-400/60 shadow-red-500/60'
              : 'bg-dark-800/95 hover:bg-dark-700/95 border-white/30 shadow-dark-900/60'
          } group overflow-hidden`}
          style={{ 
            width: buttonSize, 
            height: buttonSize, 
            minWidth: buttonSize, 
            minHeight: buttonSize 
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={isMuted}
        >
          {/* Animated background gradient when muted */}
          {isMuted && (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-90 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-red-400/80 animate-ping" style={{ animationDuration: '2s' }} />
            </>
          )}
          
          {/* Glass morphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full z-0" />
          
          {/* Icon with smooth transition and rotation - Properly centered, 24px size */}
          <div className={`relative z-20 flex items-center justify-center transition-all duration-300 ${
            isMuted 
              ? 'group-hover:scale-110 group-hover:rotate-12' 
              : 'group-hover:scale-110'
          }`}>
            {isMuted ? (
              <MicOff 
                size={iconSize}
                className="text-white" 
                strokeWidth={2.5}
                style={{ 
                  display: 'block',
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                  color: '#ffffff',
                  stroke: '#ffffff',
                  fill: 'none',
                  opacity: 1,
                  visibility: 'visible'
                }}
              />
            ) : (
              <Mic 
                size={iconSize}
                className="text-white" 
                strokeWidth={2.5}
                style={{ 
                  display: 'block',
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                  color: '#ffffff',
                  stroke: '#ffffff',
                  fill: 'none',
                  opacity: 1,
                  visibility: 'visible'
                }}
              />
            )}
          </div>

          {/* Ripple effect on click */}
          <div className="absolute inset-0 rounded-full bg-white/30 scale-0 group-active:scale-150 transition-all duration-500 opacity-0 group-active:opacity-100" />
          
          {/* Hover glow effect */}
          <div className="absolute inset-0 rounded-full bg-white/10 scale-0 group-hover:scale-100 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
        </button>

        {/* Video On/Off Button - Responsive size */}
        <button
          onClick={onToggleVideo}
          className={`relative rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 active:scale-95 shadow-2xl border-2 ${
            isVideoOff
              ? 'bg-red-500/95 hover:bg-red-600 border-red-400/60 shadow-red-500/60'
              : 'bg-dark-800/95 hover:bg-dark-700/95 border-white/30 shadow-dark-900/60'
          } group overflow-hidden`}
          style={{ 
            width: buttonSize, 
            height: buttonSize, 
            minWidth: buttonSize, 
            minHeight: buttonSize 
          }}
          title={isVideoOff ? 'Turn on video' : 'Turn off video'}
          aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          aria-pressed={isVideoOff}
        >
          {/* Animated background when video is off */}
          {isVideoOff && (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-90 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-red-400/80 animate-ping" style={{ animationDuration: '2s' }} />
            </>
          )}
          
          {/* Glass morphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full z-0" />
          
          {/* Icon with smooth transition - Properly centered, 24px size */}
          <div className={`relative z-20 flex items-center justify-center transition-all duration-300 ${
            isVideoOff 
              ? 'group-hover:scale-110 group-hover:rotate-12' 
              : 'group-hover:scale-110'
          }`}>
            {isVideoOff ? (
              <VideoOff 
                size={iconSize}
                className="text-white" 
                strokeWidth={2.5}
                style={{ 
                  display: 'block',
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                  color: '#ffffff',
                  stroke: '#ffffff',
                  fill: 'none',
                  opacity: 1,
                  visibility: 'visible'
                }}
              />
            ) : (
              <Video 
                size={iconSize}
                className="text-white" 
                strokeWidth={2.5}
                style={{ 
                  display: 'block',
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                  color: '#ffffff',
                  stroke: '#ffffff',
                  fill: 'none',
                  opacity: 1,
                  visibility: 'visible'
                }}
              />
            )}
          </div>

          {/* Ripple effect */}
          <div className="absolute inset-0 rounded-full bg-white/30 scale-0 group-active:scale-150 transition-all duration-500 opacity-0 group-active:opacity-100" />
          
          {/* Hover glow effect */}
          <div className="absolute inset-0 rounded-full bg-white/10 scale-0 group-hover:scale-100 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
        </button>

        {/* Screen Share Button - Responsive size */}
        {onScreenShare && (
          <button
            onClick={onScreenShare}
            className={`
              relative rounded-full flex items-center justify-center 
              transition-all duration-300 ease-out
              hover:scale-110 active:scale-95 
              shadow-2xl border-2
              ${
                isScreenSharing
                  ? 'bg-primary-500/95 hover:bg-primary-600 border-primary-400/60 shadow-primary-500/60'
                  : 'bg-dark-800/95 hover:bg-dark-700/95 border-white/30 shadow-dark-900/60'
              }
              group overflow-hidden
            `}
            style={{ 
              width: buttonSize, 
              height: buttonSize, 
              minWidth: buttonSize, 
              minHeight: buttonSize 
            }}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {/* Active state glow */}
            {isScreenSharing && (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-600 opacity-90 animate-pulse" />
            )}
            
            {/* Glass morphism overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full z-0" />
            
            <div className="relative z-20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
              <Monitor 
                size={iconSize}
                className="text-white" 
                strokeWidth={2.5}
                style={{ 
                  display: 'block',
                  width: `${iconSize}px`,
                  height: `${iconSize}px`,
                  color: '#ffffff',
                  stroke: '#ffffff',
                  fill: 'none',
                  opacity: 1,
                  visibility: 'visible'
                }}
              />
            </div>
            <div className="absolute inset-0 rounded-full bg-white/30 scale-0 group-active:scale-150 transition-all duration-500 opacity-0 group-active:opacity-100" />
            <div className="absolute inset-0 rounded-full bg-white/10 scale-0 group-hover:scale-100 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
          </button>
        )}

        {/* More Menu Button - Responsive size */}
        {(onAddParticipant || onSettings) && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`
                relative rounded-full flex items-center justify-center 
                transition-all duration-300 ease-out
                hover:scale-110 active:scale-95 
                shadow-2xl border-2
                ${
                  showMoreMenu
                    ? 'bg-primary-500/95 hover:bg-primary-600 border-primary-400/60 shadow-primary-500/60'
                    : 'bg-dark-800/95 hover:bg-dark-700/95 border-white/30 shadow-dark-900/60'
                }
                group overflow-hidden
              `}
              style={{ 
                width: buttonSize, 
                height: buttonSize, 
                minWidth: buttonSize, 
                minHeight: buttonSize 
              }}
              title="More options"
            >
              {/* Active state glow */}
              {showMoreMenu && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-600 opacity-90" />
              )}
              
              {/* Glass morphism overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full z-0" />
              
              <div className={`relative z-20 flex items-center justify-center transition-all duration-300 ${
                showMoreMenu 
                  ? 'rotate-180' 
                  : 'group-hover:rotate-90'
              }`}>
                <Settings 
                  size={iconSize}
                  className="text-white" 
                  strokeWidth={2.5}
                  style={{ 
                    display: 'block',
                    width: `${iconSize}px`,
                    height: `${iconSize}px`,
                    color: '#ffffff',
                    stroke: '#ffffff',
                    fill: 'none',
                    opacity: 1,
                    visibility: 'visible'
                  }}
                />
              </div>
              <div className="absolute inset-0 rounded-full bg-white/30 scale-0 group-active:scale-150 transition-all duration-500 opacity-0 group-active:opacity-100" />
              <div className="absolute inset-0 rounded-full bg-white/10 scale-0 group-hover:scale-100 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
            </button>

            {/* Dropdown Menu */}
            {showMoreMenu && (
              <div className="absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 glass-card rounded-2xl p-2 border border-dark-800/50 shadow-2xl min-w-[200px] animate-fade-in backdrop-blur-xl bg-dark-900/95 z-50">
                {onAddParticipant && (
                  <button
                    onClick={() => {
                      onAddParticipant();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-dark-800/70 transition-all duration-200 text-left group hover:scale-[1.02]"
                  >
                    <div className="p-2 rounded-lg bg-primary-500/20 group-hover:bg-primary-500/30 transition">
                      <UserPlus 
                        size={20} 
                        className="text-primary-400 group-hover:text-primary-300 transition" 
                        strokeWidth={2.5}
                      />
                    </div>
                    <span className="text-white text-sm font-medium">Add Participant</span>
                  </button>
                )}
                {onSettings && (
                  <button
                    onClick={() => {
                      onSettings();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-dark-800/70 transition-all duration-200 text-left group hover:scale-[1.02] mt-1"
                  >
                    <div className="p-2 rounded-lg bg-primary-500/20 group-hover:bg-primary-500/30 transition">
                      <Settings 
                        size={20} 
                        className="text-primary-400 group-hover:text-primary-300 transition" 
                        strokeWidth={2.5}
                      />
                    </div>
                    <span className="text-white text-sm font-medium">Settings</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* End Call Button - Responsive size (larger than others) - Immediately ends call */}
        <button
          onClick={onEndCall}
          className="relative rounded-full flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 active:scale-95 shadow-2xl border-2 bg-red-500/95 hover:bg-red-600 border-red-400/60 shadow-red-500/60 group overflow-hidden"
          style={{ 
            width: endCallSize, 
            height: endCallSize, 
            minWidth: endCallSize, 
            minHeight: endCallSize 
          }}
          title="End call"
          aria-label="End call"
        >
          {/* Pulsing red glow with multiple layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-90 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-red-400/80 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 rounded-full border border-red-300/60 animate-pulse" style={{ animationDuration: '1.5s' }} />
          
          {/* Glass morphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full z-0" />
          
          <div className="relative z-20 flex items-center justify-center transition-all duration-300 group-hover:rotate-90 group-hover:scale-110">
            <PhoneOff 
              size={iconSize}
              className="text-white" 
              strokeWidth={2.5}
              style={{ 
                display: 'block',
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                color: '#ffffff',
                stroke: '#ffffff',
                fill: 'none',
                opacity: 1,
                visibility: 'visible'
              }}
            />
          </div>

          {/* Ripple effect */}
          <div className="absolute inset-0 rounded-full bg-white/30 scale-0 group-active:scale-150 transition-all duration-500 opacity-0 group-active:opacity-100" />
          
          {/* Hover glow effect */}
          <div className="absolute inset-0 rounded-full bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
        </button>
      </div>

    </>
  );
}

