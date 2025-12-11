import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiMessageSquare,
  FiCopy,
  FiCheck,
  FiUsers,
  FiLoader,
  FiX,
  FiSend,
  FiImage,
  FiPaperclip,
  FiClock,
  FiSmile,
  FiFileText,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiAtSign,
  FiThumbsUp,
  FiCheckCircle,
  FiDownload,
  FiShare2,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
} from 'react-icons/fi';
import { Sparkles, MessageSquare, FileText, StickyNote } from 'lucide-react';
import { FaRobot } from 'react-icons/fa';
import { useAuthStore } from '../store/auth';
import { useCallStore } from '../store/call';
import { toast } from '../components/Toast';
import PrivateChatOverlay from '../components/PrivateChatOverlay';
import VideoParticipant from '../components/VideoParticipant';
import AIParticipant from '../components/AIParticipant';
import AINotesSidebar from '../components/AINotesSidebar';
import CallControls from '../components/CallControls';
import { AIThinking } from '../components/LoadingSpinner';
import LoadingSpinner from '../components/LoadingSpinner';

// Use relative URL in production (when served from backend), absolute URL in development
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

const API_URL = getApiUrl();

type RightTab = 'dreamweaving' | 'chat' | 'transcript' | 'notes';

export default function CallRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const bottomNavRef = useRef<HTMLDivElement>(null);
  const [bottomNavHeight, setBottomNavHeight] = useState(0);
  
  const { user, accessToken } = useAuthStore();
  const callStore = useCallStore();
  const {
    localStream,
    remoteStream,
    callStatus,
    participants,
    transcript,
    interimTranscript,
    aiNotes,
    isMuted,
    isVideoOff,
    isRecording,
    callStartTime,
    speechRecognition,
    callId,
    joinRoom,
    leaveRoom,
    endCall,
    toggleMute,
    toggleVideo,
    initSocket,
    minimizeCall,
    maximizeCall,
  } = callStore;

  // Comprehensive notes state
  const [comprehensiveNotes, setComprehensiveNotes] = useState<any>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesGenerating, setNotesGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Calculate call duration from start time (persists across navigation)
  const [callDuration, setCallDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('dreamweaving');
  const [showAINotesSidebar, setShowAINotesSidebar] = useState(false);
  
  // Mobile responsive state
  const [showMobileControls, setShowMobileControls] = useState(true);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [controlsTimeout, setControlsTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  const [isLaptop, setIsLaptop] = useState(window.innerWidth >= 1024 && window.innerWidth < 1366);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Calculate bottom nav height for message bar positioning
  useEffect(() => {
    const updateNavHeight = () => {
      if (bottomNavRef.current && isMobile) {
        const height = bottomNavRef.current.offsetHeight;
        setBottomNavHeight(height);
      } else {
        setBottomNavHeight(0);
      }
    };

    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);
    
    // Use ResizeObserver for more accurate height tracking
    let resizeObserver: ResizeObserver | null = null;
    if (bottomNavRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateNavHeight();
      });
      resizeObserver.observe(bottomNavRef.current);
    }
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateNavHeight);
    };
  }, [isMobile]);
  
  // Dreamweaving tab state
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('dream');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Array<{
    _id: string;
    prompt: string;
    imageUrl: string;
    style: string;
    createdAt: string;
  }>>([]);
  
  // Auto image generation state
  const [showImageSuggestion, setShowImageSuggestion] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState('');
  const [detectedConcept, setDetectedConcept] = useState('');
  
  // Chat tab state
  const [chatMessages, setChatMessages] = useState<Array<{
    _id: string;
    senderId: { _id: string; name: string };
    content: string;
    attachments?: Array<{ type: string; url: string; name: string }>;
    reactions?: Array<{ emoji: string; userId: string }>;
    createdAt: string;
    isAI?: boolean;
    aiStreaming?: boolean;
    requestedBy?: string;
  }>>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [callConversationId, setCallConversationId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [, setAiStreamingMessageId] = useState<string | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  
  // Private message notification state
  const [unreadPrivateMessages, setUnreadPrivateMessages] = useState<Array<{
    conversationId: string;
    senderName: string;
    senderId: string;
    message: string;
    timestamp: Date;
  }>>([]);
  const [showPrivateMessageBanner, setShowPrivateMessageBanner] = useState(false);
  const [currentBannerMessage, setCurrentBannerMessage] = useState<{
    conversationId: string;
    senderName: string;
    senderId: string;
  } | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Private chat overlay state (for during-call private chat)
  const [showPrivateChatOverlay, setShowPrivateChatOverlay] = useState(false);
  const [privateChatData, setPrivateChatData] = useState<{
    conversationId: string;
    targetUserId: string;
    targetUserName: string;
    initialContext?: string;
  } | null>(null);
  
  // Track participant video/mute states for multi-participant view
  const [participantStreams, setParticipantStreams] = useState<Map<string, {
    stream: MediaStream | null;
    isVideoOff: boolean;
    isMuted: boolean;
    userName: string;
    userId?: string;
    avatar?: string;
  }>>(new Map());
  const [longPressMenu, setLongPressMenu] = useState<{
    messageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [participantNameMenu, setParticipantNameMenu] = useState<{
    userId: string;
    userName: string;
    message?: typeof chatMessages[0];
    x: number;
    y: number;
  } | null>(null);

  // Fetch historical transcript when callId is available
  const fetchHistoricalTranscript = async () => {
    if (!accessToken || !callId) return;
    
    try {
      console.log('[TRANSCRIPT] 📚 Fetching historical transcript for call:', callId);
      const response = await fetch(`${API_URL}/api/calls/${callId}/transcript`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.transcript && data.transcript.segments && data.transcript.segments.length > 0) {
          console.log('[TRANSCRIPT] 📚 Loading historical transcript:', data.transcript.segments.length, 'segments');
          
          // Normalize speaker names
          const authUser = useAuthStore.getState().user;
          const currentUserId = authUser?._id;
          
          const normalizedSegments = data.transcript.segments.map((seg: any) => {
            let displaySpeaker = seg.speaker;
            if (seg.speakerId && currentUserId) {
              const segmentUserId = seg.speakerId.toString();
              const currentUserIdStr = currentUserId.toString();
              if (segmentUserId === currentUserIdStr) {
                displaySpeaker = user?.name || 'You';
              }
            }
            return {
              speaker: displaySpeaker,
              speakerId: seg.speakerId,
              text: seg.text,
              timestamp: seg.timestamp,
            };
          });
          
          // Update transcript in store by setting it directly
          // We need to merge with existing transcript to avoid duplicates
          const currentTranscript = transcript;
          const existingTimestamps = new Set(currentTranscript.map(s => s.timestamp));
          const newSegments = normalizedSegments.filter((seg: any) => !existingTimestamps.has(seg.timestamp));
          
          if (newSegments.length > 0) {
            // Sort by timestamp and merge
            const merged = [...currentTranscript, ...newSegments].sort((a, b) => a.timestamp - b.timestamp);
            // Update transcript in store using Zustand's setState
            useCallStore.setState({ transcript: merged });
            console.log('[TRANSCRIPT] ✅ Historical transcript loaded:', newSegments.length, 'new segments, total:', merged.length);
          } else {
            console.log('[TRANSCRIPT] ℹ️ No new segments to load');
          }
        } else {
          console.log('[TRANSCRIPT] ℹ️ No historical transcript found');
        }
      } else {
        console.log('[TRANSCRIPT] ⚠️ Failed to fetch transcript:', response.status);
      }
    } catch (error) {
      console.error('[TRANSCRIPT] Error fetching historical transcript:', error);
    }
  };

  // Initialize and join room
  useEffect(() => {
    if (roomId && accessToken && user) {
      const currentRoomId = useCallStore.getState().roomId;
      
      // If call is already active in the same room, just maximize it (don't restart)
      if ((callStatus === 'active' || callStatus === 'waiting') && currentRoomId === roomId) {
        console.log('[CALLROOM] Call already active in same room, maximizing...');
        maximizeCall();
        return; // Don't rejoin or reinitialize
      }
      
      // If call is active but different room, or call is not active, initialize
      console.log('[CALLROOM] Initializing socket and joining room:', roomId);
      initSocket(accessToken, user.name);
      joinRoom(roomId, accessToken).catch((err) => {
        console.error('Failed to join room:', err);
        navigate('/home');
      });
    }

    return () => {
      // When navigating away, minimize the call instead of ending it
      // The call continues in the background via FloatingCallOverlay
      const currentCallStatus = useCallStore.getState().callStatus;
      if (currentCallStatus === 'active' || currentCallStatus === 'waiting') {
        console.log('[CALLROOM] Navigating away, minimizing call...');
        minimizeCall();
      }
    };
  }, [roomId, accessToken, user]);

  // Fetch historical transcript when callId becomes available
  useEffect(() => {
    if (callId && accessToken && callStatus === 'active') {
      fetchHistoricalTranscript();
    }
  }, [callId, accessToken, callStatus]);

  // Fetch comprehensive notes when call ends or notes tab is active
  const fetchComprehensiveNotes = async () => {
    if (!callId || !accessToken) return;
    
    setNotesLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/calls/${callId}/notes`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.notes) {
          setComprehensiveNotes(data.notes);
        }
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setNotesLoading(false);
    }
  };

  // Generate comprehensive notes
  const generateComprehensiveNotes = async () => {
    if (!callId || !accessToken) return;

    setNotesGenerating(true);
    try {
      const response = await fetch(`${API_URL}/api/calls/${callId}/generate-notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setComprehensiveNotes(data.notes);
        toast.success('Notes Generated', 'Comprehensive meeting notes have been generated');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Generation Failed', errorData.error || 'Failed to generate notes');
      }
    } catch (error: any) {
      console.error('Error generating notes:', error);
      toast.error('Error', 'Failed to generate notes. Please try again.');
    } finally {
      setNotesGenerating(false);
    }
  };

  // Auto-fetch notes when call ends or notes tab is active
  useEffect(() => {
    if (callId && accessToken && (callStatus === 'ended' || activeRightTab === 'notes')) {
      fetchComprehensiveNotes();
    }
  }, [callId, accessToken, callStatus, activeRightTab]);
  
  // Responsive breakpoint detection
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setIsLaptop(width >= 1024 && width < 1366);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep controls visible (sticky) - removed auto-hide
  useEffect(() => {
    setShowMobileControls(true);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current && transcript.length > 0) {
      // Auto-scroll transcript to latest entry
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // Auto-scroll chat messages to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesEndRef.current && chatMessages.length > 0) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Keyword detection for automatic image generation
  useEffect(() => {
    if (!callId || callStatus !== 'active') return;

    // Combine transcript and interim transcript for analysis
    const fullText = [...transcript, ...(interimTranscript ? [{ text: interimTranscript, speaker: user?.name || 'You' }] : [])]
      .map(seg => seg.text || '')
      .join(' ')
      .toLowerCase();

    // Visual concept keywords
    const visualKeywords = [
      'product design', 'logo', 'architecture', 'building', 'website design', 'ui design',
      'app design', 'brand', 'visual', 'image', 'picture', 'illustration', 'sketch',
      'drawing', 'mockup', 'prototype', 'concept art', 'graphic', 'banner', 'poster',
      'show me', 'visualize', 'imagine', 'create image', 'generate image', 'make an image'
    ];

    // Check for voice commands
    const voiceCommands = [
      'ai, show me', 'ai show me', 'show me', 'visualize', 'generate image of',
      'create image of', 'make an image of', 'draw', 'illustrate'
    ];

    // Check for voice commands first
    for (const cmd of voiceCommands) {
      if (fullText.includes(cmd)) {
        const afterCommand = fullText.split(cmd)[1]?.trim();
        if (afterCommand && afterCommand.length > 10) {
          setDetectedConcept(afterCommand.substring(0, 100));
          setSuggestedPrompt(afterCommand.substring(0, 200));
          setShowImageSuggestion(true);
          return;
        }
      }
    }

    // Check for visual keywords
    for (const keyword of visualKeywords) {
      if (fullText.includes(keyword)) {
        // Extract context around the keyword
        const keywordIndex = fullText.indexOf(keyword);
        const contextStart = Math.max(0, keywordIndex - 50);
        const contextEnd = Math.min(fullText.length, keywordIndex + keyword.length + 100);
        const context = fullText.substring(contextStart, contextEnd).trim();
        
        if (context.length > 20) {
          setDetectedConcept(keyword);
          setSuggestedPrompt(context);
          setShowImageSuggestion(true);
          return;
        }
      }
    }
  }, [transcript, interimTranscript, callId, callStatus, user?.name]);

  // Cleanup on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      leaveRoom();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [leaveRoom]);

  // Set up video streams with smooth transitions (prevent glitches)
  useEffect(() => {
    if (localVideoRef.current && localStream && !isVideoOff) {
      console.log('[VIDEO] Setting local video stream');
      const videoElement = localVideoRef.current;
      // Only update if stream changed to prevent glitches
      if (videoElement.srcObject !== localStream) {
        videoElement.srcObject = localStream;
      }
      videoElement.play().catch((error) => {
        console.error('[VIDEO] Error playing local video:', error);
      });
    } else if (localVideoRef.current && (isVideoOff || !localStream)) {
      // Smoothly clear video when turned off
      if (localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[VIDEO] Setting remote video stream');
      const videoElement = remoteVideoRef.current;
      // Only update if stream changed to prevent glitches
      if (videoElement.srcObject !== remoteStream) {
        videoElement.srcObject = remoteStream;
      }
      videoElement.play().catch((error) => {
        console.error('[VIDEO] Error playing remote video:', error);
      });
    } else if (remoteVideoRef.current && !remoteStream) {
      if (remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [remoteStream]);
  
  // Update participant streams when remote stream or participants change
  useEffect(() => {
    setParticipantStreams(prev => {
      const updated = new Map(prev);
      
      // Track local user's stream
      if (localStream && user) {
        updated.set('local', {
          stream: localStream,
          isVideoOff: isVideoOff,
          isMuted: isMuted,
          userName: user.name || 'You',
          userId: user._id,
        });
      }
      
      // Track remote participants' streams
      if (remoteStream && participants.length > 0) {
        // Assign remote stream to first participant (for 1-on-1 calls)
        // For multiple participants, each would need their own peer connection
        const firstParticipant = participants[0];
        // Only update if we don't already have a stream for this participant
        if (!updated.has(firstParticipant.socketId) || !updated.get(firstParticipant.socketId)?.stream) {
          updated.set(firstParticipant.socketId, {
            stream: remoteStream,
            isVideoOff: false, // Will be updated via socket events
            isMuted: false, // Will be updated via socket events
            userName: firstParticipant.userName,
            userId: firstParticipant.userId,
          });
        }
      }
      
      // Initialize participant entries for all participants (even without streams yet)
      participants.forEach(participant => {
        if (!updated.has(participant.socketId)) {
          updated.set(participant.socketId, {
            stream: null,
            isVideoOff: false,
            isMuted: false,
            userName: participant.userName,
            userId: participant.userId,
          });
        }
      });
      
      return updated;
    });
  }, [remoteStream, participants, localStream, user, isVideoOff, isMuted]);

  // Listen for participant video/audio state changes
  useEffect(() => {
    const socket = callStore.socket;
    if (!socket) return;

    const handleVideoChanged = (data: {
      socketId: string;
      userId: string;
      userName: string;
      isVideoOff: boolean;
    }) => {
      setParticipantStreams(prev => {
        const updated = new Map(prev);
        const existing = updated.get(data.socketId);
        if (existing) {
          updated.set(data.socketId, {
            ...existing,
            isVideoOff: data.isVideoOff,
          });
        } else {
          // Create entry if it doesn't exist
          updated.set(data.socketId, {
            stream: null,
            isVideoOff: data.isVideoOff,
            isMuted: false,
            userName: data.userName,
            userId: data.userId,
          });
        }
        return updated;
      });
    };

    const handleAudioChanged = (data: {
      socketId: string;
      userId: string;
      userName: string;
      isMuted: boolean;
    }) => {
      setParticipantStreams(prev => {
        const updated = new Map(prev);
        const existing = updated.get(data.socketId);
        if (existing) {
          updated.set(data.socketId, {
            ...existing,
            isMuted: data.isMuted,
          });
        } else {
          // Create entry if it doesn't exist
          updated.set(data.socketId, {
            stream: null,
            isVideoOff: false,
            isMuted: data.isMuted,
            userName: data.userName,
            userId: data.userId,
          });
        }
        return updated;
      });
    };

    socket.on('participant:video:changed', handleVideoChanged);
    socket.on('participant:audio:changed', handleAudioChanged);

    return () => {
      socket.off('participant:video:changed', handleVideoChanged);
      socket.off('participant:audio:changed', handleAudioChanged);
    };
  }, [callStore.socket]);

  // Call duration timer - calculates from callStartTime for continuous duration
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callStatus === 'active' && callStartTime) {
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
      // Reset when call is not active
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus, callStartTime]);

  // Fetch generated images for Dreamweaving tab
  useEffect(() => {
    if (callId && activeRightTab === 'dreamweaving') {
      fetchGeneratedImages();
    }
  }, [callId, activeRightTab]);

  // Listen for real-time image generation updates via Socket.IO
  useEffect(() => {
    const socket = callStore.socket;
    if (!socket) return;

    const handleImageGenerated = (data: { image: any; creator?: string; autoGenerated?: boolean; fromTranscript?: boolean }) => {
      console.log('[DREAMWEAVING] Image generated:', data);
      if (data.image) {
        setGeneratedImages(prev => {
          // Check if image already exists
          const exists = prev.some(img => img._id === data.image._id);
          if (exists) return prev;
          return [data.image, ...prev];
        });
        
        // Show notification for auto-generated images
        if (data.autoGenerated && data.fromTranscript) {
          toast.success('✨ Auto-Generated Image', 'AI detected a visual concept and created an image!');
        } else if (data.creator && data.creator !== user?.name) {
          toast.success('New Image', `${data.creator} generated an image!`);
        }
      }
    };

    const handleImageGenerating = (data: { prompt?: string; requestedBy?: string; autoGenerated?: boolean }) => {
      if (data.autoGenerated) {
        console.log('[DREAMWEAVING] Auto-generating image from transcript...');
        setIsGeneratingImage(true);
      }
    };

    const handleImageGenerationError = (data: { error?: string; prompt?: string }) => {
      console.error('[DREAMWEAVING] Image generation error:', data);
      setIsGeneratingImage(false);
      if (data.error) {
        toast.error('Image Generation Failed', data.error);
      }
    };

    socket.on('image:generated', handleImageGenerated);
    socket.on('image:generating', handleImageGenerating);
    socket.on('image:generation:error', handleImageGenerationError);

    return () => {
      socket.off('image:generated', handleImageGenerated);
      socket.off('image:generating', handleImageGenerating);
      socket.off('image:generation:error', handleImageGenerationError);
    };
  }, [callStore.socket, user?.name]);

  // Create/get conversation for chat during call
  useEffect(() => {
    if (callId && activeRightTab === 'chat' && accessToken) {
      createOrGetCallConversation();
    }
  }, [callId, activeRightTab, accessToken]);


    // Listen for chat messages via Socket.IO
    useEffect(() => {
      const socket = callStore.socket;
      if (!socket || !callConversationId) return;

      socket.emit('conversation:join', callConversationId);

      const handleNewMessage = (data: { message: any }) => {
        console.log('[CHAT] 📨 New message received:', data.message);
        console.log('[CHAT] Message conversationId:', data.message.conversationId);
        console.log('[CHAT] Current conversationId:', callConversationId);
        
        // Check if message belongs to current conversation
        const messageConvId = data.message.conversationId?.toString() || data.message.conversationId;
        const currentConvId = callConversationId?.toString() || callConversationId;
        
        if (messageConvId === currentConvId) {
          console.log('[CHAT] ✅ Message matches current conversation, adding to chat');
          setChatMessages(prev => {
            // Check for duplicates by ID
            const existsById = prev.some(m => m._id === data.message._id);
            if (existsById) {
              console.log('[CHAT] ⚠️ Duplicate message by ID, ignoring');
              return prev;
            }
            
            // Check for duplicates by content + sender (to catch temp messages)
            const existsByContent = prev.some(m => 
              m.content === data.message.content &&
              m.senderId._id === data.message.senderId._id &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(data.message.createdAt).getTime()) < 5000
            );
            if (existsByContent) {
              console.log('[CHAT] ⚠️ Duplicate message by content, replacing temp with real');
              // Replace temp message with real one
              return prev.map(m => {
                if (m.content === data.message.content &&
                    m.senderId._id === data.message.senderId._id &&
                    (m._id?.startsWith('temp-') || !m._id)) {
                  return {
                    _id: data.message._id,
                    senderId: data.message.senderId,
                    content: data.message.content,
                    attachments: data.message.attachments,
                    reactions: data.message.reactions,
                    createdAt: data.message.createdAt,
                  };
                }
                return m;
              }).filter((m, index, self) => 
                // Remove any remaining duplicates
                index === self.findIndex(msg => msg._id === m._id)
              );
            }
            
            console.log('[CHAT] ✅ Adding new message to chat');
            return [...prev, {
              _id: data.message._id,
              senderId: data.message.senderId,
              content: data.message.content,
              attachments: data.message.attachments,
              reactions: data.message.reactions,
              createdAt: data.message.createdAt,
            }];
          });
        } else {
          console.log('[CHAT] ⚠️ Message conversationId mismatch, ignoring');
        }
      };

      // Listen for reaction updates
      const handleReactionUpdate = (data: { messageId: string; reactions: Array<{ emoji: string; userId: string }> }) => {
        console.log('[CHAT] 🎭 Reaction update:', data);
        setChatMessages(prev => {
          return prev.map(msg => {
            if (msg._id === data.messageId) {
              return { ...msg, reactions: data.reactions };
            }
            return msg;
          });
        });
      };

      socket.on('message:new', handleNewMessage);
      socket.on('message:reaction', handleReactionUpdate);

      return () => {
        socket.off('message:new', handleNewMessage);
        socket.off('message:reaction', handleReactionUpdate);
        socket.emit('conversation:leave', callConversationId);
      };
    }, [callStore.socket, callConversationId]);

  // Listen for private messages (direct conversations) during call
  useEffect(() => {
    const socket = callStore.socket;
    if (!socket || !user || !accessToken) return;

    const handlePrivateMessage = async (data: { message: any }) => {
      // Only handle messages that are NOT from the call conversation
      const messageConvId = data.message.conversationId?.toString() || data.message.conversationId;
      const currentConvId = callConversationId?.toString() || callConversationId;
      
      // Skip if it's a call chat message
      if (messageConvId === currentConvId) {
        return;
      }

      // Skip if message is from current user
      if (data.message.senderId._id === user._id) {
        return;
      }

      // Check if it's a direct conversation (private message)
      try {
        const response = await fetch(`${API_URL}/api/messages/conversations/${messageConvId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (response.ok) {
          const convData = await response.json();
          // Only show notification for direct conversations
          if (convData.conversation?.type === 'direct') {
            const senderName = data.message.senderId?.name || 'Someone';
            const messageContent = data.message.content || '📎 Attachment';
            
            console.log('[PRIVATE MSG] 📬 New private message during call from:', senderName);
            
            // Add to unread messages
            setUnreadPrivateMessages(prev => {
              // Check if we already have a message from this conversation
              const existingIndex = prev.findIndex(m => m.conversationId === messageConvId);
              if (existingIndex >= 0) {
                // Update existing
                const updated = [...prev];
                updated[existingIndex] = {
                  conversationId: messageConvId,
                  senderName,
                  senderId: data.message.senderId._id,
                  message: messageContent,
                  timestamp: new Date(),
                };
                return updated;
              }
              // Add new
              return [...prev, {
                conversationId: messageConvId,
                senderName,
                senderId: data.message.senderId._id,
                message: messageContent,
                timestamp: new Date(),
              }];
            });

            // Show toast notification
            toast.info('New Private Message', `New private message from ${senderName}`);
            
            // Show banner notification immediately and prominently
            setCurrentBannerMessage({
              conversationId: messageConvId,
              senderName,
              senderId: data.message.senderId._id,
            });
            setShowPrivateMessageBanner(true);

            // Play a subtle notification sound (optional - browser permission required)
            // You can add a sound file if desired
            
            // Auto-dismiss after 8 seconds (longer for better visibility)
            if (bannerTimeoutRef.current) {
              clearTimeout(bannerTimeoutRef.current);
            }
            bannerTimeoutRef.current = setTimeout(() => {
              setShowPrivateMessageBanner(false);
            }, 8000);
          }
        }
      } catch (error) {
        console.error('[PRIVATE MSG] Error checking conversation type:', error);
      }
    };

    socket.on('message:new', handlePrivateMessage);

    return () => {
      socket.off('message:new', handlePrivateMessage);
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, [callStore.socket, user, callConversationId, accessToken]);

  const fetchGeneratedImages = async () => {
    if (!accessToken || !callId) return;
    try {
      const response = await fetch(`${API_URL}/api/images/call/${callId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setGeneratedImages(data.images || []);
      }
    } catch (error) {
      console.error('Fetch images error:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = async () => {
    if (roomId) {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEndCall = () => {
    // User is leaving - endCall() will handle cleanup and emit user:left
    // Navigation will happen when call:ended is received (if last participant)
    endCall();
    // Navigate immediately since this user is leaving
    navigate('/home');
  };

  // Handle screen share
  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen share
        if (localStream) {
          const screenTrack = localStream.getVideoTracks().find(track => track.label.includes('screen'));
          if (screenTrack) {
            screenTrack.stop();
          }
        }
        setIsScreenSharing(false);
        toast.success('Screen Share', 'Screen sharing stopped');
      } else {
        // Start screen share
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        
        // Replace video track in local stream
        if (localStream) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = callStore.peerConnection?.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
            localStream.removeTrack(localStream.getVideoTracks()[0]);
            localStream.addTrack(videoTrack);
          }
        }
        
        setIsScreenSharing(true);
        toast.success('Screen Share', 'Screen sharing started');
        
        // Stop screen share when user clicks stop in browser
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          handleScreenShare(); // Restore camera
        };
      }
    } catch (error: any) {
      console.error('Screen share error:', error);
      toast.error('Screen Share', error.message || 'Failed to share screen');
    }
  };

  // Handle add participant
  const handleAddParticipant = () => {
    // Copy room link to clipboard
    const roomLink = `${window.location.origin}/call/${roomId}`;
    navigator.clipboard.writeText(roomLink).then(() => {
      toast.success('Link Copied', 'Room link copied to clipboard');
    }).catch(() => {
      toast.error('Error', 'Failed to copy link');
    });
  };

  // Handle settings
  const handleSettings = () => {
    // Open settings modal or navigate to settings
    toast.info('Settings', 'Settings panel coming soon');
  };

  // Generate image from transcript automatically
  const generateImageFromTranscript = async (prompt?: string) => {
    if (!accessToken || !callId) {
      toast.error('Error', 'Call ID is required');
      return;
    }

    setIsGeneratingImage(true);
    setShowImageSuggestion(false);
    
    try {
      const response = await fetch(`${API_URL}/api/images/generate-from-call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callId,
          style: imageStyle,
          prompt: prompt || suggestedPrompt, // Use provided prompt or suggested one
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image from transcript');
      }

      const data = await response.json();
      if (data.image) {
        setGeneratedImages(prev => [data.image, ...prev]);
        toast.success('Image Generated', 'Generated from call conversation!');
      }
    } catch (error: any) {
      console.error('Auto image generation error:', error);
      toast.error('Error', error.message || 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const generateImage = async (customPrompt?: string) => {
    const promptToUse = customPrompt || imagePrompt;
    if (!accessToken || !promptToUse.trim()) {
      toast.error('Error', 'Please enter a description');
      return;
    }
    
    setIsGeneratingImage(true);
    try {
      const response = await fetch(`${API_URL}/api/images/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptToUse,
          style: imageStyle,
          callId: callId || undefined,
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.image) {
        setGeneratedImages(prev => [data.image, ...prev]);
        setImagePrompt('');
        toast.success('Image Generated', 'Dreamweaving complete!');
      } else {
        throw new Error('No image data received');
      }
    } catch (error: any) {
      console.error('Image generation error:', error);
      
      // Extract error message properly
      let errorMessage = 'Failed to generate image';
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.error) {
        errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }
      
      toast.error('Error', errorMessage || 'Failed to generate image. Please check your OpenAI API key.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const createOrGetCallConversation = async () => {
    if (!accessToken || !callId) return;

    try {
      const response = await fetch(`${API_URL}/api/messages/conversations/from-call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCallConversationId(data.conversation._id);
        // Fetch existing messages
        fetchChatMessages(data.conversation._id);
      }
    } catch (error) {
      console.error('Create conversation error:', error);
    }
  };

  const fetchChatMessages = async (conversationId: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/messages/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    }
  };

  const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const uploadChatFiles = async (): Promise<string[]> => {
    if (!accessToken || selectedFiles.length === 0) return [];
    
    const uploadedUrls: string[] = [];
    
    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_URL}/api/messages/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          uploadedUrls.push(`${API_URL}${data.url}`);
        }
      } catch (error) {
        console.error('File upload error:', error);
      }
    }
    
    return uploadedUrls;
  };

  const handleChatReaction = async (messageId: string, emoji: string) => {
    if (!accessToken || !callConversationId) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${callConversationId}/messages/${messageId}/reaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji }),
        }
      );
      
      if (response.ok) {
        console.log('[CHAT] ✅ Reaction sent');
      }
    } catch (error) {
      console.error('Reaction error:', error);
    }
  };

  const createPrivateBreakoutFromCall = async (
    targetUserId: string, 
    targetUserName: string,
    message?: typeof chatMessages[0], 
    context?: string, 
    openOverlay: boolean = false,
    openInNewPage: boolean = true
  ) => {
    if (!accessToken) {
      toast.error('Error', 'Please login to use private messages');
      return;
    }

    // If we have callConversationId, use breakout endpoint
    // Otherwise, create direct private conversation
    try {
      let response;
      const messageContext = message 
        ? `Re: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`
        : context || '';

      if (callConversationId && message) {
        // Use breakout from call conversation
        response = await fetch(
          `${API_URL}/api/messages/conversations/${callConversationId}/breakout`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              targetUserId: targetUserId,
              originalMessageId: message._id,
              context: messageContext,
              originalConversationId: callConversationId,
              groupName: 'Call Chat',
            }),
          }
        );
      } else {
        // Create direct private conversation
        response = await fetch(
          `${API_URL}/api/messages/conversations/private`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              targetUserId: targetUserId,
              context: messageContext,
              originalMessageId: message?._id,
              originalConversationId: callConversationId,
              groupName: 'Call Chat',
            }),
          }
        );
      }

      if (response.ok) {
        const data = await response.json();
        console.log('[PRIVATE] Conversation created/retrieved:', data.conversation._id);
        
        // Minimize call to background (FloatingCallOverlay will handle it)
        minimizeCall();
        
        if (openOverlay) {
          // Open overlay during call (WhatsApp-style)
          setPrivateChatData({
            conversationId: data.conversation._id,
            targetUserId: targetUserId,
            targetUserName: targetUserName,
            initialContext: messageContext,
          });
          setShowPrivateChatOverlay(true);
          setParticipantNameMenu(null); // Close menu
        } else if (openInNewPage) {
          // Navigate directly to dedicated Friend Chat page (WhatsApp-style)
          // This opens immediately with the selected person, ready to type
        navigate(`/friends/chat/${data.conversation._id}`, {
            state: { 
              returnPath: `/call/${roomId}`,
              fromCall: true,
              callRoomId: roomId,
              initialMessage: messageContext, // Pre-populate input if context exists
            },
          });
          toast.success('Private Chat', `Opened private conversation with ${targetUserName}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[PRIVATE] Failed to create conversation:', errorData);
        toast.error('Error', errorData.error || 'Failed to create private conversation');
      }
    } catch (error) {
      console.error('Create breakout error:', error);
      toast.error('Error', 'Failed to create private conversation');
    }
  };

  const handleParticipantNameClick = (message: typeof chatMessages[0], e: React.MouseEvent | React.TouchEvent) => {
    if (message.senderId._id === user?._id) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Show popup menu
    setParticipantNameMenu({
      userId: message.senderId._id,
      userName: message.senderId.name,
      message: message,
      x: clientX,
      y: clientY,
    });
  };
  
  const handleReplyInPrivate = async () => {
    if (!participantNameMenu) return;
    
    setParticipantNameMenu(null);
    await createPrivateBreakoutFromCall(
      participantNameMenu.userId,
      participantNameMenu.userName,
      participantNameMenu.message,
      undefined,
      false, // Don't open overlay
      true   // Open in new page
    );
  };


  const handleChatMouseDown = (message: typeof chatMessages[0], e: React.MouseEvent | React.TouchEvent) => {
    if (message.senderId._id === user?._id) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const timer = setTimeout(() => {
      handleChatMessageLongPress(message, clientX, clientY);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleChatMessageLongPress = (message: typeof chatMessages[0], x: number, y: number) => {
    if (message.senderId._id === user?._id) return;
    // Show long-press menu
    setLongPressMenu({
      messageId: message._id,
      x,
      y,
    });
  };

  const handleChatMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };
  
  const handleReplyPrivately = async (message: typeof chatMessages[0]) => {
    setLongPressMenu(null);
    await createPrivateBreakoutFromCall(
      message.senderId._id,
      message.senderId.name,
      message,
      undefined,
      false,  // Don't open overlay
      true    // Open in new page (direct navigation to chat)
    );
  };

  // Helper to render tab content
  const renderTabContent = (tab: RightTab) => {
    switch (tab) {
      case 'dreamweaving':
        return (
          <div className="h-full flex flex-col">
            {/* Auto Image Generation Suggestion */}
            {showImageSuggestion && suggestedPrompt && (
              <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Sparkles size={16} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      <span className="text-purple-300 font-semibold text-sm">AI Suggestion</span>
                    </div>
                    <p className="text-white text-xs mb-2">
                      Detected visual concept: <span className="text-purple-300 font-medium">"{detectedConcept}"</span>
                    </p>
                    <p className="text-dark-300 text-xs mb-2 italic">"{suggestedPrompt.substring(0, 100)}..."</p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => generateImageFromTranscript()}
                        disabled={isGeneratingImage}
                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition flex items-center space-x-1.5"
                      >
                        {isGeneratingImage ? (
                          <FiLoader className="w-3 h-3 animate-spin" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        ) : (
                          <Sparkles size={12} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        )}
                        <span>Generate Image</span>
                      </button>
                      <button
                        onClick={() => {
                          setImagePrompt(suggestedPrompt);
                          setShowImageSuggestion(false);
                        }}
                        className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-white text-xs rounded-lg transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setShowImageSuggestion(false)}
                        className="px-3 py-1.5 text-dark-400 hover:text-white text-xs transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="p-6 border-b border-dark-800/50">
              <div className="space-y-4">
                {/* Quick Generate from Call Button */}
                {callId && transcript.length > 0 && (
                  <button
                    onClick={() => generateImageFromTranscript()}
                    disabled={isGeneratingImage}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 rounded-lg text-blue-300 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isGeneratingImage ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Generating from call...</span>
                      </>) : (
                      <>
                        <Sparkles size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Generate from Call Conversation</span>
                      </>
                    )}
                  </button>
                )}
                <div>
                  <label className="text-sm text-dark-300 mb-2 block font-medium">Describe your vision</label>
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Describe what you want to see..."
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-purple-500/50 glass-card resize-none"
                    rows={5}
                    style={{ minHeight: '120px' }}
                  />
                </div>
                <div>
                  <label className="text-sm text-dark-300 mb-2 block font-medium">Style</label>
                  <select
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50 glass-card"
                    style={{ padding: '12px' }}
                  >
                    <option value="realistic">Realistic</option>
                    <option value="artistic">Artistic</option>
                    <option value="sketch">Sketch</option>
                    <option value="dream">Dream</option>
                    <option value="abstract">Abstract</option>
                  </select>
                </div>
                <button
                  onClick={() => generateImage()}
                  disabled={!imagePrompt.trim() || isGeneratingImage}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  style={{ height: '48px' }}
                >
                  {isGeneratingImage ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      <span>Generating...</span>
                    </>) : (
                    <>
                        <Sparkles size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      <span>Generate Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: '300px' }}>
              {generatedImages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center" style={{ minHeight: '300px' }}>
                  <div>
                    <Sparkles size={48} className="text-dark-700 mx-auto mb-2" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <p className="text-dark-500 text-sm">Generated images will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {generatedImages.map((img) => (
                    <div
                      key={img._id}
                      className="glass-card-hover rounded-lg overflow-hidden animate-scale-in group"
                    >
                      <div 
                        className="relative cursor-pointer"
                      onClick={() => window.open(img.imageUrl, '_blank')}
                    >
                      <img
                        src={img.imageUrl}
                        alt={img.prompt}
                        className="w-full h-32 object-cover"
                      />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-white text-xs font-medium">Click to view</span>
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-dark-300 text-xs mb-2 line-clamp-2" title={img.prompt}>
                          "{img.prompt}"
                        </p>
                        <div className="flex items-center justify-between text-xs text-dark-500 mb-2">
                          <span>{new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{img.style}</span>
                        </div>
                        <div className="flex items-center space-x-2 pt-2 border-t border-dark-800/50">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Download image
                              const link = document.createElement('a');
                              link.href = img.imageUrl;
                              link.download = `image-${img._id}.png`;
                              link.click();
                              toast.success('Downloaded', 'Image saved to downloads');
                            }}
                            className="flex-1 px-2 py-1 bg-dark-700 hover:bg-dark-600 text-white text-xs rounded transition flex items-center justify-center space-x-1"
                            title="Download"
                          >
                            <FiDownload size={12} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateImage(img.prompt).catch(console.error);
                            }}
                            disabled={isGeneratingImage}
                            className="flex-1 px-2 py-1 bg-dark-700 hover:bg-dark-600 text-white text-xs rounded transition flex items-center justify-center space-x-1 disabled:opacity-50"
                            title="Regenerate"
                          >
                            <FiRefreshCw size={12} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                            <span>Regenerate</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'chat':
        return (
          <div className={`h-full flex flex-col ${isMobile ? 'mobile-overlay' : ''}`}>
            {isMobile && (
              <div className="px-4 py-3 border-b border-dark-800/50 flex items-center justify-between glass-card sticky top-0 z-10 bg-dark-900/95 backdrop-blur-xl safe-area-top">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 bg-primary-500/20 rounded-lg flex items-center justify-center">
                    <FiMessageSquare size={16} className="text-primary-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  </div>
                  <span className="text-white font-semibold text-sm">Chat</span>
                </div>
                <button
                  onClick={() => setShowBottomSheet(false)}
                  className="p-2 hover:bg-dark-800/50 rounded-lg transition"
                >
                  <FiX size={20} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                </button>
              </div>
            )}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{
                paddingBottom: isMobile && bottomNavHeight > 0 
                  ? `calc(${bottomNavHeight}px + env(safe-area-inset-bottom, 0px))` 
                  : undefined
              }}
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <FiMessageSquare size={48} className="text-dark-700 mx-auto mb-2" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <p className="text-dark-500 text-sm">Chat messages will appear here</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  // AI Message Component
                  if (msg.isAI) {
                    return (
                      <div key={msg._id} className="flex justify-start animate-fade-in mb-3">
                        <div className="max-w-[85%] rounded-xl px-4 py-3 bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-cyan-500/20 border border-purple-500/30 glass-card hover:from-purple-500/25 hover:via-blue-500/25 hover:to-cyan-500/25 transition-all group relative">
                          {/* AI Avatar */}
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                              <FaRobot size={20} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Message Header */}
                              <div className="flex items-center space-x-2 mb-1.5">
                                <span className="text-purple-300 font-semibold text-sm">AceTime AI</span>
                                <span className="px-2 py-0.5 bg-purple-500/30 text-purple-200 text-xs rounded-full border border-purple-400/50">
                                  AI Response
                                </span>
                                {msg.requestedBy && msg.requestedBy !== 'You' && (
                                  <span className="text-dark-400 text-xs">for @{msg.requestedBy}</span>
                                )}
                              </div>
                              {/* Message Text */}
                              <div className="text-white text-sm leading-relaxed">
                                {msg.aiStreaming && !msg.content ? (
                                  <span className="flex items-center space-x-2 text-purple-300">
                                    <FiLoader className="w-4 h-4 animate-spin text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                                    <span>AI is thinking</span>
                                    <span className="flex space-x-1">
                                      <span className="animate-pulse">.</span>
                                      <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>.</span>
                                      <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>.</span>
                                    </span>
                                  </span>
                                ) : (
                                  <>
                                    <span>{msg.content}</span>
                                    {msg.aiStreaming && (
                                      <span className="inline-block w-2 h-4 bg-purple-400 ml-1 animate-pulse" />
                                    )}
                                  </>
                                )}
                              </div>
                              {/* Message Actions */}
                              <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-purple-500/20">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.content);
                                    toast.success('Copied', 'AI response copied to clipboard');
                                  }}
                                  className="flex items-center space-x-1 px-2 py-1 text-xs text-purple-300 hover:text-purple-200 hover:bg-purple-500/20 rounded transition"
                                  title="Copy"
                                >
                                  <FiCopy size={12} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                                  <span>Copy</span>
                                </button>
                                <button
                                  className="flex items-center space-x-1 px-2 py-1 text-xs text-purple-300 hover:text-purple-200 hover:bg-purple-500/20 rounded transition"
                                  title="Helpful"
                                >
                                  <FiThumbsUp size={12} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                                  <span>Helpful</span>
                                </button>
                              </div>
                              {/* Timestamp */}
                              <div className="text-dark-400 text-xs mt-1">
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Regular Message Component
                  return (
                  <div
                    key={msg._id}
                    className={`flex ${msg.senderId._id === user?._id ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    onMouseDown={(e) => {
                      // Only handle long-press if not clicking on name
                      if ((e.target as HTMLElement).closest('.user-name-clickable')) {
                        return;
                      }
                      handleChatMouseDown(msg, e);
                    }}
                    onMouseUp={handleChatMouseUp}
                    onMouseLeave={handleChatMouseUp}
                    onTouchStart={(e) => {
                      // Only handle long-press if not touching name
                      if ((e.target as HTMLElement).closest('.user-name-clickable')) {
                        return;
                      }
                      e.preventDefault();
                      handleChatMouseDown(msg, e);
                    }}
                    onTouchEnd={handleChatMouseUp}
                    onTouchCancel={handleChatMouseUp}
                    style={{ cursor: msg.senderId._id !== user?._id ? 'pointer' : 'default' }}
                  >
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      msg.senderId._id === user?._id
                        ? 'bg-primary-500 glass-card'
                        : 'bg-dark-800/50 glass-card hover:bg-dark-700/50'
                    } ${msg.senderId._id !== user?._id ? 'active:scale-95' : ''}`}
                    title={msg.senderId._id !== user?._id ? 'Press and hold to reply privately' : ''}
                    >
                      {msg.senderId._id !== user?._id && (
                        <div 
                          className="user-name-clickable text-primary-400 text-xs mb-1 cursor-pointer hover:underline relative group"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleParticipantNameClick(msg, e);
                          }}
                          onTouchEnd={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleParticipantNameClick(msg, e);
                          }}
                          title="Tap to reply in private"
                        >
                          {msg.senderId.name}
                        </div>
                      )}
                      <p className="text-white text-sm">{msg.content}</p>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.attachments.map((att, idx) => (
                            <div key={idx}>
                              {att.type === 'image' ? (
                                <img 
                                  src={att.url} 
                                  alt={att.name}
                                  className="max-w-full rounded-lg"
                                  style={{ maxHeight: '200px' }}
                                />
                              ) : (
                                <a 
                                  href={att.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
                                >
                                  <FiPaperclip size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                                  <span className="text-sm">{att.name}</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(
                            msg.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                              if (!acc[r.emoji]) acc[r.emoji] = [];
                              acc[r.emoji].push(r.userId);
                              return acc;
                            }, {})
                          ).map(([emoji, userIds]) => (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleChatReaction(msg._id, emoji);
                              }}
                              className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 transition ${
                                userIds.includes(user?._id || '')
                                  ? 'bg-primary-500/30 text-primary-300'
                                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{userIds.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowReactionPicker(showReactionPicker === msg._id ? null : msg._id);
                          }}
                          className="text-dark-400 hover:text-dark-300 transition"
                          title="Add reaction"
                        >
                          <FiSmile size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        </button>
                        {showReactionPicker === msg._id && (
                          <div className="flex items-center space-x-1 bg-dark-800 rounded-lg p-2 border border-dark-700">
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleChatReaction(msg._id, emoji);
                                  setShowReactionPicker(null);
                                }}
                                className="text-xl hover:scale-125 transition"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-dark-500 text-xs mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
                })
              )}
              <div ref={chatMessagesEndRef} />
            </div>
            {/* Quick AI Actions */}
            {activeRightTab === 'chat' && (callStatus === 'active' || callStatus === 'waiting') && (
              <div className="px-4 py-2 border-t border-dark-800/50 bg-dark-900/50 backdrop-blur-sm">
                <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-2">
                  <span className="text-xs text-dark-400 font-medium flex-shrink-0">Quick AI:</span>
                  <button
                    onClick={() => setNewChatMessage('/ai summarize this call')}
                    className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs rounded-lg border border-purple-500/30 transition flex items-center space-x-1.5 flex-shrink-0"
                  >
                    <FiFileText size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <span>Summarize</span>
                  </button>
                  <button
                    onClick={() => {
                      setNewChatMessage('/ai what are the action items?');
                      setTimeout(() => sendChatMessage(), 100);
                    }}
                    className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs rounded-lg border border-green-500/30 transition flex items-center space-x-1.5 flex-shrink-0"
                  >
                    <FiCheckCircle size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <span>Action Items</span>
                  </button>
                  <button
                    onClick={() => {
                      setNewChatMessage('/ai generate meeting notes');
                      setTimeout(() => sendChatMessage(), 100);
                    }}
                    className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded-lg border border-blue-500/30 transition flex items-center space-x-1.5 flex-shrink-0"
                  >
                    <FiFileText size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <span>Notes</span>
                  </button>
                  <button
                    onClick={() => {
                      setNewChatMessage('/ai key decisions made');
                      setTimeout(() => sendChatMessage(), 100);
                    }}
                    className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs rounded-lg border border-yellow-500/30 transition flex items-center space-x-1.5 flex-shrink-0"
                  >
                    <FiCheckCircle size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <span>Decisions</span>
                  </button>
                </div>
              </div>
            )}
            {/* Chat Input - Only show in Chat tab AND when call is active/waiting */}
            {activeRightTab === 'chat' && (callStatus === 'active' || callStatus === 'waiting') && (
              <div 
                className="p-4 border-t border-dark-800/50 bg-dark-900/95 backdrop-blur-sm"
                style={
                  isMobile && bottomNavHeight > 0
                    ? {
                        position: 'sticky',
                        bottom: `calc(${bottomNavHeight}px + env(safe-area-inset-bottom, 0px))`,
                        zIndex: 10,
                      }
                    : undefined
                }
              >
              {selectedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-dark-800 rounded-lg p-2">
                      {file.type.startsWith('image/') ? (
                        <FiImage size={16} className="text-primary-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      ) : (
                        <FiPaperclip size={16} className="text-primary-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      )}
                      <span className="text-sm text-dark-300 truncate max-w-[150px]">{file.name}</span>
                      <button
                        onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                        className="text-dark-500 hover:text-dark-300"
                      >
                        <FiX size={12} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  ref={chatFileInputRef}
                  type="file"
                  multiple
                  onChange={handleChatFileSelect}
                  className="hidden"
                  accept="image/*,audio/*,.pdf,.doc,.docx"
                />
                <button
                  onClick={() => chatFileInputRef.current?.click()}
                  className="p-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition"
                  title="Attach file"
                >
                  <FiPaperclip size={16} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                </button>
                <input
                  type="text"
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !uploading && sendChatMessage()}
                    placeholder="Type a message or /ai [command]..."
                  className="flex-1 px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-blue-500/50 glass-card"
                  disabled={uploading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={uploading || (!newChatMessage.trim() && selectedFiles.length === 0)}
                  className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiSend size={16} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  )}
                </button>
              </div>
            </div>
            )}
          </div>
        );
      case 'transcript':
        // Only show transcript during/after calls
        if (callStatus !== 'active' && callStatus !== 'ended' && callStatus !== 'waiting') {
        return (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <FiMessageSquare size={48} className="text-dark-700 mx-auto mb-2" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <p className="text-dark-500 text-sm">Transcript will appear here once the call starts</p>
              </div>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-800/50 flex items-center justify-between glass-card sticky top-0 z-10 bg-dark-900/95 backdrop-blur-xl">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <FiMessageSquare size={16} className="text-primary-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                </div>
                <span className="text-white font-semibold text-sm md:text-base">Live Transcript</span>
              </div>
              <div className="flex items-center space-x-2">
                {speechRecognition ? (
                  <div className="flex items-center space-x-1.5 px-2 py-1 bg-green-500/20 rounded-lg border border-green-500/30">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-green-400 text-xs font-medium">Listening</span>
                  </div>
                ) : isMuted ? (
                  <div className="flex items-center space-x-1.5 px-2 py-1 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                    <span className="text-yellow-400 text-xs font-medium">Muted</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 px-2 py-1 bg-red-500/20 rounded-lg border border-red-500/30">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    <span className="text-red-400 text-xs font-medium">Not Listening</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={transcriptRef}>
              {transcript.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <LoadingSpinner size="lg" text="Waiting for transcript..." />
                  </div>
                </div>
              ) : (
                <>
                  {transcript.map((segment, index) => {
                    const isCurrentUser = segment.speaker === user?.name || segment.speaker === 'You';
                    return (
                      <div 
                        key={index}
                        className="animate-fade-in glass-card-hover rounded-lg p-3 md:p-4 border-l-4"
                        style={{ borderLeftColor: isCurrentUser ? 'rgba(99, 102, 241, 0.6)' : 'rgba(59, 130, 246, 0.6)' }}
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCurrentUser ? 'bg-primary-500/30' : 'bg-blue-500/30'
                          }`}>
                            <span className={`font-semibold text-xs md:text-sm ${
                              isCurrentUser ? 'text-primary-400' : 'text-blue-400'
                            }`}>
                              {segment.speaker.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className={`font-semibold text-sm md:text-base ${
                            isCurrentUser ? 'text-primary-400' : 'text-blue-400'
                          }`}>
                            {segment.speaker}
                          </span>
                          <span className="text-dark-400 text-xs md:text-sm ml-auto flex-shrink-0">
                            {new Date(segment.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-white text-sm md:text-base leading-relaxed pl-9 md:pl-10">{segment.text}</p>
                      </div>
                    );
                  })}
                  {interimTranscript && (
                    <div className="rounded-lg p-3 md:p-4 opacity-60 border-l-4 border-primary-500/30">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 bg-primary-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-400/60 font-semibold text-xs md:text-sm">
                            {user?.name?.charAt(0).toUpperCase() || 'Y'}
                          </span>
                        </div>
                        <span className="text-primary-400/60 font-semibold text-sm md:text-base">
                          {user?.name || 'You'}
                        </span>
                        <span className="text-dark-500 text-xs md:text-sm italic ml-auto flex-shrink-0">(speaking...)</span>
                      </div>
                      <p className="text-white/60 text-sm md:text-base leading-relaxed pl-9 md:pl-10 italic">{interimTranscript}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* AI Insights Section - Show below transcript */}
            {aiNotes && (callStatus === 'active' || callStatus === 'ended') && (
              <div className="border-t border-dark-800/50 bg-dark-900/50 backdrop-blur-sm">
                <div className="px-4 py-3 border-b border-dark-800/50 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
              <Sparkles size={16} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <span className="text-white font-semibold text-sm">AI Insights</span>
                    {aiNotes.lastUpdated && (
                      <span className="text-dark-400 text-xs">
                        Updated {new Date(aiNotes.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
          </div>
            </div>
                <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                {aiNotes.summary && (
                  <div className="glass-card rounded-lg p-3 border border-purple-500/20">
                    <h4 className="text-xs font-semibold text-purple-300 mb-2 uppercase tracking-wide flex items-center space-x-1">
                      <Sparkles size={12} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      <span>Summary</span>
                    </h4>
                    <p className="text-white text-sm leading-relaxed">{aiNotes.summary}</p>
                  </div>
                )}
                  
                  {aiNotes.bullets && aiNotes.bullets.length > 0 && (
                    <div className="glass-card rounded-lg p-3 border border-primary-500/20">
                      <h4 className="text-xs font-semibold text-primary-300 mb-2 uppercase tracking-wide">Key Points</h4>
                      <ul className="space-y-1.5">
                        {aiNotes.bullets.map((point, idx) => (
                          <li key={idx} className="text-white text-sm flex items-start space-x-2">
                            <span className="text-primary-400 mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                {aiNotes.actionItems && aiNotes.actionItems.length > 0 && (
                  <div className="glass-card rounded-lg p-3 border border-green-500/20">
                    <h4 className="text-xs font-semibold text-green-300 mb-2 uppercase tracking-wide">Action Items</h4>
                    <ul className="space-y-1.5">
                      {aiNotes.actionItems.map((item, idx) => (
                        <li key={idx} className="text-white text-sm flex items-start space-x-2">
                            <span className="text-green-400 mt-1">✓</span>
                            <span>{item.text}{item.assignee && <span className="text-green-300"> ({item.assignee})</span>}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                  
                  {aiNotes.decisions && aiNotes.decisions.length > 0 && (
                    <div className="glass-card rounded-lg p-3 border border-blue-500/20">
                      <h4 className="text-xs font-semibold text-blue-300 mb-2 uppercase tracking-wide">Decisions Made</h4>
                      <ul className="space-y-1.5">
                        {aiNotes.decisions.map((decision, idx) => (
                          <li key={idx} className="text-white text-sm flex items-start space-x-2">
                            <span className="text-blue-400 mt-1">→</span>
                            <span>{decision}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                {aiNotes.keyTopics && aiNotes.keyTopics.length > 0 && (
                    <div className="glass-card rounded-lg p-3 border border-yellow-500/20">
                      <h4 className="text-xs font-semibold text-yellow-300 mb-2 uppercase tracking-wide">Topics Discussed</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {aiNotes.keyTopics.map((topic, idx) => (
                          <span key={idx} className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                  
                  {aiNotes.suggestedReplies && aiNotes.suggestedReplies.length > 0 && (
                    <div className="glass-card rounded-lg p-3 border border-cyan-500/20">
                      <h4 className="text-xs font-semibold text-cyan-300 mb-2 uppercase tracking-wide">Next Steps</h4>
                      <ul className="space-y-1.5">
                        {aiNotes.suggestedReplies.map((step, idx) => (
                          <li key={idx} className="text-white text-sm flex items-start space-x-2">
                            <span className="text-cyan-400 mt-1">→</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
              </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      case 'notes':
        return (
          <div className="h-full overflow-y-auto">
            {/* Notes Header */}
            <div className="sticky top-0 z-10 bg-dark-900/95 backdrop-blur-xl border-b border-dark-800/50 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Sparkles size={20} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  <h1 className="text-white font-bold text-lg">
                    {comprehensiveNotes?.title || 'Meeting Notes'}
                  </h1>
                </div>
                <div className="flex items-center space-x-2">
                  {!comprehensiveNotes && callStatus === 'ended' && (
                    <button
                      onClick={generateComprehensiveNotes}
                      disabled={notesGenerating}
                      className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      {notesGenerating ? (
                        <>
                          <FiLoader size={14} className="animate-spin" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                          <span>Generate Notes</span>
                        </>
                      )}
                    </button>
                  )}
                  {comprehensiveNotes && (
                    <>
                      <button
                        onClick={() => {
                          // Export functionality will be added
                          toast.info('Export', 'Export functionality coming soon');
                        }}
                        className="p-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition"
                        title="Export"
                      >
                        <FiDownload size={16} className="text-dark-300" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      </button>
                      <button
                        onClick={() => {
                          // Share functionality will be added
                          toast.info('Share', 'Share functionality coming soon');
                        }}
                        className="p-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition"
                        title="Share"
                      >
                        <FiShare2 size={16} className="text-dark-300" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {comprehensiveNotes && (
                <div className="flex items-center space-x-4 text-xs text-dark-400">
                  <span className="flex items-center space-x-1">
                    <FiClock size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <span>{new Date(comprehensiveNotes.date).toLocaleDateString()}</span>
                  </span>
                  <span>{Math.round((comprehensiveNotes.duration || 0) / 60)} minutes</span>
                  <span className="flex items-center space-x-1">
                    <FiUsers size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    <span>{comprehensiveNotes.participants?.length || 0} participants</span>
                  </span>
                </div>
              )}
            </div>

            {/* Notes Content */}
            <div className="p-4 space-y-6">
              {notesLoading ? (
                <div className="text-center py-12">
                  <FiLoader size={32} className="animate-spin text-purple-400 mx-auto mb-3" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  <p className="text-dark-400 text-sm">Loading notes...</p>
                </div>
              ) : comprehensiveNotes ? (
                <>
                  {/* Summary Section */}
                  {comprehensiveNotes.summary && (
                    <section className="glass-card rounded-lg p-4 border border-purple-500/20">
                      <h2 className="text-white font-semibold text-base mb-3 flex items-center space-x-2">
                        <Sparkles size={16} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Summary</span>
                      </h2>
                      <p className="text-white text-sm leading-relaxed">{comprehensiveNotes.summary}</p>
                    </section>
                  )}

                  {/* Action Items Section */}
                  {comprehensiveNotes.actionItems && comprehensiveNotes.actionItems.length > 0 && (
                    <section className="glass-card rounded-lg p-4 border border-green-500/20">
                      <h2 className="text-white font-semibold text-base mb-3 flex items-center space-x-2">
                        <FiCheckCircle size={16} className="text-green-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Action Items ({comprehensiveNotes.actionItems.length})</span>
                      </h2>
                      <div className="space-y-3">
                        {comprehensiveNotes.actionItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start space-x-3 p-3 bg-dark-800/30 rounded-lg hover:bg-dark-800/50 transition">
                            <input
                              type="checkbox"
                              checked={item.completed || false}
                              className="mt-1 w-4 h-4 rounded border-dark-600 bg-dark-700 text-green-500 focus:ring-green-500"
                              readOnly
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm">{item.text}</p>
                              <div className="flex items-center space-x-3 mt-2 text-xs">
                                {item.assignee && (
                                  <span className="text-green-300">@{item.assignee}</span>
                                )}
                                {item.dueDate && (
                                  <span className="text-dark-400">
                                    Due: {new Date(item.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                                {item.priority && (
                                  <span className={`px-2 py-0.5 rounded ${
                                    item.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                    item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                    'bg-blue-500/20 text-blue-300'
                                  }`}>
                                    {item.priority}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Decisions Section */}
                  {comprehensiveNotes.decisions && comprehensiveNotes.decisions.length > 0 && (
                    <section className="glass-card rounded-lg p-4 border border-blue-500/20">
                      <h2 className="text-white font-semibold text-base mb-3 flex items-center space-x-2">
                        <FiCheckCircle size={16} className="text-blue-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Key Decisions</span>
                      </h2>
                      <div className="space-y-3">
                        {comprehensiveNotes.decisions.map((decision: any, idx: number) => (
                          <div key={idx} className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <p className="text-white text-sm font-medium mb-1">{decision.decision}</p>
                            {decision.context && (
                              <p className="text-dark-300 text-xs mb-2">{decision.context}</p>
                            )}
                            <span className="text-dark-400 text-xs">{decision.timestamp}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Discussion Topics Section */}
                  {comprehensiveNotes.sections && comprehensiveNotes.sections.length > 0 && (
                    <section className="glass-card rounded-lg p-4 border border-yellow-500/20">
                      <h2 className="text-white font-semibold text-base mb-3 flex items-center space-x-2">
                        <FiMessageSquare size={16} className="text-yellow-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Discussion Topics</span>
                      </h2>
                      <div className="space-y-4">
                        {comprehensiveNotes.sections.map((section: any, idx: number) => {
                          const isExpanded = expandedSections.has(`section-${idx}`);
                          return (
                            <div key={idx} className="border border-dark-700 rounded-lg overflow-hidden">
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedSections);
                                  if (isExpanded) {
                                    newExpanded.delete(`section-${idx}`);
                                  } else {
                                    newExpanded.add(`section-${idx}`);
                                  }
                                  setExpandedSections(newExpanded);
                                }}
                                className="w-full flex items-center justify-between p-3 bg-dark-800/30 hover:bg-dark-800/50 transition"
                              >
                                <div className="flex items-center space-x-2">
                                  <h3 className="text-white font-medium text-sm">{section.topic}</h3>
                                  <span className="text-dark-400 text-xs">{section.timestamp}</span>
                                </div>
                                {isExpanded ? (
                                  <FiChevronUp size={16} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                                ) : (
                                  <FiChevronDown size={16} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                                )}
                              </button>
                              {isExpanded && (
                                <div className="p-3 space-y-2">
                                  <ul className="space-y-1.5">
                                    {section.notes.map((note: string, noteIdx: number) => (
                                      <li key={noteIdx} className="text-white text-sm flex items-start space-x-2">
                                        <span className="text-yellow-400 mt-1">•</span>
                                        <span>{note}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  {section.relatedTranscript && (
                                    <details className="mt-3">
                                      <summary className="text-dark-400 text-xs cursor-pointer hover:text-dark-300">
                                        View related transcript
                                      </summary>
                                      <p className="text-dark-300 text-xs mt-2 p-2 bg-dark-800/50 rounded italic">
                                        {section.relatedTranscript}
                                      </p>
                                    </details>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Key Points */}
                  {comprehensiveNotes.keyPoints && comprehensiveNotes.keyPoints.length > 0 && (
                    <section className="glass-card rounded-lg p-4 border border-primary-500/20">
                      <h2 className="text-white font-semibold text-base mb-3">Key Points</h2>
                      <ul className="space-y-2">
                        {comprehensiveNotes.keyPoints.map((point: string, idx: number) => (
                          <li key={idx} className="text-white text-sm flex items-start space-x-2">
                            <span className="text-primary-400 mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Questions Raised */}
                  {comprehensiveNotes.questionsRaised && comprehensiveNotes.questionsRaised.length > 0 && (
                    <section className="glass-card rounded-lg p-4 border border-cyan-500/20">
                      <h2 className="text-white font-semibold text-base mb-3">Questions Raised</h2>
                      <ul className="space-y-2">
                        {comprehensiveNotes.questionsRaised.map((question: string, idx: number) => (
                          <li key={idx} className="text-white text-sm flex items-start space-x-2">
                            <span className="text-cyan-400 mt-1">?</span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Next Steps */}
                  {comprehensiveNotes.nextSteps && comprehensiveNotes.nextSteps.length > 0 && (
                    <section className="glass-card rounded-lg p-4 border border-purple-500/20">
                      <h2 className="text-white font-semibold text-base mb-3">Next Steps</h2>
                      <ul className="space-y-2 mb-4">
                        {comprehensiveNotes.nextSteps.map((step: string, idx: number) => (
                          <li key={idx} className="text-white text-sm flex items-start space-x-2">
                            <span className="text-purple-400 mt-1">→</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                      {comprehensiveNotes.suggestedFollowUp && (
                        <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <div className="flex items-center space-x-2">
                            <FiCalendar size={16} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                            <p className="text-white text-sm">
                              Suggested follow-up: {new Date(comprehensiveNotes.suggestedFollowUp).toLocaleDateString()}
                            </p>
                          </div>
                          <button className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition flex items-center space-x-1.5">
                            <FiCalendar size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                            <span>Schedule</span>
                          </button>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Generated Images Gallery */}
                  {generatedImages.length > 0 && (
                    <section className="glass-card rounded-lg p-4 border border-purple-500/20">
                      <h2 className="text-white font-semibold text-base mb-3 flex items-center space-x-2">
                        <FiImage size={16} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Generated Images ({generatedImages.length})</span>
                      </h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {generatedImages.map((img) => (
                          <div
                            key={img._id}
                            className="glass-card-hover rounded-lg overflow-hidden group"
                          >
                            <div 
                              className="relative cursor-pointer"
                              onClick={() => window.open(img.imageUrl, '_blank')}
                            >
                              <img
                                src={img.imageUrl}
                                alt={img.prompt}
                                className="w-full h-32 object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="text-white text-xs font-medium">View Full</span>
                              </div>
                            </div>
                            <div className="p-2">
                              <p className="text-dark-300 text-xs mb-1 line-clamp-2" title={img.prompt}>
                                "{img.prompt.substring(0, 50)}{img.prompt.length > 50 ? '...' : ''}"
                              </p>
                              <div className="flex items-center justify-between text-xs text-dark-500 mb-2">
                                <span>{new Date(img.createdAt).toLocaleDateString()}</span>
                                <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">{img.style}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const link = document.createElement('a');
                                    link.href = img.imageUrl;
                                    link.download = `image-${img._id}.png`;
                                    link.click();
                                    toast.success('Downloaded', 'Image saved');
                                  }}
                                  className="flex-1 px-2 py-1 bg-dark-700 hover:bg-dark-600 text-white text-xs rounded transition flex items-center justify-center space-x-1"
                                  title="Download"
                                >
                                  <FiDownload size={10} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateImage(img.prompt);
                                  }}
                                  disabled={isGeneratingImage}
                                  className="flex-1 px-2 py-1 bg-dark-700 hover:bg-dark-600 text-white text-xs rounded transition flex items-center justify-center space-x-1 disabled:opacity-50"
                                  title="Regenerate"
                                >
                                  <FiRefreshCw size={10} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                                  <span>Regen</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {generatedImages.length > 6 && (
                        <button
                          onClick={() => {
                            // Download all images as ZIP (would need backend support)
                            toast.info('Download All', 'Feature coming soon');
                          }}
                          className="mt-3 w-full px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition flex items-center justify-center space-x-2"
                        >
                          <FiDownload size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                          <span>Download All Images</span>
                        </button>
                      )}
                    </section>
                  )}
                </>
              ) : callStatus === 'ended' ? (
                <div className="text-center py-12">
                  <FiFileText size={48} className="text-dark-700 mx-auto mb-3" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  <p className="text-dark-400 text-sm mb-4">No comprehensive notes available</p>
                  <button
                    onClick={generateComprehensiveNotes}
                    disabled={notesGenerating}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition disabled:opacity-50 flex items-center space-x-2 mx-auto"
                  >
                    {notesGenerating ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span>Generate Meeting Notes</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                <AIThinking className="justify-center" />
                  <p className="text-dark-500 text-sm mt-4">Comprehensive notes will be available after the call ends</p>
              </div>
            )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Handle AI command
  const handleAICommand = async (command: string) => {
    if (!accessToken || !callId) return;

    const prompt = command.slice(4).trim(); // Remove "/ai "
    if (!prompt) {
      toast.error('AI Command', 'Please provide a command after /ai');
      return;
    }

    // Add user message showing the command
    const userMessageId = `ai-cmd-${Date.now()}`;
    setChatMessages(prev => [...prev, {
      _id: userMessageId,
      senderId: { _id: user?._id || '', name: user?.name || 'You' },
      content: `/ai ${prompt}`,
      createdAt: new Date().toISOString(),
    }]);

    // Create AI message placeholder
    const aiMessageId = `ai-response-${Date.now()}`;
    setChatMessages(prev => [...prev, {
      _id: aiMessageId,
      senderId: { _id: 'ai', name: 'AceTime AI' },
      content: '',
      isAI: true,
      aiStreaming: true,
      requestedBy: user?.name || 'You',
      createdAt: new Date().toISOString(),
    }]);
    setAiStreamingMessageId(aiMessageId);

    try {
      const response = await fetch(`${API_URL}/api/calls/${callId}/ai-command`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: prompt,
          requestedBy: user?.name || 'You',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process AI command');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'chunk' && data.content) {
                  setChatMessages(prev => prev.map(msg => 
                    msg._id === aiMessageId
                      ? { ...msg, content: (msg.content || '') + data.content }
                      : msg
                  ));
                } else if (data.type === 'done') {
                  setChatMessages(prev => prev.map(msg => 
                    msg._id === aiMessageId
                      ? { ...msg, aiStreaming: false }
                      : msg
                  ));
                  setAiStreamingMessageId(null);
                } else if (data.type === 'error') {
                  setChatMessages(prev => prev.map(msg => 
                    msg._id === aiMessageId
                      ? { ...msg, content: `Error: ${data.error}`, aiStreaming: false }
                      : msg
                  ));
                  setAiStreamingMessageId(null);
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('AI command error:', error);
      setChatMessages(prev => prev.map(msg => 
        msg._id === aiMessageId
          ? { ...msg, content: 'Failed to get AI response. Please try again.', aiStreaming: false }
          : msg
      ));
      setAiStreamingMessageId(null);
      toast.error('AI Error', error.message || 'Failed to process AI command');
    }
  };

  const sendChatMessage = async () => {
    if (!accessToken || (!newChatMessage.trim() && selectedFiles.length === 0) || !callConversationId) return;

    const messageContent = newChatMessage.trim();

    // Check if it's an AI command
    if (messageContent.startsWith('/ai ')) {
      await handleAICommand(messageContent);
      setNewChatMessage('');
      return;
    }
    
    // Upload files if any
    let attachments: Array<{ type: string; url: string; name: string }> = [];
    if (selectedFiles.length > 0) {
      setUploading(true);
      try {
        const uploadedUrls = await uploadChatFiles();
        attachments = selectedFiles.map((file, idx) => ({
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
          url: uploadedUrls[idx] || '',
          name: file.name,
        }));
      } catch (error) {
        console.error('File upload error:', error);
      } finally {
        setUploading(false);
      }
    }
    
    setNewChatMessage('');
    setSelectedFiles([]);
    
    // Optimistic update - add temp message with unique ID
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      _id: tempId,
      senderId: { _id: user?._id || '', name: user?.name || 'You' },
      content: messageContent || '📎',
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date().toISOString(),
    };
    
    // Add temp message optimistically
    setChatMessages(prev => {
      const exists = prev.some(m => m._id === tempId || (m._id?.startsWith('temp-') && m.content === messageContent));
      if (exists) return prev;
      return [...prev, tempMessage];
    });
    
    try {
      const response = await fetch(`${API_URL}/api/messages/conversations/${callConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: messageContent || '📎',
          requestAiResponse: false,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CHAT] ✅ Message sent, received response:', data.message._id);
        setChatMessages(prev => {
          const filtered = prev.filter(m => m._id !== tempId);
          const hasReal = filtered.some(m => 
            m._id === data.message._id || 
            (m.content === (messageContent || '📎') && m.senderId._id === user?._id && !m._id?.startsWith('temp-'))
          );
          if (!hasReal) {
            return [...filtered, {
              _id: data.message._id,
              senderId: data.message.senderId,
              content: data.message.content,
              attachments: data.message.attachments,
              reactions: data.message.reactions,
              createdAt: data.message.createdAt,
            }];
          }
          return filtered;
        });
      } else {
        setChatMessages(prev => prev.filter(m => m._id !== tempId));
        setNewChatMessage(messageContent);
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error', errorData.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
      setChatMessages(prev => prev.filter(m => m._id !== tempId));
      setNewChatMessage(messageContent);
      toast.error('Error', 'Failed to send message. Please try again.');
    }
  };

  // Handle tap to show controls on mobile
  const handleVideoTap = () => {
    if (isMobile) {
      setShowMobileControls(true);
      if (controlsTimeout) clearTimeout(controlsTimeout);
      const timer = setTimeout(() => setShowMobileControls(false), 3000);
      setControlsTimeout(timer);
    }
  };

      return (
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">

      {/* Private Message Notification Icon - Floating button (visible when there are unread messages) */}
      {unreadPrivateMessages.length > 0 && !showPrivateChatOverlay && (
        <div className="fixed top-20 right-4 z-50">
          <button
            onClick={() => {
              const firstUnread = unreadPrivateMessages[0];
              setPrivateChatData({
                conversationId: firstUnread.conversationId,
                targetUserId: firstUnread.senderId,
                targetUserName: firstUnread.senderName,
              });
              setShowPrivateChatOverlay(true);
              setUnreadPrivateMessages(prev =>
                prev.filter(m => m.conversationId !== firstUnread.conversationId)
              );
            }}
            className="bg-primary-500/90 hover:bg-primary-500 rounded-full p-3 shadow-lg hover:scale-110 transition-all animate-pulse flex items-center justify-center relative"
            title={`${unreadPrivateMessages.length} new private message${unreadPrivateMessages.length > 1 ? 's' : ''}`}
          >
            <FiMessageSquare size={20} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
            {unreadPrivateMessages.length > 1 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadPrivateMessages.length > 9 ? '9+' : unreadPrivateMessages.length}
              </span>
            )}
          </button>
        </div>
      )}
      
      {/* MOBILE LAYOUT (< 768px) - WhatsApp Style */}
      {isMobile ? (
        <div className="h-full relative overflow-hidden">
          {/* Multi-Participant Video Grid - Mobile */}
          <div 
            className="absolute inset-0 bg-dark-900"
            onClick={handleVideoTap}
            style={{ paddingTop: '48px', paddingBottom: '80px' }} // Space for tabs and controls
          >
            {/* Call Controls - Show during active/waiting call on ALL tabs */}
            {/* Show controls when: call is active or waiting, regardless of active tab */}
            {(callStatus === 'active' || callStatus === 'waiting') && 
             !showBottomSheet && (
              <div 
                className={`fixed z-[1001] pointer-events-auto ${
                  // Mobile: Position above bottom nav (60px from bottom), centered
                  isMobile 
                    ? 'bottom-[60px] left-1/2 transform -translate-x-1/2' 
                    // Tablet: Center with margin
                    : isTablet
                    ? 'bottom-6 left-1/2 transform -translate-x-1/2'
                    // Desktop: Center, adjust when side panel open to prevent overlap
                    : activeRightTab !== 'dreamweaving' && (isTablet || isLaptop)
                    ? 'bottom-8 right-[420px] left-auto transform-none'
                    : 'bottom-8 left-1/2 transform -translate-x-1/2'
                }`}
                style={{
                  transition: 'bottom 0.3s ease, right 0.3s ease, left 0.3s ease, transform 0.3s ease',
                  // Ensure controls don't overlap with video tiles
                  maxWidth: 'calc(100vw - 32px)',
                }}
              >
                <CallControls
                  isMuted={isMuted}
                  isVideoOff={isVideoOff}
                  onToggleMute={toggleMute}
                  onToggleVideo={toggleVideo}
                  onEndCall={handleEndCall}
                  onScreenShare={handleScreenShare}
                  onAddParticipant={handleAddParticipant}
                  onSettings={handleSettings}
                  isScreenSharing={isScreenSharing}
                />
              </div>
            )}
            {/* Always show local video, even when alone */}
            {(() => {
              // Determine if AI is speaking or thinking
              // AI is "speaking" when there's an interim transcript (AI is generating)
              // AI is "thinking" when AI notes are being updated
              const isAISpeaking = !!interimTranscript && interimTranscript.trim().length > 0;
              const isAIThinking = !!aiNotes && !isAISpeaking;
              
              // Calculate actual participant count (excluding AI for grid logic)
              const actualParticipantCount = participants.length + 1; // +1 for local user
              const isAlone = actualParticipantCount === 1;
              const isTwoParticipants = actualParticipantCount === 2;

              // Responsive grid configuration
              const getGridConfig = () => {
                const width = window.innerWidth;
                const isDesktop = width >= 1024;
                
                // Special case: 1 participant (alone)
                if (isAlone) {
                  if (width < 640) {
                    // Mobile: centered single tile
                    return {
                      gridCols: '1fr',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-1 justify-items-center',
                      maxWidth: '100%',
                    };
                  } else {
                    // Desktop: centered square tile
                    return {
                      gridCols: '1fr',
                      gridRows: '1fr',
                      containerClass: 'flex justify-center items-center',
                      maxWidth: width >= 1024 ? '600px' : '100%',
                    };
                  }
                }
                
                // Desktop: Optimize grid based on participant count for equal-sized tiles
                if (isDesktop) {
                  if (isTwoParticipants) {
                    // 2 participants: 2 columns, 1 row
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 3) {
                    // 3 participants: 3 columns, 1 row
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-3',
                    };
                  } else if (actualParticipantCount === 4) {
                    // 4 participants: 2x2 grid
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 5 || actualParticipantCount === 6) {
                    // 5-6 participants: 3 columns, 2 rows
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-3',
                    };
                  } else if (actualParticipantCount >= 7 && actualParticipantCount <= 9) {
                    // 7-9 participants: 3x3 grid
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: 'repeat(3, 1fr)',
                      containerClass: 'grid-cols-3',
                    };
                  } else {
                    // 10+ participants: 4 columns, calculate rows needed
                    const rowsNeeded = Math.ceil(actualParticipantCount / 4);
                    return {
                      gridCols: 'repeat(4, 1fr)',
                      gridRows: `repeat(${rowsNeeded}, 1fr)`,
                      containerClass: 'grid-cols-4',
                    };
                  }
                }
                
                // Mobile/Tablet: Optimize grid based on participant count for square tiles
                if (width < 640) {
                  // Mobile: Optimize grid based on participant count for equal-sized square tiles
                  if (isTwoParticipants) {
                    // 2 participants: 2 columns, 1 row
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 3) {
                    // 3 participants: 2 columns, 2 rows
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 4) {
                    // 4 participants: 2x2 grid
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 5 || actualParticipantCount === 6) {
                    // 5-6 participants: 2 columns, 3 rows
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(3, 1fr)',
                      containerClass: 'grid-cols-2',
                    };
                  } else {
                    // 7+ participants: Calculate rows needed (2 columns, ceil(participants/2) rows)
                    const rowsNeeded = Math.ceil(actualParticipantCount / 2);
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: `repeat(${rowsNeeded}, 1fr)`,
                      containerClass: 'grid-cols-2',
                    };
                  }
                } else {
                  // Tablet: Similar to mobile but can fit more
                  if (isTwoParticipants) {
                    // 2 participants: 2 columns
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-1 sm:grid-cols-2',
                    };
                  } else if (actualParticipantCount === 3) {
                    // 3 participants: 3 columns, 1 row
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-2 sm:grid-cols-3',
                    };
                  } else if (actualParticipantCount === 4) {
                    // 4 participants: 2x2 grid
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-1 sm:grid-cols-2',
                    };
                  } else if (actualParticipantCount >= 5 && actualParticipantCount <= 6) {
                    // 5-6 participants: 3 columns, 2 rows
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-2 sm:grid-cols-3',
                    };
                  } else {
                    // 7+ participants: 3 columns, calculate rows needed
                    const rowsNeeded = Math.ceil(actualParticipantCount / 3);
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: `repeat(${rowsNeeded}, 1fr)`,
                      containerClass: 'grid-cols-2 sm:grid-cols-3',
                    };
                  }
                }
              };

              const gridConfig = getGridConfig();
              
              return (
                <div 
                  className={`w-full h-full grid gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-6 relative ${gridConfig.containerClass}`}
                  style={{
                    display: 'grid', // Explicit grid display
                    gridTemplateColumns: gridConfig.gridCols,
                    gridTemplateRows: gridConfig.gridRows || '1fr',
                    gridAutoRows: '1fr', // Ensure all auto rows are equal height
                    maxWidth: gridConfig.maxWidth || '100%',
                    margin: isAlone && window.innerWidth >= 640 ? '0 auto' : '0',
                    alignItems: 'stretch',
                    justifyItems: 'stretch', // Stretch to fill grid cells
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Remote participants */}
                  {participants.map((participant) => {
                    const participantData = participantStreams.get(participant.socketId);
                    // Use stable key: prefer userId if available, fallback to socketId
                    const stableKey = participant.userId || participant.socketId;
                    return (
                      <VideoParticipant
                        key={stableKey}
                        stream={participantData?.stream || (participants.indexOf(participant) === 0 ? remoteStream : null)}
                        userName={participant.userName}
                        userId={participant.userId}
                        isVideoOff={participantData?.isVideoOff || false}
                        isMuted={participantData?.isMuted || false}
                        className="w-full max-w-full"
                      />
                    );
                  })}
                  
                  {/* Local user (ALWAYS shown) */}
                  <VideoParticipant
                    key={user?._id || 'local-user'}
                    stream={localStream}
                    userName={user?.name || 'You'}
                    userId={user?._id}
                    avatar={user?.avatar}
                    isVideoOff={isVideoOff}
                    isMuted={isMuted}
                    isLocal={true}
                    className="w-full max-w-full"
                  />
                  
                  {/* AI Participant (ALWAYS shown as third participant) */}
                  <AIParticipant
                    key="ai-participant"
                    isSpeaking={isAISpeaking}
                    isThinking={isAIThinking}
                    className="w-full max-w-full"
                  />
                  
                  {/* Waiting message overlay (only when alone with AI) - Moved up significantly to avoid button overlap */}
                  {participants.length === 0 && (
                    <div className="absolute bottom-24 sm:bottom-32 md:bottom-36 left-1/2 transform -translate-x-1/2 bg-dark-900/90 backdrop-blur-lg rounded-full px-4 py-2.5 md:px-6 md:py-3 z-20 max-w-[90%] md:max-w-none">
                      <p className="text-white text-sm md:text-base font-medium whitespace-nowrap">Waiting for others to join...</p>
                      {roomId && (
                        <p className="text-dark-400 text-xs md:text-sm mt-1 text-center truncate">Room: <span className="text-primary-400 font-mono">{roomId}</span></p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Call Controls - Show during active/waiting call on ALL tabs (Mobile) */}
            {/* Show controls when: call is active or waiting, regardless of active tab */}
            {(callStatus === 'active' || callStatus === 'waiting') && 
             !showBottomSheet && (
              <div 
                className={`fixed z-[1001] pointer-events-auto ${
                  // Mobile: Position above bottom nav (60px from bottom), centered
                  isMobile 
                    ? 'bottom-[60px] left-1/2 transform -translate-x-1/2' 
                    // Tablet: Center with margin
                    : isTablet
                    ? 'bottom-6 left-1/2 transform -translate-x-1/2'
                    // Desktop: Center, adjust when side panel open to prevent overlap
                    : activeRightTab !== 'dreamweaving' && (isTablet || isLaptop)
                    ? 'bottom-8 right-[420px] left-auto transform-none'
                    : 'bottom-8 left-1/2 transform -translate-x-1/2'
                }`}
                style={{
                  transition: 'bottom 0.3s ease, right 0.3s ease, left 0.3s ease, transform 0.3s ease',
                  // Ensure controls don't overlap with video tiles
                  maxWidth: 'calc(100vw - 32px)',
                }}
              >
                <CallControls
                  isMuted={isMuted}
                  isVideoOff={isVideoOff}
                  onToggleMute={toggleMute}
                  onToggleVideo={toggleVideo}
                  onEndCall={handleEndCall}
                  onScreenShare={handleScreenShare}
                  onAddParticipant={handleAddParticipant}
                  onSettings={handleSettings}
                  isScreenSharing={isScreenSharing}
                />
              </div>
            )}

            {/* Mobile Bottom Tab Navigation - Only show on mobile */}
            <div ref={bottomNavRef} className="mobile-bottom-nav safe-area-bottom md:hidden">
              {(['dreamweaving', 'chat', 'transcript', 'notes'] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveRightTab(tab);
                    setShowBottomSheet(true);
                  }}
                  className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] transition-all ${
                    activeRightTab === tab
                      ? 'text-primary-400'
                      : 'text-dark-400'
                  }`}
                >
                  {tab === 'dreamweaving' && (
                    <Sparkles size={24} className="text-current" strokeWidth={2.5} style={{ display: 'block', opacity: 1, visibility: 'visible' }} />
                  )}
                  {tab === 'chat' && (
                    <div className="relative">
                      <MessageSquare size={24} className="text-current" strokeWidth={2.5} style={{ display: 'block', opacity: 1, visibility: 'visible' }} />
                      {(unreadPrivateMessages.length > 0 || showPrivateChatOverlay) && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                      )}
                    </div>
                  )}
                  {tab === 'transcript' && (
                    <FileText size={24} className="text-current" strokeWidth={2.5} style={{ display: 'block', opacity: 1, visibility: 'visible' }} />
                  )}
                  {tab === 'notes' && (
                    <StickyNote size={24} className="text-current" strokeWidth={2.5} style={{ display: 'block', opacity: 1, visibility: 'visible' }} />
                  )}
                  <span className="text-xs font-medium capitalize">{tab === 'dreamweaving' ? 'Dream' : tab}</span>
                </button>
              ))}
            </div>

            {/* Top Left Info - Auto-hide */}
            <div className={`absolute top-4 left-4 z-30 transition-opacity duration-300 ${showMobileControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="glass-card rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center space-x-2">
                  <FiClock 
                    size={16}
                    className="text-white flex-shrink-0" 
                    style={{ 
                      display: 'inline-block', 
                      width: '16px', 
                      height: '16px', 
                      color: '#ffffff', 
                      opacity: 1,
                      visibility: 'visible'
                    }} 
                  />
                  <span className="text-white font-mono text-sm">{formatDuration(callDuration)}</span>
            </div>
                <div className="flex items-center space-x-2">
                  <FiUsers 
                    size={16}
                    className="text-white flex-shrink-0" 
                    style={{ 
                      display: 'inline-block', 
                      width: '16px', 
                      height: '16px', 
                      color: '#ffffff', 
                      opacity: 1,
                      visibility: 'visible'
                    }} 
                  />
                  <span className="text-white text-sm">{participants.length + 1}</span>
        </div>
                {isRecording && (
                  <div className="flex items-center space-x-1.5 mt-1 pt-1 border-t border-dark-700/50">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-400 text-xs font-medium">REC</span>
          </div>
                )}
        </div>
            </div>
            </div>

          {/* Swipeable Top Tabs Bar - Fixed at top */}
          <div className="fixed top-0 left-0 right-0 z-20 glass-card border-b border-dark-800/50" style={{ height: '48px' }}>
            <div className="flex overflow-x-auto scrollbar-hide">
              {(['dreamweaving', 'chat', 'transcript', 'notes'] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveRightTab(tab);
                    setShowBottomSheet(true);
                  }}
                  className={`flex-shrink-0 px-4 py-3 text-xs font-medium transition-all relative ${
                    activeRightTab === tab
                      ? 'text-primary-400 bg-primary-500/10 border-b-2 border-primary-500'
                      : 'text-dark-400'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1.5">
                    {tab === 'dreamweaving' && (
                      <Sparkles 
                        size={20}
                        className="flex-shrink-0 text-current" 
                        strokeWidth={2.5}
                      />
                    )}
                    {tab === 'chat' && (
                      <div className="relative">
                        <MessageSquare 
                          size={20}
                          className="flex-shrink-0 text-current" 
                          strokeWidth={2.5}
                        />
                        {(unreadPrivateMessages.length > 0 || showPrivateChatOverlay) && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                        )}
                      </div>
                    )}
                    {tab === 'transcript' && (
                      <FileText 
                        size={20}
                        className="flex-shrink-0 text-current" 
                        strokeWidth={2.5}
                      />
                    )}
                    {tab === 'notes' && (
                      <StickyNote 
                        size={20}
                        className="flex-shrink-0 text-current" 
                        strokeWidth={2.5}
                      />
                    )}
                    <span className="capitalize">{tab === 'dreamweaving' ? 'Dream' : tab === 'transcript' ? 'Transcript' : tab}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Private Message Notification Banner - Mobile */}
          {showPrivateMessageBanner && currentBannerMessage && (
            <div 
              className="fixed left-4 right-4 z-[100] animate-slide-down"
              style={{ top: '16px' }}
            >
              <div
                onClick={() => {
                  setShowPrivateMessageBanner(false);
                  if (bannerTimeoutRef.current) {
                    clearTimeout(bannerTimeoutRef.current);
                  }
                  // Open private chat overlay instead of navigating away
                  // This keeps the call visible and active
                  setPrivateChatData({
                    conversationId: currentBannerMessage.conversationId,
                    targetUserId: currentBannerMessage.senderId,
                    targetUserName: currentBannerMessage.senderName,
                  });
                  setShowPrivateChatOverlay(true);
                  // Clear unread for this conversation
                  setUnreadPrivateMessages(prev =>
                    prev.filter(m => m.conversationId !== currentBannerMessage.conversationId)
                  );
                }}
                className="glass-card rounded-xl p-4 border-2 border-primary-500/70 bg-gradient-to-r from-primary-500/30 via-primary-500/20 to-primary-500/10 hover:from-primary-500/40 hover:via-primary-500/30 hover:to-primary-500/20 transition-all cursor-pointer flex items-center justify-between shadow-2xl backdrop-blur-xl animate-fade-in hover:scale-[1.02] active:scale-[0.98] animate-pulse-slow"
                style={{
                  boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4), 0 0 30px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-primary-500/40 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse ring-2 ring-primary-500/50">
                    <FiMessageSquare size={24} className="text-primary-200" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-base truncate">
                      New private message from {currentBannerMessage.senderName}
                    </p>
                    <p className="text-primary-200 text-xs mt-1 font-medium">Tap to view and respond</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPrivateMessageBanner(false);
                    if (bannerTimeoutRef.current) {
                      clearTimeout(bannerTimeoutRef.current);
                    }
                  }}
                  className="ml-3 p-2 hover:bg-dark-800/70 rounded-lg transition flex-shrink-0"
                  aria-label="Dismiss notification"
                >
                  <FiX size={20} className="text-dark-300 hover:text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                </button>
              </div>
            </div>
          )}

          {/* Bottom Sheet for Tab Content */}
          {showBottomSheet && (
            <>
              <div 
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowBottomSheet(false)}
              />
              <div className={`fixed bottom-0 left-0 right-0 z-50 bg-dark-950 rounded-t-3xl shadow-2xl border-t border-dark-800/50 flex flex-col animate-slide-up ${
                isMobile ? 'h-[90vh]' : 'max-h-[80vh]'
              }`}>
                <div className="flex items-center justify-between p-4 border-b border-dark-800/50">
                  <h3 className="text-white font-semibold capitalize">
                    {activeRightTab === 'dreamweaving' ? 'Dreamweaving' : activeRightTab === 'transcript' ? 'Live Transcript' : activeRightTab}
                  </h3>
                  <button
                    onClick={() => setShowBottomSheet(false)}
                    className="p-2 glass-card rounded-lg hover:bg-dark-800/50"
                  >
                    <FiX size={20} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {renderTabContent(activeRightTab)}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* DESKTOP/TABLET LAYOUT (>= 768px) */
        <>
          {/* Top Header Bar - Desktop Only */}
          <header className="hidden md:flex glass-card border-b border-dark-800/50 px-6 py-3 items-center justify-between">
            <div className="flex items-center space-x-4">
              {isRecording && (
                <div className="flex items-center space-x-2 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm font-medium">REC</span>
    </div>
              )}
              <div className="flex items-center space-x-2">
                <FiClock 
                  size={16}
                  className="text-dark-400" 
                  style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    color: '#94a3b8', 
                    opacity: 1,
                    visibility: 'visible'
                  }} 
                />
                <span className="text-white font-mono text-lg">{formatDuration(callDuration)}</span>
              </div>
              <div className="flex items-center space-x-2 bg-dark-800/50 px-3 py-1.5 rounded-lg">
                <FiUsers 
                  size={16}
                  className="text-dark-400" 
                  style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    color: '#94a3b8', 
                    opacity: 1,
                    visibility: 'visible'
                  }} 
                />
                <span className="text-white text-sm">{participants.length + 1}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleCopyCode}
                className="glass-card-hover px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                {copied ? (
                  <FiCheck size={16} className="text-green-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                ) : (
                  <FiCopy size={16} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                )}
                <span className="text-white font-mono text-sm">{roomId}</span>
              </button>
            </div>
          </header>

          {/* Main Content - Responsive Split Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* LEFT: Video Area - Responsive width for laptop/tablet/desktop */}
            <div className={`flex flex-col overflow-hidden ${
              isTablet ? 'flex-1 min-w-0' : 
              isLaptop ? 'flex-1 min-w-[55%] max-w-[65%]' : 
              'flex-1 min-w-[50%]'
            }`}>
          {/* Video/Audio Call View - Multi-Participant Grid */}
          <div className="flex-1 relative bg-dark-900 min-h-0 overflow-hidden">
            {/* Always show local video, even when alone */}
            {(() => {
              // Determine if AI is speaking or thinking
              // AI is "speaking" when there's an interim transcript (AI is generating)
              // AI is "thinking" when AI notes are being updated
              const isAISpeaking = !!interimTranscript && interimTranscript.trim().length > 0;
              const isAIThinking = !!aiNotes && !isAISpeaking;
              
              // Calculate actual participant count (excluding AI for grid logic)
              const actualParticipantCount = participants.length + 1; // +1 for local user
              const isAlone = actualParticipantCount === 1;
              const isTwoParticipants = actualParticipantCount === 2;

              // Responsive grid configuration
              const getGridConfig = () => {
                const width = window.innerWidth;
                const isDesktop = width >= 1024;
                
                // Special case: 1 participant (alone)
                if (isAlone) {
                  if (width < 640) {
                    // Mobile: centered single tile
                    return {
                      gridCols: '1fr',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-1 justify-items-center',
                      maxWidth: '100%',
                    };
                  } else {
                    // Desktop: centered square tile
                    return {
                      gridCols: '1fr',
                      gridRows: '1fr',
                      containerClass: 'flex justify-center items-center',
                      maxWidth: width >= 1024 ? '600px' : '100%',
                    };
                  }
                }
                
                // Desktop: Optimize grid based on participant count for equal-sized tiles
                if (isDesktop) {
                  if (isTwoParticipants) {
                    // 2 participants: 2 columns, 1 row
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 3) {
                    // 3 participants: 3 columns, 1 row
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-3',
                    };
                  } else if (actualParticipantCount === 4) {
                    // 4 participants: 2x2 grid
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 5 || actualParticipantCount === 6) {
                    // 5-6 participants: 3 columns, 2 rows
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-3',
                    };
                  } else if (actualParticipantCount >= 7 && actualParticipantCount <= 9) {
                    // 7-9 participants: 3x3 grid
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: 'repeat(3, 1fr)',
                      containerClass: 'grid-cols-3',
                    };
                  } else {
                    // 10+ participants: 4 columns, calculate rows needed
                    const rowsNeeded = Math.ceil(actualParticipantCount / 4);
                    return {
                      gridCols: 'repeat(4, 1fr)',
                      gridRows: `repeat(${rowsNeeded}, 1fr)`,
                      containerClass: 'grid-cols-4',
                    };
                  }
                }
                
                // Mobile/Tablet: Optimize grid based on participant count for square tiles
                if (width < 640) {
                  // Mobile: Optimize grid based on participant count for equal-sized square tiles
                  if (isTwoParticipants) {
                    // 2 participants: 2 columns, 1 row
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 3) {
                    // 3 participants: 2 columns, 2 rows
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 4) {
                    // 4 participants: 2x2 grid
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-2',
                    };
                  } else if (actualParticipantCount === 5 || actualParticipantCount === 6) {
                    // 5-6 participants: 2 columns, 3 rows
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(3, 1fr)',
                      containerClass: 'grid-cols-2',
                    };
                  } else {
                    // 7+ participants: Calculate rows needed (2 columns, ceil(participants/2) rows)
                    const rowsNeeded = Math.ceil(actualParticipantCount / 2);
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: `repeat(${rowsNeeded}, 1fr)`,
                      containerClass: 'grid-cols-2',
                    };
                  }
                } else {
                  // Tablet: Similar to mobile but can fit more
                  if (isTwoParticipants) {
                    // 2 participants: 2 columns
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-1 sm:grid-cols-2',
                    };
                  } else if (actualParticipantCount === 3) {
                    // 3 participants: 3 columns, 1 row
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: '1fr',
                      containerClass: 'grid-cols-2 sm:grid-cols-3',
                    };
                  } else if (actualParticipantCount === 4) {
                    // 4 participants: 2x2 grid
                    return {
                      gridCols: 'repeat(2, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-1 sm:grid-cols-2',
                    };
                  } else if (actualParticipantCount >= 5 && actualParticipantCount <= 6) {
                    // 5-6 participants: 3 columns, 2 rows
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: 'repeat(2, 1fr)',
                      containerClass: 'grid-cols-2 sm:grid-cols-3',
                    };
                  } else {
                    // 7+ participants: 3 columns, calculate rows needed
                    const rowsNeeded = Math.ceil(actualParticipantCount / 3);
                    return {
                      gridCols: 'repeat(3, 1fr)',
                      gridRows: `repeat(${rowsNeeded}, 1fr)`,
                      containerClass: 'grid-cols-2 sm:grid-cols-3',
                    };
                  }
                }
              };

              const gridConfig = getGridConfig();
              
              return (
                <div 
                  className={`w-full h-full grid gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 md:p-6 relative ${gridConfig.containerClass}`}
                  style={{
                    display: 'grid', // Explicit grid display
                    gridTemplateColumns: gridConfig.gridCols,
                    gridTemplateRows: gridConfig.gridRows || '1fr',
                    gridAutoRows: '1fr', // Ensure all auto rows are equal height
                    maxWidth: gridConfig.maxWidth || '100%',
                    margin: isAlone && window.innerWidth >= 640 ? '0 auto' : '0',
                    alignItems: 'stretch',
                    justifyItems: 'stretch', // Stretch to fill grid cells
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Remote participants */}
                  {participants.map((participant) => {
                    const participantData = participantStreams.get(participant.socketId);
                    // Use stable key: prefer userId if available, fallback to socketId
                    const stableKey = participant.userId || participant.socketId;
                    return (
                      <VideoParticipant
                        key={stableKey}
                        stream={participantData?.stream || (participants.indexOf(participant) === 0 ? remoteStream : null)}
                        userName={participant.userName}
                        userId={participant.userId}
                        isVideoOff={participantData?.isVideoOff || false}
                        isMuted={participantData?.isMuted || false}
                        className="w-full max-w-full"
                      />
                    );
                  })}
                  
                  {/* Local user (ALWAYS shown) */}
                  <VideoParticipant
                    key={user?._id || 'local-user'}
                    stream={localStream}
                    userName={user?.name || 'You'}
                    userId={user?._id}
                    avatar={user?.avatar}
                    isVideoOff={isVideoOff}
                    isMuted={isMuted}
                    isLocal={true}
                    className="w-full max-w-full"
                  />
                  
                  {/* AI Participant (ALWAYS shown as third participant) */}
                  <AIParticipant
                    key="ai-participant"
                    isSpeaking={isAISpeaking}
                    isThinking={isAIThinking}
                    className="w-full max-w-full"
                  />
                  
                  {/* Waiting message overlay (only when alone with AI) - Moved up significantly to avoid button overlap */}
                  {participants.length === 0 && (
                    <div className="absolute bottom-24 sm:bottom-32 md:bottom-36 left-1/2 transform -translate-x-1/2 bg-dark-900/90 backdrop-blur-lg rounded-full px-4 py-2.5 md:px-6 md:py-3 z-20 max-w-[90%] md:max-w-none">
                      <p className="text-white text-sm md:text-base font-medium whitespace-nowrap">Waiting for others to join...</p>
                      {roomId && (
                        <p className="text-dark-400 text-xs md:text-sm mt-1 text-center truncate">Room: <span className="text-primary-400 font-mono">{roomId}</span></p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Call Controls - Show during active/waiting call on ALL tabs (Desktop) */}
            {/* Show controls when: call is active or waiting, regardless of active tab */}
            {(callStatus === 'active' || callStatus === 'waiting') && (
              <div 
                className={`fixed z-[1001] pointer-events-auto ${
                  // Mobile: Position above bottom nav (60px from bottom), centered
                  isMobile 
                    ? 'bottom-[60px] left-1/2 transform -translate-x-1/2' 
                    // Tablet: Center with margin
                    : isTablet
                    ? 'bottom-6 left-1/2 transform -translate-x-1/2'
                    // Desktop: Center, adjust when side panel open to prevent overlap
                    : activeRightTab !== 'dreamweaving' && (isTablet || isLaptop)
                    ? 'bottom-8 right-[420px] left-auto transform-none'
                    : 'bottom-8 left-1/2 transform -translate-x-1/2'
                }`}
                style={{
                  transition: 'bottom 0.3s ease, right 0.3s ease, left 0.3s ease, transform 0.3s ease',
                  // Ensure controls don't overlap with video tiles
                  maxWidth: 'calc(100vw - 32px)',
                }}
              >
              <CallControls
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                onToggleMute={toggleMute}
                onToggleVideo={toggleVideo}
                onEndCall={handleEndCall}
                onScreenShare={handleScreenShare}
                onAddParticipant={handleAddParticipant}
                onSettings={handleSettings}
                isScreenSharing={isScreenSharing}
              />
            </div>
            )}

          </div>
        </div>

            {/* RIGHT: Side Panel - Responsive width for laptop/tablet/desktop */}
            <div className={`flex flex-col border-l border-dark-800/50 ${
              isTablet ? 'w-80 min-w-[320px]' : 
              isLaptop ? 'w-80 min-w-[320px] max-w-[45%]' : 
              'w-96 min-w-[384px]'
            }`}>
              {/* Tab Bar */}
              <div className="flex border-b border-dark-800/50 glass-card overflow-x-auto scrollbar-hide">
                {(['dreamweaving', 'chat', 'transcript', 'notes'] as RightTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveRightTab(tab)}
                    className={`flex-1 px-3 py-3 text-xs font-medium transition-all relative flex-shrink-0 ${
                      activeRightTab === tab
                        ? tab === 'dreamweaving' 
                          ? 'text-purple-400 bg-purple-500/10 border-b-2 border-purple-500'
                          : tab === 'chat'
                          ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-500'
                          : tab === 'transcript'
                          ? 'text-primary-400 bg-primary-500/10 border-b-2 border-primary-500'
                          : 'text-purple-400 bg-purple-500/10 border-b-2 border-purple-500'
                        : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-1.5">
                      {tab === 'dreamweaving' && (
                      <Sparkles 
                        size={16}
                        className="flex-shrink-0" 
                        style={{ 
                          display: 'inline-block', 
                          width: '16px', 
                          height: '16px', 
                          opacity: 1,
                          visibility: 'visible'
                        }} 
                      />
                      )}
                      {tab === 'chat' && (
                        <div className="relative">
                          <MessageSquare 
                            size={20}
                            className="flex-shrink-0 text-current" 
                            strokeWidth={2.5}
                            style={{ 
                              display: 'block', 
                              width: '20px', 
                              height: '20px', 
                              opacity: 1,
                              visibility: 'visible'
                            }} 
                          />
                          {unreadPrivateMessages.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                          )}
                        </div>
                      )}
                      {tab === 'transcript' && (
                        <FileText 
                          size={20}
                          className="flex-shrink-0 text-current" 
                          strokeWidth={2.5}
                          style={{ 
                            display: 'block', 
                            width: '20px', 
                            height: '20px', 
                            opacity: 1,
                            visibility: 'visible'
                          }} 
                        />
                      )}
                      {tab === 'notes' && (
                        <StickyNote 
                          size={20}
                          className="flex-shrink-0 text-current" 
                          strokeWidth={2.5}
                          style={{ 
                            display: 'block', 
                            width: '20px', 
                            height: '20px', 
                            opacity: 1,
                            visibility: 'visible'
                          }} 
                        />
                      )}
                      <span className="hidden sm:inline capitalize">
                        {tab === 'dreamweaving' ? 'Dream' : tab === 'transcript' ? 'Transcript' : tab}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Private Message Notification Banner - Desktop */}
              {showPrivateMessageBanner && currentBannerMessage && (
                <div className="px-4 pt-2 z-[100] animate-slide-down">
                  <div
                    onClick={() => {
                      setShowPrivateMessageBanner(false);
                      if (bannerTimeoutRef.current) {
                        clearTimeout(bannerTimeoutRef.current);
                      }
                      // Open private chat overlay instead of navigating away
                      // This keeps the call visible and active
                      setPrivateChatData({
                        conversationId: currentBannerMessage.conversationId,
                        targetUserId: currentBannerMessage.senderId,
                        targetUserName: currentBannerMessage.senderName,
                      });
                      setShowPrivateChatOverlay(true);
                      // Clear unread for this conversation
                      setUnreadPrivateMessages(prev =>
                        prev.filter(m => m.conversationId !== currentBannerMessage.conversationId)
                      );
                    }}
                    className="glass-card rounded-xl p-4 border-2 border-primary-500/70 bg-gradient-to-r from-primary-500/30 via-primary-500/20 to-primary-500/10 hover:from-primary-500/40 hover:via-primary-500/30 hover:to-primary-500/20 transition-all cursor-pointer flex items-center justify-between shadow-2xl backdrop-blur-xl animate-fade-in hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4), 0 0 30px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                      animation: 'slideDown 0.3s ease-out, pulse 2s ease-in-out infinite',
                    }}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-primary-500/40 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse ring-2 ring-primary-500/50">
                        <FiMessageSquare size={24} className="text-primary-200" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-base truncate">
                          New private message from {currentBannerMessage.senderName}
                        </p>
                        <p className="text-primary-200 text-xs mt-1 font-medium">Click to view and respond</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPrivateMessageBanner(false);
                        if (bannerTimeoutRef.current) {
                          clearTimeout(bannerTimeoutRef.current);
                        }
                      }}
                      className="ml-3 p-2 hover:bg-dark-800/70 rounded-lg transition flex-shrink-0"
                      aria-label="Dismiss notification"
                    >
                      <FiX size={20} className="text-dark-300 hover:text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden">
                {renderTabContent(activeRightTab)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Participant Name Popup Menu */}
      {participantNameMenu && (
        <>
          <div 
            className="fixed inset-0 z-[99]"
            onClick={() => setParticipantNameMenu(null)}
          />
          <div
            className="fixed z-[100] bg-dark-800 border border-dark-700 rounded-xl shadow-2xl py-2 min-w-[200px] animate-fade-in"
            style={{
              left: `${Math.min(participantNameMenu.x, window.innerWidth - 220)}px`,
              top: `${Math.min(participantNameMenu.y, window.innerHeight - 200)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 border-b border-dark-700/50">
              <p className="text-white font-medium text-sm">{participantNameMenu.userName}</p>
            </div>
            <button
              onClick={handleReplyInPrivate}
              className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-dark-700/50 transition text-left"
            >
              <FiCornerUpLeft size={16} className="text-primary-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              <span className="text-white text-sm">Reply in private</span>
            </button>
          </div>
        </>
      )}

      {/* Long-Press Menu */}
      {longPressMenu && (() => {
        const message = chatMessages.find(m => m._id === longPressMenu.messageId);
        if (!message || message.senderId._id === user?._id) return null;
        
        return (
          <>
            <div 
              className="fixed inset-0 z-[99]"
              onClick={() => setLongPressMenu(null)}
            />
            <div
              className="fixed z-[100] bg-dark-800 border border-dark-700 rounded-xl shadow-2xl py-2 min-w-[200px]"
              style={{
                left: `${Math.min(longPressMenu.x, window.innerWidth - 220)}px`,
                top: `${Math.min(longPressMenu.y, window.innerHeight - 200)}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => handleReplyPrivately(message)}
                className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-dark-700/50 transition text-left"
              >
                <FiCornerUpLeft size={16} className="text-primary-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="text-white text-sm">Reply in Private</span>
              </button>
              <button
                onClick={() => {
                  setNewChatMessage(`@${message.senderId.name} `);
                  setLongPressMenu(null);
                  toast.success('Mention', `Mentioning ${message.senderId.name}`);
                }}
                className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-dark-700/50 transition text-left"
              >
                <FiAtSign size={16} className="text-blue-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="text-white text-sm">Mention</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                  toast.success('Copied', 'Message copied to clipboard');
                  setLongPressMenu(null);
                }}
                className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-dark-700/50 transition text-left"
              >
                <FiCopy size={16} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="text-white text-sm">Copy</span>
              </button>
              <button
                onClick={() => {
                  toast.info('Forward', 'Forward feature coming soon');
                  setLongPressMenu(null);
                }}
                className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-dark-700/50 transition text-left"
              >
                <FiCornerUpRight size={16} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="text-white text-sm">Forward</span>
              </button>
            </div>
          </>
        );
      })()}

      {/* Private Chat Overlay (During Call) */}
      {showPrivateChatOverlay && privateChatData && (
        <PrivateChatOverlay
          conversationId={privateChatData.conversationId}
          targetUserId={privateChatData.targetUserId}
          targetUserName={privateChatData.targetUserName}
          initialContext={privateChatData.initialContext}
          onClose={() => {
            setShowPrivateChatOverlay(false);
            setPrivateChatData(null);
          }}
        />
      )}
      
      {/* Message Indicator Badge - Shows when private chat is active */}
      {showPrivateChatOverlay && (
        <div className="fixed top-16 right-4 z-[90] bg-primary-500 rounded-full p-2 shadow-lg animate-pulse">
          <FiMessageSquare size={16} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
        </div>
      )}

      {/* AI Notes Sidebar */}
      <AINotesSidebar
        aiNotes={aiNotes}
        isOpen={showAINotesSidebar}
        onToggle={() => setShowAINotesSidebar(!showAINotesSidebar)}
        callTitle={`Call ${roomId ? `- ${roomId.substring(0, 8)}` : ''}`}
      />


    </div>
  );
}
