import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FiVideo,
  FiPhone,
  FiClock,
  FiFileText,
  FiUsers,
  FiCalendar,
  FiSearch,
  FiFilter,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiPhoneCall,
  FiTrendingUp,
  FiBarChart2,
} from 'react-icons/fi';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';

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

interface CallHistory {
  _id: string;
  roomId: string;
  hostId: { _id: string; name: string; email: string; avatar?: string };
  guestIds: Array<{ _id: string; name: string; email: string; avatar?: string }>;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  recordingUrl?: string;
  transcriptId?: {
    _id: string;
    segments?: Array<{
      speaker: string;
      text: string;
      timestamp: number;
    }>;
    fullText?: string;
    wordCount?: number;
  };
  notesId?: {
    _id: string;
    summary?: string;
    bullets?: string[];
    actionItems?: Array<{ text: string; assignee?: string }>;
    decisions?: string[];
    keyTopics?: string[];
  };
  metadata?: {
    audioOnly?: boolean;
    participantCount?: number;
  };
  status?: string;
}

type CallType = 'all' | 'video' | 'audio' | 'missed';
type SortOption = 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc';

export default function CallHistoryEnhanced() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState<CallType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (accessToken) {
      fetchHistory();
    }
  }, [accessToken]);

  const fetchHistory = async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await fetch(`${API_URL}/api/users/history?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCalls(data.calls || []);
      }
    } catch (error) {
      console.error('Fetch history error:', error);
      toast.error('Error', 'Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthCalls = calls.filter(call => new Date(call.startedAt) >= thisMonth);
    
    const totalMinutes = Math.floor(calls.reduce((acc, c) => acc + (c.duration || 0), 0) / 60);
    const thisMonthMinutes = Math.floor(thisMonthCalls.reduce((acc, c) => acc + (c.duration || 0), 0) / 60);
    const avgDuration = calls.length > 0 
      ? Math.floor(calls.reduce((acc, c) => acc + (c.duration || 0), 0) / calls.length / 60)
      : 0;

    // Most frequent contacts
    const contactCounts = new Map<string, { name: string; count: number; avatar?: string }>();
    calls.forEach(call => {
      const allParticipants = [call.hostId, ...call.guestIds];
      allParticipants.forEach(p => {
        if (p._id !== user?._id) {
          const existing = contactCounts.get(p._id);
          if (existing) {
            existing.count++;
          } else {
            contactCounts.set(p._id, {
              name: p.name,
              count: 1,
              avatar: p.avatar,
            });
          }
        }
      });
    });
    const mostFrequent = Array.from(contactCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      totalCalls: calls.length,
      thisMonthCalls: thisMonthCalls.length,
      totalMinutes,
      thisMonthMinutes,
      avgDuration,
      mostFrequent,
      videoCalls: calls.filter(c => !c.metadata?.audioOnly).length,
      audioCalls: calls.filter(c => c.metadata?.audioOnly).length,
    };
  }, [calls, user?._id]);

  // Filter and sort calls
  const filteredAndSortedCalls = useMemo(() => {
    let filtered = calls.filter(call => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = call.hostId?.name?.toLowerCase().includes(query) ||
          call.guestIds?.some(g => g.name?.toLowerCase().includes(query));
        const matchesSummary = call.notesId?.summary?.toLowerCase().includes(query);
        const matchesTopics = call.notesId?.keyTopics?.some(t => t.toLowerCase().includes(query));
        const matchesTranscript = call.transcriptId?.fullText?.toLowerCase().includes(query);
        
        if (!matchesName && !matchesSummary && !matchesTopics && !matchesTranscript) {
          return false;
        }
      }

      // Type filter
      if (callTypeFilter === 'video' && call.metadata?.audioOnly) return false;
      if (callTypeFilter === 'audio' && !call.metadata?.audioOnly) return false;
      if (callTypeFilter === 'missed' && call.status !== 'failed') return false;

      // Date filter
      if (dateFrom && new Date(call.startedAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(call.startedAt) > new Date(dateTo)) return false;

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
        case 'date-asc':
          return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
        case 'duration-desc':
          return (b.duration || 0) - (a.duration || 0);
        case 'duration-asc':
          return (a.duration || 0) - (b.duration || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [calls, searchQuery, callTypeFilter, sortBy, dateFrom, dateTo]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getParticipants = (call: CallHistory) => {
    const allParticipants = [call.hostId, ...call.guestIds];
    return allParticipants.filter((p) => p._id !== user?._id);
  };

  const handleCallAgain = async (call: CallHistory) => {
    if (!accessToken) return;
    
    try {
      const participants = getParticipants(call);
      const participantIds = participants.map(p => p._id);
      
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioOnly: call.metadata?.audioOnly || false,
          participants: participantIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/call/${data.roomId}`);
      } else {
        toast.error('Error', 'Failed to start call');
      }
    } catch (error) {
      console.error('Call again error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  const toggleCallExpansion = (callId: string) => {
    setExpandedCalls(prev => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCallTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('date-desc');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 bg-animated flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading call history..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 gradient-text">
                Call History
              </h1>
              <p className="text-dark-400 text-sm">
                {filteredAndSortedCalls.length} of {calls.length} calls
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition flex items-center space-x-2"
              >
                <FiFilter size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="hidden md:inline">Filters</span>
              </button>
              <Link
                to="/home"
                className="px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition flex items-center space-x-2"
              >
                <span className="hidden md:inline">Back</span>
              </Link>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <FiSearch
              size={20}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-dark-400"
              style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search calls, participants, transcripts, or topics..."
              className="w-full pl-12 pr-4 py-3 bg-dark-800/50 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500/50 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-white"
              >
                <FiX size={18} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-dark-400 text-sm">Type:</span>
              <button
                onClick={() => setCallTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  callTypeFilter === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50'
                }`}
              >
                All Calls
              </button>
              <button
                onClick={() => setCallTypeFilter('video')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  callTypeFilter === 'video'
                    ? 'bg-blue-500 text-white'
                    : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50'
                }`}
              >
                <FiVideo size={14} className="inline mr-1" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                Video
              </button>
              <button
                onClick={() => setCallTypeFilter('audio')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  callTypeFilter === 'audio'
                    ? 'bg-green-500 text-white'
                    : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50'
                }`}
              >
                <FiPhone size={14} className="inline mr-1" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                Audio
              </button>
              <button
                onClick={() => setCallTypeFilter('missed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  callTypeFilter === 'missed'
                    ? 'bg-red-500 text-white'
                    : 'bg-dark-800/50 text-dark-400 hover:bg-dark-700/50'
                }`}
              >
                Missed
              </button>
            </div>
            <div className="flex items-center space-x-2 ml-auto">
              <span className="text-dark-400 text-sm">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-xs focus:outline-none focus:border-primary-500/50"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="duration-desc">Longest First</option>
                <option value="duration-asc">Shortest First</option>
              </select>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="glass-card rounded-xl p-4 border border-dark-800/50 mb-4 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">Advanced Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-primary-400 hover:text-primary-300 text-xs"
                >
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-dark-400 text-xs mb-1 block">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
                  />
                </div>
                <div>
                  <label className="text-dark-400 text-xs mb-1 block">Date To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
                  />
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5 border border-primary-500/20 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                <FiPhoneCall size={20} className="text-primary-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              </div>
              <FiTrendingUp size={16} className="text-green-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.thisMonthCalls}</div>
            <div className="text-dark-400 text-xs">Calls This Month</div>
            <div className="text-dark-500 text-xs mt-1">Total: {stats.totalCalls}</div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-purple-500/20 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <FiClock size={20} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              </div>
              <FiBarChart2 size={16} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.thisMonthMinutes}m</div>
            <div className="text-dark-400 text-xs">Minutes This Month</div>
            <div className="text-dark-500 text-xs mt-1">Total: {stats.totalMinutes}m</div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-blue-500/20 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <FiClock size={20} className="text-blue-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.avgDuration}m</div>
            <div className="text-dark-400 text-xs">Avg Call Duration</div>
            <div className="text-dark-500 text-xs mt-1">
              {stats.videoCalls} video, {stats.audioCalls} audio
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 border border-green-500/20 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <FiUsers size={20} className="text-green-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.mostFrequent.length}</div>
            <div className="text-dark-400 text-xs">Top Contacts</div>
            <div className="text-dark-500 text-xs mt-1">
              {stats.mostFrequent[0]?.name || 'None'}
            </div>
          </div>
        </div>

        {/* Most Frequent Contacts */}
        {stats.mostFrequent.length > 0 && (
          <div className="glass-card rounded-xl p-5 mb-8 border border-dark-800/50 animate-fade-in">
            <h2 className="text-white font-semibold text-lg mb-4 flex items-center space-x-2">
              <FiUsers size={20} className="text-primary-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              <span>Most Frequent Contacts</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.mostFrequent.map((contact, idx) => (
                <div
                  key={idx}
                  className="flex items-center space-x-3 p-3 bg-dark-800/30 rounded-lg hover:bg-dark-800/50 transition"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    {contact.avatar ? (
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{contact.name}</p>
                    <p className="text-dark-400 text-xs">{contact.count} calls</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call List */}
        {filteredAndSortedCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FiPhoneCall size={64} className="text-dark-700 mb-4" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
            <h3 className="text-white font-semibold text-xl mb-2">
              {searchQuery || callTypeFilter !== 'all' || dateFrom || dateTo
                ? 'No calls found'
                : 'No calls yet'}
            </h3>
            <p className="text-dark-400 text-sm max-w-md mb-6">
              {searchQuery || callTypeFilter !== 'all' || dateFrom || dateTo
                ? 'Try adjusting your search or filters'
                : 'Your completed calls will appear here'}
            </p>
            {(searchQuery || callTypeFilter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedCalls.map((call) => {
              const participants = getParticipants(call);
              const isExpanded = expandedCalls.has(call._id);
              const callTitle = participants.length > 0
                ? participants.map(p => p.name).join(', ')
                : 'Solo Call';

              return (
                <div
                  key={call._id}
                  className="glass-card rounded-xl p-5 border border-dark-800/50 hover:border-primary-500/50 transition group animate-fade-in"
                >
                  <div className="flex items-start justify-between">
                    {/* Left: Participants & Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start space-x-4">
                        {/* Participant Avatars */}
                        <div className="flex -space-x-2 flex-shrink-0">
                          {participants.slice(0, 3).map((p, idx) => (
                            <div
                              key={p._id}
                              className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center border-2 border-dark-950 overflow-hidden"
                              style={{ zIndex: 10 - idx }}
                            >
                              {p.avatar ? (
                                <img
                                  src={p.avatar}
                                  alt={p.name}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-white font-semibold text-lg">
                                  {p.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          ))}
                          {participants.length > 3 && (
                            <div className="w-12 h-12 bg-dark-800 rounded-full flex items-center justify-center border-2 border-dark-950">
                              <span className="text-white text-xs font-semibold">
                                +{participants.length - 3}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Call Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-lg mb-1 truncate">
                            {callTitle}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-dark-400 text-sm mb-2">
                            <span className="flex items-center space-x-1">
                              <FiCalendar size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                              <span>{formatDate(call.startedAt)}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <FiClock size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                              <span>{formatDuration(call.duration)}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              {call.metadata?.audioOnly ? (
                                <FiPhone size={14} className="text-green-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                              ) : (
                                <FiVideo size={14} className="text-blue-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                              )}
                              <span>{call.metadata?.audioOnly ? 'Audio' : 'Video'}</span>
                            </span>
                          </div>

                          {/* AI Summary */}
                          {call.notesId?.summary && (
                            <p className="text-dark-300 text-sm line-clamp-2 mb-2">
                              {call.notesId.summary}
                            </p>
                          )}

                          {/* Key Topics */}
                          {call.notesId?.keyTopics && call.notesId.keyTopics.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {call.notesId.keyTopics.slice(0, 3).map((topic, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-primary-500/20 text-primary-300 text-xs rounded border border-primary-500/30"
                                >
                                  {topic}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition">
                      <Link
                        to={`/call/${call._id}/summary`}
                        className="px-3 py-1.5 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition flex items-center space-x-1.5 text-sm"
                        title="View Summary"
                      >
                        <FiFileText size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span className="hidden md:inline">Summary</span>
                      </Link>
                      <button
                        onClick={() => handleCallAgain(call)}
                        className="px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 rounded-lg transition flex items-center space-x-1.5 text-sm"
                        title="Call Again"
                      >
                        <FiPhone size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        <span className="hidden md:inline">Call Again</span>
                      </button>
                      <button
                        onClick={() => toggleCallExpansion(call._id)}
                        className="p-1.5 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <FiChevronUp size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        ) : (
                          <FiChevronDown size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-dark-800/50 space-y-4 animate-fade-in">
                      {/* Participants List */}
                      <div>
                        <h4 className="text-dark-400 text-xs font-semibold uppercase tracking-wide mb-3">
                          Participants ({participants.length + 1})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          <div className="flex items-center space-x-2 px-3 py-2 bg-dark-800/50 rounded-lg">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center">
                              {call.hostId.avatar ? (
                                <img
                                  src={call.hostId.avatar}
                                  alt={call.hostId.name}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-white text-xs font-semibold">
                                  {call.hostId.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="text-white text-sm">{call.hostId.name}</span>
                            <span className="text-dark-400 text-xs">(Host)</span>
                          </div>
                          {call.guestIds.map((guest) => (
                            <div
                              key={guest._id}
                              className="flex items-center space-x-2 px-3 py-2 bg-dark-800/50 rounded-lg"
                            >
                              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center">
                                {guest.avatar ? (
                                  <img
                                    src={guest.avatar}
                                    alt={guest.name}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-white text-xs font-semibold">
                                    {guest.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className="text-white text-sm">{guest.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Items */}
                      {call.notesId?.actionItems && call.notesId.actionItems.length > 0 && (
                        <div>
                          <h4 className="text-dark-400 text-xs font-semibold uppercase tracking-wide mb-2">
                            Action Items
                          </h4>
                          <div className="space-y-2">
                            {call.notesId.actionItems.map((item, idx) => (
                              <div key={idx} className="flex items-start space-x-2 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-white text-sm">{item.text}</p>
                                  {item.assignee && (
                                    <p className="text-green-400 text-xs mt-1">@{item.assignee}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Decisions */}
                      {call.notesId?.decisions && call.notesId.decisions.length > 0 && (
                        <div>
                          <h4 className="text-dark-400 text-xs font-semibold uppercase tracking-wide mb-2">
                            Decisions Made
                          </h4>
                          <div className="space-y-2">
                            {call.notesId.decisions.map((decision, idx) => (
                              <div key={idx} className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <p className="text-white text-sm">
                                  {typeof decision === 'string' ? decision : decision}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Call Metadata */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <p className="text-dark-400 text-xs mb-1">Started</p>
                          <p className="text-white text-sm">
                            {new Date(call.startedAt).toLocaleString()}
                          </p>
                        </div>
                        {call.endedAt && (
                          <div>
                            <p className="text-dark-400 text-xs mb-1">Ended</p>
                            <p className="text-white text-sm">
                              {new Date(call.endedAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

