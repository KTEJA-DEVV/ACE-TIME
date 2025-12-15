import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { toast } from '../components/Toast';
import { parseApiError, getUserFriendlyMessage } from '../utils/errorHandler';
import { useAuthStore } from './auth';

// Use relative URL in production (when served from backend), absolute URL in development
const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // In production, if served from same origin, use relative path
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production, if served from same origin, use relative path
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const SOCKET_URL = getSocketUrl();
const API_URL = getApiUrl();

interface TranscriptSegment {
  speaker: string;
  speakerId?: string;
  text: string;
  timestamp: number;
}

interface AINotes {
  summary: string;
  bullets: string[];
  actionItems: Array<{ text: string; assignee?: string }>;
  decisions: string[];
  suggestedReplies: string[];
  keyTopics: string[];
  isFinal?: boolean;
  lastUpdated?: number;
}

interface Participant {
  userId: string;
  userName: string;
  socketId: string;
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface CallState {
  socket: Socket | null;
  peerConnection: RTCPeerConnection | null; // Keep for backward compatibility (1-on-1 calls)
  peerConnections: Map<string, RTCPeerConnection>; // Map of socketId -> peer connection (for multiple participants)
  localStream: MediaStream | null;
  remoteStream: MediaStream | null; // Keep for backward compatibility (1-on-1 calls)
  remoteStreams: Map<string, MediaStream>; // Map of socketId -> remote stream (for multiple participants)
  speechRecognition: any | null;
  callRecorder: MediaRecorder | null; // For recording the call
  recordingChunks: Blob[]; // Store recording chunks
  
  roomId: string | null;
  callId: string | null;
  userName: string | null; // Store user name for transcript
  isHost: boolean;
  callStatus: 'idle' | 'connecting' | 'waiting' | 'active' | 'ended';
  participants: Participant[];
  callStartTime: number | null; // Timestamp when call became active (for continuous duration)
  
  transcript: TranscriptSegment[];
  interimTranscript: string; // For showing live interim results
  aiNotes: AINotes | null;
  aiAnalysisInterval: ReturnType<typeof setInterval> | null; // For periodic AI analysis
  
  isMuted: boolean;
  isVideoOff: boolean;
  isRecording: boolean;
  isMinimized: boolean; // For floating PiP overlay when navigating away
  
  error: string | null;
  
  initSocket: (token: string, userName: string) => void;
  disconnectSocket: () => void;
  createRoom: (token: string) => Promise<string>;
  joinRoom: (roomId: string, token: string) => Promise<void>;
  createPeerConnection: (socketId: string, userId: string, userName: string) => Promise<void>;
  removePeerConnection: (socketId: string) => void;
  leaveRoom: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  sendTranscript: (text: string) => void;
  requestNotes: () => void;
  startAIAnalysis: () => void;
  stopAIAnalysis: () => void;
  analyzeTranscript: (isFinal?: boolean) => Promise<void>;
  startSpeechRecognition: () => void;
  stopSpeechRecognition: () => void;
  startCallRecording: () => void;
  stopCallRecording: () => Promise<void>;
  clearCall: () => void;
  minimizeCall: () => void;
  maximizeCall: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
};

export const useCallStore = create<CallState>((set, get) => ({
  socket: null,
  peerConnection: null,
  peerConnections: new Map<string, RTCPeerConnection>(),
  localStream: null,
  remoteStream: null,
  remoteStreams: new Map<string, MediaStream>(),
  speechRecognition: null,
  callRecorder: null,
  recordingChunks: [],
  
  roomId: null,
  callId: null,
  userName: null,
  isHost: false,
  callStatus: 'idle',
  participants: [],
  callStartTime: null,
  
  transcript: [],
  interimTranscript: '',
  aiNotes: null,
  aiAnalysisInterval: null,
  
  isMuted: false,
  isVideoOff: false,
  isRecording: false,
  isMinimized: false,
  
  error: null,

  initSocket: (token: string, userName: string) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) {
      console.log('[SOCKET] Already connected, skipping initialization');
      return;
    }

    // Disconnect existing socket if it exists but not connected
    if (existingSocket) {
      console.log('[SOCKET] Disconnecting existing socket');
      existingSocket.disconnect();
    }

    // Store user name for transcript
    set({ userName });

    const socket = io(SOCKET_URL, {
      auth: { token, userName },
      transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10, // Increase attempts for better reliability
      timeout: 20000, // 20 second connection timeout
      upgrade: true, // Allow transport upgrades
      rememberUpgrade: true, // Remember successful transport
      forceNew: false, // Reuse existing connection if available
    });
    
    // Store socket immediately so joinRoom can access it
    set({ socket });
    
    console.log('[SOCKET] Initializing connection to:', SOCKET_URL);
    console.log('[SOCKET] Socket instance created, waiting for connection...');

    // Track connection attempts to avoid showing errors too early
    let connectionAttempts = 0;
    let errorToastShown = false;

    socket.on('connect', () => {
      console.log('[SOCKET] ✅ Connected successfully');
      console.log('[SOCKET] Socket ID:', socket.id);
      console.log('[SOCKET] Transport:', socket.io.engine?.transport?.name || 'unknown');
      set({ error: null });
      // Reset error tracking on successful connection
      connectionAttempts = 0;
      errorToastShown = false;
      // Don't show toast on every connect (too noisy, connection is expected)
      // toast.success('Connected', 'Socket connection established');
    });
    
    socket.on('connect_error', (error: any) => {
      connectionAttempts++;
      
      // Log error for debugging
      console.warn('[SOCKET] ⚠️ Connection error (will retry):', error.message, `Attempt ${connectionAttempts}`);
      
      // Transport errors are expected - Socket.IO will automatically try polling
      const isTransportError = error.type === 'TransportError' || 
                               error.message === 'websocket error' ||
                               error.message?.includes('websocket') ||
                               error.message?.includes('transport');
      
      if (isTransportError) {
        // Transport error - just log, Socket.IO will automatically try polling
        console.log('[SOCKET] WebSocket transport failed, will try polling fallback...');
        return; // Don't show error for transport failures
      }
      
      // For non-transport errors, only show error after multiple failed attempts
      // This gives Socket.IO time to retry and potentially succeed
      if (connectionAttempts >= 5 && !errorToastShown) {
        console.error('[SOCKET] ❌ Connection failed after multiple attempts:', {
          message: error.message,
          type: error.type || 'unknown',
          attempts: connectionAttempts,
        });
        
        errorToastShown = true;
        const message = `Unable to connect to call server: ${error.message || 'Connection failed'}`;
        set({ error: message });
        toast.error('Connection Error', message);
      }
    });
    
    // Reset error tracking on successful connection
    socket.on('connect', () => {
      connectionAttempts = 0;
      errorToastShown = false;
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log('[SOCKET] ✅ Reconnected after', attemptNumber, 'attempts');
      // Only show toast if it took multiple attempts (significant reconnection)
      if (attemptNumber > 3) {
        toast.success('Reconnected', 'Connection restored');
      }
      
      // Rejoin room if we were in one
      const { roomId } = get();
      if (roomId && socket.connected) {
        console.log('[SOCKET] Rejoining room after reconnect:', roomId);
        socket.emit('room:join', { roomId });
      }
    });
    
    socket.on('reconnect_error', (error) => {
      // Only log, don't show error - Socket.IO will keep trying
      console.warn('[SOCKET] ⚠️ Reconnection attempt failed (will retry):', error.message || error);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('[SOCKET] ❌ Reconnection failed - giving up');
      toast.error('Connection Failed', 'Unable to reconnect. Please refresh the page.');
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
      // Only show warning for unexpected disconnects, not for manual disconnects
      if (reason === 'io server disconnect' || reason === 'transport close') {
        console.log('[SOCKET] Unexpected disconnect, will attempt to reconnect...');
        // Don't show toast for normal reconnection scenarios
      } else if (reason === 'io client disconnect') {
        console.log('[SOCKET] Client-initiated disconnect');
      }
    });

    socket.on('error', (error: any) => {
      console.error('Socket error:', error);
      const message = error.message || 'An error occurred';
      set({ error: message });
      toast.error('Error', message);
    });

    socket.on('room:joined', (data) => {
      // Filter out current user from participants list and remove duplicates
      const authUser = useAuthStore.getState().user;
      const currentUserId = authUser?._id;
      const currentSocketId = socket.id;
      
      // CRITICAL: Deduplicate participants by userId (UI-level deduplication)
      // This ensures no duplicate participants even if backend sends duplicates
      const participantMap = new Map<string, any>();
      (data.participants || []).forEach((p: any) => {
        // Filter out current user
        if (p.userId === currentUserId || p.socketId === currentSocketId) {
          return;
        }
        // Use userId as key for deduplication (most reliable identifier)
        const userId = p.userId || p._id;
        if (userId && !participantMap.has(userId)) {
          participantMap.set(userId, p);
        } else if (userId && participantMap.has(userId)) {
          // If duplicate found, keep the one with more complete data
          const existing = participantMap.get(userId);
          if (p.userName && !existing.userName) {
            participantMap.set(userId, p);
          }
        }
      });
      const filteredParticipants = Array.from(participantMap.values());
      
      console.log('[ROOM] Joined room with participants:', filteredParticipants.length);
      set({
        roomId: data.roomId,
        callId: data.callId,
        participants: filteredParticipants,
        callStatus: data.callStarted ? 'active' : 'waiting',
      });
      
      // Create peer connections for all existing participants
      const { localStream } = get();
      if (localStream && filteredParticipants.length > 0) {
        console.log('[WEBRTC] 🚀 Creating peer connections for existing participants...');
        // Use setTimeout to ensure state is updated before creating connections
        setTimeout(async () => {
          for (const participant of filteredParticipants) {
            try {
              await get().createPeerConnection(participant.socketId, participant.userId, participant.userName);
              // Small delay between connections to avoid overwhelming the system
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error: any) {
              console.error('[WEBRTC] ❌ Error creating peer connection for:', participant.socketId, error.message);
            }
          }
        }, 500); // Wait 500ms for state to settle
      }
    });

    socket.on('user:joined', async (data) => {
      // Don't add current user to participants list
      const currentSocketId = socket.id;
      if (data.socketId === currentSocketId) {
        console.log('[ROOM] Ignoring own join event');
        return;
      }
      
      console.log('[ROOM] 🎉 ========== USER JOINED EVENT ==========');
      console.log('[ROOM] 🎉 User details:', {
        socketId: data.socketId,
        userName: data.userName,
        userId: data.userId,
      });
      
      set((state) => {
        // CRITICAL: Deduplicate by userId (most reliable identifier)
        const userId = data.userId || data._id;
        const exists = state.participants.some(p => 
          (p.userId === userId) || (p.socketId === data.socketId)
        );
        if (exists) {
          console.log('[ROOM] ⚠️ Participant already exists:', { userId, socketId: data.socketId });
          // Update existing participant if new data is more complete
          return {
            participants: state.participants.map(p => 
              (p.userId === userId || p.socketId === data.socketId) 
                ? { ...p, ...data } // Merge new data
                : p
            ),
          };
        }
        console.log('[ROOM] ✅ Adding new participant:', data.userName, data.socketId);
        return {
          participants: [...state.participants, data],
        };
      });
      
      // Create peer connection for the new participant
      const { localStream, peerConnections } = get();
      if (!localStream) {
        console.warn('[WEBRTC] ⚠️ Cannot create peer connection - no local stream');
        return;
      }
      
      // Check if peer connection already exists for this socketId
      if (peerConnections.has(data.socketId)) {
        console.log('[WEBRTC] ⚠️ Peer connection already exists for:', data.socketId);
        return;
      }
      
      // Create new peer connection for this participant
      console.log('[WEBRTC] 🚀 Creating peer connection for new participant:', data.socketId);
      await get().createPeerConnection(data.socketId, data.userId, data.userName);
    }),

    socket.on('user:left', (data) => {
      console.log('[CALL] User left:', data.userName, 'Remaining participants:', data.participantCount);
      
      // Remove peer connection for the leaving user
      get().removePeerConnection(data.socketId);
      
      set((state) => {
        const updatedParticipants = state.participants.filter(p => p.socketId !== data.socketId);
        console.log('[CALL] Updated participants count:', updatedParticipants.length);
        return {
          participants: updatedParticipants,
        };
      });
      
      // Keep call active - don't change call status
      // Call only ends when call:ended event is received (last participant left)
      const { callStatus } = get();
      if (callStatus === 'active') {
        console.log('[CALL] Call continues with remaining participants');
      }
    });

    socket.on('signal:offer', async (data) => {
      const { peerConnections, localStream } = get();
      const fromSocketId = data.fromId;
      
      // Get or create peer connection for this specific participant
      let pc = peerConnections.get(fromSocketId);
      
      // If peer connection doesn't exist, create it
      if (!pc) {
        console.log('[WEBRTC] ⚠️ No peer connection found for offer from:', fromSocketId, '- Creating new one');
        // We need participant info to create connection - try to find it from participants list
        const { participants } = get();
        const participant = participants.find(p => p.socketId === fromSocketId);
        if (participant && localStream) {
          await get().createPeerConnection(fromSocketId, participant.userId, participant.userName);
          // Refresh peerConnections after creation
          const updatedPeerConnections = get().peerConnections;
          pc = updatedPeerConnections.get(fromSocketId);
        } else {
          console.error('[WEBRTC] ❌ Cannot create peer connection - missing participant info or local stream');
          return;
        }
      }
      
      // Final check - if still no peer connection, abort
      if (!pc) {
        console.error('[WEBRTC] ❌ Cannot handle offer - no peer connection for:', fromSocketId);
        return;
      }
      
      // TypeScript now knows pc is defined
      const peerConn = pc;
      
      try {
        console.log('[WEBRTC] 📥 ========== RECEIVED OFFER ==========');
        console.log('[WEBRTC] 📥 Offer from:', fromSocketId);
        console.log('[WEBRTC] 📥 Offer details:', {
          type: data.offer?.type,
          sdp: data.offer?.sdp?.substring(0, 200) + '...',
        });
        console.log('[WEBRTC] 📥 Current signaling state:', peerConn.signalingState);
        
        // CRITICAL: Ensure tracks are added BEFORE setting remote description
        if (localStream) {
          const senders = peerConn.getSenders();
          const hasVideoSender = senders.some(s => s.track && s.track.kind === 'video');
          const hasAudioSender = senders.some(s => s.track && s.track.kind === 'audio');
          
          console.log('[WEBRTC] 📊 Current senders before handling offer:', {
            totalSenders: senders.length,
            hasVideoSender,
            hasAudioSender,
          });
          
          if (!hasVideoSender || !hasAudioSender) {
            console.log('[WEBRTC] 🔧 Adding tracks before handling offer...');
            localStream.getTracks().forEach(track => {
              const existingSender = senders.find(s => s.track && s.track.id === track.id);
              if (!existingSender) {
                console.log('[WEBRTC] ➕ Adding track:', track.kind, track.id);
                try {
                  peerConn.addTrack(track, localStream);
                  console.log('[WEBRTC] ✅ Track added successfully');
                } catch (error: any) {
                  console.error('[WEBRTC] ❌ Error adding track:', error.message);
                }
              } else {
                console.log('[WEBRTC] ℹ️ Track already added:', track.kind, track.id);
              }
            });
          }
        } else {
          console.warn('[WEBRTC] ⚠️ No local stream available when handling offer');
        }
        
        // CRITICAL: Set remote description first
        console.log('[WEBRTC] 🔧 Setting remote description...');
        await peerConn.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('[WEBRTC] ✅ Remote description set, signaling state:', peerConn.signalingState);
        
        // CRITICAL: Create answer with proper options
        console.log('[WEBRTC] 🔧 Creating answer...');
        const answer = await peerConn.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        
        console.log('[WEBRTC] 📤 Answer created:', {
          type: answer.type,
          sdp: answer.sdp?.substring(0, 200) + '...',
        });
        
        // CRITICAL: Set local description
        await peerConn.setLocalDescription(answer);
        console.log('[WEBRTC] ✅ Local description set, signaling state:', peerConn.signalingState);
        
        // CRITICAL: Send answer
        socket.emit('signal:answer', {
          targetId: fromSocketId,
          answer: peerConn.localDescription,
        });
        console.log('[WEBRTC] 📡 Answer sent via Socket.IO to:', fromSocketId);
        console.log('[WEBRTC] 📥 ========== OFFER HANDLED ==========');
      } catch (error: any) {
        console.error('[WEBRTC] ❌ Error handling offer:', error.message, error);
        toast.error('Connection Error', 'Failed to accept video connection');
      }
    });

    socket.on('signal:answer', async (data) => {
      const { peerConnections } = get();
      const fromSocketId = data.fromId;
      
      const pc = peerConnections.get(fromSocketId);
      if (!pc) {
        console.error('[WEBRTC] ❌ Cannot handle answer - no peer connection for:', fromSocketId);
        return;
      }
      
      try {
        console.log('[WEBRTC] 📥 Received answer from:', fromSocketId);
        
        if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('[WEBRTC] ✅ Answer set for:', fromSocketId);
        } else {
          console.warn('[WEBRTC] ⚠️ Wrong signaling state for answer:', pc.signalingState);
        }
      } catch (error: any) {
        console.error('[WEBRTC] ❌ Error handling answer:', error.message);
      }
    });

    socket.on('signal:candidate', async (data) => {
      const { peerConnections } = get();
      const fromSocketId = data.fromId;
      
      const pc = peerConnections.get(fromSocketId);
      if (!pc) {
        console.warn('[WEBRTC] ⚠️ Cannot add ICE candidate - no peer connection for:', fromSocketId);
        return;
      }
      
      try {
        if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log('[WEBRTC] ✅ ICE candidate added for:', fromSocketId);
        }
      } catch (error: any) {
        // Ignore duplicate/invalid candidate errors
        if (!error.message?.includes('duplicate') && !error.message?.includes('Invalid')) {
          console.error('[WEBRTC] ❌ Error adding ICE candidate:', error.message);
        }
      }
    });

    socket.on('call:started', (data) => {
      console.log('[CALL] 📞 Call started event received:', data);
      const startTime = Date.now();
      set({
        callStatus: 'active',
        callId: data.callId,
        isRecording: true, // Set flag, actual recording will start when streams are ready
        callStartTime: startTime, // Store start time for continuous duration
      });
      // Start speech recognition for transcription
      // Ensure socket is connected first
      const { socket: currentSocket } = get();
      if (currentSocket && currentSocket.connected) {
        setTimeout(() => {
          console.log('[CALL] Starting speech recognition after call:started');
          get().startSpeechRecognition();
          // CRITICAL: Start call recording automatically when call starts
          console.log('[RECORDING] Auto-starting recording after call:started event');
          get().startCallRecording();
        }, 1000); // Wait 1 second for streams to be ready
      } else {
        console.warn('[CALL] ⚠️ Socket not connected, cannot start transcription');
        // Wait for socket and retry
        const checkSocketInterval = setInterval(() => {
          const { socket: checkSocket, localStream } = get();
          if (checkSocket && checkSocket.connected && localStream) {
            console.log('[CALL] Socket connected and streams ready, starting services');
            get().startSpeechRecognition();
            // CRITICAL: Start call recording when socket connects and streams are ready
            console.log('[RECORDING] Auto-starting recording after socket connection');
            get().startCallRecording();
            get().startAIAnalysis();
            clearInterval(checkSocketInterval);
          }
        }, 500);
        setTimeout(() => clearInterval(checkSocketInterval), 10000);
      }
    });

    socket.on('call:ended', async (data) => {
      console.log('[CALL] Call ended for all participants:', data?.reason || 'unknown');
      set({
        callStatus: 'ended',
        isRecording: false,
      });
      // Stop speech recognition
      get().stopSpeechRecognition();
      // Stop AI analysis
      get().stopAIAnalysis();
      // Generate final summary (only when call actually ends for everyone)
      await get().analyzeTranscript(true);
      // Stop and upload recording (only when call actually ends for everyone)
      await get().stopCallRecording();
    });

    socket.on('transcript:chunk', (segment: TranscriptSegment) => {
      console.log('[TRANSCRIPT] ✅ Received transcript chunk:', {
        speaker: segment.speaker,
        speakerId: segment.speakerId,
        text: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
        fullTextLength: segment.text.length,
        timestamp: segment.timestamp,
        currentTime: Date.now(),
        timeDiff: Date.now() - segment.timestamp,
      });
      const authUser = useAuthStore.getState().user;
      const currentUserId = authUser?._id;
      console.log('[TRANSCRIPT] Current user ID:', currentUserId);
      console.log('[TRANSCRIPT] Current transcript length:', get().transcript.length);
      console.log('[TRANSCRIPT] Socket connection state:', socket.connected ? 'connected' : 'disconnected');
      
      // Get current user info to check if this is from current user
      const { userName: currentUserName } = get();
      
      // Normalize speaker name - keep original speaker name from server
      // Server already identifies the speaker correctly, so we should display it as-is
      // Only normalize if it's clearly the current user
      let displaySpeaker = segment.speaker;
      if (segment.speakerId && currentUserId) {
        const segmentUserId = segment.speakerId.toString();
        const currentUserIdStr = currentUserId.toString();
        if (segmentUserId === currentUserIdStr) {
          // This is from current user - use their name or "You"
          displaySpeaker = currentUserName || 'You';
        } else {
          // This is from another user - keep their name as sent by server
          displaySpeaker = segment.speaker;
        }
      }
      
      const normalizedSegment: TranscriptSegment = {
        ...segment,
        speaker: displaySpeaker,
      };
      
      set((state) => {
        // Check if this segment already exists (avoid duplicates)
        // Check by speaker + text + timestamp to be more accurate
        const exists = state.transcript.some(
          s => {
            const sameText = s.text.trim().toLowerCase() === segment.text.trim().toLowerCase();
            const sameSpeaker = s.speaker === displaySpeaker || 
              (segment.speakerId && s.speakerId && s.speakerId.toString() === segment.speakerId.toString());
            const closeTimestamp = Math.abs(s.timestamp - segment.timestamp) < 10000;
            return sameText && sameSpeaker && closeTimestamp;
          }
        );
        if (exists) {
          console.log('[TRANSCRIPT] ⚠️ Duplicate segment, skipping');
          return state;
        }
        
        console.log('[TRANSCRIPT] ✅ Adding new segment from:', displaySpeaker);
        const newTranscript = [...state.transcript, normalizedSegment];
        console.log('[TRANSCRIPT] ✅ Updated transcript length:', newTranscript.length);
        return {
          transcript: newTranscript,
          interimTranscript: '', // Clear interim when final arrives
        };
      });
      
      // Auto-scroll transcript to bottom
      setTimeout(() => {
        const transcriptElement = document.querySelector('[data-transcript-container]');
        if (transcriptElement) {
          transcriptElement.scrollTop = transcriptElement.scrollHeight;
        }
      }, 100);
    });

    // Handle remote participant audio state changes
    socket.on('participant:audio:changed', (data: { socketId: string; userId: string; userName: string; isMuted: boolean }) => {
      console.log('[AUDIO] 📥 Remote participant audio state changed:', {
        socketId: data.socketId,
        userId: data.userId,
        userName: data.userName,
        isMuted: data.isMuted,
      });
      
      // Update participant state
      set((state) => ({
        participants: state.participants.map((p) =>
          p.socketId === data.socketId || p.userId === data.userId
            ? { ...p, isMuted: data.isMuted }
            : p
        ),
      }));
      
      // Update remote audio element mute state if needed
      const remoteAudioElement = document.getElementById(`remote-audio-${data.socketId}`) as HTMLAudioElement;
      if (remoteAudioElement) {
        // Note: We can't directly mute remote audio, but we can show visual indicator
        console.log(`[AUDIO] Remote participant ${data.userId} is ${data.isMuted ? 'muted' : 'unmuted'}`);
      }
    });

    // Handle remote participant video state changes
    socket.on('participant:video:changed', (data: { socketId: string; userId: string; userName: string; isVideoOff: boolean }) => {
      console.log('[VIDEO] 📥 Remote participant video state changed:', {
        socketId: data.socketId,
        userId: data.userId,
        userName: data.userName,
        isVideoOff: data.isVideoOff,
      });
      
      // Update participant state
      set((state) => ({
        participants: state.participants.map((p) =>
          p.socketId === data.socketId || p.userId === data.userId
            ? { ...p, isVideoOff: data.isVideoOff }
            : p
        ),
      }));
    });

    socket.on('ai:notes', (notes: AINotes) => {
      set({ aiNotes: notes });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket, peerConnection, localStream } = get();
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnection) {
      peerConnection.close();
    }
    
    if (socket) {
      socket.disconnect();
    }
    
    set({
      socket: null,
      peerConnection: null,
      localStream: null,
      remoteStream: null,
    });
  },

  createRoom: async (token: string) => {
    set({ error: null });
    
    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // If token is invalid, clear storage and reload
        if (response.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          toast.error('Session Expired', 'Please login again.');
          window.location.href = '/login';
          throw new Error('Session expired. Please login again.');
        }
        
        const error = parseApiError(errorData);
        const message = getUserFriendlyMessage(error);
        set({ error: message });
        toast.error('Failed to Create Room', message);
        throw new Error(message);
      }

      const data = await response.json();
      set({ isHost: true, callId: data.callId, error: null });
      toast.success('Room Created', `Room code: ${data.roomId}`);
      return data.roomId;
    } catch (error: any) {
      // Network error - check if server is reachable
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('[ROOM] Network error - server may not be running on', API_URL);
        const message = 'Unable to connect to server. Please ensure the backend is running.';
        set({ error: message });
        toast.error('Connection Error', message);
        throw new Error(message);
      }
      console.error('Create room error:', error);
      throw error;
    }
  },

  joinRoom: async (roomId: string, token: string) => {
    set({ error: null, callStatus: 'connecting' });
    
    // Wait for socket to be connected (with timeout)
    const waitForSocket = (): Promise<Socket> => {
      return new Promise((resolve, reject) => {
        const currentSocket = get().socket;
        if (currentSocket && currentSocket.connected) {
          resolve(currentSocket);
          return;
        }

        // Wait up to 10 seconds for socket connection
        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout. Please refresh and try again.'));
        }, 10000);

        // Check every 100ms
        const checkInterval = setInterval(() => {
          const checkSocket = get().socket;
          if (checkSocket && checkSocket.connected) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve(checkSocket);
          }
        }, 100);

        // If socket doesn't exist yet, wait a bit for initSocket to create it
        if (!currentSocket) {
          setTimeout(() => {
            const newSocket = get().socket;
            if (newSocket) {
              newSocket.once('connect', () => {
                clearTimeout(timeout);
                clearInterval(checkInterval);
                resolve(newSocket);
              });
            }
          }, 100);
        } else {
          // Socket exists but not connected, wait for connect event
          currentSocket.once('connect', () => {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve(currentSocket);
          });
        }
      });
    };

    try {
      // Wait for socket connection before proceeding
      console.log('[JOIN] Waiting for socket connection...');
      await waitForSocket();
      console.log('[JOIN] ✅ Socket connected, proceeding with room join');

      const response = await fetch(`${API_URL}/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          toast.error('Session Expired', 'Please login again.');
          window.location.href = '/login';
          throw new Error('Session expired');
        }
        
        if (response.status === 404) {
          const message = 'Room not found. Please check the room code.';
          set({ error: message });
          toast.error('Room Not Found', message);
          throw new Error(message);
        }
        
        const error = parseApiError(errorData);
        const message = getUserFriendlyMessage(error);
        set({ error: message });
        toast.error('Failed to Join Room', message);
        throw new Error(message);
      }

      const data = await response.json();
      set({
        isHost: data.isHost,
        callId: data.callId,
        roomId,
        error: null,
      });
    } catch (error: any) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('[ROOM] Network error - server may not be running on', API_URL);
        const message = 'Unable to connect to server. Please ensure the backend is running.';
        set({ error: message, callStatus: 'idle' });
        toast.error('Connection Error', message);
        throw new Error(message);
      }
      if (error.message?.includes('timeout')) {
        set({ error: error.message, callStatus: 'idle' });
        toast.error('Connection Timeout', error.message);
        throw error;
      }
      set({ callStatus: 'idle' });
      throw error;
    }

    // Get media devices with proper error handling
    let stream: MediaStream | null = null;
    try {
      console.log('[WEBRTC] Requesting camera and microphone permissions...');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });
      
      console.log('[WEBRTC] ✅ Media stream obtained:', {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoEnabled: stream.getVideoTracks()[0]?.enabled,
        audioEnabled: stream.getAudioTracks()[0]?.enabled,
      });

      // Verify tracks are actually enabled
      stream.getVideoTracks().forEach(track => {
        console.log('[WEBRTC] Video track:', {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
        });
      });

      stream.getAudioTracks().forEach(track => {
        console.log('[WEBRTC] Audio track:', {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
        });
      });
    } catch (error: any) {
      console.error('[WEBRTC] ❌ Error getting user media:', error);
      let errorMessage = 'Failed to access camera/microphone';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera/microphone permission denied. Please allow access and refresh.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera/microphone found. Please connect a device.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera/microphone is being used by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support required settings.';
      }
      
      set({ error: errorMessage, callStatus: 'idle' });
      toast.error('Media Access Error', errorMessage);
      throw new Error(errorMessage);
    }

    if (!stream) {
      throw new Error('Failed to get media stream');
    }

    // Store local stream - peer connections will be created when participants join
    set({
      localStream: stream,
      // CRITICAL: Initialize mute/video state from actual track state
      isMuted: stream.getAudioTracks().length === 0 || !stream.getAudioTracks()[0]?.enabled,
      isVideoOff: stream.getVideoTracks().length === 0 || !stream.getVideoTracks()[0]?.enabled,
    });

    // Emit room:join to get list of existing participants
    // Peer connections will be created in the room:joined handler
    const { socket: currentSocket } = get();
    if (currentSocket && currentSocket.connected) {
      console.log('[JOIN] ✅ Emitting room:join with connected socket');
      currentSocket.emit('room:join', { roomId });
    } else {
      console.warn('[JOIN] ⚠️ Socket not connected, waiting...');
      // Wait for socket and then emit
      const waitAndEmit = setInterval(() => {
        const { socket: checkSocket } = get();
        if (checkSocket && checkSocket.connected) {
          console.log('[JOIN] ✅ Socket connected, emitting room:join now');
          checkSocket.emit('room:join', { roomId });
          clearInterval(waitAndEmit);
        }
      }, 100);
      setTimeout(() => clearInterval(waitAndEmit), 10000); // Timeout after 10s
    }

    // Start speech recognition immediately after getting stream (only if not muted)
    setTimeout(() => {
      const { isMuted, speechRecognition, callStatus } = get();
      if (!isMuted && !speechRecognition && callStatus !== 'ended') {
        console.log('[JOIN] ✅ Starting speech recognition after getting media stream');
        get().startSpeechRecognition();
      } else if (isMuted) {
        console.log('[JOIN] ⚠️ User is muted, skipping speech recognition (will start when unmuted)');
      } else if (speechRecognition) {
        console.log('[JOIN] ✅ Speech recognition already active');
      } else if (callStatus === 'ended') {
        console.log('[JOIN] ⚠️ Call ended, not starting speech recognition');
      }
    }, 1000);
  },

  createPeerConnection: async (socketId: string, userId: string, userName: string) => {
    const { localStream, peerConnections, socket } = get();
    
    if (!localStream) {
      console.error('[WEBRTC] ❌ Cannot create peer connection - no local stream');
      return;
    }
    
    if (peerConnections.has(socketId)) {
      console.log('[WEBRTC] ⚠️ Peer connection already exists for:', socketId);
      return;
    }
    
    if (!socket) {
      console.error('[WEBRTC] ❌ Cannot create peer connection - no socket');
      return;
    }
    
    console.log('[WEBRTC] 🚀 Creating peer connection for participant:', { socketId, userId, userName });
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => {
      try {
        pc.addTrack(track, localStream);
        console.log('[WEBRTC] ✅ Added track to peer connection:', track.kind);
      } catch (error: any) {
        console.error('[WEBRTC] ❌ Error adding track:', error.message);
      }
    });
    
    // Handle incoming remote tracks for this specific peer
    pc.ontrack = (event) => {
      console.log('[WEBRTC] 📹 Received track from:', socketId);
      if (!event.track) return;
      
      const { remoteStreams } = get();
      let participantStream = remoteStreams.get(socketId);
      
      if (!participantStream) {
        participantStream = new MediaStream();
        remoteStreams.set(socketId, participantStream);
      }
      
      // Check if track already exists
      const existingTrack = participantStream.getTracks().find(t => t.id === event.track.id);
      if (!existingTrack) {
        participantStream.addTrack(event.track);
        console.log('[WEBRTC] ✅ Added track to participant stream:', { 
          socketId, 
          trackKind: event.track.kind,
          trackEnabled: event.track.enabled,
          trackMuted: event.track.muted,
          trackReadyState: event.track.readyState,
        });
        
        // Log initial track state for debugging
        if (event.track.kind === 'video') {
          console.log('[WEBRTC] 📹 Video track state:', {
            enabled: event.track.enabled,
            muted: event.track.muted,
            readyState: event.track.readyState,
          });
        } else if (event.track.kind === 'audio') {
          console.log('[WEBRTC] 🎤 Audio track state:', {
            enabled: event.track.enabled,
            muted: event.track.muted,
            readyState: event.track.readyState,
          });
        }
        
        // CRITICAL: Wait for track to become 'live' before checking state
        // Tracks might be in 'connecting' state initially, and we shouldn't mark them as off/muted
        const checkWhenLive = () => {
          if (event.track.readyState === 'live') {
            console.log('[WEBRTC] ✅ Track is now live:', {
              socketId,
              trackKind: event.track.kind,
              enabled: event.track.enabled,
              muted: event.track.muted,
            });
            // Trigger state update by updating remoteStreams
            const { remoteStreams: currentStreams } = get();
            set({ remoteStreams: new Map(currentStreams) });
          } else if (event.track.readyState !== 'ended') {
            // Track is still connecting, check again soon
            setTimeout(checkWhenLive, 100);
          }
        };
        
        // Start checking when track becomes live
        if (event.track.readyState !== 'live') {
          setTimeout(checkWhenLive, 100);
        }
      }
      
      set({ remoteStreams: new Map(remoteStreams) });
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal:candidate', {
          targetId: socketId,
          candidate: event.candidate,
        });
      }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[WEBRTC] Connection state changed:', { socketId, state: pc.connectionState });
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('[WEBRTC] ⚠️ Peer connection failed or disconnected:', socketId);
      }
    };
    
    // Store peer connection
    peerConnections.set(socketId, pc);
    set({ peerConnections: new Map(peerConnections) });
    
    // Create and send offer
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await pc.setLocalDescription(offer);
      
      socket.emit('signal:offer', {
        targetId: socketId,
        offer: pc.localDescription,
      });
      
      console.log('[WEBRTC] ✅ Offer sent to:', socketId);
    } catch (error: any) {
      console.error('[WEBRTC] ❌ Error creating offer:', error.message);
      // Clean up on error
      pc.close();
      peerConnections.delete(socketId);
      set({ peerConnections: new Map(peerConnections) });
    }
  },

  removePeerConnection: (socketId: string) => {
    const { peerConnections, remoteStreams } = get();
    
    const pc = peerConnections.get(socketId);
    if (pc) {
      pc.close();
      peerConnections.delete(socketId);
      console.log('[WEBRTC] ✅ Removed peer connection for:', socketId);
    }
    
    // Remove remote stream
    remoteStreams.delete(socketId);
    
    set({ 
      peerConnections: new Map(peerConnections),
      remoteStreams: new Map(remoteStreams),
    });
  },

  leaveRoom: async () => {
    const { socket, roomId, localStream, peerConnection, peerConnections } = get();
    
    console.log('[LEAVE] Leaving room:', roomId);
    
    // Stop speech recognition first
    get().stopSpeechRecognition();
    // Stop recording
    await get().stopCallRecording();
    
    // Emit leave event (but don't disconnect socket - let it reconnect)
    if (socket && roomId && socket.connected) {
      console.log('[LEAVE] Emitting room:leave event');
      socket.emit('room:leave');
    }
    
    // Stop all media tracks immediately
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('[LEAVE] Stopped track:', track.kind);
      });
    }
    
    // Close all peer connections (for multi-participant calls)
    peerConnections.forEach((pc, socketId) => {
      try {
        pc.close();
        console.log('[LEAVE] Closed peer connection for:', socketId);
      } catch (error: any) {
        console.error('[LEAVE] Error closing peer connection:', error.message);
      }
    });
    
    // Close legacy peer connection (for backward compatibility)
    if (peerConnection) {
      try {
        peerConnection.close();
        console.log('[LEAVE] Closed legacy peer connection');
      } catch (error: any) {
        console.error('[LEAVE] Error closing legacy peer connection:', error.message);
      }
    }
    
    // Don't disconnect socket - let it stay connected for reconnection
    // Only disconnect if explicitly requested (e.g., logout)
    
    // Reset call state but keep socket for potential reconnection
    set({
      peerConnection: null,
      peerConnections: new Map(),
      localStream: null,
      remoteStream: null,
      remoteStreams: new Map(),
      roomId: null,
      callId: null,
      isHost: false,
      callStatus: 'idle',
      participants: [],
      transcript: [],
      interimTranscript: '',
      aiNotes: null,
      isMuted: false,
      isVideoOff: false,
      isRecording: false,
      error: null,
    });
    
    console.log('[LEAVE] Room left, socket remains connected for reconnection');
  },

  endCall: async () => {
    const { socket, localStream, peerConnection, peerConnections, roomId } = get();
    
    console.log('[CALL] User leaving call, but call continues for others');
    
    // Stop speech recognition for this user only
    get().stopSpeechRecognition();
    // Stop AI analysis for this user only
    get().stopAIAnalysis();
    
    // Stop all media tracks for this user
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('[CALL] Stopped track:', track.kind);
      });
    }
    
    // Close all peer connections (for multi-participant calls)
    peerConnections.forEach((pc, socketId) => {
      try {
        pc.close();
        console.log('[CALL] Closed peer connection for:', socketId);
      } catch (error: any) {
        console.error('[CALL] Error closing peer connection:', error.message);
      }
    });
    
    // Close legacy peer connection (for backward compatibility)
    if (peerConnection) {
      try {
        peerConnection.close();
        console.log('[CALL] Closed legacy peer connection');
      } catch (error: any) {
        console.error('[CALL] Error closing legacy peer connection:', error.message);
      }
    }
    
    // Emit call:end to remove this user from the call
    // The call will continue for other participants
    if (socket && roomId) {
      socket.emit('call:end');
    }
    
    // Leave the room (this will trigger user:left event for others)
    get().leaveRoom();
    
    // Clear local state (this user has left, but call may continue for others)
    set({ 
      callStatus: 'ended', // This user's call has ended
      isRecording: false,
      isMinimized: false,
      callStartTime: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      peerConnections: new Map(),
      remoteStreams: new Map(),
      participants: [], // Clear participants list for this user
    });
  },

  toggleMute: () => {
    const { localStream, speechRecognition, socket, roomId, peerConnection, peerConnections } = get();
    
    if (!localStream) {
      console.warn('[MUTE] ⚠️ No local stream available');
      return;
    }
    
    // Get actual track state (more reliable than store state)
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('[MUTE] ⚠️ No audio tracks available');
      return;
    }
    
    const audioTrack = audioTracks[0];
    
    // Check current track state BEFORE toggling
    const currentTrackEnabled = audioTrack.enabled;
    const newTrackEnabled = !currentTrackEnabled;
    const newMutedState = !newTrackEnabled; // Muted = track disabled
    
    console.log('[MUTE] 🔄 Before toggle - Track enabled:', currentTrackEnabled, 'State muted:', !currentTrackEnabled);
    
    // CRITICAL: Update track state (enabled = unmuted, disabled = muted)
    audioTrack.enabled = newTrackEnabled;
    
    console.log('[MUTE] ✅ After toggle - Track enabled:', audioTrack.enabled, 'State muted:', newMutedState);
    
    // Update all audio tracks in the stream
    audioTracks.forEach(track => {
      if (track.id !== audioTrack.id) {
        track.enabled = newTrackEnabled;
      }
    });
    
    // Update peer connection senders to reflect track state
    if (peerConnection) {
      const senders = peerConnection.getSenders();
      const audioSender = senders.find(s => s.track?.kind === 'audio');
      if (audioSender && audioSender.track) {
        // Ensure sender track state matches
        audioSender.track.enabled = newTrackEnabled;
        console.log('[MUTE] 📡 Peer connection audio sender track enabled:', audioSender.track.enabled);
      }
    }
    
    // Update all peer connections (for multi-participant calls)
    peerConnections.forEach((pc, socketId) => {
      const senders = pc.getSenders();
      const audioSender = senders.find(s => s.track?.kind === 'audio');
      if (audioSender && audioSender.track) {
        audioSender.track.enabled = newTrackEnabled;
        console.log(`[MUTE] 📡 Peer connection ${socketId} audio sender track enabled:`, audioSender.track.enabled);
      }
    });
    
    // Update store state to match track state IMMEDIATELY
    set({ isMuted: newMutedState });
    
    // Notify other participants of audio state change
    if (socket && roomId) {
      socket.emit('participant:audio:toggle', { isMuted: newMutedState });
      console.log('[MUTE] 📤 Emitted state change to room:', { roomId, isMuted: newMutedState });
    }
    
    // Stop speech recognition when muted, restart when unmuted
    if (newMutedState) {
      // Muted - stop recognition
      if (speechRecognition) {
        console.log('[MUTE] ⏸️ Stopping speech recognition (muted)');
        get().stopSpeechRecognition();
      }
    } else {
      // Unmuted - start recognition if call is active
      const { callStatus } = get();
      if (callStatus === 'active' && !speechRecognition) {
        console.log('[MUTE] ▶️ Starting speech recognition (unmuted)');
        setTimeout(() => {
          get().startSpeechRecognition();
        }, 500);
      }
    }
  },

  toggleVideo: () => {
    const { localStream, socket, roomId, peerConnection, peerConnections } = get();
    
    if (!localStream) {
      console.warn('[VIDEO] ⚠️ No local stream available');
      return;
    }
    
    // Get actual track state (more reliable than store state)
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn('[VIDEO] ⚠️ No video tracks available');
      return;
    }
    
    const videoTrack = videoTracks[0];
    
    // Check current track state BEFORE toggling
    const currentTrackEnabled = videoTrack.enabled;
    const newTrackEnabled = !currentTrackEnabled;
    const newVideoOff = !newTrackEnabled; // Video off = track disabled
    
    console.log('[VIDEO] 🔄 Before toggle - Track enabled:', currentTrackEnabled, 'State videoOff:', !currentTrackEnabled);
    
    // CRITICAL: Update track state (enabled = video on, disabled = video off)
    videoTrack.enabled = newTrackEnabled;
    
    console.log('[VIDEO] ✅ After toggle - Track enabled:', videoTrack.enabled, 'State videoOff:', newVideoOff);
    
    // Update all video tracks in the stream
    videoTracks.forEach(track => {
      if (track.id !== videoTrack.id) {
        track.enabled = newTrackEnabled;
      }
    });
    
    // Update peer connection senders to reflect track state
    if (peerConnection) {
      const senders = peerConnection.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');
      if (videoSender && videoSender.track) {
        // Ensure sender track state matches
        videoSender.track.enabled = newTrackEnabled;
        console.log('[VIDEO] 📡 Peer connection video sender track enabled:', videoSender.track.enabled);
      }
    }
    
    // Update all peer connections (for multi-participant calls)
    peerConnections.forEach((pc, socketId) => {
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');
      if (videoSender && videoSender.track) {
        videoSender.track.enabled = newTrackEnabled;
        console.log(`[VIDEO] 📡 Peer connection ${socketId} video sender track enabled:`, videoSender.track.enabled);
      }
    });
    
    // Update store state to match track state IMMEDIATELY
    set({ isVideoOff: newVideoOff });
    
    // Notify other participants of video state change
    if (socket && roomId) {
      socket.emit('participant:video:toggle', { isVideoOff: newVideoOff });
      console.log('[VIDEO] 📤 Emitted state change to room:', { roomId, isVideoOff: newVideoOff });
    }
  },

  sendTranscript: (text: string) => {
    const { socket } = get();
    
    if (socket && text.trim()) {
      socket.emit('transcript:manual', {
        text: text.trim(),
        timestamp: Date.now(),
      });
    }
  },

  requestNotes: () => {
    const { socket } = get();
    
    if (socket) {
      socket.emit('notes:request');
    }
  },

  startAIAnalysis: () => {
    const { aiAnalysisInterval, callStatus } = get();
    
    // Don't start if already running or call not active
    if (aiAnalysisInterval || callStatus !== 'active') {
      return;
    }

    console.log('[AI] Starting real-time AI analysis (every 30 seconds)');
    
    // Start immediate analysis
    get().analyzeTranscript(false);
    
    // Set up interval for periodic analysis
    const interval = setInterval(() => {
      const { callStatus: currentStatus } = get();
      if (currentStatus === 'active') {
        get().analyzeTranscript(false);
      } else {
        // Stop if call ended
        get().stopAIAnalysis();
      }
    }, 30000); // Every 30 seconds

    set({ aiAnalysisInterval: interval });
  },

  stopAIAnalysis: () => {
    const { aiAnalysisInterval } = get();
    
    if (aiAnalysisInterval) {
      clearInterval(aiAnalysisInterval);
      set({ aiAnalysisInterval: null });
      console.log('[AI] Stopped real-time AI analysis');
    }
  },

  analyzeTranscript: async (isFinal: boolean = false) => {
    const { transcript, callId, participants, callStartTime } = get();
    const { accessToken } = useAuthStore.getState();
    
    if (!callId || !accessToken) {
      console.warn('[AI] Cannot analyze: missing callId or accessToken');
      return;
    }

    if (transcript.length === 0) {
      console.log('[AI] No transcript to analyze yet');
      return;
    }

    try {
      // Convert transcript segments to text
      const transcriptText = transcript
        .map(seg => `${seg.speaker}: ${seg.text}`)
        .join('\n');

      // Calculate duration
      const duration = callStartTime ? Date.now() - callStartTime : 0;

      // Get participant names
      const participantNames = participants.map(p => p.userName);
      const authUser = useAuthStore.getState().user;
      if (authUser?.name && !participantNames.includes(authUser.name)) {
        participantNames.push(authUser.name);
      }

      console.log('[AI] Analyzing transcript...', {
        transcriptLength: transcriptText.length,
        segmentCount: transcript.length,
        isFinal,
      });

      const response = await fetch(`${API_URL}/api/calls/${callId}/analyze-transcript`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcriptText,
          participants: participantNames,
          duration,
          isFinal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AI] Analysis failed:', errorData);
        return;
      }

      const analysis = await response.json();
      
      // Update AI notes in store
      set({
        aiNotes: {
          summary: analysis.summary || '',
          bullets: analysis.keyPoints || [],
          actionItems: analysis.actionItems || [],
          decisions: analysis.decisions || [],
          suggestedReplies: analysis.nextSteps || [],
          keyTopics: analysis.topics || [],
          isFinal,
          lastUpdated: Date.now(),
        },
      });

      console.log('[AI] ✅ Analysis complete', { isFinal });
    } catch (error: any) {
      console.error('[AI] Error analyzing transcript:', error);
    }
  },

  startSpeechRecognition: () => {
    const { socket, speechRecognition } = get();
    
    // Don't start if already active
    if (speechRecognition) {
      console.log('[SPEECH] Speech recognition already active');
      return;
    }
    
    // Allow speech recognition even without socket (for local display)
    if (!socket || !socket.connected) {
      console.warn('[SPEECH] ⚠️ No socket connection - will work locally only');
      // Continue anyway - we'll show transcript locally
    }
    
    // Check Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('[SPEECH] ❌ Web Speech API not supported in this browser');
      console.error('[SPEECH] Available:', {
        SpeechRecognition: typeof window.SpeechRecognition,
        webkitSpeechRecognition: typeof window.webkitSpeechRecognition,
        userAgent: navigator.userAgent,
      });
      toast.error('Speech Recognition Not Supported', 'Please use Chrome or Edge browser. Web Speech API is not available in this browser.');
      return;
    }
    
    console.log('[SPEECH] ✅ Web Speech API is available');
    
    try {
      const recognition = new SpeechRecognition();
      
      // Configuration
      recognition.continuous = true; // Keep listening
      recognition.interimResults = true; // Show interim results
      recognition.lang = 'en-US'; // Language
      recognition.maxAlternatives = 1; // Only get best result
      
      recognition.onstart = () => {
        console.log('[SPEECH] ✅ Speech recognition started');
        console.log('[SPEECH] Language:', recognition.lang);
        console.log('[SPEECH] Continuous:', recognition.continuous);
        console.log('[SPEECH] Interim results:', recognition.interimResults);
        console.log('[SPEECH] Max alternatives:', recognition.maxAlternatives);
        set({ speechRecognition: recognition }); // Store immediately
        toast.success('Speech Recognition Active', 'Listening for speech...');
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimText = '';
        
        console.log('[SPEECH] 📝 onresult event:', {
          resultIndex: event.resultIndex,
          resultsLength: event.results.length,
        });
        
        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript || '';
          const isFinal = result.isFinal;
          
          console.log('[SPEECH] Result', i, ':', {
            transcript,
            isFinal,
            confidence: result[0]?.confidence,
          });
          
          if (isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimText += transcript + ' ';
          }
        }
        
        // Update interim transcript in UI immediately for live feedback
        if (interimText.trim()) {
          console.log('[SPEECH] 📝 Interim transcript:', interimText.trim());
          set({ interimTranscript: interimText.trim() });
        } else if (finalTranscript.trim()) {
          // Clear interim when we have final
          set({ interimTranscript: '' });
        }
        
        // Send final transcript to server and show locally as fallback
        if (finalTranscript.trim()) {
          console.log('[SPEECH] ✅ Final transcript:', finalTranscript.trim());
          const { socket: currentSocket, roomId, isMuted, userName: currentUserName } = get();
          const authUser = useAuthStore.getState().user;
          
          // Don't send if muted
          if (isMuted) {
            console.log('[SPEECH] ⚠️ User is muted, ignoring transcript');
            return;
          }
          
          // Create segment for local display (fallback if server doesn't respond)
          const localSegment: TranscriptSegment = {
            speaker: currentUserName || 'You',
            speakerId: authUser?._id,
            text: finalTranscript.trim(),
            timestamp: Date.now(),
          };
          
          // Show locally immediately for better UX
          set((state) => {
            // Check if already exists
            const exists = state.transcript.some(
              s => s.text.trim().toLowerCase() === localSegment.text.trim().toLowerCase() 
                && Math.abs(s.timestamp - localSegment.timestamp) < 5000
            );
            if (!exists) {
              console.log('[SPEECH] ✅ Adding transcript locally (will be replaced by server response)');
              return {
                transcript: [...state.transcript, localSegment],
                interimTranscript: '', // Clear interim
              };
            }
            return state;
          });
          
          // Send to server - server will broadcast back and replace/update the local one
          if (currentSocket && currentSocket.connected && roomId) {
            console.log('[SPEECH] 📤 Sending transcript to server:', {
              text: finalTranscript.trim(),
              roomId,
              socketConnected: currentSocket.connected,
            });
            
            try {
              currentSocket.emit('transcript:manual', {
                text: finalTranscript.trim(),
                timestamp: Date.now(),
              }, (response: any) => {
                if (response) {
                  console.log('[SPEECH] ✅ Server acknowledged:', response);
                }
              });
            } catch (error: any) {
              console.error('[SPEECH] ❌ Error sending to server:', error.message);
            }
          } else {
            console.warn('[SPEECH] ⚠️ Socket not available - showing transcript locally only');
            if (!currentSocket) {
              console.warn('[SPEECH]   - No socket instance');
            } else if (!currentSocket.connected) {
              console.warn('[SPEECH]   - Socket not connected');
            } else if (!roomId) {
              console.warn('[SPEECH]   - No roomId');
            }
          }
          
          finalTranscript = '';
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('[SPEECH] Recognition error:', event.error);
        console.error('[SPEECH] Error details:', event);
        
        if (event.error === 'no-speech') {
          // This is normal, just continue - don't log as error
          console.log('[SPEECH] No speech detected (normal - will continue listening)');
          return;
        }
        
        if (event.error === 'audio-capture') {
          console.error('[SPEECH] ❌ Microphone not accessible');
          toast.error('Microphone Error', 'Could not access microphone. Please check permissions.');
          // Try to restart after a delay
          setTimeout(() => {
            const { callStatus } = get();
            if (callStatus === 'active') {
              console.log('[SPEECH] Attempting to restart after audio-capture error');
              get().startSpeechRecognition();
            }
          }, 2000);
        } else if (event.error === 'not-allowed') {
          console.error('[SPEECH] ❌ Microphone permission denied');
          toast.error('Permission Denied', 'Microphone permission required. Please allow microphone access.');
          set({ speechRecognition: null });
        } else if (event.error === 'network') {
          console.error('[SPEECH] ❌ Network error');
          // Don't show error toast for network issues - might be temporary
          console.log('[SPEECH] Network error - will retry on next recognition cycle');
        } else if (event.error === 'service-not-allowed') {
          console.error('[SPEECH] ❌ Speech recognition service not allowed');
          toast.error('Service Not Allowed', 'Please enable speech recognition in browser settings');
          set({ speechRecognition: null });
        } else if (event.error === 'aborted') {
          // Aborted is usually intentional, don't treat as error
          console.log('[SPEECH] Recognition aborted (normal)');
          return;
        } else {
          console.error('[SPEECH] ❌ Unknown error:', event.error);
          // Don't show toast for unknown errors - might be temporary
          console.log('[SPEECH] Will continue listening despite error');
        }
        
        // Only stop on critical errors that can't be recovered
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          set({ speechRecognition: null });
        }
      };
      
      recognition.onend = () => {
        console.log('[SPEECH] Speech recognition ended');
        const { callStatus, speechRecognition: currentRec, localStream, isMuted } = get();
        
        // Don't restart if muted
        if (isMuted) {
          console.log('[SPEECH] ⏸️ Not restarting - user is muted');
          if (currentRec === recognition) {
            set({ speechRecognition: null });
          }
          return;
        }
        
        // Auto-restart if call is still active (Web Speech API auto-stops after ~60s of silence)
        if (callStatus === 'active' && currentRec === recognition && localStream) {
          console.log('[SPEECH] 🔄 Auto-restarting recognition (normal behavior - Web Speech API auto-stops)...');
          setTimeout(() => {
            const { speechRecognition: stillActive, callStatus: stillActiveStatus, localStream: stillStream, isMuted: stillMuted } = get();
            // Only restart if no other recognition instance is active, call is still active, and not muted
            if (!stillActive && stillActiveStatus === 'active' && stillStream && !stillMuted) {
              console.log('[SPEECH] ✅ Restarting speech recognition');
              try {
              get().startSpeechRecognition();
              } catch (error) {
                console.error('[SPEECH] Error restarting recognition:', error);
                // Try again after a longer delay
                setTimeout(() => {
                  const { callStatus: retryStatus, localStream: retryStream, isMuted: retryMuted } = get();
                  if (retryStatus === 'active' && retryStream && !retryMuted) {
                    console.log('[SPEECH] Retrying recognition restart...');
                    get().startSpeechRecognition();
                  }
                }, 2000);
              }
            } else {
              console.log('[SPEECH] ⏸️ Not restarting - recognition already active, call ended, no stream, or muted');
            }
          }, 300); // Wait 300ms before restarting (faster restart)
        } else {
          console.log('[SPEECH] ⏹️ Not restarting - call status:', callStatus, 'has stream:', !!localStream);
          if (currentRec === recognition) {
          set({ speechRecognition: null });
          }
        }
      };
      
      // Start recognition
      try {
      recognition.start();
      set({ speechRecognition: recognition });
      console.log('[SPEECH] ✅ Started Web Speech API recognition');
      } catch (error: any) {
        // If already started, that's okay
        if (error.message?.includes('already started') || error.name === 'InvalidStateError') {
          console.log('[SPEECH] Recognition already started, continuing...');
          set({ speechRecognition: recognition });
        } else {
          throw error;
        }
      }
      
    } catch (error: any) {
      console.error('[SPEECH] Failed to start speech recognition:', error.message);
      toast.error('Failed to Start Recognition', error.message);
      set({ speechRecognition: null });
    }
  },

  stopSpeechRecognition: () => {
    const { speechRecognition } = get();
    
    if (speechRecognition) {
      try {
        speechRecognition.stop();
        set({ speechRecognition: null });
        console.log('[SPEECH] ✅ Speech recognition stopped');
      } catch (error) {
        console.error('[SPEECH] Error stopping recognition:', error);
        set({ speechRecognition: null });
      }
    }
  },

  startCallRecording: () => {
    const { localStream, remoteStream, callId, callRecorder } = get();
    
    // Don't start if already recording
    if (callRecorder && callRecorder.state !== 'inactive') {
      console.log('[RECORDING] Already recording, state:', callRecorder.state);
      return;
    }
    
    if (!callId) {
      console.log('[RECORDING] ⚠️ No call ID, skipping recording');
      return;
    }
    
    if (!localStream) {
      console.log('[RECORDING] ⚠️ No local stream available');
      return;
    }
    
    // Check MediaRecorder support
    if (!window.MediaRecorder) {
      console.warn('[RECORDING] ❌ MediaRecorder not supported in this browser');
      toast.error('Recording Not Supported', 'MediaRecorder API is not available');
      return;
    }
    
    try {
      console.log('[RECORDING] 🎬 Starting call recording...');
      console.log('[RECORDING] Streams available:', {
        hasLocalStream: !!localStream,
        localVideoTracks: localStream.getVideoTracks().length,
        localAudioTracks: localStream.getAudioTracks().length,
        hasRemoteStream: !!remoteStream,
        remoteVideoTracks: remoteStream?.getVideoTracks().length || 0,
        remoteAudioTracks: remoteStream?.getAudioTracks().length || 0,
      });
      
      // CRITICAL: Combine local and remote streams for recording
      const mixedStream = new MediaStream();
      
      // Add local stream tracks (user's own video/audio)
      localStream.getTracks().forEach(track => {
        if (track.readyState === 'live' && (track.kind === 'audio' || track.kind === 'video')) {
          console.log('[RECORDING] ➕ Adding local track:', track.kind, track.id);
          mixedStream.addTrack(track);
        }
      });
      
      // Add remote stream tracks (other participants' video/audio)
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => {
          if (track.readyState === 'live' && (track.kind === 'audio' || track.kind === 'video')) {
            console.log('[RECORDING] ➕ Adding remote track:', track.kind, track.id);
            mixedStream.addTrack(track);
          }
        });
      }
      
      const totalTracks = mixedStream.getTracks().length;
      const videoTracks = mixedStream.getVideoTracks().length;
      const audioTracks = mixedStream.getAudioTracks().length;
      
      console.log('[RECORDING] 📊 Mixed stream tracks:', {
        totalTracks,
        videoTracks,
        audioTracks,
      });
      
      if (totalTracks === 0) {
        console.warn('[RECORDING] ⚠️ No active tracks available for recording');
        toast.warning('Recording Warning', 'No active media tracks to record');
        return;
      }
      
      // Find supported mime type (prefer VP9 for better compression)
      const supportedTypes = [
        'video/webm;codecs=vp9,opus', // Best compression
        'video/webm;codecs=vp8,opus', // Good compression
        'video/webm', // Fallback
        'audio/webm;codecs=opus', // Audio-only fallback
      ];
      
      let selectedMimeType = '';
      for (const mimeType of supportedTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('[RECORDING] ✅ Selected codec:', mimeType);
          break;
        }
      }
      
      if (!selectedMimeType) {
        console.warn('[RECORDING] ⚠️ No supported codec found, using default');
        selectedMimeType = 'video/webm';
      }
      
      // Create MediaRecorder with selected codec
      const recorder = new MediaRecorder(mixedStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality/size balance
      });
      
      // CRITICAL: Clear previous chunks and store in state
      set({ recordingChunks: [] });
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('[RECORDING] 📦 Chunk received:', {
            size: event.data.size,
            type: event.data.type,
          });
          set((state) => ({
            recordingChunks: [...state.recordingChunks, event.data],
          }));
        }
      };
      
      recorder.onerror = (event: any) => {
        console.error('[RECORDING] ❌ Recording error:', event.error);
        toast.error('Recording Error', 'An error occurred while recording');
        set({ callRecorder: null, isRecording: false });
      };
      
      recorder.onstop = async () => {
        console.log('[RECORDING] ⏹️ Recording stopped, preparing upload...');
        const { callId: currentCallId, recordingChunks: finalChunks } = get();
        
        if (finalChunks.length === 0) {
          console.warn('[RECORDING] ⚠️ No recording chunks collected');
          set({ callRecorder: null, isRecording: false, recordingChunks: [] });
          return;
        }
        
        if (!currentCallId) {
          console.error('[RECORDING] ❌ No call ID for upload');
          set({ callRecorder: null, isRecording: false, recordingChunks: [] });
          return;
        }
        
        try {
          console.log('[RECORDING] 📤 Creating blob from', finalChunks.length, 'chunks...');
          const blob = new Blob(finalChunks, { type: selectedMimeType || 'video/webm' });
          console.log('[RECORDING] ✅ Blob created:', {
            size: blob.size,
            type: blob.type,
            sizeMB: (blob.size / (1024 * 1024)).toFixed(2),
          });
          
          const formData = new FormData();
          const filename = `recording-${currentCallId}-${Date.now()}.webm`;
          formData.append('recording', blob, filename);
          
          const token = localStorage.getItem('accessToken');
          if (!token) {
            console.error('[RECORDING] ❌ No access token available');
            toast.error('Upload Failed', 'Authentication required');
            set({ callRecorder: null, isRecording: false, recordingChunks: [] });
            return;
          }
          
          console.log('[RECORDING] 📤 Uploading to server...');
          const response = await fetch(`${API_URL}/api/calls/${currentCallId}/recording`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('[RECORDING] ✅ Recording uploaded successfully:', result);
            toast.success('Recording Saved', 'Call recording has been saved successfully');
          } else {
            const errorText = await response.text();
            console.error('[RECORDING] ❌ Upload failed:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
            });
            toast.error('Upload Failed', `Could not upload recording: ${response.statusText}`);
          }
        } catch (error: any) {
          console.error('[RECORDING] ❌ Upload error:', error);
          toast.error('Upload Error', error.message || 'Failed to upload recording');
        } finally {
          // Clear recording state
          set({ callRecorder: null, isRecording: false, recordingChunks: [] });
        }
      };
      
      // Start recording with 1 second chunks (collects data every second)
      recorder.start(1000);
      set({ callRecorder: recorder, isRecording: true });
      console.log('[RECORDING] ✅ Recording started successfully:', {
        state: recorder.state,
        mimeType: selectedMimeType,
        tracks: totalTracks,
      });
      toast.success('Recording Started', 'Call is being recorded');
      
    } catch (error: any) {
      console.error('[RECORDING] ❌ Failed to start recording:', {
        error: error.message,
        stack: error.stack,
      });
      toast.error('Recording Failed', error.message || 'Could not start recording');
      set({ callRecorder: null, isRecording: false });
    }
  },

  stopCallRecording: async () => {
    const { callRecorder } = get();
    
    if (!callRecorder) {
      console.log('[RECORDING] No active recording to stop');
      return;
    }
    
    if (callRecorder.state === 'inactive') {
      console.log('[RECORDING] Recording already stopped');
      set({ callRecorder: null, isRecording: false });
      return;
    }
    
    try {
      console.log('[RECORDING] ⏹️ Stopping call recording, current state:', callRecorder.state);
      
      // Stop the recorder (this will trigger onstop event)
      callRecorder.stop();
      
      // Wait for onstop to complete (it handles the upload)
      // Give it enough time to process chunks and upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('[RECORDING] ✅ Recording stopped');
    } catch (error: any) {
      console.error('[RECORDING] ❌ Error stopping recording:', error);
      toast.error('Recording Error', 'Failed to stop recording properly');
      set({ callRecorder: null, isRecording: false, recordingChunks: [] });
    }
  },

  clearCall: async () => {
    // Stop speech recognition first
    get().stopSpeechRecognition();
    // Stop recording
    await get().stopCallRecording();
    
    // Make sure to stop any remaining tracks
    const { localStream, peerConnection, peerConnections, socket } = get();
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    // Close all peer connections (for multi-participant calls)
    peerConnections.forEach((pc, socketId) => {
      try {
        pc.close();
        console.log('[CLEAR] Closed peer connection for:', socketId);
      } catch (error: any) {
        console.error('[CLEAR] Error closing peer connection:', error.message);
      }
    });
    
    // Close legacy peer connection (for backward compatibility)
    if (peerConnection) {
      try {
        peerConnection.close();
        console.log('[CLEAR] Closed legacy peer connection');
      } catch (error: any) {
        console.error('[CLEAR] Error closing legacy peer connection:', error.message);
      }
    }
    
    if (socket) {
      socket.disconnect();
    }
    
    set({
      socket: null,
      peerConnection: null,
      peerConnections: new Map(),
      localStream: null,
      remoteStream: null,
      remoteStreams: new Map(),
      speechRecognition: null,
      callRecorder: null,
      recordingChunks: [],
      roomId: null,
      callId: null,
      userName: null,
      isHost: false,
      callStatus: 'idle',
      participants: [],
      callStartTime: null,
      transcript: [],
      interimTranscript: '',
      aiNotes: null,
      aiAnalysisInterval: null,
      isMuted: false,
      isVideoOff: false,
      isRecording: false,
      isMinimized: false,
      error: null,
    });
  },

  minimizeCall: () => {
    const { callStatus } = get();
    if (callStatus === 'active' || callStatus === 'waiting') {
      set({ isMinimized: true });
    }
  },

  maximizeCall: () => {
    set({ isMinimized: false });
  },
}));

