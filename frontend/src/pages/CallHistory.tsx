import { useEffect, useState } from 'react';
import {
  Video,
  Clock,
  FileText,
  Users,
  Calendar,
  Search,
  Sparkles,
  Play,
  Filter,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import TranscriptViewer from '../components/TranscriptViewer';
import { toast } from '../components/Toast';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';

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
      speakerId?: string;
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
}

export default function CallHistory() {
  const { accessToken, user } = useAuthStore();
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCall, setSelectedCall] = useState<CallHistory | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    contactId: '',
    dateFrom: '',
    dateTo: '',
    minDuration: '',
    maxDuration: '',
  });

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
      if (searchQuery) params.append('search', searchQuery);
      if (filters.contactId) params.append('contactId', filters.contactId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.minDuration) params.append('minDuration', filters.minDuration);
      if (filters.maxDuration) params.append('maxDuration', filters.maxDuration);

      const response = await fetch(`${API_URL}/api/users/history?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCalls(data.calls || []);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to fetch call history';
        setError(errorMessage);
        toast.error('Error', errorMessage);
      }
    } catch (error) {
      console.error('Fetch history error:', error);
      const errorMessage = 'Failed to fetch call history';
      setError(errorMessage);
      toast.error('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchHistory();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, filters]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
    const allParticipants = [call.hostId, ...(call.guestIds || [])];
    return allParticipants.filter((p) => p._id !== user?._id);
  };

  const toggleCallExpansion = (callId: string) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  };

  const handleViewTranscript = (call: CallHistory) => {
    setSelectedCall(call);
    setShowTranscript(true);
  };

  const handlePlayRecording = (call: CallHistory) => {
    if (!call.recordingUrl) {
      toast.error('No Recording', 'Recording not available for this call');
      return;
    }

    // Open recording in new tab or play in audio/video element
    window.open(`${API_URL}${call.recordingUrl}`, '_blank');
  };

  const clearFilters = () => {
    setFilters({
      contactId: '',
      dateFrom: '',
      dateTo: '',
      minDuration: '',
      maxDuration: '',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 pb-16 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="space-y-4 mb-6">
            <Skeleton variant="text" width="200px" height={32} />
            <Skeleton variant="text" width="300px" height={16} />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 pb-16 md:pb-0">
        <ErrorState
          title="Failed to load call history"
          message={error}
          onRetry={fetchHistory}
          showHomeButton={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-dark-900 border-b border-dark-800/50 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-white font-semibold text-xl">Call History</h1>
            <p className="text-dark-400 text-sm">{calls.length} calls</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 rounded-lg hover:bg-dark-800/50 transition"
            title="Toggle filters"
          >
            <Filter className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            placeholder="Search calls, transcripts, participants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 transition"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="glass-card rounded-xl p-4 border border-dark-800/50 mb-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-dark-400 text-xs mb-1 block">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
                />
              </div>
              <div>
                <label className="text-dark-400 text-xs mb-1 block">Date To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
                />
              </div>
              <div>
                <label className="text-dark-400 text-xs mb-1 block">Min Duration (seconds)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.minDuration}
                  onChange={(e) => setFilters({ ...filters, minDuration: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
                />
              </div>
              <div>
                <label className="text-dark-400 text-xs mb-1 block">Max Duration (seconds)</label>
                <input
                  type="number"
                  placeholder="∞"
                  value={filters.maxDuration}
                  onChange={(e) => setFilters({ ...filters, maxDuration: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-white text-sm transition"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Call List */}
      <div className="px-4 py-6 space-y-4">
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Video className="w-16 h-16 text-dark-700 mb-4" />
            <h3 className="text-white font-medium text-lg mb-2">No calls found</h3>
            <p className="text-dark-400 text-sm text-center max-w-md">
              {searchQuery || Object.values(filters).some((f) => f)
                ? 'Try adjusting your search or filters'
                : 'Your call history will appear here'}
            </p>
          </div>
        ) : (
          calls.map((call) => {
            const participants = getParticipants(call);
            const isExpanded = expandedCalls.has(call._id);
            const hasTranscript = !!call.transcriptId;
            const hasRecording = !!call.recordingUrl;

            return (
              <div
                key={call._id}
                className="glass-card rounded-xl p-5 border border-dark-800/50 hover:border-primary-500/30 transition animate-fade-in"
              >
                {/* Call Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {call.metadata?.audioOnly ? (
                        <Phone className="w-5 h-5 text-primary-400" />
                      ) : (
                        <Video className="w-5 h-5 text-primary-400" />
                      )}
                      <div>
                        <h3 className="text-white font-semibold text-base">
                          {participants.length > 0
                            ? participants.map((p) => p.name).join(', ')
                            : 'Solo Call'}
                        </h3>
                        <div className="flex items-center space-x-3 text-dark-400 text-xs mt-1">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(call.startedAt)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(call.duration)}</span>
                          </span>
                          {participants.length > 0 && (
                            <span className="flex items-center space-x-1">
                              <Users className="w-3 h-3" />
                              <span>{participants.length + 1} participants</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Summary */}
                    {call.notesId?.summary && (
                      <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span className="text-purple-400 text-xs font-semibold">AI Summary</span>
                        </div>
                        <p className="text-white text-sm leading-relaxed line-clamp-2">
                          {call.notesId.summary}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    {hasRecording && (
                      <button
                        onClick={() => handlePlayRecording(call)}
                        className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                        title="Play recording"
                      >
                        <Play className="w-4 h-4 text-primary-400" />
                      </button>
                    )}
                    {hasTranscript && (
                      <button
                        onClick={() => handleViewTranscript(call)}
                        className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                        title="View transcript"
                      >
                        <FileText className="w-4 h-4 text-primary-400" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleCallExpansion(call._id)}
                      className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-dark-800/50 space-y-4 animate-fade-in">
                    {/* Participants */}
                    <div>
                      <h4 className="text-dark-400 text-xs font-semibold uppercase tracking-wide mb-2">
                        Participants
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-dark-800/50 rounded-lg">
                          {call.hostId.avatar ? (
                            <img
                              src={call.hostId.avatar}
                              alt={call.hostId.name}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                              <User className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <span className="text-white text-sm">{call.hostId.name}</span>
                          <span className="text-dark-400 text-xs">(Host)</span>
                        </div>
                        {call.guestIds.map((guest) => (
                          <div
                            key={guest._id}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-dark-800/50 rounded-lg"
                          >
                            {guest.avatar ? (
                              <img
                                src={guest.avatar}
                                alt={guest.name}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                                <User className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <span className="text-white text-sm">{guest.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Topics */}
                    {call.notesId?.keyTopics && call.notesId.keyTopics.length > 0 && (
                      <div>
                        <h4 className="text-dark-400 text-xs font-semibold uppercase tracking-wide mb-2">
                          Key Topics
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {call.notesId.keyTopics.map((topic, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-primary-500/20 text-primary-300 text-xs rounded-lg border border-primary-500/30"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items */}
                    {call.notesId?.actionItems && call.notesId.actionItems.length > 0 && (
                      <div>
                        <h4 className="text-dark-400 text-xs font-semibold uppercase tracking-wide mb-2">
                          Action Items
                        </h4>
                        <ul className="space-y-2">
                          {call.notesId.actionItems.map((item, idx) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-white text-sm">{item.text}</p>
                                {item.assignee && (
                                  <p className="text-green-400 text-xs mt-1">Assigned to: {item.assignee}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Call Details */}
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
          })
        )}
      </div>

      {/* Transcript Viewer Modal */}
      {selectedCall && (
        <TranscriptViewer
          transcript={selectedCall.transcriptId || null}
          isOpen={showTranscript}
          onClose={() => {
            setShowTranscript(false);
            setSelectedCall(null);
          }}
          callTitle={`Call - ${formatDate(selectedCall.startedAt)}`}
        />
      )}
    </div>
  );
}

// Add missing import
import { Phone } from 'lucide-react';

