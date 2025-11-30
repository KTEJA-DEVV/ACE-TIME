import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Target,
  Users,
  Briefcase,
  Lightbulb,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';

// Use relative URL in production (when served from backend), absolute URL in development
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production, if served from same origin, use relative path
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

interface Vision {
  _id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: string;
}

interface Lead {
  _id: string;
  name: string;
  email?: string;
  company?: string;
  status: string;
  interests: string[];
}

interface Offer {
  _id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  tags: string[];
}

interface NetworkStats {
  visions: number;
  leads: number;
  offers: number;
  connections: number;
  pendingMatches: number;
}

export default function Network() {
  const { accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'visions' | 'leads' | 'offers' | 'matches'>('visions');
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [visions, setVisions] = useState<Vision[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'vision' | 'lead' | 'offer'>('vision');

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    name: '',
    email: '',
    company: '',
    interests: '',
    type: 'service',
  });

  useEffect(() => {
    fetchStats();
    fetchData();
  }, [accessToken, activeTab]);

  const fetchStats = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/network/stats`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const fetchData = async () => {
    if (!accessToken) return;
    try {
      if (activeTab === 'visions') {
        const response = await fetch(`${API_URL}/api/network/visions`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setVisions(data.visions || []);
        }
      } else if (activeTab === 'leads') {
        const response = await fetch(`${API_URL}/api/network/leads`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setLeads(data.leads || []);
        }
      } else if (activeTab === 'offers') {
        const response = await fetch(`${API_URL}/api/network/offers`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setOffers(data.offers || []);
        }
      }
    } catch (error) {
      console.error('Fetch data error:', error);
    }
  };

  const handleCreate = async () => {
    if (!accessToken) return;

    let endpoint = '';
    let body: any = {};

    if (createType === 'vision') {
      endpoint = '/api/network/visions';
      body = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
    } else if (createType === 'lead') {
      endpoint = '/api/network/leads';
      body = {
        name: formData.name,
        email: formData.email,
        company: formData.company,
        interests: formData.interests.split(',').map(t => t.trim()).filter(Boolean),
      };
    } else if (createType === 'offer') {
      endpoint = '/api/network/offers';
      body = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        type: formData.type,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          title: '', description: '', category: '', tags: '',
          name: '', email: '', company: '', interests: '', type: 'service',
        });
        fetchData();
        fetchStats();
      }
    } catch (error) {
      console.error('Create error:', error);
    }
  };

  const findMatches = async (entityType: string, entityId: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/network/match/find`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entityType, entityId }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Found ${data.matches.length} potential matches!`);
      }
    } catch (error) {
      console.error('Find matches error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
      {/* Header */}
      <header className="border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/home" className="flex items-center space-x-2 text-dark-400 hover:text-white mr-6">
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-primary-500" />
              <h1 className="text-xl font-semibold text-white">Network Hub</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="glass rounded-xl p-5 hover:border-yellow-500/30 transition group">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Lightbulb className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.visions}</div>
                  <div className="text-dark-400 text-sm">Visions</div>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-5 hover:border-blue-500/30 transition group">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.leads}</div>
                  <div className="text-dark-400 text-sm">Leads</div>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-5 hover:border-green-500/30 transition group">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Briefcase className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.offers}</div>
                  <div className="text-dark-400 text-sm">Offers</div>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-5 hover:border-purple-500/30 transition group">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.connections}</div>
                  <div className="text-dark-400 text-sm">Connections</div>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-5 hover:border-pink-500/30 transition group">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
                  <Sparkles className="w-6 h-6 text-pink-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{stats.pendingMatches}</div>
                  <div className="text-dark-400 text-sm">Matches</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex space-x-1 bg-dark-800 rounded-xl p-1">
            {(['visions', 'leads', 'offers', 'matches'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === tab
                    ? 'bg-primary-500 text-white'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setCreateType(activeTab === 'leads' ? 'lead' : activeTab === 'offers' ? 'offer' : 'vision');
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl transition"
          >
            <Plus className="w-5 h-5" />
            <span>Create</span>
          </button>
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === 'visions' && visions.map((vision) => (
            <div key={vision._id} className="glass rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="text-xs bg-dark-700 text-dark-300 px-2 py-1 rounded">
                  {vision.status}
                </span>
              </div>
              <h3 className="text-white font-semibold mb-2">{vision.title}</h3>
              <p className="text-dark-400 text-sm mb-3 line-clamp-2">{vision.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {vision.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="text-xs bg-primary-500/20 text-primary-300 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <button
                onClick={() => findMatches('vision', vision._id)}
                className="w-full flex items-center justify-center space-x-2 bg-dark-700 hover:bg-dark-600 text-white py-2 rounded-lg transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Find Matches</span>
              </button>
            </div>
          ))}

          {activeTab === 'leads' && leads.map((lead) => (
            <div key={lead._id} className="glass rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  lead.status === 'new' ? 'bg-green-500/20 text-green-400' :
                  lead.status === 'contacted' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-dark-700 text-dark-300'
                }`}>
                  {lead.status}
                </span>
              </div>
              <h3 className="text-white font-semibold mb-1">{lead.name}</h3>
              {lead.company && <p className="text-dark-400 text-sm mb-2">{lead.company}</p>}
              <div className="flex flex-wrap gap-1">
                {lead.interests.slice(0, 3).map((interest, i) => (
                  <span key={i} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {activeTab === 'offers' && offers.map((offer) => (
            <div key={offer._id} className="glass rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-xs bg-dark-700 text-dark-300 px-2 py-1 rounded">
                  {offer.type}
                </span>
              </div>
              <h3 className="text-white font-semibold mb-2">{offer.title}</h3>
              <p className="text-dark-400 text-sm mb-3 line-clamp-2">{offer.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {offer.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <button
                onClick={() => findMatches('offer', offer._id)}
                className="w-full flex items-center justify-center space-x-2 bg-dark-700 hover:bg-dark-600 text-white py-2 rounded-lg transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Find Matches</span>
              </button>
            </div>
          ))}

          {activeTab === 'matches' && (
            <div className="col-span-full text-center py-12">
              <Sparkles className="w-16 h-16 text-dark-600 mx-auto mb-4" />
              <h3 className="text-xl text-white mb-2">AI Matching Engine</h3>
              <p className="text-dark-400 mb-4">
                Create visions and offers, then click "Find Matches" to discover connections
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                Create {createType.charAt(0).toUpperCase() + createType.slice(1)}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-dark-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {createType === 'lead' ? (
                <>
                  <input
                    type="text"
                    placeholder="Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                  <input
                    type="text"
                    placeholder="Company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                  <input
                    type="text"
                    placeholder="Interests (comma-separated)"
                    value={formData.interests}
                    onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                  <textarea
                    placeholder="Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 resize-none"
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                  <input
                    type="text"
                    placeholder="Tags (comma-separated)"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  />
                  {createType === 'offer' && (
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500"
                    >
                      <option value="service">Service</option>
                      <option value="product">Product</option>
                      <option value="collaboration">Collaboration</option>
                      <option value="investment">Investment</option>
                      <option value="other">Other</option>
                    </select>
                  )}
                </>
              )}
            </div>

            <button
              onClick={handleCreate}
              className="w-full mt-6 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-semibold transition"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

