import { useState } from 'react';
import {
  Sparkles,
  ChevronRight,
  Download,
  CheckCircle2,
  ListChecks,
  Target,
  Tag,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AINotes {
  summary?: string;
  bullets?: string[];
  actionItems?: Array<{ text: string; assignee?: string }>;
  decisions?: string[];
  suggestedReplies?: string[];
  keyTopics?: string[];
  isFinal?: boolean;
}

interface AINotesSidebarProps {
  aiNotes: AINotes | null;
  isOpen: boolean;
  onToggle: () => void;
  callTitle?: string;
}

export default function AINotesSidebar({
  aiNotes,
  isOpen,
  onToggle,
  callTitle = 'Meeting Notes',
}: AINotesSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'keyPoints', 'actionItems', 'decisions', 'topics'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const exportNotes = () => {
    if (!aiNotes) return;

    const notesText = `# ${callTitle}\n\n` +
      `Generated: ${new Date().toLocaleString()}\n\n` +
      (aiNotes.summary ? `## Summary\n${aiNotes.summary}\n\n` : '') +
      (aiNotes.keyTopics && aiNotes.keyTopics.length > 0
        ? `## Key Topics\n${aiNotes.keyTopics.map((t) => `- ${t}`).join('\n')}\n\n`
        : '') +
      (aiNotes.bullets && aiNotes.bullets.length > 0
        ? `## Key Points\n${aiNotes.bullets.map((b) => `- ${b}`).join('\n')}\n\n`
        : '') +
      (aiNotes.actionItems && aiNotes.actionItems.length > 0
        ? `## Action Items\n${aiNotes.actionItems.map((item) => `- ${item.text}${item.assignee ? ` (@${item.assignee})` : ''}`).join('\n')}\n\n`
        : '') +
      (aiNotes.decisions && aiNotes.decisions.length > 0
        ? `## Decisions Made\n${aiNotes.decisions.map((d) => `- ${d}`).join('\n')}\n\n`
        : '') +
      (aiNotes.suggestedReplies && aiNotes.suggestedReplies.length > 0
        ? `## Suggested Replies\n${aiNotes.suggestedReplies.map((r) => `- ${r}`).join('\n')}\n\n`
        : '');

    const blob = new Blob([notesText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${callTitle.replace(/[^a-z0-9]/gi, '_')}_notes_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Toggle Button - Always visible */}
      <button
        onClick={onToggle}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white p-3 rounded-l-xl shadow-lg transition-all duration-300 ${
          isOpen ? 'translate-x-[400px] md:translate-x-[400px]' : 'translate-x-0'
        }`}
        style={{
          right: isOpen ? (window.innerWidth < 768 ? '100%' : '400px') : '0',
        }}
        title={isOpen ? 'Hide AI Notes' : 'Show AI Notes'}
      >
        {isOpen ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <div className="relative">
            <Sparkles className="w-5 h-5" />
            {aiNotes && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </div>
        )}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full z-40 bg-dark-900/95 backdrop-blur-xl border-l border-dark-800/50 shadow-2xl transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: isOpen ? (window.innerWidth < 768 ? '100%' : '400px') : '0',
        }}
      >
        {isOpen && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-dark-800/50 bg-dark-900/80 backdrop-blur-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-500 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-sm">AI Notes</h2>
                    {aiNotes?.isFinal ? (
                      <span className="text-green-400 text-xs flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Final</span>
                      </span>
                    ) : (
                      <span className="text-blue-400 text-xs animate-pulse">Live</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {aiNotes && (
                    <button
                      onClick={exportNotes}
                      className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                      title="Export notes"
                    >
                      <Download className="w-4 h-4 text-white" />
                    </button>
                  )}
                  <button
                    onClick={onToggle}
                    className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                    title="Close sidebar"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {!aiNotes ? (
                <div className="h-full flex items-center justify-center text-center py-16">
                  <div>
                    <Sparkles className="w-16 h-16 text-dark-700 mx-auto mb-4" />
                    <p className="text-dark-500 text-sm">AI notes will appear here as the conversation progresses...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  {aiNotes.summary && (
                    <div className="glass-card rounded-xl p-4 border border-purple-500/20 bg-purple-500/10 animate-fade-in">
                      <button
                        onClick={() => toggleSection('summary')}
                        className="w-full flex items-center justify-between mb-2"
                      >
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-purple-400" />
                          <h3 className="text-purple-300 font-semibold text-sm uppercase tracking-wide">Summary</h3>
                        </div>
                        {expandedSections.has('summary') ? (
                          <ChevronUp className="w-4 h-4 text-purple-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-purple-400" />
                        )}
                      </button>
                      {expandedSections.has('summary') && (
                        <p className="text-white text-sm leading-relaxed animate-fade-in">{aiNotes.summary}</p>
                      )}
                    </div>
                  )}

                  {/* Key Points */}
                  {aiNotes.bullets && aiNotes.bullets.length > 0 && (
                    <div className="glass-card rounded-xl p-4 border border-blue-500/20 bg-blue-500/10 animate-fade-in">
                      <button
                        onClick={() => toggleSection('keyPoints')}
                        className="w-full flex items-center justify-between mb-2"
                      >
                        <div className="flex items-center space-x-2">
                          <ListChecks className="w-4 h-4 text-blue-400" />
                          <h3 className="text-blue-300 font-semibold text-sm uppercase tracking-wide">
                            Key Points ({aiNotes.bullets.length})
                          </h3>
                        </div>
                        {expandedSections.has('keyPoints') ? (
                          <ChevronUp className="w-4 h-4 text-blue-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                      {expandedSections.has('keyPoints') && (
                        <ul className="space-y-2 animate-fade-in">
                          {aiNotes.bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                              <p className="text-white text-sm">{bullet}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Action Items */}
                  {aiNotes.actionItems && aiNotes.actionItems.length > 0 && (
                    <div className="glass-card rounded-xl p-4 border border-green-500/20 bg-green-500/10 animate-fade-in">
                      <button
                        onClick={() => toggleSection('actionItems')}
                        className="w-full flex items-center justify-between mb-2"
                      >
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <h3 className="text-green-300 font-semibold text-sm uppercase tracking-wide">
                            Action Items ({aiNotes.actionItems.length})
                          </h3>
                        </div>
                        {expandedSections.has('actionItems') ? (
                          <ChevronUp className="w-4 h-4 text-green-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-green-400" />
                        )}
                      </button>
                      {expandedSections.has('actionItems') && (
                        <ul className="space-y-2 animate-fade-in">
                          {aiNotes.actionItems.map((item, idx) => (
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
                      )}
                    </div>
                  )}

                  {/* Decisions */}
                  {aiNotes.decisions && aiNotes.decisions.length > 0 && (
                    <div className="glass-card rounded-xl p-4 border border-cyan-500/20 bg-cyan-500/10 animate-fade-in">
                      <button
                        onClick={() => toggleSection('decisions')}
                        className="w-full flex items-center justify-between mb-2"
                      >
                        <div className="flex items-center space-x-2">
                          <Target className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-cyan-300 font-semibold text-sm uppercase tracking-wide">
                            Decisions ({aiNotes.decisions.length})
                          </h3>
                        </div>
                        {expandedSections.has('decisions') ? (
                          <ChevronUp className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-cyan-400" />
                        )}
                      </button>
                      {expandedSections.has('decisions') && (
                        <ul className="space-y-2 animate-fade-in">
                          {aiNotes.decisions.map((decision, idx) => (
                            <li key={idx} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                              <p className="text-white text-sm">{decision}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Key Topics */}
                  {aiNotes.keyTopics && aiNotes.keyTopics.length > 0 && (
                    <div className="glass-card rounded-xl p-4 border border-primary-500/20 bg-primary-500/10 animate-fade-in">
                      <button
                        onClick={() => toggleSection('topics')}
                        className="w-full flex items-center justify-between mb-2"
                      >
                        <div className="flex items-center space-x-2">
                          <Tag className="w-4 h-4 text-primary-400" />
                          <h3 className="text-primary-300 font-semibold text-sm uppercase tracking-wide">
                            Topics ({aiNotes.keyTopics.length})
                          </h3>
                        </div>
                        {expandedSections.has('topics') ? (
                          <ChevronUp className="w-4 h-4 text-primary-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-primary-400" />
                        )}
                      </button>
                      {expandedSections.has('topics') && (
                        <div className="flex flex-wrap gap-2 animate-fade-in">
                          {aiNotes.keyTopics.map((topic, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-primary-500/20 text-primary-300 text-xs rounded-lg border border-primary-500/30"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggested Replies */}
                  {aiNotes.suggestedReplies && aiNotes.suggestedReplies.length > 0 && (
                    <div className="glass-card rounded-xl p-4 border border-pink-500/20 bg-pink-500/10 animate-fade-in">
                      <button
                        onClick={() => toggleSection('suggestedReplies')}
                        className="w-full flex items-center justify-between mb-2"
                      >
                        <div className="flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 text-pink-400" />
                          <h3 className="text-pink-300 font-semibold text-sm uppercase tracking-wide">
                            Suggested Replies ({aiNotes.suggestedReplies.length})
                          </h3>
                        </div>
                        {expandedSections.has('suggestedReplies') ? (
                          <ChevronUp className="w-4 h-4 text-pink-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-pink-400" />
                        )}
                      </button>
                      {expandedSections.has('suggestedReplies') && (
                        <div className="space-y-2 animate-fade-in">
                          {aiNotes.suggestedReplies.map((reply, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-dark-800/50 rounded-lg border border-pink-500/20"
                            >
                              <p className="text-pink-200 text-sm">{reply}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overlay for mobile */}
      {isOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
}

