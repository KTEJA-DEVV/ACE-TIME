import { useEffect, useRef, useState } from 'react';
import { Sparkles, CheckCircle2, Clock, User, Bot, MessageSquare } from 'lucide-react';

interface TranscriptSegment {
  speaker: string;
  speakerId?: string;
  text: string;
  timestamp: number;
}

interface AINotes {
  summary?: string;
  bullets?: string[];
  actionItems?: Array<{ text: string; assignee?: string }>;
  decisions?: string[];
  suggestedReplies?: string[];
  keyTopics?: string[];
  isFinal?: boolean;
}

interface LiveTranscriptDisplayProps {
  transcript: TranscriptSegment[];
  aiNotes: AINotes | null;
  currentUserId?: string;
  currentUserName?: string;
  interimTranscript?: string;
}

// Color palette for different speakers
const SPEAKER_COLORS = [
  { bg: 'bg-primary-500/20', border: 'border-primary-500/40', text: 'text-primary-300', name: 'text-primary-400' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300', name: 'text-purple-400' },
  { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', name: 'text-blue-400' },
  { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-300', name: 'text-green-400' },
  { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-300', name: 'text-pink-400' },
  { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300', name: 'text-cyan-400' },
];

// Get color for a speaker based on their name
const getSpeakerColor = (speaker: string, _speakerIndex: number): typeof SPEAKER_COLORS[0] => {
  // Use a hash of the speaker name to consistently assign colors
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SPEAKER_COLORS.length;
  return SPEAKER_COLORS[index];
};

// Format timestamp to readable time
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Calculate relative time from start
const formatRelativeTime = (timestamp: number, startTime?: number): string => {
  if (!startTime) return formatTimestamp(timestamp);
  const seconds = Math.floor((timestamp - startTime) / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export default function LiveTranscriptDisplay({
  transcript,
  aiNotes,
  currentUserId,
  currentUserName = 'You',
  interimTranscript = '',
}: LiveTranscriptDisplayProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const aiNotesEndRef = useRef<HTMLDivElement>(null);
  const [speakerMap, setSpeakerMap] = useState<Map<string, number>>(new Map());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastHighlightedIndex, setLastHighlightedIndex] = useState<number>(-1);

  // Track unique speakers and assign colors
  useEffect(() => {
    const newSpeakerMap = new Map<string, number>();
    transcript.forEach((segment) => {
      if (!newSpeakerMap.has(segment.speaker)) {
        newSpeakerMap.set(segment.speaker, newSpeakerMap.size);
      }
    });
    setSpeakerMap(newSpeakerMap);
    
    // Set start time from first transcript entry
    if (transcript.length > 0 && !startTime) {
      setStartTime(transcript[0].timestamp);
    }
  }, [transcript, startTime]);

  // Auto-scroll transcript to bottom when new entries arrive
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [transcript]);

  // Auto-scroll AI notes to bottom when updated
  useEffect(() => {
    if (aiNotesEndRef.current) {
      aiNotesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [aiNotes]);

  // Highlight the latest entry
  useEffect(() => {
    if (transcript.length > 0) {
      setLastHighlightedIndex(transcript.length - 1);
      // Remove highlight after 3 seconds
      const timer = setTimeout(() => {
        setLastHighlightedIndex(-1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [transcript.length]);

  return (
    <div className="h-full flex flex-col bg-dark-950">
      {/* Top 50%: Live Transcript */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-dark-800/50">
        {/* Transcript Header */}
        <div className="flex-shrink-0 px-4 py-3 bg-dark-900/80 backdrop-blur-lg border-b border-dark-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-primary-400" />
              <h3 className="text-white font-semibold text-sm">Live Transcript</h3>
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                {transcript.length} entries
              </span>
            </div>
            {startTime && (
              <div className="flex items-center space-x-1 text-dark-400 text-xs">
                <Clock className="w-3 h-3" />
                <span>Started {formatTimestamp(startTime)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Transcript Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {transcript.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-dark-700 mx-auto mb-4" />
                <p className="text-dark-500 text-sm">Transcript will appear here as participants speak...</p>
              </div>
            </div>
          ) : (
            <>
              {transcript.map((segment, index) => {
                const isCurrentUser = segment.speaker === currentUserName || segment.speaker === 'You' || 
                                      (currentUserId && segment.speakerId === currentUserId);
                const isLatest = index === transcript.length - 1;
                const isHighlighted = index === lastHighlightedIndex;
                const speakerColor = getSpeakerColor(segment.speaker, speakerMap.get(segment.speaker) || 0);
                const isAI = segment.speaker.toLowerCase().includes('ai') || segment.speaker.toLowerCase().includes('acetime');

                return (
                  <div
                    key={`${segment.timestamp}-${index}`}
                    className={`group animate-fade-in transition-all duration-300 ${
                      isHighlighted ? 'scale-[1.02]' : ''
                    }`}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <div
                      className={`glass-card rounded-xl p-4 border-2 transition-all duration-300 ${
                        isHighlighted
                          ? `${speakerColor.border} shadow-lg ${speakerColor.bg} scale-[1.02]`
                          : `${speakerColor.border} ${speakerColor.bg}`
                      } ${isLatest ? 'ring-2 ring-primary-500/50' : ''}`}
                    >
                      {/* Speaker Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {isAI ? (
                            <Bot className={`w-4 h-4 ${speakerColor.name}`} />
                          ) : (
                            <User className={`w-4 h-4 ${speakerColor.name}`} />
                          )}
                          <span className={`font-semibold text-sm ${speakerColor.name}`}>
                            {isCurrentUser ? 'You' : segment.speaker}
                          </span>
                          {isLatest && (
                            <span className="px-1.5 py-0.5 bg-primary-500/30 text-primary-300 text-xs rounded-full animate-pulse">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-dark-400 text-xs">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(segment.timestamp, startTime || undefined)}</span>
                          <span className="text-dark-600">•</span>
                          <span>{formatTimestamp(segment.timestamp)}</span>
                        </div>
                      </div>

                      {/* Transcript Text */}
                      <p className={`text-sm leading-relaxed ${speakerColor.text} whitespace-pre-wrap`}>
                        {segment.text}
                      </p>

                      {/* Highlight Indicator */}
                      {isHighlighted && (
                        <div className="mt-2 pt-2 border-t border-primary-500/30">
                          <div className="flex items-center space-x-1 text-primary-400 text-xs">
                            <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />
                            <span>New entry</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Interim Transcript (if any) */}
              {interimTranscript && (
                <div className="animate-fade-in">
                  <div className="glass-card rounded-xl p-4 border-2 border-primary-500/30 bg-primary-500/10">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
                      <span className="text-primary-400 text-sm font-semibold">Speaking...</span>
                    </div>
                    <p className="text-primary-300 text-sm italic leading-relaxed">{interimTranscript}</p>
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={transcriptEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Bottom 50%: AI Notes/Insights */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* AI Notes Header */}
        <div className="flex-shrink-0 px-4 py-3 bg-dark-900/80 backdrop-blur-lg border-b border-dark-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="text-white font-semibold text-sm">AI Insights</h3>
              {aiNotes?.isFinal ? (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Final</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30 animate-pulse">
                  Live
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AI Notes Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {!aiNotes ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Sparkles className="w-16 h-16 text-dark-700 mx-auto mb-4" />
                <p className="text-dark-500 text-sm">AI insights will appear here as the conversation progresses...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary */}
              {aiNotes.summary && (
                <div className="glass-card rounded-xl p-4 border border-purple-500/20 bg-purple-500/10 animate-fade-in">
                  <div className="flex items-center space-x-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h4 className="text-purple-300 font-semibold text-sm uppercase tracking-wide">Summary</h4>
                  </div>
                  <p className="text-white text-sm leading-relaxed">{aiNotes.summary}</p>
                </div>
              )}

              {/* Key Topics */}
              {aiNotes.keyTopics && aiNotes.keyTopics.length > 0 && (
                <div className="glass-card rounded-xl p-4 border border-primary-500/20 animate-fade-in">
                  <h4 className="text-primary-300 font-semibold text-sm uppercase tracking-wide mb-3 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Key Topics</span>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {aiNotes.keyTopics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-primary-500/20 text-primary-300 text-xs rounded-lg border border-primary-500/30 animate-fade-in"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items */}
              {aiNotes.actionItems && aiNotes.actionItems.length > 0 && (
                <div className="glass-card rounded-xl p-4 border border-green-500/20 bg-green-500/10 animate-fade-in">
                  <h4 className="text-green-300 font-semibold text-sm uppercase tracking-wide mb-3 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Action Items</span>
                  </h4>
                  <ul className="space-y-2">
                    {aiNotes.actionItems.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start space-x-2 animate-fade-in"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
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

              {/* Decisions */}
              {aiNotes.decisions && aiNotes.decisions.length > 0 && (
                <div className="glass-card rounded-xl p-4 border border-blue-500/20 bg-blue-500/10 animate-fade-in">
                  <h4 className="text-blue-300 font-semibold text-sm uppercase tracking-wide mb-3 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Decisions Made</span>
                  </h4>
                  <ul className="space-y-2">
                    {aiNotes.decisions.map((decision, idx) => (
                      <li
                        key={idx}
                        className="flex items-start space-x-2 animate-fade-in"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                        <p className="text-white text-sm">{decision}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bullet Points */}
              {aiNotes.bullets && aiNotes.bullets.length > 0 && (
                <div className="glass-card rounded-xl p-4 border border-cyan-500/20 animate-fade-in">
                  <h4 className="text-cyan-300 font-semibold text-sm uppercase tracking-wide mb-3 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Key Points</span>
                  </h4>
                  <ul className="space-y-2">
                    {aiNotes.bullets.map((bullet, idx) => (
                      <li
                        key={idx}
                        className="flex items-start space-x-2 animate-fade-in"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                        <p className="text-white text-sm">{bullet}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Replies */}
              {aiNotes.suggestedReplies && aiNotes.suggestedReplies.length > 0 && (
                <div className="glass-card rounded-xl p-4 border border-pink-500/20 bg-pink-500/10 animate-fade-in">
                  <h4 className="text-pink-300 font-semibold text-sm uppercase tracking-wide mb-3 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Suggested Replies</span>
                  </h4>
                  <div className="space-y-2">
                    {aiNotes.suggestedReplies.map((reply, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-dark-800/50 rounded-lg border border-pink-500/20 animate-fade-in"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <p className="text-pink-200 text-sm">{reply}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={aiNotesEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

