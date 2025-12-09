import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useCallStore } from '../store/call';
import IncomingCallNotification from './IncomingCallNotification';

export default function GlobalCallHandler() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const { socket, initSocket } = useCallStore();
  const [incomingCall, setIncomingCall] = useState<{
    roomId: string;
    callerName: string;
    callerId: string;
    isVideo: boolean;
    conversationId?: string;
  } | null>(null);

  // Initialize socket connection for call invitations
  useEffect(() => {
    if (accessToken && user && !socket) {
      initSocket(accessToken, user.name);
    }
  }, [accessToken, user, socket, initSocket]);

  // Listen for incoming call invitations
  useEffect(() => {
    if (!socket) return;

    const handleCallInvitation = (data: {
      roomId: string;
      callId: string;
      callerId: string;
      callerName: string;
      callerAvatar?: string;
      isVideo: boolean;
      conversationId?: string;
    }) => {
      console.log('[CALL] Incoming call invitation:', data);
      setIncomingCall({
        roomId: data.roomId,
        callerName: data.callerName,
        callerId: data.callerId,
        isVideo: data.isVideo,
        conversationId: data.conversationId,
      });
    };

    socket.on('call:invitation', handleCallInvitation);

    return () => {
      socket.off('call:invitation', handleCallInvitation);
    };
  }, [socket]);

  const handleAcceptCall = () => {
    if (incomingCall) {
      navigate(`/call/${incomingCall.roomId}`, {
        state: {
          conversationId: incomingCall.conversationId,
          fromIncomingCall: true,
        },
      });
      setIncomingCall(null);
    }
  };

  const handleDeclineCall = () => {
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  return (
    <IncomingCallNotification
      callData={incomingCall}
      onAccept={handleAcceptCall}
      onDecline={handleDeclineCall}
    />
  );
}

