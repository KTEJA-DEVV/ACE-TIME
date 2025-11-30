import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Video,
  Clock,
  FileText,
  Users,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Search,
  MessageSquare,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface CallHistory {
  _id: string;
  roomId: string;
  hostId: { name: string; email: string };
  guestIds: Array<{ name: string; email: string }>;
  startedAt: string;
  endedAt: string;
  duration: number;
  transcriptId?: { fullText: string; wordCount: number };
  notesId?: { summary: string; keyTopics: string[] };
}

export default function History() {
  const { accessToken } = useAuthStore();
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [accessToken]);

  const fetchHistory = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/users/history`, {
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
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredCalls = calls.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      call.notesId?.summary?.toLowerCase().includes(query) ||
      call.notesId?.keyTopics?.some(t => t.toLowerCase().includes(query)) ||
      call.hostId?.name?.toLowerCase().includes(query) ||
      call.guestIds?.some(g => g.name?.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
      {/* Header */}
      <header className="border-b border-dark-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link
              to="/home"
              className="flex items-center space-x-2 text-dark-400 hover:text-white transition mr-6"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary-500" />
              <h1 className="text-xl font-semibold text-white">Call History</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search calls, topics, or participants..."
            className="w-full pl-12 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 transition"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass-card glass-card-hover rounded-xl p-5 animate-scale-in">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{calls.length}</div>
                <div className="text-dark-400 text-sm">Total Calls</div>
              </div>
            </div>
          </div>
          <div className="glass-card glass-card-hover rounded-xl p-5 animate-scale-in">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {Math.floor(calls.reduce((acc, c) => acc + (c.duration || 0), 0) / 60)}m
                </div>
                <div className="text-dark-400 text-sm">Total Duration</div>
              </div>
            </div>
          </div>
          <div className="glass-card glass-card-hover rounded-xl p-5 animate-scale-in">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {calls.filter(c => c.transcriptId).length}
                </div>
                <div className="text-dark-400 text-sm">Transcripts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Call List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="w-16 h-16 text-dark-700 mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">No calls yet</h3>
            <p className="text-dark-400 mb-6">Your completed calls will appear here</p>
            <Link
              to="/home"
              className="inline-flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl transition"
            >
              <Video className="w-5 h-5" />
              <span>Start a Call</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCalls.map((call) => {
              const participants = [call.hostId, ...call.guestIds].filter(Boolean);
              
              return (
                <div
                  key={call._id}
                  className="glass-card glass-card-hover rounded-xl p-5 border border-dark-800/50 hover:border-primary-500/50 transition group animate-fade-in"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-dark-500" />
                          <span className="text-white font-medium">
                            {participants.map(p => p?.name).filter(Boolean).join(', ') || 'Unknown'}
                          </span>
                        </div>
                        <span className="text-dark-600">•</span>
                        <div className="flex items-center space-x-1 text-dark-400 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(call.startedAt)}</span>
                        </div>
                        <span className="text-dark-600">•</span>
                        <div className="flex items-center space-x-1 text-dark-400 text-sm">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(call.duration)}</span>
                        </div>
                      </div>

                      {call.notesId?.summary && (
                        <p className="text-dark-300 mb-3 line-clamp-2">
                          {call.notesId.summary}
                        </p>
                      )}

                      {call.notesId?.keyTopics && call.notesId.keyTopics.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <div className="flex flex-wrap gap-2">
                            {call.notesId.keyTopics.slice(0, 3).map((topic, index) => (
                              <span
                                key={index}
                                className="bg-primary-500/20 text-primary-300 px-2 py-0.5 rounded text-sm"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition">
                      <Link
                        to={`/history/${call._id}`}
                        className="flex items-center space-x-1 px-3 py-1.5 glass-card-hover text-white rounded-lg transition text-sm"
                        title="View full details"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileText className="w-4 h-4" />
                        <span>Details</span>
                      </Link>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!accessToken) return;
                          try {
                            const response = await fetch(`${API_URL}/api/messages/conversations/from-call`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ callId: call._id }),
                            });
                            if (response.ok) {
                              window.location.href = '/messages';
                            }
                          } catch (error) {
                            console.error('Create conversation error:', error);
                          }
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg transition text-sm"
                        title="Continue conversation in Messages"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Continue</span>
                      </button>
                    </div>
                  </div>

                  {call.transcriptId && (
                    <div className="flex items-center mt-3 pt-3 border-t border-dark-800/50 text-dark-400 text-sm">
                      <FileText className="w-4 h-4 mr-1" />
                      <span>{call.transcriptId.wordCount} words transcribed</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

