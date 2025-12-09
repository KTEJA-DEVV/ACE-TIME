import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  Send,
  X,
  Video,
  Phone,
  ArrowLeft,
  Paperclip,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useCallStore } from '../store/call';
import { toast } from './Toast';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();
const SOCKET_URL = getSocketUrl();

interface Message {
  _id: string;
  senderId: { _id: string; name: string; avatar?: string };
  content: string;
  type: 'text' | 'image' | 'system';
  createdAt: string;
  attachments?: Array<{ type: string; url: string; name?: string }>;
}

interface PrivateChatOverlayProps {
  conversationId: string;
  targetUserId: string;
  targetUserName: string;
  onClose: () => void;
  initialContext?: string;
}

// Helper to format duration
const formatCallDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function PrivateChatOverlay({
  conversationId,
  targetUserId, // Kept for interface consistency, may be used in future
  targetUserName,
  onClose,
  initialContext,
}: PrivateChatOverlayProps) {
  // Suppress unused variable warning - targetUserId is part of the interface
  void targetUserId;
  const { accessToken, user } = useAuthStore();
  const callStore = useCallStore();
  const { callStatus, callStartTime } = callStore;
  
  // Calculate call duration
  const [callDuration, setCallDuration] = useState(0);
  
  useEffect(() => {
    if (callStatus === 'active' && callStartTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        setCallDuration(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCallDuration(0);
    }
  }, [callStatus, callStartTime]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState(initialContext || '');
  const [sending, setSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ y: 0, startY: 0 });
  const [overlayHeight, setOverlayHeight] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);


  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch messages
  useEffect(() => {
    if (!accessToken || !conversationId) return;
    
    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/messages/conversations/${conversationId}/messages`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Fetch messages error:', error);
      }
    };

    fetchMessages();
  }, [accessToken, conversationId]);

  // Initialize Socket.IO
  useEffect(() => {
    if (!accessToken || !user) return;

    const socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
        userName: user.name,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('conversation:join', conversationId);
    });

    const handleNewMessage = (data: { message: any }) => {
      if (data.message.conversationId?.toString() === conversationId) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === data.message._id);
          if (exists) return prev;
          return [...prev, {
            _id: data.message._id,
            senderId: data.message.senderId,
            content: data.message.content,
            type: data.message.type || 'text',
            createdAt: data.message.createdAt,
            attachments: data.message.attachments,
          }];
        });
      }
    };

    socket.on('message:new', handleNewMessage);
    socketRef.current = socket;

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.emit('conversation:leave', conversationId);
      socket.disconnect();
    };
  }, [accessToken, user, conversationId]);

  // Handle swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ y: e.touches[0].clientY, startY: overlayHeight });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragStart.y;
    const newHeight = Math.max(0, Math.min(window.innerHeight * 0.9, dragStart.startY + deltaY));
    
    if (overlayRef.current) {
      overlayRef.current.style.height = `${newHeight}px`;
      overlayRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    const currentHeight = overlayRef.current?.offsetHeight || 0;
    const threshold = window.innerHeight * 0.3;
    
    if (currentHeight < threshold || (overlayRef.current && overlayRef.current.style.transform.includes('translateY'))) {
      // Close if dragged down significantly
      const transform = overlayRef.current?.style.transform || '';
      const translateY = parseInt(transform.match(/translateY\(([-\d]+)px\)/)?.[1] || '0');
      if (translateY > 100) {
        onClose();
        return;
      }
    }
    
    // Reset transform
    if (overlayRef.current) {
      overlayRef.current.style.transform = '';
      overlayRef.current.style.height = '';
    }
  };

  // Set initial height on mount
  useEffect(() => {
    if (overlayRef.current) {
      const height = window.innerWidth < 768 
        ? window.innerHeight * 0.7 
        : window.innerHeight * 0.8;
      setOverlayHeight(height);
      overlayRef.current.style.height = `${height}px`;
    }
  }, []);

  const sendMessage = async () => {
    if (!accessToken || !conversationId || !newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Upload files if any
      let attachments: string[] = [];
      if (selectedFiles.length > 0) {
        setUploading(true);
        attachments = await uploadFiles();
        setSelectedFiles([]);
        setUploading(false);
      }

      const response = await fetch(
        `${API_URL}/api/messages/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: messageContent || '📎',
            attachments: attachments.length > 0 ? attachments.map(url => ({
              type: 'file',
              url,
            })) : undefined,
          }),
        }
      );

      if (!response.ok) {
        setNewMessage(messageContent);
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Error', 'Failed to send message');
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const uploadFiles = async (): Promise<string[]> => {
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

  const handleStartCall = async (video: boolean = true) => {
    if (!accessToken) return;
    
    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioOnly: !video }),
      });

      if (response.ok) {
        const data = await response.json();
        // Close overlay and navigate to call
        onClose();
        window.location.href = `/call/${data.roomId}`;
      }
    } catch (error) {
      console.error('Start call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  const isMobile = window.innerWidth < 768;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Overlay Panel */}
      <div
        ref={overlayRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed ${
          isMobile 
            ? 'bottom-0 left-0 right-0 rounded-t-3xl' 
            : 'right-4 top-1/2 -translate-y-1/2 w-96 rounded-2xl'
        } bg-dark-950 border-2 border-dark-800/50 shadow-2xl z-[101] flex flex-col glass-card transition-all duration-300`}
        style={{
          maxHeight: isMobile ? '90vh' : '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Call Preview */}
        <div className="flex-shrink-0 border-b border-dark-800/50 p-4 bg-gradient-to-r from-dark-900 to-dark-800">
          {/* Call Status Bar (if call is active) */}
          {callStatus === 'active' && (
            <div className="flex items-center justify-between mb-3 px-3 py-2 bg-dark-800/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">
                  Call Active • {formatCallDuration(callDuration)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-dark-700/50 rounded transition"
              >
                <X className="w-4 h-4 text-dark-400" />
              </button>
            </div>
          )}
          
          {/* Chat Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <button
                onClick={onClose}
                className="p-2 hover:bg-dark-800/50 rounded-lg transition flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold">
                  {targetUserName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">
                  {targetUserName}
                </h3>
                <p className="text-dark-400 text-xs">Private chat</p>
              </div>
            </div>
            
            {/* Call Buttons */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={() => handleStartCall(false)}
                className="p-2 bg-dark-800/50 hover:bg-primary-500/20 rounded-lg transition"
                title="Audio call"
              >
                <Phone className="w-4 h-4 text-dark-400" />
              </button>
              <button
                onClick={() => handleStartCall(true)}
                className="p-2 bg-dark-800/50 hover:bg-primary-500/20 rounded-lg transition"
                title="Video call"
              >
                <Video className="w-4 h-4 text-dark-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <MessageSquare className="w-12 h-12 text-dark-600 mb-3" />
              <p className="text-dark-400 text-sm">No messages yet</p>
              {initialContext && (
                <p className="text-dark-500 text-xs mt-2">Start the conversation...</p>
              )}
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.senderId._id === user?._id;
              return (
                <div
                  key={message._id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-primary-500/20 text-white border border-primary-500/30'
                        : 'bg-dark-800/50 text-white border border-dark-700/50'
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-xs text-dark-400 mb-1">
                        {message.senderId.name}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((att, idx) => (
                          <div key={idx} className="text-xs text-dark-400">
                            📎 {att.name || 'Attachment'}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-dark-500 mt-1">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-dark-800/50 p-4 bg-dark-900/50">
          <div className="flex items-end space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  setSelectedFiles(Array.from(e.target.files));
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-dark-800/50 rounded-lg transition flex-shrink-0"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 text-dark-400 animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5 text-dark-400" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="w-full bg-dark-800/50 border border-dark-700/50 rounded-xl px-4 py-2.5 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 resize-none max-h-32 overflow-y-auto"
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || uploading}
              className="p-2 bg-primary-500 hover:bg-primary-600 disabled:bg-dark-800 disabled:opacity-50 rounded-lg transition flex-shrink-0"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

