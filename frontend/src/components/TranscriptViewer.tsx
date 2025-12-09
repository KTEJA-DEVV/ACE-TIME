import { X, Download, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

interface TranscriptSegment {
  speaker: string;
  speakerId?: string;
  text: string;
  timestamp: number;
}

interface TranscriptViewerProps {
  transcript: {
    segments?: TranscriptSegment[];
    fullText?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  callTitle?: string;
}

export default function TranscriptViewer({
  transcript,
  isOpen,
  onClose,
  callTitle = 'Call Transcript',
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());

  const filteredSegments = useMemo(() => {
    if (!transcript?.segments) return [];
    if (!searchQuery.trim()) return transcript.segments;

    const query = searchQuery.toLowerCase();
    return transcript.segments.filter((seg) =>
      seg.text.toLowerCase().includes(query) ||
      seg.speaker.toLowerCase().includes(query)
    );
  }, [transcript, searchQuery]);

  const toggleSegment = (index: number) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const downloadTranscript = () => {
    if (!transcript) return;

    let transcriptText = `# ${callTitle}\n\n`;
    transcriptText += `Generated: ${new Date().toLocaleString()}\n\n`;
    transcriptText += `## Transcript\n\n`;

    if (transcript.segments && transcript.segments.length > 0) {
      transcript.segments.forEach((seg) => {
        const time = new Date(seg.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        transcriptText += `[${time}] ${seg.speaker}: ${seg.text}\n\n`;
      });
    } else if (transcript.fullText) {
      transcriptText += transcript.fullText;
    }

    const blob = new Blob([transcriptText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${callTitle.replace(/[^a-z0-9]/gi, '_')}_transcript_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full h-full md:w-[90%] md:h-[90%] md:max-w-4xl md:max-h-[90vh] bg-dark-900 rounded-xl shadow-2xl flex flex-col border border-dark-800/50">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-dark-800/50 bg-dark-900/80 backdrop-blur-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold text-lg">{callTitle}</h2>
              <p className="text-dark-400 text-sm">
                {transcript?.segments?.length || 0} segments
                {searchQuery && ` • ${filteredSegments.length} results`}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {transcript && (
                <button
                  onClick={downloadTranscript}
                  className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                  title="Download transcript"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                title="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 transition"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {!transcript || (!transcript.segments && !transcript.fullText) ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <FileText className="w-16 h-16 text-dark-700 mx-auto mb-4" />
                <p className="text-dark-500 text-sm">No transcript available</p>
              </div>
            </div>
          ) : transcript.segments && transcript.segments.length > 0 ? (
            <div className="space-y-3">
              {filteredSegments.map((segment) => {
                const originalIndex = transcript.segments!.indexOf(segment);
                const isExpanded = expandedSegments.has(originalIndex);
                const isLong = segment.text.length > 200;

                return (
                  <div
                    key={originalIndex}
                    className="glass-card rounded-xl p-4 border border-dark-800/50 hover:border-primary-500/30 transition animate-fade-in"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-semibold">
                            {segment.speaker.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-primary-400 font-semibold text-sm">{segment.speaker}</p>
                          <p className="text-dark-400 text-xs">
                            {new Date(segment.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      {isLong && (
                        <button
                          onClick={() => toggleSegment(originalIndex)}
                          className="p-1 rounded-lg hover:bg-dark-800/50 transition"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-dark-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-dark-400" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className={`text-white text-sm leading-relaxed ${isLong && !isExpanded ? 'line-clamp-3' : ''}`}>
                      {segment.text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card rounded-xl p-6 border border-dark-800/50">
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                {transcript.fullText}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add missing import
import { FileText } from 'lucide-react';

