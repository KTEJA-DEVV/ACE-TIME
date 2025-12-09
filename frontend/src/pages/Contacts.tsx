import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquare,
  Phone,
  Video,
  Pin,
  UserPlus,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';
import { Skeleton, SkeletonList } from '../components/Skeleton';
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

interface Contact {
  _id: string;
  contact: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  conversationId: string;
  nickname?: string;
  tags: string[];
  lastInteractionAt: string;
  totalMessages: number;
  totalCalls: number;
  unreadCount: number;
  isPinned: boolean;
  lastMessage?: {
    content: string;
    sender: {
      _id: string;
      name: string;
      avatar?: string;
    };
    timestamp: string;
  };
  aiContext?: {
    summary?: string;
    keyTopics?: string[];
    relationship?: string;
  };
}

export default function Contacts() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch contacts
  useEffect(() => {
    if (accessToken) {
      fetchContacts();
    }
  }, [accessToken]);

  const fetchContacts = async () => {
    if (!accessToken) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/contacts`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to fetch contacts';
        setError(errorMessage);
        toast.error('Error', errorMessage);
      }
    } catch (error) {
      console.error('Fetch contacts error:', error);
      const errorMessage = 'Failed to fetch contacts';
      setError(errorMessage);
      toast.error('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts by search query
  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const contactName = (contact.nickname || contact.contact.name).toLowerCase();
    const email = contact.contact.email?.toLowerCase() || '';
    const tags = contact.tags.join(' ').toLowerCase();
    return contactName.includes(query) || email.includes(query) || tags.includes(query);
  });

  // Format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Handle contact click
  const handleContactClick = (contact: Contact) => {
    navigate(`/contacts/${contact._id}/chat`, {
      state: {
        contact,
        conversationId: contact.conversationId,
      },
    });
  };

  // Handle start call
  const handleStartCall = async (contact: Contact, video: boolean = true, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioOnly: !video,
          participants: [contact.contact._id],
          conversationId: contact.conversationId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/call/${data.roomId}`, {
          state: {
            returnPath: `/contacts/${contact._id}/chat`,
            conversationId: contact.conversationId,
            fromContacts: true,
          },
        });
        toast.success('Call Started', 'Starting call with transcription...');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error', errorData.error || 'Failed to start call');
      }
    } catch (error) {
      console.error('Start call error:', error);
      toast.error('Error', 'Failed to start call');
    }
  };

  // Handle pin/unpin
  const handlePin = async (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_URL}/api/contacts/${contact._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPinned: !contact.isPinned,
        }),
      });

      if (response.ok) {
        await fetchContacts(); // Refresh list
        toast.success('Updated', contact.isPinned ? 'Contact unpinned' : 'Contact pinned');
      }
    } catch (error) {
      console.error('Pin error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <Skeleton variant="text" width="120px" height={24} />
            <Skeleton variant="circular" width={40} height={40} />
          </div>
          <Skeleton variant="rounded" height={40} />
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <SkeletonList count={8} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50 px-4 py-3">
          <h1 className="text-white font-semibold text-xl">Contacts</h1>
        </header>
        <div className="flex-1">
          <ErrorState
            title="Failed to load contacts"
            message={error}
            onRetry={fetchContacts}
            variant="default"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-900 border-b border-dark-800/50 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-white font-semibold text-xl">Contacts</h1>
          <button
            onClick={() => navigate('/network')}
            className="p-2 rounded-lg hover:bg-dark-800/50 transition"
            title="Add contact"
          >
            <UserPlus className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary-500/50 transition"
          />
        </div>
      </header>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <MessageSquare className="w-16 h-16 text-dark-700 mb-4" />
            <h3 className="text-white font-medium text-lg mb-2">
              {searchQuery ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-dark-400 text-sm text-center max-w-xs">
              {searchQuery
                ? 'Try a different search term'
                : 'Start a conversation or add contacts from your network'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-dark-800/50">
            {filteredContacts.map((contact) => (
              <div
                key={contact._id}
                onClick={() => handleContactClick(contact)}
                className="px-4 py-3 hover:bg-dark-900/50 transition cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center">
                      {contact.contact.avatar ? (
                        <img
                          src={contact.contact.avatar}
                          alt={contact.contact.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-semibold">
                          {(contact.nickname || contact.contact.name).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {contact.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{contact.unreadCount}</span>
                      </div>
                    )}
                    {contact.isPinned && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                        <Pin className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white font-semibold text-sm truncate">
                        {contact.nickname || contact.contact.name}
                      </h3>
                      {contact.lastMessage && (
                        <span className="text-dark-400 text-xs flex-shrink-0 ml-2">
                          {formatRelativeTime(contact.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    {contact.lastMessage ? (
                      <p className="text-dark-400 text-sm truncate">
                        {contact.lastMessage.sender._id === user?._id ? 'You: ' : ''}
                        {contact.lastMessage.content}
                      </p>
                    ) : (
                      <p className="text-dark-500 text-sm italic">No messages yet</p>
                    )}
                    <div className="flex items-center space-x-2 mt-1">
                      {contact.totalCalls > 0 && (
                        <span className="text-dark-500 text-xs flex items-center space-x-1">
                          <Phone className="w-3 h-3" />
                          <span>{contact.totalCalls}</span>
                        </span>
                      )}
                      {contact.tags.length > 0 && (
                        <div className="flex items-center space-x-1">
                          {contact.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-primary-500/20 text-primary-300 text-xs rounded border border-primary-500/30"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      onClick={(e) => handleStartCall(contact, false, e)}
                      className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                      title="Audio call"
                    >
                      <Phone className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={(e) => handleStartCall(contact, true, e)}
                      className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                      title="Video call"
                    >
                      <Video className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={(e) => handlePin(contact, e)}
                      className="p-2 rounded-lg hover:bg-dark-800/50 transition"
                      title={contact.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin
                        className={`w-4 h-4 ${
                          contact.isPinned ? 'text-yellow-400 fill-yellow-400' : 'text-dark-400'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

