import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiDownload,
  FiShare2,
  FiCopy,
  FiClock,
  FiUsers,
  FiFileText,
  FiSearch,
  FiX,
  FiChevronLeft,
  FiImage,
  FiCheckCircle,
  FiMessageSquare,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { FaMagic } from 'react-icons/fa';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';

// Use relative URL in production (when served from backend), absolute URL in development
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

interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: number;
}

interface ActionItem {
  text: string;
  assignee?: string;
  completed?: boolean;
  dueDate?: Date;
  priority?: 'high' | 'medium' | 'low';
}

interface Decision {
  decision: string;
  context?: string;
  timestamp?: string;
}

interface ComprehensiveNotes {
  _id: string;
  callId: string;
  title: string;
  date: Date;
  duration: number;
  participants: string[];
  summary: string;
  sections?: Array<{
    topic: string;
    timestamp: string;
    notes: string[];
    relatedTranscript: string;
  }>;
  actionItems: ActionItem[];
  decisions: Decision[];
  keyPoints: string[];
  questionsRaised: string[];
  nextSteps: string[];
  suggestedFollowUp?: Date;
}

interface GeneratedImage {
  _id: string;
  prompt: string;
  imageUrl: string;
  style: string;
  createdAt: string;
}

interface CallInfo {
  _id: string;
  roomId: string;
  hostId: { name: string; email: string; avatar?: string };
  guestIds: Array<{ name: string; email: string; avatar?: string }>;
  startedAt: string;
  endedAt: string;
  duration: number;
}

export default function CallSummary() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [notes, setNotes] = useState<ComprehensiveNotes | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (callId && accessToken) {
      fetchAllData();
    }
  }, [callId, accessToken]);

  const fetchAllData = async () => {
    if (!callId || !accessToken) return;
    
    setLoading(true);
    try {
      // Fetch call info, notes, transcript, and images in parallel
      const [callRes, notesRes, transcriptRes, imagesRes] = await Promise.all([
        fetch(`${API_URL}/api/calls/${callId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch(`${API_URL}/api/calls/${callId}/notes`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch(`${API_URL}/api/calls/${callId}/transcript`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch(`${API_URL}/api/images/call/${callId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
      ]);

      if (callRes.ok) {
        const callData = await callRes.json();
        setCallInfo(callData.call);
      }

      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData.notes);
      }

      if (transcriptRes.ok) {
        const transcriptData = await transcriptRes.json();
        if (transcriptData.transcript?.segments) {
          setTranscript(transcriptData.transcript.segments);
        }
      }

      if (imagesRes.ok) {
        const imagesData = await imagesRes.json();
        setImages(imagesData.images || []);
      }
    } catch (error) {
      console.error('Error fetching call summary:', error);
      toast.error('Error', 'Failed to load call summary');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = timestamp % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const exportToPDF = async () => {
    toast.info('Export', 'PDF export coming soon');
    // TODO: Implement PDF export
  };

  const exportToMarkdown = () => {
    if (!notes || !transcript) return;
    
    let markdown = `# ${notes.title || 'Call Summary'}\n\n`;
    markdown += `**Date:** ${new Date(notes.date).toLocaleDateString()}\n`;
    markdown += `**Duration:** ${formatDuration(notes.duration)}\n`;
    markdown += `**Participants:** ${notes.participants.join(', ')}\n\n`;
    
    markdown += `## Summary\n\n${notes.summary}\n\n`;
    
    if (notes.actionItems.length > 0) {
      markdown += `## Action Items\n\n`;
      notes.actionItems.forEach(item => {
        markdown += `- [ ] ${item.text}`;
        if (item.assignee) markdown += ` (@${item.assignee})`;
        if (item.dueDate) markdown += ` - Due: ${new Date(item.dueDate).toLocaleDateString()}`;
        markdown += '\n';
      });
      markdown += '\n';
    }
    
    if (notes.decisions.length > 0) {
      markdown += `## Decisions Made\n\n`;
      notes.decisions.forEach(decision => {
        markdown += `- ${typeof decision === 'string' ? decision : decision.decision}\n`;
      });
      markdown += '\n';
    }
    
    if (notes.nextSteps.length > 0) {
      markdown += `## Next Steps\n\n`;
      notes.nextSteps.forEach(step => {
        markdown += `- ${step}\n`;
      });
      markdown += '\n';
    }
    
    if (showTranscript && transcript.length > 0) {
      markdown += `## Full Transcript\n\n`;
      transcript.forEach(seg => {
        markdown += `**[${formatTimestamp(seg.timestamp)}] ${seg.speaker}:** ${seg.text}\n\n`;
      });
    }
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-summary-${callId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported', 'Markdown file downloaded');
  };

  const exportToJSON = () => {
    if (!notes || !callInfo) return;
    
    const exportData = {
      callId,
      callInfo,
      notes,
      transcript: showTranscript ? transcript : [],
      images,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-summary-${callId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported', 'JSON file downloaded');
  };

  const copySummary = () => {
    if (!notes) return;
    
    let summaryText = `${notes.title || 'Call Summary'}\n\n`;
    summaryText += `Date: ${new Date(notes.date).toLocaleDateString()}\n`;
    summaryText += `Duration: ${formatDuration(notes.duration)}\n`;
    summaryText += `Participants: ${notes.participants.join(', ')}\n\n`;
    summaryText += `Summary:\n${notes.summary}\n\n`;
    
    if (notes.actionItems.length > 0) {
      summaryText += `Action Items:\n`;
      notes.actionItems.forEach(item => {
        summaryText += `- ${item.text}${item.assignee ? ` (@${item.assignee})` : ''}\n`;
      });
      summaryText += '\n';
    }
    
    navigator.clipboard.writeText(summaryText);
    toast.success('Copied', 'Summary copied to clipboard');
  };

  const emailToParticipants = () => {
    if (!notes || !callInfo) return;
    
    const subject = encodeURIComponent(notes.title || 'Call Summary');
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the summary of our call below:\n\n${notes.summary}\n\nView full details: ${window.location.href}`
    );
    const email = callInfo.guestIds.map(g => g.email).join(',');
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  // Get unique speakers for filter
  const speakers = Array.from(new Set(transcript.map(seg => seg.speaker)));

  // Filter transcript based on search and speaker
  const filteredTranscript = transcript.filter(seg => {
    const matchesSearch = !searchQuery || 
      seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seg.speaker.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpeaker = !selectedSpeaker || seg.speaker === selectedSpeaker;
    return matchesSearch && matchesSpeaker;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 bg-animated flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading call summary..." />
      </div>
    );
  }

  if (!notes && !callInfo) {
    return (
      <div className="min-h-screen bg-dark-950 bg-animated flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Call summary not found</p>
          <button
            onClick={() => navigate('/history')}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const allParticipants = callInfo ? [callInfo.hostId, ...callInfo.guestIds] : [];
  const uniqueParticipants = allParticipants.filter((p, i, self) => 
    i === self.findIndex(participant => participant.email === p.email)
  );

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center space-x-2 text-dark-400 hover:text-white mb-4 transition glass-card-hover px-3 py-2 rounded-lg"
          >
            <FiChevronLeft size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
            <span>Back</span>
          </button>

          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 gradient-text">
                {notes?.title || callInfo?.roomId || 'Call Summary'}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-dark-400 text-sm">
                <div className="flex items-center space-x-2 glass-card px-3 py-1.5 rounded-lg">
                  <FiCalendar size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  <span>{notes?.date ? new Date(notes.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : callInfo?.startedAt ? new Date(callInfo.startedAt).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex items-center space-x-2 glass-card px-3 py-1.5 rounded-lg">
                  <FiClock size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  <span>{formatDuration(notes?.duration || callInfo?.duration || 0)}</span>
                </div>
                <div className="flex items-center space-x-2 glass-card px-3 py-1.5 rounded-lg">
                  <FiUsers size={14} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  <span>{notes?.participants?.length || uniqueParticipants.length} participant{(notes?.participants?.length || uniqueParticipants.length) !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <button
                onClick={exportToPDF}
                className="flex items-center space-x-2 px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition glass-card"
                title="Export PDF"
              >
                <FiDownload size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="hidden md:inline">PDF</span>
              </button>
              <button
                onClick={exportToMarkdown}
                className="flex items-center space-x-2 px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition glass-card"
                title="Export Markdown"
              >
                <FiDownload size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="hidden md:inline">MD</span>
              </button>
              <button
                onClick={exportToJSON}
                className="flex items-center space-x-2 px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition glass-card"
                title="Export JSON"
              >
                <FiDownload size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="hidden md:inline">JSON</span>
              </button>
              <button
                onClick={copySummary}
                className="flex items-center space-x-2 px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition glass-card"
                title="Copy Summary"
              >
                <FiCopy size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="hidden md:inline">Copy</span>
              </button>
              <button
                onClick={emailToParticipants}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition"
                title="Email to Participants"
              >
                <FiShare2 size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span className="hidden md:inline">Email</span>
              </button>
            </div>
          </div>
        </header>

        {/* Executive Summary */}
        {notes?.summary && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-purple-500/20 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
              <FaMagic size={20} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              <span>Executive Summary</span>
            </h2>
            <p className="text-white text-base leading-relaxed">{notes.summary}</p>
          </section>
        )}

        {/* Action Items */}
        {notes?.actionItems && notes.actionItems.length > 0 && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-green-500/20 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
              <FiCheckCircle size={20} className="text-green-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              <span>Action Items ({notes.actionItems.length})</span>
            </h2>
            <div className="space-y-3">
              {notes.actionItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-3 p-4 bg-dark-800/30 rounded-lg hover:bg-dark-800/50 transition border border-green-500/10"
                >
                  <input
                    type="checkbox"
                    checked={item.completed || false}
                    readOnly
                    className="mt-1 w-5 h-5 rounded border-dark-600 bg-dark-700 text-green-500 focus:ring-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm md:text-base">{item.text}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs md:text-sm">
                      {item.assignee && (
                        <span className="text-green-300 font-medium">@{item.assignee}</span>
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

        {/* Decisions Made */}
        {notes?.decisions && notes.decisions.length > 0 && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-blue-500/20 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
              <FiCheckCircle size={20} className="text-blue-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              <span>Key Decisions</span>
            </h2>
            <div className="space-y-3">
              {notes.decisions.map((decision, idx) => {
                const decisionText = typeof decision === 'string' ? decision : decision.decision;
                const decisionContext = typeof decision === 'object' ? decision.context : undefined;
                const decisionTimestamp = typeof decision === 'object' ? decision.timestamp : undefined;
                
                return (
                  <div key={idx} className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-white text-sm md:text-base font-medium mb-1">{decisionText}</p>
                    {decisionContext && (
                      <p className="text-dark-300 text-xs md:text-sm mb-2">{decisionContext}</p>
                    )}
                    {decisionTimestamp && (
                      <span className="text-dark-400 text-xs">{decisionTimestamp}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Discussion Topics */}
        {notes?.sections && notes.sections.length > 0 && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-yellow-500/20 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
              <FiMessageSquare size={20} className="text-yellow-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              <span>Discussion Topics</span>
            </h2>
            <div className="space-y-4">
              {notes.sections.map((section, idx) => {
                const sectionId = `section-${idx}`;
                const isExpanded = expandedSections.has(sectionId);
                return (
                  <div key={idx} className="border border-dark-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedSections);
                        if (isExpanded) {
                          newExpanded.delete(sectionId);
                        } else {
                          newExpanded.add(sectionId);
                        }
                        setExpandedSections(newExpanded);
                      }}
                      className="w-full flex items-center justify-between p-4 bg-dark-800/30 hover:bg-dark-800/50 transition"
                    >
                      <div className="flex items-center space-x-3">
                        <h3 className="text-white font-medium text-sm md:text-base">{section.topic}</h3>
                        <span className="text-dark-400 text-xs">{section.timestamp}</span>
                      </div>
                      {isExpanded ? (
                        <FiChevronUp size={16} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      ) : (
                        <FiChevronDown size={16} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="p-4 space-y-2">
                        <ul className="space-y-1.5">
                          {section.notes.map((note, noteIdx) => (
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
        {notes?.keyPoints && notes.keyPoints.length > 0 && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-primary-500/20 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4">Key Points</h2>
            <ul className="space-y-2">
              {notes.keyPoints.map((point, idx) => (
                <li key={idx} className="text-white text-sm md:text-base flex items-start space-x-2">
                  <span className="text-primary-400 mt-1">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Questions Raised */}
        {notes?.questionsRaised && notes.questionsRaised.length > 0 && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-cyan-500/20 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4">Questions Raised</h2>
            <ul className="space-y-2">
              {notes.questionsRaised.map((question, idx) => (
                <li key={idx} className="text-white text-sm md:text-base flex items-start space-x-2">
                  <span className="text-cyan-400 mt-1">?</span>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Next Steps */}
        {notes?.nextSteps && notes.nextSteps.length > 0 && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-purple-500/20 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4">Next Steps</h2>
            <ul className="space-y-2 mb-4">
              {notes.nextSteps.map((step, idx) => (
                <li key={idx} className="text-white text-sm md:text-base flex items-start space-x-2">
                  <span className="text-purple-400 mt-1">→</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            {notes.suggestedFollowUp && (
              <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <div className="flex items-center space-x-2">
                  <FiCalendar size={16} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                  <p className="text-white text-sm">
                    Suggested follow-up: {new Date(notes.suggestedFollowUp).toLocaleDateString()}
                  </p>
                </div>
                <button className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition">
                  Schedule
                </button>
              </div>
            )}
          </section>
        )}

        {/* Generated Images Gallery */}
        {images.length > 0 && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-purple-500/20 animate-fade-in">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
              <FiImage size={20} className="text-purple-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              <span>Generated Images ({images.length})</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img) => (
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
                      "{img.prompt.substring(0, 40)}{img.prompt.length > 40 ? '...' : ''}"
                    </p>
                    <div className="flex items-center justify-between text-xs text-dark-500">
                      <span>{new Date(img.createdAt).toLocaleDateString()}</span>
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">{img.style}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Full Transcript */}
        {transcript.length > 0 && (
          <section className="glass-card rounded-xl p-6 mb-6 border border-dark-700 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                <FiFileText size={20} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                <span>Full Transcript</span>
              </h2>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg transition text-white text-sm"
              >
                {showTranscript ? 'Hide' : 'Show'} Transcript
              </button>
            </div>

            {showTranscript && (
              <>
                {/* Search and Filter */}
                <div className="mb-4 space-y-3">
                  <div className="relative">
                    <FiSearch
                      size={18}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400"
                      style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search transcript..."
                      className="w-full pl-10 pr-10 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-white"
                      >
                        <FiX size={16} style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
                      </button>
                    )}
                  </div>
                  {speakers.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedSpeaker(null)}
                        className={`px-3 py-1 rounded-lg text-xs transition ${
                          !selectedSpeaker
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-800/50 text-dark-300 hover:bg-dark-700/50'
                        }`}
                      >
                        All Speakers
                      </button>
                      {speakers.map(speaker => (
                        <button
                          key={speaker}
                          onClick={() => setSelectedSpeaker(speaker)}
                          className={`px-3 py-1 rounded-lg text-xs transition ${
                            selectedSpeaker === speaker
                              ? 'bg-primary-500 text-white'
                              : 'bg-dark-800/50 text-dark-300 hover:bg-dark-700/50'
                          }`}
                        >
                          {speaker}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transcript Content */}
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {filteredTranscript.length === 0 ? (
                    <p className="text-dark-400 text-center py-8">No matching transcript entries</p>
                  ) : (
                    filteredTranscript.map((segment, index) => {
                      const isCurrentUser = segment.speaker === user?.name || segment.speaker === 'You';
                      return (
                        <div
                          key={index}
                          className="p-3 md:p-4 bg-dark-800/30 rounded-lg border-l-4 hover:bg-dark-800/50 transition"
                          style={{ borderLeftColor: isCurrentUser ? 'rgba(99, 102, 241, 0.6)' : 'rgba(59, 130, 246, 0.6)' }}
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isCurrentUser ? 'bg-primary-500/30' : 'bg-blue-500/30'
                            }`}>
                              <span className={`font-semibold text-xs ${
                                isCurrentUser ? 'text-primary-400' : 'text-blue-400'
                              }`}>
                                {segment.speaker.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className={`font-semibold text-sm ${
                              isCurrentUser ? 'text-primary-400' : 'text-blue-400'
                            }`}>
                              {segment.speaker}
                            </span>
                            <span className="text-dark-400 text-xs ml-auto flex-shrink-0">
                              {formatTimestamp(segment.timestamp)}
                            </span>
                          </div>
                          <p className="text-white text-sm md:text-base leading-relaxed pl-9">
                            {segment.text}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

