import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCallStore } from '../store/call';
import { useAuthStore } from '../store/auth';
import VideoParticipant from '../components/VideoParticipant';
import CallControls from '../components/CallControls';

export default function PrivateCall() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuthStore();
  const callStore = useCallStore();
  
  const {
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    participants,
    callStatus,
    toggleMute,
    toggleVideo,
    leaveRoom,
  } = callStore;

  const [showControls, setShowControls] = useState(true);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get conversation ID from location state
  const conversationId = location.state?.conversationId;
  
  // Get other participant (first participant in 1-on-1 call)
  const otherParticipant = participants[0];

  // Initialize socket and call
  useEffect(() => {
    if (roomId && accessToken && user) {
      let isMounted = true;
      
      const initializeCall = async () => {
        // Initialize socket first if not already initialized
        const { socket } = callStore;
        if (!socket || !socket.connected) {
          callStore.initSocket(accessToken, user.name);
          
          // Wait for socket to connect
          const checkSocket = setInterval(() => {
            const { socket: currentSocket } = callStore;
            if (currentSocket && currentSocket.connected) {
              clearInterval(checkSocket);
              if (isMounted) {
                callStore.joinRoom(roomId, accessToken).catch((err) => {
                  console.error('[PRIVATE CALL] Failed to join room:', err);
                });
              }
            }
          }, 100);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            clearInterval(checkSocket);
          }, 10000);
        } else {
          // Socket already connected, join room immediately
          callStore.joinRoom(roomId, accessToken).catch((err) => {
            console.error('[PRIVATE CALL] Failed to join room:', err);
          });
        }
      };
      
      initializeCall();
      
      return () => {
        isMounted = false;
        if (roomId) {
          leaveRoom();
        }
      };
    }
  }, [roomId, accessToken, user]);

  // Initialize remote participant state when they join
  useEffect(() => {
    if (otherParticipant) {
      // Reset state when participant changes
      setRemoteVideoOff(false);
      setRemoteMuted(false);
    }
  }, [otherParticipant?.socketId]);

  // Listen for participant video/audio state changes
  useEffect(() => {
    const socket = callStore.socket;
    if (!socket || !otherParticipant) return;

    const handleVideoChanged = (data: {
      socketId: string;
      userId: string;
      userName: string;
      isVideoOff: boolean;
    }) => {
      // Update remote participant video state
      if (data.socketId === otherParticipant.socketId || data.userId === otherParticipant.userId) {
        setRemoteVideoOff(data.isVideoOff);
      }
    };

    const handleAudioChanged = (data: {
      socketId: string;
      userId: string;
      userName: string;
      isMuted: boolean;
    }) => {
      // Update remote participant audio state
      if (data.socketId === otherParticipant.socketId || data.userId === otherParticipant.userId) {
        setRemoteMuted(data.isMuted);
      }
    };

    socket.on('participant:video:changed', handleVideoChanged);
    socket.on('participant:audio:changed', handleAudioChanged);

    return () => {
      socket.off('participant:video:changed', handleVideoChanged);
      socket.off('participant:audio:changed', handleAudioChanged);
    };
  }, [callStore.socket, otherParticipant]);

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

  // Listen for private messages
  useEffect(() => {
    const socket = callStore.socket;
    if (!socket || !conversationId) return;

    const handlePrivateMessage = (data: { message: any }) => {
      // Handle private messages during call if needed
      const messageConvId = data.message.conversationId?.toString();
      if (messageConvId === conversationId?.toString() && 
          data.message.senderId._id !== user?._id) {
        // Could show notification here
      }
    };

    socket.on('message:new', handlePrivateMessage);
    return () => {
      socket.off('message:new', handlePrivateMessage);
    };
  }, [callStore.socket, conversationId, user]);

  const handleEndCall = () => {
    leaveRoom();
    if (conversationId) {
      navigate(`/friends/chat/${conversationId}`);
    } else {
      navigate('/friends');
    }
  };

  // Removed unused handleOpenChat function

  const handleToggleControls = () => {
    setShowControls(!showControls);
  };

  return (
    <div className="h-screen bg-dark-950 flex flex-col relative overflow-hidden">
      {/* Video Area - Side by side for 1-on-1 */}
      <div 
        className="flex-1 flex gap-2 p-4"
        onClick={handleToggleControls}
      >
        {/* Remote Participant - Full screen when alone, side-by-side when connected */}
        <div className="relative rounded-xl overflow-hidden bg-dark-900 flex-1">
          {otherParticipant ? (
            <VideoParticipant
              stream={remoteStream}
              userName={otherParticipant.userName}
              userId={otherParticipant.userId}
              isVideoOff={remoteVideoOff}
              isMuted={remoteMuted}
              className="w-full h-full"
            />
          ) : (
            // Show local video full screen when waiting
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
          )}
          
          {/* Waiting overlay when no participant - Moved up to avoid button overlap */}
          {!otherParticipant && (
            <div className="absolute bottom-32 md:bottom-36 left-1/2 transform -translate-x-1/2 bg-dark-900/90 backdrop-blur-lg rounded-full px-4 py-2.5 md:px-6 md:py-3 z-20 max-w-[90%] md:max-w-none">
              <p className="text-white text-sm md:text-base font-medium whitespace-nowrap">Waiting for participant...</p>
            </div>
          )}
        </div>

        {/* Local User - Show as small tile when participant is connected */}
        {otherParticipant && (
          <div className="w-64 rounded-xl overflow-hidden bg-dark-900">
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
          </div>
        )}
      </div>

      {/* Floating Controls - Enhanced with proper spacing */}
      {showControls && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[60]">
          <CallControls
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onEndCall={handleEndCall}
          />
        </div>
      )}

      {/* Call Status */}
      {callStatus === 'waiting' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-dark-900/90 backdrop-blur-lg rounded-full px-4 py-2">
          <p className="text-white text-sm">Connecting...</p>
        </div>
      )}
    </div>
  );
}

