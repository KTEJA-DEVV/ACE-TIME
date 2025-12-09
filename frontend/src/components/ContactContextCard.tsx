import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, Lightbulb, Users, MessageSquare, TrendingUp } from 'lucide-react';

interface ContactContext {
  summary?: string;
  keyTopics?: string[];
  relationship?: string;
  lastDiscussion?: string;
  suggestedTopics?: string[];
  lastUpdated?: string;
}

interface ContactContextCardProps {
  contactName?: string;
  contactId?: string;
  context: ContactContext | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function ContactContextCard({
  context,
  onRefresh,
  isRefreshing = false,
}: ContactContextCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!context && !isRefreshing) {
    return null;
  }

  const relationshipLabels: Record<string, string> = {
    colleague: 'Colleague',
    friend: 'Friend',
    client: 'Client',
    mentor: 'Mentor',
    teammate: 'Teammate',
    contact: 'Contact',
  };

  return (
    <div className="glass-card rounded-xl p-4 border border-dark-700/50 mb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">AI Insights</h3>
            {context?.lastUpdated && (
              <p className="text-dark-400 text-xs">
                Updated {new Date(context.lastUpdated).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 hover:bg-dark-800/50 rounded-lg transition disabled:opacity-50"
              title="Refresh insights"
            >
              <RefreshCw className={`w-4 h-4 text-dark-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-dark-800/50 rounded-lg transition"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-dark-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-dark-400" />
            )}
          </button>
        </div>
      </div>

      {/* Summary - Always visible */}
      {context?.summary && (
        <div className="mb-3">
          <p className="text-white text-sm leading-relaxed">{context.summary}</p>
        </div>
      )}

      {/* Relationship Badge */}
      {context?.relationship && (
        <div className="mb-3">
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-primary-500/20 text-primary-300 rounded-full text-xs font-medium">
            <Users className="w-3 h-3" />
            <span>{relationshipLabels[context.relationship] || context.relationship}</span>
          </span>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-3 mt-3 pt-3 border-t border-dark-800/50 animate-fade-in">
          {/* Key Topics */}
          {context?.keyTopics && context.keyTopics.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary-400" />
                <h4 className="text-dark-300 text-xs font-semibold uppercase tracking-wide">Common Topics</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {context.keyTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-dark-800/50 text-dark-300 rounded-lg text-xs border border-dark-700/50"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last Discussion */}
          {context?.lastDiscussion && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <MessageSquare className="w-4 h-4 text-primary-400" />
                <h4 className="text-dark-300 text-xs font-semibold uppercase tracking-wide">Last Discussion</h4>
              </div>
              <p className="text-white text-sm">{context.lastDiscussion}</p>
            </div>
          )}

          {/* Suggested Topics */}
          {context?.suggestedTopics && context.suggestedTopics.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" />
                <h4 className="text-dark-300 text-xs font-semibold uppercase tracking-wide">Suggested Topics</h4>
              </div>
              <ul className="space-y-1.5">
                {context.suggestedTopics.map((topic, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm text-white">
                    <span className="text-primary-400 mt-0.5">•</span>
                    <span>{topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Loading State */}
          {isRefreshing && (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-5 h-5 text-primary-400 animate-spin" />
              <span className="ml-2 text-dark-400 text-sm">Generating insights...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

