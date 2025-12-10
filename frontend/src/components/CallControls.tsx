import { useState, useRef, useEffect } from 'react';
import { 
  FiMic, 
  FiMicOff, 
  FiVideo, 
  FiVideoOff, 
  FiMonitor,
  FiUserPlus, 
  FiSettings, 
  FiMoreVertical,
  FiAlertTriangle, 
  FiX 
} from 'react-icons/fi';
import { MdCallEnd, MdDesktopMac } from 'react-icons/md';

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
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
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

  const handleEndCall = () => {
    setShowEndCallConfirm(true);
  };

  const confirmEndCall = () => {
    setShowEndCallConfirm(false);
    onEndCall();
  };

  const cancelEndCall = () => {
    setShowEndCallConfirm(false);
  };

  return (
    <>
      {/* Call Controls Container with backdrop blur - Fixed z-index and no text overlap */}
      <div
        className={`flex items-center justify-center gap-4 sm:gap-5 md:gap-6 backdrop-blur-xl bg-dark-900/70 rounded-full px-4 sm:px-6 py-3 sm:py-4 border border-white/10 shadow-2xl ${className}`}
        style={{ 
          isolation: 'isolate', 
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          visibility: 'visible',
          opacity: 1,
          zIndex: 9999,
          width: 'auto',
          height: 'auto',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
        }}
      >
        {/* Mute/Unmute Button - Fixed size 56px */}
        <button
          onClick={onToggleMute}
          className={`
            relative rounded-full flex items-center justify-center 
            transition-all duration-300 ease-out
            hover:scale-110 active:scale-95 
            shadow-2xl border-2
            ${
              isMuted
                ? 'bg-red-500/95 hover:bg-red-600 border-red-400/60 shadow-red-500/60'
                : 'bg-dark-800/95 hover:bg-dark-700/95 border-white/30 shadow-dark-900/60'
            }
            group overflow-hidden
          `}
          style={{ width: 'clamp(48px, 14vw, 56px)', height: 'clamp(48px, 14vw, 56px)', minWidth: '48px', minHeight: '48px' }}
          title={isMuted ? 'Unmute' : 'Mute'}
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
          
          {/* Icon with smooth transition and rotation - Properly centered */}
          <div className={`relative z-20 flex items-center justify-center transition-all duration-300 ${
            isMuted 
              ? 'group-hover:scale-110 group-hover:rotate-12' 
              : 'group-hover:scale-110'
          }`} style={{ width: '24px', height: '24px' }}>
            {isMuted ? (
              <FiMicOff 
                size={24} 
                className="text-white" 
                style={{ 
                  display: 'inline-block', 
                  width: '24px', 
                  height: '24px', 
                  color: '#ffffff', 
                  opacity: 1,
                  visibility: 'visible'
                }} 
              />
            ) : (
              <FiMic 
                size={24} 
                className="text-white" 
                style={{ 
                  display: 'inline-block', 
                  width: '24px', 
                  height: '24px', 
                  color: '#ffffff', 
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

        {/* Video On/Off Button - Fixed size 56px */}
        <button
          onClick={onToggleVideo}
          className={`
            relative rounded-full flex items-center justify-center 
            transition-all duration-300 ease-out
            hover:scale-110 active:scale-95 
            shadow-2xl border-2
            ${
              isVideoOff
                ? 'bg-red-500/95 hover:bg-red-600 border-red-400/60 shadow-red-500/60'
                : 'bg-dark-800/95 hover:bg-dark-700/95 border-white/30 shadow-dark-900/60'
            }
            group overflow-hidden
          `}
          style={{ width: 'clamp(48px, 14vw, 56px)', height: 'clamp(48px, 14vw, 56px)', minWidth: '48px', minHeight: '48px' }}
          title={isVideoOff ? 'Turn on video' : 'Turn off video'}
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
          
          {/* Icon with smooth transition - Properly centered */}
          <div className={`relative z-20 flex items-center justify-center transition-all duration-300 ${
            isVideoOff 
              ? 'group-hover:scale-110 group-hover:rotate-12' 
              : 'group-hover:scale-110'
          }`} style={{ width: '24px', height: '24px' }}>
            {isVideoOff ? (
              <FiVideoOff 
                size={24} 
                className="text-white" 
                style={{ 
                  display: 'inline-block', 
                  width: '24px', 
                  height: '24px', 
                  color: '#ffffff', 
                  opacity: 1,
                  visibility: 'visible'
                }} 
              />
            ) : (
              <FiVideo 
                size={24} 
                className="text-white" 
                style={{ 
                  display: 'inline-block', 
                  width: '24px', 
                  height: '24px', 
                  color: '#ffffff', 
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

        {/* Screen Share Button - Fixed size 56px */}
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
            style={{ width: 'clamp(48px, 14vw, 56px)', height: 'clamp(48px, 14vw, 56px)', minWidth: '48px', minHeight: '48px' }}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            {/* Active state glow */}
            {isScreenSharing && (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-600 opacity-90 animate-pulse" />
            )}
            
            {/* Glass morphism overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full z-0" />
            
            <div className="relative z-20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6" style={{ width: '24px', height: '24px' }}>
              {isScreenSharing ? (
                <MdDesktopMac 
                  size={24} 
                  className="text-white" 
                  style={{ 
                    display: 'inline-block', 
                    width: '24px', 
                    height: '24px', 
                    color: '#ffffff', 
                    opacity: 1,
                    visibility: 'visible'
                  }} 
                />
              ) : (
                <FiMonitor 
                  size={24} 
                  className="text-white" 
                  style={{ 
                    display: 'inline-block', 
                    width: '24px', 
                    height: '24px', 
                    color: '#ffffff', 
                    opacity: 1,
                    visibility: 'visible'
                  }} 
                />
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-white/30 scale-0 group-active:scale-150 transition-all duration-500 opacity-0 group-active:opacity-100" />
            <div className="absolute inset-0 rounded-full bg-white/10 scale-0 group-hover:scale-100 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
          </button>
        )}

        {/* More Menu Button */}
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
              style={{ width: 'clamp(48px, 14vw, 56px)', height: 'clamp(48px, 14vw, 56px)', minWidth: '48px', minHeight: '48px' }}
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
              }`} style={{ width: '24px', height: '24px' }}>
                {showMoreMenu ? (
                  <FiX 
                    size={24} 
                    className="text-white" 
                    style={{ 
                      display: 'inline-block', 
                      width: '24px', 
                      height: '24px', 
                      color: '#ffffff', 
                      opacity: 1,
                      visibility: 'visible'
                    }} 
                  />
                ) : (
                  <FiMoreVertical 
                    size={24} 
                    className="text-white" 
                    style={{ 
                      display: 'inline-block', 
                      width: '24px', 
                      height: '24px', 
                      color: '#ffffff', 
                      opacity: 1,
                      visibility: 'visible'
                    }} 
                  />
                )}
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
                      <FiUserPlus 
                        size={16} 
                        className="text-primary-400 group-hover:text-primary-300 transition" 
                        style={{ 
                          display: 'inline-block', 
                          width: '16px', 
                          height: '16px', 
                          color: '#60a5fa', 
                          opacity: 1,
                          visibility: 'visible'
                        }} 
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
                      <FiSettings 
                        size={16} 
                        className="text-primary-400 group-hover:text-primary-300 transition" 
                        style={{ 
                          display: 'inline-block', 
                          width: '16px', 
                          height: '16px', 
                          color: '#60a5fa', 
                          opacity: 1,
                          visibility: 'visible'
                        }} 
                      />
                    </div>
                    <span className="text-white text-sm font-medium">Settings</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* End Call Button - Fixed size 56px (same as others for consistency) */}
        <button
          onClick={handleEndCall}
          className={`
            relative rounded-full flex items-center justify-center 
            transition-all duration-300 ease-out
            hover:scale-110 active:scale-95 
            shadow-2xl border-2
            bg-red-500/95 hover:bg-red-600 border-red-400/60 shadow-red-500/60
            group overflow-hidden
          `}
          style={{ width: 'clamp(48px, 14vw, 56px)', height: 'clamp(48px, 14vw, 56px)', minWidth: '48px', minHeight: '48px' }}
          title="End call"
        >
          {/* Pulsing red glow with multiple layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-90 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-red-400/80 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 rounded-full border border-red-300/60 animate-pulse" style={{ animationDuration: '1.5s' }} />
          
          {/* Glass morphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full z-0" />
          
          <div className="relative z-20 flex items-center justify-center transition-all duration-300 group-hover:rotate-90 group-hover:scale-110" style={{ width: '24px', height: '24px' }}>
            <MdCallEnd 
              size={24} 
              className="text-white" 
              style={{ 
                display: 'inline-block', 
                width: '24px', 
                height: '24px', 
                color: '#ffffff', 
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

      {/* End Call Confirmation Modal - Enhanced with better sizing and spacing */}
      {showEndCallConfirm && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4"
          onClick={cancelEndCall}
        >
          <div 
            className="glass-card rounded-2xl border border-red-500/40 shadow-2xl w-[90%] max-w-[420px] animate-scale-in bg-dark-900/95 backdrop-blur-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '32px' }}
          >
            {/* Close button - Top right, larger */}
            <button
              onClick={cancelEndCall}
              className="absolute top-4 right-4 w-10 h-10 rounded-lg hover:bg-dark-800/50 transition flex items-center justify-center flex-shrink-0 z-10"
              title="Close"
              aria-label="Close"
            >
              <FiX 
                size={20} 
                className="text-dark-400 hover:text-white transition" 
                style={{ 
                  display: 'inline-block', 
                  width: '20px', 
                  height: '20px', 
                  color: '#94a3b8', 
                  opacity: 1,
                  visibility: 'visible'
                }} 
              />
            </button>

            <div className="flex items-start space-x-4 mb-6 pr-8">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse ring-4 ring-red-500/20">
                <FiAlertTriangle 
                  size={32} 
                  className="text-red-400" 
                  style={{ 
                    display: 'inline-block', 
                    width: '32px', 
                    height: '32px', 
                    color: '#f87171', 
                    opacity: 1,
                    visibility: 'visible'
                  }} 
                />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-white font-semibold text-xl md:text-2xl mb-3">End Call?</h3>
                <p className="text-dark-300 text-sm md:text-base break-words" style={{ lineHeight: '1.6' }}>
                  Are you sure you want to end this call? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={cancelEndCall}
                className="flex-1 px-5 bg-dark-800/80 hover:bg-dark-700/80 rounded-xl text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-dark-700/50 text-base"
                style={{ height: '48px' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmEndCall}
                className="flex-1 px-5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl text-white font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 text-base"
                style={{ height: '48px' }}
              >
                <MdCallEnd 
                  size={20} 
                  className="text-white" 
                  style={{ 
                    display: 'inline-block', 
                    width: '20px', 
                    height: '20px', 
                    color: '#ffffff', 
                    opacity: 1,
                    visibility: 'visible'
                  }} 
                />
                <span>End Call</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

