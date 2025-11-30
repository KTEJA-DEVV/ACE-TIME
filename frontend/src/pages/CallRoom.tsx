import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  Users,
  Wand2,
  Loader2,
  X,
  Send,
  Image as ImageIcon,
  Paperclip,
  Clock,
  Smile,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useCallStore } from '../store/call';
import { toast } from '../components/Toast';

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

type RightTab = 'dreamweaving' | 'chat' | 'transcript';

export default function CallRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  
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
    speechRecognition,
    callId,
    joinRoom,
    leaveRoom,
    endCall,
    toggleMute,
    toggleVideo,
    initSocket,
  } = callStore;

  const [callDuration, setCallDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('transcript');
  
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
  
  // Chat tab state
  const [chatMessages, setChatMessages] = useState<Array<{
    _id: string;
    senderId: { _id: string; name: string };
    content: string;
    attachments?: Array<{ type: string; url: string; name: string }>;
    reactions?: Array<{ emoji: string; userId: string }>;
    createdAt: string;
  }>>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [callConversationId, setCallConversationId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and join room
  useEffect(() => {
    if (roomId && accessToken && user) {
      console.log('[CALLROOM] Initializing socket and joining room:', roomId);
      initSocket(accessToken, user.name);
      joinRoom(roomId, accessToken).catch((err) => {
        console.error('Failed to join room:', err);
        navigate('/home');
      });
    }

    return () => {
      const isUnmounting = !roomId || !accessToken || !user;
      if (isUnmounting) {
        console.log('[CALLROOM] Component unmounting, cleaning up...');
        leaveRoom();
      }
    };
  }, [roomId, accessToken, user]);
  
  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current && transcript.length > 0) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

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

  // Set up video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('[VIDEO] Setting local video stream');
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((error) => {
        console.error('[VIDEO] Error playing local video:', error);
      });
    } else if (localVideoRef.current && !localStream) {
      localVideoRef.current.srcObject = null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[VIDEO] Setting remote video stream');
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((error) => {
        console.error('[VIDEO] Error playing remote video:', error);
      });
    } else if (remoteVideoRef.current && !remoteStream) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'active') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

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

    const handleImageGenerated = (data: { image: any; creator?: string }) => {
      console.log('[DREAMWEAVING] Image generated:', data);
      if (data.image) {
        setGeneratedImages(prev => {
          // Check if image already exists
          const exists = prev.some(img => img._id === data.image._id);
          if (exists) return prev;
          return [data.image, ...prev];
        });
        if (data.creator && data.creator !== user?.name) {
          toast.success('New Image', `${data.creator} generated an image!`);
        }
      }
    };

    socket.on('image:generated', handleImageGenerated);

    return () => {
      socket.off('image:generated', handleImageGenerated);
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
    endCall();
    navigate('/home');
  };

  const generateImage = async () => {
    if (!accessToken || !imagePrompt.trim()) {
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
          prompt: imagePrompt,
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

  const handleChatMessageLongPress = (message: typeof chatMessages[0]) => {
    if (message.senderId._id === user?._id) return;
    
    if (confirm(`Create a private conversation with ${message.senderId.name}?`)) {
      createPrivateBreakoutFromCall(message);
    }
  };

  const createPrivateBreakoutFromCall = async (message: typeof chatMessages[0]) => {
    if (!accessToken || !callConversationId) return;

    try {
      const response = await fetch(
        `${API_URL}/api/messages/conversations/${callConversationId}/breakout`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUserId: message.senderId._id,
            originalMessageId: message._id,
          }),
        }
      );

      if (response.ok) {
        await response.json();
        toast.success('Private Chat', `Created private conversation with ${message.senderId.name}`);
      }
    } catch (error) {
      console.error('Create breakout error:', error);
      toast.error('Error', 'Failed to create private conversation');
    }
  };

  const handleChatMouseDown = (message: typeof chatMessages[0]) => {
    if (message.senderId._id === user?._id) return;

    const timer = setTimeout(() => {
      handleChatMessageLongPress(message);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleChatMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const sendChatMessage = async () => {
    if (!accessToken || (!newChatMessage.trim() && selectedFiles.length === 0) || !callConversationId) return;

    const messageContent = newChatMessage.trim();
    
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

  return (
    <div className="h-screen bg-dark-950 flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="glass-card border-b border-dark-800/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {isRecording && (
            <div className="flex items-center space-x-2 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-sm font-medium">REC</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-dark-400" />
            <span className="text-white font-mono text-lg">{formatDuration(callDuration)}</span>
          </div>
          <div className="flex items-center space-x-2 bg-dark-800/50 px-3 py-1.5 rounded-lg">
            <Users className="w-4 h-4 text-dark-400" />
            <span className="text-white text-sm">{participants.length + 1}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCopyCode}
            className="glass-card-hover px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-dark-400" />
            )}
            <span className="text-white font-mono text-sm">{roomId}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area - Left + Right Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDE - Call Area Only */}
        <div className="flex-1 flex flex-col border-r border-dark-800/50 overflow-hidden">
          {/* Video/Audio Call View */}
          <div className="flex-1 relative bg-dark-900 min-h-0">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                className="w-full h-full object-cover"
                onLoadedMetadata={() => {
                  console.log('[VIDEO] Remote video metadata loaded');
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play().catch((error) => {
                      console.error('[VIDEO] Error playing remote video after metadata:', error);
                    });
                  }
                }}
                onPlay={() => console.log('[VIDEO] Remote video playing')}
                onError={(e) => console.error('[VIDEO] Remote video error:', e)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {callStatus === 'waiting' ? (
                  <div className="text-center">
                    <div className="w-24 h-24 bg-dark-800/50 rounded-full flex items-center justify-center mx-auto mb-4 glass-card">
                      <Users className="w-12 h-12 text-dark-500" />
                    </div>
                    <p className="text-white text-xl font-medium mb-2">Waiting for others to join...</p>
                    <p className="text-dark-400">Share the code: <span className="text-primary-400 font-mono">{roomId}</span></p>
                  </div>
                ) : (
                  <div className="text-dark-400">Connecting...</div>
                )}
              </div>
            )}

            {/* Local Video (PIP) */}
            {localStream && !isVideoOff && (
              <div className="absolute top-4 right-4 w-48 aspect-video bg-dark-800 rounded-xl overflow-hidden shadow-xl border-2 border-dark-700 glass-card">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                  onLoadedMetadata={() => {
                    console.log('[VIDEO] Local video metadata loaded');
                    if (localVideoRef.current) {
                      localVideoRef.current.play().catch((error) => {
                        console.error('[VIDEO] Error playing local video after metadata:', error);
                      });
                    }
                  }}
                  onPlay={() => console.log('[VIDEO] Local video playing')}
                  onError={(e) => console.error('[VIDEO] Local video error:', e)}
                />
              </div>
            )}

            {/* Call Controls - Overlaid at bottom of video */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center space-x-4 z-30">
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-xl glass-card ${
                  isMuted 
                    ? 'bg-red-500/90 hover:bg-red-600 shadow-red-500/50' 
                    : 'bg-dark-800/90 hover:bg-dark-700 border border-dark-700/50'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <MicOff className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>
              <button
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-xl glass-card ${
                  isVideoOff 
                    ? 'bg-red-500/90 hover:bg-red-600 shadow-red-500/50' 
                    : 'bg-dark-800/90 hover:bg-dark-700 border border-dark-700/50'
                }`}
                title={isVideoOff ? 'Turn on video' : 'Turn off video'}
              >
                {isVideoOff ? (
                  <VideoOff className="w-6 h-6 text-white" />
                ) : (
                  <Video className="w-6 h-6 text-white" />
                )}
              </button>
              <button
                onClick={handleEndCall}
                className="w-16 h-14 bg-red-500/90 hover:bg-red-600 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-xl shadow-red-500/50 glass-card"
                title="End call"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - Gmail-style Tabs */}
        <div className="w-96 flex flex-col border-l border-dark-800/50">
          {/* Tab Bar */}
          <div className="flex border-b border-dark-800/50 glass-card">
            <button
              onClick={() => setActiveRightTab('dreamweaving')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                activeRightTab === 'dreamweaving'
                  ? 'text-purple-400 bg-purple-500/10 border-b-2 border-purple-500'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Wand2 className="w-4 h-4" />
                <span>Dreamweaving</span>
              </div>
            </button>
            <button
              onClick={() => setActiveRightTab('chat')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                activeRightTab === 'chat'
                  ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-500'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </div>
            </button>
            <button
              onClick={() => setActiveRightTab('transcript')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                activeRightTab === 'transcript'
                  ? 'text-primary-400 bg-primary-500/10 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800/50'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span>Live Transcript</span>
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {/* TAB 1: AI Dreamweaving */}
            {activeRightTab === 'dreamweaving' && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-dark-800/50">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-dark-400 mb-1.5 block">Describe your vision</label>
                      <textarea
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        placeholder="Describe what you want to see..."
                        className="w-full px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-purple-500/50 glass-card"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 mb-1.5 block">Style</label>
                      <select
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                        className="w-full px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/50 glass-card"
                      >
                        <option value="realistic">Realistic</option>
                        <option value="artistic">Artistic</option>
                        <option value="sketch">Sketch</option>
                        <option value="dream">Dream</option>
                        <option value="abstract">Abstract</option>
                      </select>
                    </div>
                    <button
                      onClick={generateImage}
                      disabled={!imagePrompt.trim() || isGeneratingImage}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating...</span>
                        </>) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          <span>Generate Image</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {generatedImages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                      <div>
                        <Wand2 className="w-12 h-12 text-dark-700 mx-auto mb-2" />
                        <p className="text-dark-500 text-sm">Generated images will appear here</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {generatedImages.map((img) => (
                        <div
                          key={img._id}
                          className="glass-card-hover rounded-lg overflow-hidden cursor-pointer animate-scale-in"
                          onClick={() => window.open(img.imageUrl, '_blank')}
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.prompt}
                            className="w-full h-32 object-cover"
                          />
                          <div className="p-2">
                            <p className="text-dark-300 text-xs truncate">{img.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Chat */}
            {activeRightTab === 'chat' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                      <div>
                        <MessageSquare className="w-12 h-12 text-dark-700 mx-auto mb-2" />
                        <p className="text-dark-500 text-sm">Chat messages will appear here</p>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg._id}
                        className={`flex ${msg.senderId._id === user?._id ? 'justify-end' : 'justify-start'} animate-fade-in`}
                        onMouseDown={() => handleChatMouseDown(msg)}
                        onMouseUp={handleChatMouseUp}
                        onMouseLeave={handleChatMouseUp}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          handleChatMouseDown(msg);
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
                            <div className="text-primary-400 text-xs mb-1">{msg.senderId.name}</div>
                          )}
                          <p className="text-white text-sm">{msg.content}</p>
                          
                          {/* Attachments */}
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
                                      <Paperclip className="w-4 h-4" />
                                      <span className="text-sm">{att.name}</span>
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Reactions */}
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
                          
                          {/* Reaction button */}
                          <div className="mt-2 flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowReactionPicker(showReactionPicker === msg._id ? null : msg._id);
                              }}
                              className="text-dark-400 hover:text-dark-300 transition"
                              title="Add reaction"
                            >
                              <Smile className="w-4 h-4" />
                            </button>
                            
                            {/* Reaction picker */}
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
                    ))
                  )}
                </div>
                <div className="p-4 border-t border-dark-800/50">
                  {selectedFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center space-x-2 bg-dark-800 rounded-lg p-2">
                          {file.type.startsWith('image/') ? (
                            <ImageIcon className="w-4 h-4 text-primary-400" />
                          ) : (
                            <Paperclip className="w-4 h-4 text-primary-400" />
                          )}
                          <span className="text-sm text-dark-300 truncate max-w-[150px]">{file.name}</span>
                          <button
                            onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                            className="text-dark-500 hover:text-dark-300"
                          >
                            <X className="w-3 h-3" />
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
                      <Paperclip className="w-4 h-4 text-dark-400" />
                    </button>
                    <input
                      type="text"
                      value={newChatMessage}
                      onChange={(e) => setNewChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !uploading && sendChatMessage()}
                      placeholder="Type a message..."
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
                        <Send className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

                {/* TAB 3: Live Transcription */}
                {activeRightTab === 'transcript' && (
                  <div className="h-full flex flex-col">
                    <div className="px-4 py-3 border-b border-dark-800/50 flex items-center justify-between glass-card">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 bg-primary-500/20 rounded-lg flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-primary-400" />
                        </div>
                        <span className="text-white font-semibold text-sm">Live Transcript</span>
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
                    {!speechRecognition && !isMuted && callStatus === 'active' && (
                      <div className="mx-4 mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 text-xs">
                          ⚠️ Speech recognition not active. Both users need recognition enabled to see each other's transcripts.
                        </p>
                      </div>
                    )}
                {/* Top Half: Transcript */}
                <div 
                  className="h-1/2 overflow-y-auto p-4 space-y-2 border-b border-dark-800/50"
                  data-transcript-container
                >
                  {transcript.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                      <div>
                        <MessageSquare className="w-12 h-12 text-dark-700 mx-auto mb-2" />
                        <p className="text-dark-500 text-sm">Transcript will appear here as you speak...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {transcript.map((segment, index) => {
                        const isCurrentUser = segment.speaker === user?.name || segment.speaker === 'You';
                        return (
                          <div 
                            key={index}
                            className="animate-fade-in glass-card-hover rounded-lg p-3"
                          >
                            <div className="flex items-center space-x-2 mb-1.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                isCurrentUser ? 'bg-primary-500/30' : 'bg-blue-500/30'
                              }`}>
                                <span className={`font-semibold text-xs ${
                                  isCurrentUser ? 'text-primary-400' : 'text-blue-400'
                                }`}>
                                  {segment.speaker.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className={`font-semibold text-xs ${
                                isCurrentUser ? 'text-primary-400' : 'text-blue-400'
                              }`}>
                                {segment.speaker}
                              </span>
                              <span className="text-dark-500 text-xs">
                                {new Date(segment.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-dark-200 text-sm leading-relaxed pl-8">{segment.text}</p>
                          </div>
                        );
                      })}
                      {interimTranscript && (
                        <div className="rounded-lg p-3 opacity-60">
                          <div className="flex items-center space-x-2 mb-1.5">
                            <div className="w-6 h-6 bg-primary-500/10 rounded-full flex items-center justify-center">
                              <span className="text-primary-400/60 font-semibold text-xs">
                                {user?.name?.charAt(0).toUpperCase() || 'Y'}
                              </span>
                            </div>
                            <span className="text-primary-400/60 font-semibold text-xs">
                              {user?.name || 'You'}
                            </span>
                            <span className="text-dark-600 text-xs italic">(speaking...)</span>
                          </div>
                          <p className="text-dark-400 text-sm leading-relaxed pl-8 italic">{interimTranscript}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                {/* Bottom Half: AI Notes */}
                <div className="h-1/2 overflow-y-auto p-4 border-t border-dark-800/50">
                    <div className="flex items-center space-x-2 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-white font-semibold text-sm">AI Meeting Notes</span>
                    </div>
                    {aiNotes ? (
                      <div className="space-y-4">
                        {aiNotes.summary && (
                          <div className="glass-card rounded-lg p-3 border border-purple-500/20">
                            <h4 className="text-xs font-semibold text-purple-300 mb-2 uppercase tracking-wide flex items-center space-x-1">
                              <Sparkles className="w-3 h-3" />
                              <span>Summary</span>
                            </h4>
                            <p className="text-white text-sm leading-relaxed">{aiNotes.summary}</p>
                          </div>
                        )}
                        {aiNotes.actionItems && aiNotes.actionItems.length > 0 && (
                          <div className="glass-card rounded-lg p-3 border border-green-500/20">
                            <h4 className="text-xs font-semibold text-green-300 mb-2 uppercase tracking-wide">Action Items</h4>
                            <ul className="space-y-1.5">
                              {aiNotes.actionItems.map((item, idx) => (
                                <li key={idx} className="text-white text-sm flex items-start space-x-2">
                                  <span className="text-green-400 mt-1">•</span>
                                  <span>{item.text}{item.assignee && ` (${item.assignee})`}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {aiNotes.keyTopics && aiNotes.keyTopics.length > 0 && (
                          <div className="glass-card rounded-lg p-3">
                            <h4 className="text-xs font-semibold text-dark-300 mb-2 uppercase tracking-wide">Key Topics</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {aiNotes.keyTopics.map((topic, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-primary-500/20 text-primary-300 text-xs rounded border border-primary-500/30"
                                >
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Sparkles className="w-8 h-8 text-dark-700 mx-auto mb-2" />
                        <p className="text-dark-500 text-sm">AI notes will appear here as the conversation progresses...</p>
                      </div>
                    )}
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
