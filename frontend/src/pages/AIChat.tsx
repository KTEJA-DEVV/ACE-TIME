import { useEffect, useState, useRef } from 'react';
import { Send, Sparkles, Bot } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import AIMessageBubble from '../components/AIMessageBubble';
import HumanMessageBubble from '../components/HumanMessageBubble';
import AITypingIndicator from '../components/AITypingIndicator';
import { toast } from '../components/Toast';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

interface Message {
  _id: string;
  content: string;
  type: 'text' | 'ai_response';
  aiGenerated: boolean;
  createdAt: string;
  senderId: string;
}

export default function AIChat() {
  const { accessToken, user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch conversation and messages
  useEffect(() => {
    if (accessToken) {
      fetchConversation();
    }
  }, [accessToken]);

  const fetchConversation = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/ai-chat/conversation`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversationId(data.conversation._id);
        setMessages(data.messages || []);
      } else {
        console.error('Failed to fetch conversation');
      }
    } catch (error) {
      console.error('Fetch conversation error:', error);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current && !isLoading) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isLoading]);

  // Send message with streaming
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !accessToken) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingContent('');

    // Add user message to UI immediately
    const userMessage: Message = {
      _id: `temp-${Date.now()}`,
      content: messageContent,
      type: 'text',
      aiGenerated: false,
      createdAt: new Date().toISOString(),
      senderId: user?._id || '',
    };
    setMessages((prev) => [...prev, userMessage]);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_URL}/api/ai-chat/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageContent,
          conversationId: conversationId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let aiMessageId: string | null = null;

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
              
              if (data.type === 'chunk') {
                setStreamingContent((prev) => prev + data.content);
              } else if (data.type === 'done') {
                aiMessageId = data.messageId;
                setIsStreaming(false);
                
                // Replace streaming content with final message
                setMessages((prev) => {
                  const updated = [...prev];
                  const streamingIndex = updated.findIndex((m) => m._id === streamingMessageId);
                  
                  if (streamingIndex !== -1) {
                    updated[streamingIndex] = {
                      _id: aiMessageId || streamingMessageId || `ai-${Date.now()}`,
                      content: streamingContent + data.content || streamingContent,
                      type: 'ai_response',
                      aiGenerated: true,
                      createdAt: new Date().toISOString(),
                      senderId: user?._id || '',
                    };
                  } else {
                    // Add new AI message
                    updated.push({
                      _id: aiMessageId || `ai-${Date.now()}`,
                      content: streamingContent,
                      type: 'ai_response',
                      aiGenerated: true,
                      createdAt: new Date().toISOString(),
                      senderId: user?._id || '',
                    });
                  }
                  return updated;
                });
                
                setStreamingContent('');
                setStreamingMessageId(null);
              } else if (data.type === 'error') {
                throw new Error(data.error || 'AI response error');
              }
            } catch (parseError) {
              console.error('Parse error:', parseError);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Send message error:', error);
        toast.error('Error', error.message || 'Failed to send message');
        
        // Remove user message on error
        setMessages((prev) => prev.filter((m) => m._id !== userMessage._id));
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  // Update streaming message in real-time
  useEffect(() => {
    if (isStreaming && streamingContent && !streamingMessageId) {
      // Create placeholder AI message
      const placeholderId = `streaming-${Date.now()}`;
      setStreamingMessageId(placeholderId);
      setMessages((prev) => [
        ...prev,
        {
          _id: placeholderId,
          content: '',
          type: 'ai_response',
          aiGenerated: true,
          createdAt: new Date().toISOString(),
          senderId: user?._id || '',
        },
      ]);
    } else if (isStreaming && streamingContent && streamingMessageId) {
      // Update streaming message
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === streamingMessageId
            ? { ...msg, content: streamingContent }
            : msg
        )
      );
    }
  }, [streamingContent, isStreaming, streamingMessageId, user?._id]);

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50 px-4 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">Chat with AI</h1>
            <p className="text-dark-400 text-xs">Powered by AceTime AI</p>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-dark-950 bg-[url('data:image/svg+xml,%3Csvg%20width=%22100%22%20height=%22100%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cdefs%3E%3Cpattern%20id=%22grid%22%20width=%22100%22%20height=%22100%22%20patternUnits=%22userSpaceOnUse%22%3E%3Cpath%20d=%22M%20100%200%20L%200%200%200%20100%22%20fill=%22none%22%20stroke=%22%231a1a2e%22%20stroke-width=%221%22/%3E%3C/pattern%3E%3C/defs%3E%3Crect%20width=%22100%22%20height=%22100%22%20fill=%22url(%23grid)%22/%3E%3C/svg%3E')] bg-opacity-30">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full flex items-center justify-center mb-6 shadow-xl">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-white font-semibold text-xl mb-2">Start a conversation with AI</h2>
            <p className="text-dark-400 text-sm text-center max-w-md">
              Ask me anything! I can help with questions, provide insights from your recent calls, or just chat.
            </p>
            <div className="mt-6 space-y-2">
              <button
                onClick={() => setInputMessage("What can you help me with?")}
                className="px-4 py-2 bg-dark-800/50 hover:bg-dark-800 rounded-lg text-white text-sm transition"
              >
                What can you help me with?
              </button>
              <button
                onClick={() => setInputMessage("Summarize my recent calls")}
                className="px-4 py-2 bg-dark-800/50 hover:bg-dark-800 rounded-lg text-white text-sm transition block w-full"
              >
                Summarize my recent calls
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message._id}>
                {message.aiGenerated ? (
                  <AIMessageBubble
                    content={message.content}
                    isStreaming={message._id === streamingMessageId && isStreaming}
                  />
                ) : (
                  <HumanMessageBubble
                    content={message.content}
                    avatar={user?.avatar}
                    userName={user?.name}
                  />
                )}
              </div>
            ))}

            {/* Streaming indicator */}
            {isStreaming && streamingContent && streamingMessageId && (
              <AIMessageBubble
                content={streamingContent}
                isStreaming={true}
              />
            )}

            {/* Typing indicator */}
            {isLoading && !isStreaming && <AITypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-dark-900 border-t border-dark-800/50 p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message..."
              disabled={isLoading}
              className="w-full px-4 py-3 bg-dark-800/50 border border-dark-700 rounded-full text-white text-sm placeholder-dark-500 focus:outline-none focus:border-purple-500/50 transition disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="p-3 bg-gradient-to-br from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[48px] shadow-lg"
            title="Send message"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

