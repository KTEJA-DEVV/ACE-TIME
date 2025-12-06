import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Maximize2,
  Users,
  GripVertical
} from 'lucide-react';
import { useCallStore } from '../store/call';

export default function FloatingCallOverlay() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const {
    localStream,
    remoteStream,
    callStatus,
    roomId,
    participants,
    callStartTime,
    isMuted,
    isVideoOff,
    isMinimized,
    toggleMute,
    toggleVideo,
    endCall,
    maximizeCall,
  } = useCallStore();

  const [callDuration, setCallDuration] = useState(0);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Call duration timer - calculates from callStartTime for continuous duration
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callStatus === 'active' && isMinimized && callStartTime) {
      // Calculate initial duration from start time
      const calculateDuration = () => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        setCallDuration(elapsed);
      };
      
      // Calculate immediately
      calculateDuration();
      
      // Update every second
      interval = setInterval(calculateDuration, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus, isMinimized, callStartTime]);

  // Attach video stream
  useEffect(() => {
    if (videoRef.current) {
      // Prefer remote stream if available, otherwise show local
      const stream = remoteStream || localStream;
      if (stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [localStream, remoteStream, isMinimized]);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  // Handle drag move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Keep within viewport bounds
        const maxX = window.innerWidth - 200;
        const maxY = window.innerHeight - 160;
        
        setPosition({
          x: Math.max(10, Math.min(newX, maxX)),
          y: Math.max(10, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (overlayRef.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = overlayRef.current.getBoundingClientRect();
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
        const touch = e.touches[0];
        const newX = touch.clientX - dragOffset.x;
        const newY = touch.clientY - dragOffset.y;
        
        const maxX = window.innerWidth - 200;
        const maxY = window.innerHeight - 160;
        
        setPosition({
          x: Math.max(10, Math.min(newX, maxX)),
          y: Math.max(10, Math.min(newY, maxY)),
        });
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset]);

  // Handle return to call
  const handleMaximize = () => {
    maximizeCall();
    if (roomId) {
      navigate(`/call/${roomId}`);
    }
  };

  // Handle end call
  const handleEndCall = () => {
    endCall();
  };

  // Don't render if not minimized or call not active
  if (!isMinimized || (callStatus !== 'active' && callStatus !== 'waiting')) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="fixed z-[9999] select-none"
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
      }}
    >
      {/* Main overlay container */}
      <div className="w-48 bg-dark-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-dark-700/50 overflow-hidden">
        {/* Drag handle */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-dark-800/80 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-dark-400" />
            <span className="text-xs font-medium text-white">Live Call</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-mono">{formatDuration(callDuration)}</span>
          </div>
        </div>

        {/* Video preview */}
        <div className="relative aspect-video bg-dark-950">
          {!isVideoOff && (remoteStream || localStream) ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={!remoteStream}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-dark-800 to-dark-900">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center">
                <VideoOff className="w-6 h-6 text-white" />
              </div>
            </div>
          )}
          
          {/* Participants count */}
          {participants.length > 0 && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-dark-900/80 rounded-full">
              <Users className="w-3 h-3 text-white" />
              <span className="text-xs text-white font-medium">{participants.length + 1}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-dark-800/60">
          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-lg transition-all ${
              isMuted 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-dark-700/50 text-white hover:bg-dark-600/50'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Video toggle */}
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-lg transition-all ${
              isVideoOff 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-dark-700/50 text-white hover:bg-dark-600/50'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Maximize */}
          <button
            onClick={handleMaximize}
            className="p-2 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-all"
            title="Return to call"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* End call */}
          <button
            onClick={handleEndCall}
            className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
            title="End call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

