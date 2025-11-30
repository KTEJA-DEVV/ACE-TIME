import { useState, useEffect } from 'react';
import {
  Video,
  Clock,
  FileText,
  Settings,
  LogOut,
  Plus,
  Search,
  ChevronRight,
  Play,
  Sparkles,
  Users,
  Calendar,
} from 'lucide-react';

interface CallHistory {
  _id: string;
  roomId: string;
  duration: number;
  createdAt: string;
  participants: string[];
  summary?: string;
  keyTopics?: string[];
}

export default function Dashboard() {
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'calls' | 'settings'>('calls');

  // Mock data for demo
  useEffect(() => {
    setCalls([
      {
        _id: '1',
        roomId: 'ABC123',
        duration: 1847,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        participants: ['Alex Chen', 'Jordan Smith'],
        summary: 'Discussed Q4 product roadmap and marketing strategy for the upcoming launch.',
        keyTopics: ['Product Launch', 'Marketing', 'Q4 Goals'],
      },
      {
        _id: '2',
        roomId: 'XYZ789',
        duration: 923,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        participants: ['Sarah Johnson'],
        summary: 'Weekly 1:1 meeting covering project updates and career development.',
        keyTopics: ['1:1', 'Career', 'Projects'],
      },
      {
        _id: '3',
        roomId: 'DEF456',
        duration: 2156,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        participants: ['Mike Brown', 'Emily Davis', 'Chris Wilson'],
        summary: 'Sprint planning session for the next two weeks.',
        keyTopics: ['Sprint', 'Planning', 'Agile'],
      },
    ]);
  }, []);

  const formatDuration = (seconds: number) => {
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

  const filteredCalls = calls.filter(call =>
    call.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    call.keyTopics?.some(topic => topic.toLowerCase().includes(searchQuery.toLowerCase())) ||
    call.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-900 border-r border-dark-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-dark-800">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AceTime</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('calls')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${
                activeTab === 'calls'
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-dark-400 hover:bg-dark-800 hover:text-white'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>Call History</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition ${
                activeTab === 'settings'
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-dark-400 hover:bg-dark-800 hover:text-white'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center space-x-3 px-4 py-3">
            <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">U</span>
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">User</div>
              <div className="text-dark-500 text-sm">user@example.com</div>
            </div>
            <button className="text-dark-500 hover:text-white transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-dark-900/50 border-b border-dark-800 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {activeTab === 'calls' ? 'Call History' : 'Settings'}
              </h1>
              <p className="text-dark-400 mt-1">
                {activeTab === 'calls'
                  ? 'View and search your past calls'
                  : 'Manage your account settings'}
              </p>
            </div>
            {activeTab === 'calls' && (
              <button className="flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium transition">
                <Plus className="w-5 h-5" />
                <span>New Call</span>
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {activeTab === 'calls' && (
            <>
              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                <input
                  type="text"
                  placeholder="Search calls, topics, or participants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-5">
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
                <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {Math.floor(calls.reduce((acc, c) => acc + c.duration, 0) / 60)}m
                      </div>
                      <div className="text-dark-400 text-sm">Total Duration</div>
                    </div>
                  </div>
                </div>
                <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{calls.length}</div>
                      <div className="text-dark-400 text-sm">Transcripts</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call List */}
              <div className="space-y-4">
                {filteredCalls.map((call) => (
                  <div
                    key={call._id}
                    className="bg-dark-800/50 border border-dark-700 rounded-xl p-5 hover:border-primary-500/50 transition cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-dark-500" />
                            <span className="text-white font-medium">
                              {call.participants.join(', ')}
                            </span>
                          </div>
                          <span className="text-dark-600">•</span>
                          <div className="flex items-center space-x-1 text-dark-400 text-sm">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(call.createdAt)}</span>
                          </div>
                          <span className="text-dark-600">•</span>
                          <div className="flex items-center space-x-1 text-dark-400 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>{formatDuration(call.duration)}</span>
                          </div>
                        </div>

                        {call.summary && (
                          <p className="text-dark-300 mb-3">{call.summary}</p>
                        )}

                        {call.keyTopics && call.keyTopics.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <div className="flex flex-wrap gap-2">
                              {call.keyTopics.map((topic, index) => (
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
                        <button className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition">
                          <Play className="w-4 h-4 text-white" />
                        </button>
                        <button className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition">
                          <FileText className="w-4 h-4 text-white" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-dark-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl">
              <div className="space-y-6">
                {/* Call Settings */}
                <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Call Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white">Microphone on by default</div>
                        <div className="text-dark-500 text-sm">Start calls with mic enabled</div>
                      </div>
                      <button className="w-12 h-6 bg-primary-500 rounded-full relative">
                        <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white">Camera on by default</div>
                        <div className="text-dark-500 text-sm">Start calls with camera enabled</div>
                      </div>
                      <button className="w-12 h-6 bg-primary-500 rounded-full relative">
                        <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white">Auto-record calls</div>
                        <div className="text-dark-500 text-sm">Automatically record all calls</div>
                      </div>
                      <button className="w-12 h-6 bg-primary-500 rounded-full relative">
                        <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Account */}
                <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Account</h3>
                  <div className="space-y-4">
                    <button className="w-full text-left px-4 py-3 bg-dark-700 hover:bg-dark-600 rounded-xl text-white transition">
                      Export Data
                    </button>
                    <button className="w-full text-left px-4 py-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-400 transition">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

