import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  MessageSquare,
  Clock,
  Users,
  FileText,
  Play,
  Pause,
  Wand2,
  Search,
  Sparkles,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: number;
}

interface CallDetail {
  _id: string;
  roomId: string;
  hostId: { name: string; email: string; avatar?: string };
  guestIds: Array<{ name: string; email: string; avatar?: string }>;
  startedAt: string;
  endedAt: string;
  duration: number;
  recordingUrl?: string;
  transcriptId?: {
    segments: TranscriptSegment[];
    fullText: string;
    wordCount: number;
  };
  notesId?: {
    summary: string;
    bullets: string[];
    keyTopics: string[];
    actionItems: Array<{ text: string; assignee?: string }>;
    decisions: string[];
    suggestedReplies: string[];
  };
}

interface GeneratedImage {
  _id: string;
  prompt: string;
  imageUrl: string;
  style: string;
  createdAt: string;
}

export default function CallDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !accessToken) return;
    fetchCallDetail();
    fetchImages();
  }, [id, accessToken]);

  const fetchCallDetail = async () => {
    if (!accessToken || !id) return;

    try {
      const response = await fetch(`${API_URL}/api/calls/${id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCall(data.call);
      } else if (response.status === 404) {
        setError('Call not found');
      } else {
        setError('Failed to load call details');
      }
    } catch (err) {
      console.error('Fetch call detail error:', err);
      setError('Failed to load call details');
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    if (!accessToken || !id) return;
    try {
      const response = await fetch(`${API_URL}/api/images/call/${id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
      }
    } catch (error) {
      console.error('Fetch images error:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = timestamp % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const downloadTranscript = () => {
    if (!call?.transcriptId) return;
    
    const transcriptText = call.transcriptId.segments
      .map(seg => `[${formatTimestamp(seg.timestamp)}] ${seg.speaker}: ${seg.text}`)
      .join('\n\n');
    
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-transcript-${call.roomId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSegments = call?.transcriptId?.segments.filter(seg =>
    searchQuery ? seg.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  seg.speaker.toLowerCase().includes(searchQuery.toLowerCase()) : true
  ) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 bg-animated flex items-center justify-center">
        <div className="text-dark-400">Loading call details...</div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="min-h-screen bg-dark-950 bg-animated flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error || 'Call not found'}</div>
          <button
            onClick={() => navigate('/history')}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  // Remove duplicate participants based on email
  const allParticipants = [call.hostId, ...call.guestIds];
  const uniqueParticipants = allParticipants.filter((participant, index, self) =>
    index === self.findIndex((p) => p.email === participant.email)
  );

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/history"
            className="inline-flex items-center space-x-2 text-dark-400 hover:text-white mb-4 transition glass-card-hover px-3 py-2 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to History</span>
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 gradient-text">Call Details</h1>
              <div className="flex items-center space-x-4 text-dark-400 text-sm">
                <div className="flex items-center space-x-1 glass-card px-3 py-1.5 rounded-lg">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(call.duration)}</span>
                </div>
                <div className="flex items-center space-x-1 glass-card px-3 py-1.5 rounded-lg">
                  <Users className="w-4 h-4" />
                  <span>{uniqueParticipants.length} {uniqueParticipants.length === 1 ? 'participant' : 'participants'}</span>
                </div>
                <div className="glass-card px-3 py-1.5 rounded-lg">
                  {new Date(call.startedAt).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {call.recordingUrl && (
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center space-x-2 px-4 py-2 glass-card-hover rounded-lg transition"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white" />
                  )}
                  <span className="text-white">Play Recording</span>
                </button>
              )}
              {call.transcriptId && (
                <button
                  onClick={downloadTranscript}
                  className="flex items-center space-x-2 px-4 py-2 glass-card-hover rounded-lg transition"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span className="text-white">Download Transcript</span>
                </button>
              )}
              <button
                onClick={async () => {
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
                      navigate('/messages');
                    }
                  } catch (error) {
                    console.error('Create conversation error:', error);
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Continue in Chat</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recording Player */}
            {call.recordingUrl && (
              <div className="glass-card rounded-xl p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <Play className="w-5 h-5" />
                    <span>Recording</span>
                  </h2>
                  <a
                    href={`${API_URL}${call.recordingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 text-sm flex items-center space-x-1"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Video</span>
                  </a>
                </div>
                <video
                  src={`${API_URL}${call.recordingUrl}`}
                  controls
                  className="w-full rounded-lg"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {/* Transcript with Search */}
            <div className="glass-card rounded-xl p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Transcript</span>
                </h2>
                {call.transcriptId && (
                  <span className="text-dark-400 text-sm">
                    {call.transcriptId.wordCount} words
                  </span>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transcript..."
                  className="w-full pl-10 pr-4 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 glass-card"
                />
              </div>

              {call.transcriptId && filteredSegments.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredSegments.map((segment, idx) => {
                    const isHost = segment.speaker === call.hostId.name;
                    return (
                      <div
                        key={idx}
                        className="glass-card-hover rounded-lg p-4 animate-slide-in border-l-2 border-primary-500/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                              isHost ? 'bg-primary-500/30' : 'bg-blue-500/30'
                            }`}>
                              <span className={`font-semibold text-xs ${
                                isHost ? 'text-primary-400' : 'text-blue-400'
                              }`}>
                                {segment.speaker.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className={`font-semibold text-sm ${
                              isHost ? 'text-primary-400' : 'text-blue-400'
                            }`}>
                              {segment.speaker}
                            </span>
                          </div>
                          <span className="text-dark-500 text-xs">
                            {formatTimestamp(segment.timestamp)}
                          </span>
                        </div>
                        <p className="text-dark-200 text-sm leading-relaxed pl-9">{segment.text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-dark-400">
                  {searchQuery ? 'No results found' : 'No transcript available for this call'}
                </div>
              )}
            </div>

            {/* Dreamweaving Images Gallery */}
            {images.length > 0 && (
              <div className="glass-card rounded-xl p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <Wand2 className="w-5 h-5" />
                    <span>Dreamweaving Images</span>
                  </h2>
                  <span className="text-dark-400 text-sm">{images.length} {images.length === 1 ? 'image' : 'images'}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((img) => (
                    <div
                      key={img._id}
                      className="glass-card-hover rounded-lg overflow-hidden cursor-pointer animate-scale-in group"
                      onClick={() => setSelectedImage(img.imageUrl)}
                    >
                      <div className="aspect-square relative">
                        <img
                          src={img.imageUrl}
                          alt={img.prompt}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent opacity-0 group-hover:opacity-100 transition">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white text-xs truncate">{img.prompt}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* AI Notes */}
            {call.notesId && (
              <div className="glass-card rounded-xl p-6 animate-fade-in">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
                  <Sparkles className="w-5 h-5" />
                  <span>AI Notes</span>
                </h2>

                {call.notesId.summary && (
                  <div className="mb-6 glass-card border border-purple-500/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-purple-300 mb-2 uppercase tracking-wide flex items-center space-x-2">
                      <Sparkles className="w-3 h-3" />
                      <span>Summary</span>
                    </h3>
                    <p className="text-white text-sm leading-relaxed">{call.notesId.summary}</p>
                  </div>
                )}

                {call.notesId.keyTopics && call.notesId.keyTopics.length > 0 && (
                  <div className="mb-6 glass-card rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-dark-300 mb-3 uppercase tracking-wide">Key Topics</h3>
                    <div className="flex flex-wrap gap-2">
                      {call.notesId.keyTopics.map((topic, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-primary-500/20 text-primary-300 text-xs rounded-lg border border-primary-500/30"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {call.notesId.actionItems && call.notesId.actionItems.length > 0 && (
                  <div className="mb-6 glass-card border border-green-500/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-green-300 mb-3 uppercase tracking-wide">Action Items</h3>
                    <ul className="space-y-2">
                      {call.notesId.actionItems.map((item, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <div className="w-4 h-4 border-2 border-green-400 rounded mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <span className="text-white text-sm">{item.text}</span>
                            {item.assignee && (
                              <div className="mt-0.5">
                                <span className="text-green-400 text-xs">→ {item.assignee}</span>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {call.notesId.decisions && call.notesId.decisions.length > 0 && (
                  <div className="mb-6 glass-card border border-blue-500/20 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-300 mb-3 uppercase tracking-wide">Decisions</h3>
                    <ul className="space-y-2">
                      {call.notesId.decisions.map((decision, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                          <span className="text-white text-sm">{decision}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {call.notesId.suggestedReplies && call.notesId.suggestedReplies.length > 0 && (
                  <div className="glass-card rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-dark-300 mb-3 uppercase tracking-wide">Suggested Replies</h3>
                    <div className="space-y-2">
                      {call.notesId.suggestedReplies.map((reply, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left glass-card-hover rounded-lg p-3 border border-primary-500/30 transition"
                          onClick={() => {
                            navigator.clipboard.writeText(reply);
                          }}
                        >
                          <p className="text-primary-300 text-sm">{reply}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Participants */}
            <div className="glass-card rounded-xl p-6 animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Participants</span>
              </h2>
              <div className="space-y-3">
                {uniqueParticipants.map((participant, idx) => (
                  <div key={`${participant.email}-${idx}`} className="flex items-center space-x-3 glass-card-hover p-3 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-primary-500/30 flex items-center justify-center text-primary-400 font-semibold border border-primary-500/50">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-medium">{participant.name}</div>
                      <div className="text-dark-400 text-xs">{participant.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-dark-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] glass-card rounded-xl overflow-hidden">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-dark-800/80 hover:bg-dark-700 rounded-full flex items-center justify-center transition"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <img
              src={selectedImage}
              alt="Generated image"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
