import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, User, MessageSquare, FileText, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface SearchResult {
  type: 'contact' | 'message' | 'transcript';
  id: string;
  title: string;
  subtitle: string;
  preview: string;
  metadata?: any;
  highlightedText?: string;
}

interface SearchResponse {
  contacts: Array<{
    _id: string;
    contact: { _id: string; name: string; email: string; avatar?: string };
    lastMessage?: { content: string; timestamp: string };
  }>;
  messages: Array<{
    _id: string;
    content: string;
    senderId: { _id: string; name: string; avatar?: string };
    conversationId: { _id: string; type: string };
    createdAt: string;
  }>;
  transcripts: Array<{
    _id: string;
    callId: { _id: string; roomId: string; createdAt: string };
    segments: Array<{ speaker: string; text: string; timestamp: number }>;
    matchedSegment?: { speaker: string; text: string; timestamp: number };
  }>;
}

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.PROD) return window.location.origin;
  return 'http://localhost:3001';
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'contacts' | 'messages' | 'transcripts'>('all');
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recent-searches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load recent searches:', e);
      }
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !accessToken) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const API_URL = getApiUrl();
        const response = await fetch(
          `${API_URL}/api/search?q=${encodeURIComponent(query)}&filter=${activeFilter}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (response.ok) {
          const data: SearchResponse = await response.json();
          const formattedResults = formatResults(data, query);
          setResults(formattedResults);

          // Save to recent searches
          if (query.trim()) {
            setRecentSearches((prev) => {
              const updated = [query, ...prev.filter(s => s !== query)].slice(0, 10);
              localStorage.setItem('recent-searches', JSON.stringify(updated));
              return updated;
            });
          }
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, accessToken, activeFilter]);

  const formatResults = (data: SearchResponse, searchQuery: string): SearchResult[] => {
    const results: SearchResult[] = [];
    const queryLower = searchQuery.toLowerCase();

    // Contacts
    if (activeFilter === 'all' || activeFilter === 'contacts') {
      data.contacts?.forEach((contact) => {
        results.push({
          type: 'contact',
          id: contact._id,
          title: contact.contact.name,
          subtitle: contact.contact.email,
          preview: contact.lastMessage?.content || 'No recent messages',
          metadata: { contactId: contact.contact._id, conversationId: contact._id },
          highlightedText: highlightText(contact.contact.name, queryLower),
        });
      });
    }

    // Messages
    if (activeFilter === 'all' || activeFilter === 'messages') {
      data.messages?.forEach((message) => {
        results.push({
          type: 'message',
          id: message._id,
          title: message.senderId.name,
          subtitle: formatDate(message.createdAt),
          preview: message.content,
          metadata: { conversationId: message.conversationId._id, messageId: message._id },
          highlightedText: highlightText(message.content, queryLower),
        });
      });
    }

    // Transcripts
    if (activeFilter === 'all' || activeFilter === 'transcripts') {
      data.transcripts?.forEach((transcript) => {
        const matchedSegment = transcript.matchedSegment || transcript.segments[0];
        results.push({
          type: 'transcript',
          id: transcript._id,
          title: `Call Transcript`,
          subtitle: formatDate(transcript.callId.createdAt),
          preview: `${matchedSegment.speaker}: ${matchedSegment.text}`,
          metadata: { callId: transcript.callId._id, transcriptId: transcript._id },
          highlightedText: highlightText(matchedSegment.text, queryLower),
        });
      });
    }

    return results;
  };

  const highlightText = (text: string, query: string): string => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');

    switch (result.type) {
      case 'contact':
        navigate(`/contacts/${result.metadata.contactId}/chat`);
        break;
      case 'message':
        navigate(`/friends/chat/${result.metadata.conversationId}`);
        break;
      case 'transcript':
        navigate(`/call-detail/${result.metadata.callId}`);
        break;
    }
  };

  const handleRecentSearch = (searchTerm: string) => {
    setQuery(searchTerm);
    inputRef.current?.focus();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent-searches');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'contact':
        return <User className="w-4 h-4" />;
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'transcript':
        return <FileText className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'contact':
        return 'Contact';
      case 'message':
        return 'Message';
      case 'transcript':
        return 'Transcript';
      default:
        return '';
    }
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Button/Input */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-4 py-2 glass-card rounded-lg 
                   border border-dark-700/50 text-dark-300 hover:text-white 
                   transition-all duration-200 min-w-[200px] md:min-w-[300px]"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm hidden md:inline">Search contacts, messages...</span>
        <span className="text-sm md:hidden">Search</span>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150]"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl mx-4 z-[151]">
            <div className="glass-card rounded-2xl border border-dark-700/50 shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="p-4 border-b border-dark-800/50">
                <div className="flex items-center space-x-3">
                  <Search className="w-5 h-5 text-dark-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search contacts, messages, call transcripts..."
                    className="flex-1 bg-transparent text-white placeholder-dark-500 
                             focus:outline-none text-sm"
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('');
                        setResults([]);
                        inputRef.current?.focus();
                      }}
                      className="p-1 hover:bg-dark-800/50 rounded transition"
                    >
                      <X className="w-4 h-4 text-dark-400" />
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex items-center space-x-2 mt-3">
                  {(['all', 'contacts', 'messages', 'transcripts'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                        activeFilter === filter
                          ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                          : 'bg-dark-800/30 text-dark-400 hover:text-white'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                  </div>
                ) : query.trim() ? (
                  results.length > 0 ? (
                    <div className="divide-y divide-dark-800/50">
                      {results.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className="w-full text-left p-4 hover:bg-dark-800/30 transition"
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              {getIcon(result.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-white font-medium text-sm truncate">
                                  {result.title}
                                </span>
                                <span className="text-xs text-dark-500 bg-dark-800/50 px-2 py-0.5 rounded">
                                  {getTypeLabel(result.type)}
                                </span>
                              </div>
                              <p className="text-dark-400 text-xs mb-1">{result.subtitle}</p>
                              <p
                                className="text-dark-300 text-sm line-clamp-2"
                                dangerouslySetInnerHTML={{
                                  __html: result.highlightedText || result.preview,
                                }}
                              />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                      <Search className="w-12 h-12 text-dark-700 mb-3" />
                      <p className="text-dark-400 text-sm text-center">
                        No results found for &quot;{query}&quot;
                      </p>
                    </div>
                  )
                ) : (
                  recentSearches.length > 0 && (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-dark-400" />
                          <span className="text-dark-400 text-xs font-medium">Recent Searches</span>
                        </div>
                        <button
                          onClick={clearRecentSearches}
                          className="text-dark-500 hover:text-dark-300 text-xs transition"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((search, index) => (
                          <button
                            key={index}
                            onClick={() => handleRecentSearch(search)}
                            className="w-full text-left px-3 py-2 hover:bg-dark-800/30 rounded-lg transition text-sm text-dark-300 hover:text-white"
                          >
                            {search}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

