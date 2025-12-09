import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useCallStore } from '../store/call';
import { useAuthStore } from '../store/auth';
import VideoParticipant from './VideoParticipant';
import { motion } from 'framer-motion';

export default function FaceTimeCallInterface() {
  const { callId } = useParams<{ callId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get data from location state or params
  const recipientId = location.state?.recipientId || '';
  const recipientName = location.state?.recipientName || 'Friend';
  const recipientAvatar = location.state?.recipientAvatar;
  const conversationId = location.state?.conversationId;
  const { user, accessToken } = useAuthStore();
  const callStore = useCallStore();
  const {
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    callStatus,
    participants,
    toggleMute,
    toggleVideo,
  } = callStore;

  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get other participant
  const otherParticipant = participants.find((p) => p.userId === recipientId) || participants[0];

  // Initialize call
  useEffect(() => {
    if (!accessToken || !user) return;

    const initializeCall = async () => {
      // Initialize socket if needed
      if (!callStore.socket || !callStore.socket.connected) {
        callStore.initSocket(accessToken, user.name);
        
        // Wait for socket connection
        const checkSocket = setInterval(() => {
          if (callStore.socket && callStore.socket.connected && callId) {
            clearInterval(checkSocket);
            // Join room using callId as roomId
            callStore.joinRoom(callId, accessToken).catch(console.error);
          }
        }, 100);

        setTimeout(() => clearInterval(checkSocket), 10000);
      } else {
        if (callId) {
          callStore.joinRoom(callId, accessToken).catch(console.error);
        }
      }
    };

    initializeCall();

    return () => {
      if (callId) {
        callStore.leaveRoom();
      }
    };
  }, [callId, accessToken, user]);

  // Listen for participant state changes
  useEffect(() => {
    const socket = callStore.socket;
    if (!socket || !otherParticipant) return;

    const handleVideoChanged = (data: {
      socketId: string;
      userId: string;
      isVideoOff: boolean;
    }) => {
      if (data.userId === recipientId || data.socketId === otherParticipant.socketId) {
        setRemoteVideoOff(data.isVideoOff);
      }
    };

    const handleAudioChanged = (data: {
      socketId: string;
      userId: string;
      isMuted: boolean;
    }) => {
      if (data.userId === recipientId || data.socketId === otherParticipant.socketId) {
        setRemoteMuted(data.isMuted);
      }
    };

    socket.on('participant:video:changed', handleVideoChanged);
    socket.on('participant:audio:changed', handleAudioChanged);

    return () => {
      socket.off('participant:video:changed', handleVideoChanged);
      socket.off('participant:audio:changed', handleAudioChanged);
    };
  }, [callStore.socket, otherParticipant, recipientId]);

  // Call duration timer
  useEffect(() => {
    if (callStatus === 'active') {
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      setCallDuration(0);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callStatus]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    // Notify backend that call ended
    if (callStore.socket && callId) {
      callStore.socket.emit('private-call-end', {
        callId,
        duration: callDuration,
      });
    }

    callStore.leaveRoom();

    // Navigate back
    if (conversationId) {
      navigate(`/friends/chat/${conversationId}`);
    } else {
      navigate('/friends');
    }
  };

  const handleToggleControls = () => {
    setShowControls(!showControls);
  };

  return (
    <div
      className="h-screen bg-black flex flex-col relative overflow-hidden"
      onClick={handleToggleControls}
    >
      {/* Main Video Area - Full Screen Remote Video */}
      <div className="flex-1 relative bg-black">
        {otherParticipant ? (
          <VideoParticipant
            stream={remoteStream}
            userName={recipientName}
            userId={recipientId}
            avatar={recipientAvatar}
            isVideoOff={remoteVideoOff}
            isMuted={remoteMuted}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                {recipientAvatar ? (
                  <img
                    src={recipientAvatar}
                    alt={recipientName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-4xl">
                    {recipientName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-white text-lg">{recipientName}</p>
              <p className="text-dark-400 text-sm mt-2">Connecting...</p>
            </div>
          </div>
        )}

        {/* Floating Local Video - Top Right */}
        {otherParticipant && localStream && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 right-4 w-32 h-48 rounded-xl overflow-hidden bg-dark-900 border-2 border-white/20 shadow-2xl"
            style={{ zIndex: 10 }}
          >
            <VideoParticipant
              stream={localStream}
              userName={user?.name || 'You'}
              userId={user?._id}
              avatar={user?.avatar}
              isVideoOff={isVideoOff}
              isMuted={isMuted}
              isLocal={true}
              className="w-full h-full"
            />
          </motion.div>
        )}

        {/* Call Info - Top Center */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 glass-card rounded-full px-4 py-2 z-20"
          >
            <div className="flex items-center space-x-3">
              <p className="text-white font-medium">{recipientName}</p>
              {callStatus === 'active' && (
                <span className="text-dark-400 text-sm font-mono">
                  {formatDuration(callDuration)}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Call Controls - Bottom Center */}
      {showControls && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className="flex items-center space-x-4">
            {/* Mute/Unmute */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted
                  ? 'bg-red-500/90 hover:bg-red-600'
                  : 'bg-dark-800/80 hover:bg-dark-700/80'
              } backdrop-blur-lg`}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>

            {/* Video On/Off */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleVideo();
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isVideoOff
                  ? 'bg-dark-800/80 hover:bg-dark-700/80'
                  : 'bg-dark-800/80 hover:bg-dark-700/80'
              } backdrop-blur-lg`}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </button>

            {/* End Call */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEndCall();
              }}
              className="w-14 h-14 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 backdrop-blur-lg"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Connecting Status */}
      {callStatus === 'waiting' && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 glass-card rounded-full px-4 py-2">
          <p className="text-white text-sm">Connecting...</p>
        </div>
      )}
    </div>
  );
}

