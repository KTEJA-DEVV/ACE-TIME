import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Bell, Video, Sparkles, Shield, Palette, 
  LogOut, Trash2, Save, RotateCcw, Upload, Check, ChevronDown
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';

interface UserSettings {
  notifications: {
    incomingCalls: boolean;
    newMessages: boolean;
    friendRequests: boolean;
    aiInsights: boolean;
    callRecordings: boolean;
  };
  callQuality: {
    videoResolution: '720p' | '1080p' | 'auto';
    bandwidth: 'low' | 'medium' | 'high' | 'auto';
    audioQuality: 'low' | 'medium' | 'high';
  };
  ai: {
    enabled: boolean;
    voicePreference: 'male' | 'female' | 'neutral';
    autoTranscribe: boolean;
    autoSummarize: boolean;
  };
  privacy: {
    whoCanCall: 'everyone' | 'contacts' | 'nobody';
    chatHistory: 'forever' | '30days' | '7days' | 'delete';
    profileVisibility: 'public' | 'contacts' | 'private';
  };
  appearance: {
    theme: 'dark' | 'light' | 'auto';
    accentColor: 'purple' | 'blue' | 'green' | 'red' | 'orange';
  };
}

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.PROD) return window.location.origin;
  return 'http://localhost:3001';
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, setUser, accessToken } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Profile
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  
  // Settings
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      incomingCalls: true,
      newMessages: true,
      friendRequests: true,
      aiInsights: true,
      callRecordings: true,
    },
    callQuality: {
      videoResolution: 'auto',
      bandwidth: 'auto',
      audioQuality: 'high',
    },
    ai: {
      enabled: true,
      voicePreference: 'neutral',
      autoTranscribe: true,
      autoSummarize: true,
    },
    privacy: {
      whoCanCall: 'everyone',
      chatHistory: 'forever',
      profileVisibility: 'public',
    },
    appearance: {
      theme: 'dark',
      accentColor: 'purple',
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const API_URL = getApiUrl();
      const response = await fetch(`${API_URL}/api/users/settings`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
        if (data.bio) {
          setBio(data.bio);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accessToken) return;
    
    setSaving(true);
    try {
      const API_URL = getApiUrl();
      
      // Save profile
      const profileResponse = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name, avatar, bio }),
      });

      // Save settings
      const settingsResponse = await fetch(`${API_URL}/api/users/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ settings }),
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData.user) {
          setUser(profileData.user);
        }
      }

      if (settingsResponse.ok || profileResponse.ok) {
        toast.success('Settings Saved', 'Your preferences have been updated');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error: any) {
      toast.error('Save Failed', error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!accessToken) return;
    
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const API_URL = getApiUrl();
      const response = await fetch(`${API_URL}/api/users/settings/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('Settings Reset', 'All settings have been reset to defaults');
      }
    } catch (error: any) {
      toast.error('Reset Failed', error.message || 'Failed to reset settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const API_URL = getApiUrl();
      const response = await fetch(`${API_URL}/api/users/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        logout();
        navigate('/');
        toast.success('Account Deleted', 'Your account has been permanently deleted');
      } else {
        throw new Error('Failed to delete account');
      }
    } catch (error: any) {
      toast.error('Delete Failed', error.message || 'Failed to delete account');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        setAvatar(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profile: true,
    notifications: false,
    callQuality: false,
    ai: false,
    privacy: false,
    appearance: false,
    account: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isMobile = window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-dark-950 bg-animated pb-16 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-dark-800/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/home')}
              className="p-2 glass-card rounded-lg hover:bg-dark-800/50"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-white font-semibold text-lg">Settings</h1>
              <p className="text-dark-400 text-xs">Customize your experience</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 glass-card border border-dark-700/50 text-dark-300 
                       hover:text-white rounded-lg transition flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm">Reset</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-primary-500 to-purple-500 
                       text-white font-semibold rounded-lg shadow-lg hover:shadow-xl 
                       transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-sm">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="text-sm">Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Settings Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Profile Section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => isMobile && toggleSection('profile')}
            className={`w-full flex items-center justify-between p-6 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-primary-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">Profile</h2>
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${expandedSections.profile ? 'rotate-180' : ''}`} />
            )}
          </button>
          <div className={`px-6 pb-6 ${isMobile && !expandedSections.profile ? 'hidden' : ''}`}>

          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary-500/50 
                              bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center 
                              cursor-pointer relative group" onClick={() => fileInputRef.current?.click()}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-white text-2xl font-bold">
                      {name ? getInitials(name) : <User className="w-12 h-12" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 
                                transition-opacity flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <label className="block text-dark-300 text-sm mb-2">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                           text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 
                           transition-all duration-200"
                  placeholder="Your name"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-dark-300 text-sm mb-2">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 
                         transition-all duration-200 resize-none"
                placeholder="Tell us about yourself..."
              />
              <p className="text-dark-500 text-xs mt-1">{bio.length}/500</p>
            </div>
          </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => isMobile && toggleSection('notifications')}
            className={`w-full flex items-center justify-between p-6 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">Notifications</h2>
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${expandedSections.notifications ? 'rotate-180' : ''}`} />
            )}
          </button>
          <div className={`px-6 pb-6 ${isMobile && !expandedSections.notifications ? 'hidden' : ''}`}>

          <div className="space-y-4">
            {[
              { key: 'incomingCalls', label: 'Incoming Calls', desc: 'Get notified about incoming calls' },
              { key: 'newMessages', label: 'New Messages', desc: 'Get notified about new messages' },
              { key: 'friendRequests', label: 'Friend Requests', desc: 'Get notified about friend requests' },
              { key: 'aiInsights', label: 'AI Insights', desc: 'Get notified when AI generates insights' },
              { key: 'callRecordings', label: 'Call Recordings', desc: 'Get notified when recordings are ready' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-dark-800/30 rounded-lg">
                <div className="flex-1">
                  <p className="text-white font-medium text-sm mb-1">{item.label}</p>
                  <p className="text-dark-400 text-xs">{item.desc}</p>
                </div>
                <ToggleSwitch
                  checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                  onChange={(checked) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, [item.key]: checked }
                  })}
                />
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Call Quality Section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => isMobile && toggleSection('callQuality')}
            className={`w-full flex items-center justify-between p-6 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">Call Quality</h2>
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${expandedSections.callQuality ? 'rotate-180' : ''}`} />
            )}
          </button>
          <div className={`px-6 pb-6 ${isMobile && !expandedSections.callQuality ? 'hidden' : ''}`}>

          <div className="space-y-4">
            <div>
              <label className="block text-dark-300 text-sm mb-2">Video Resolution</label>
              <select
                value={settings.callQuality.videoResolution}
                onChange={(e) => setSettings({
                  ...settings,
                  callQuality: { ...settings.callQuality, videoResolution: e.target.value as any }
                })}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white focus:outline-none focus:border-primary-500 transition-all"
              >
                <option value="auto">Auto (Recommended)</option>
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>

            <div>
              <label className="block text-dark-300 text-sm mb-2">Bandwidth</label>
              <select
                value={settings.callQuality.bandwidth}
                onChange={(e) => setSettings({
                  ...settings,
                  callQuality: { ...settings.callQuality, bandwidth: e.target.value as any }
                })}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white focus:outline-none focus:border-primary-500 transition-all"
              >
                <option value="auto">Auto</option>
                <option value="low">Low (Data Saver)</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-dark-300 text-sm mb-2">Audio Quality</label>
              <select
                value={settings.callQuality.audioQuality}
                onChange={(e) => setSettings({
                  ...settings,
                  callQuality: { ...settings.callQuality, audioQuality: e.target.value as any }
                })}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white focus:outline-none focus:border-primary-500 transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High (Recommended)</option>
              </select>
            </div>
          </div>
          </div>
        </div>

        {/* AI Settings Section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => isMobile && toggleSection('ai')}
            className={`w-full flex items-center justify-between p-6 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">AI Settings</h2>
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${expandedSections.ai ? 'rotate-180' : ''}`} />
            )}
          </button>
          <div className={`px-6 pb-6 ${isMobile && !expandedSections.ai ? 'hidden' : ''}`}>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-dark-800/30 rounded-lg">
              <div className="flex-1">
                <p className="text-white font-medium text-sm mb-1">Enable AI Assistant</p>
                <p className="text-dark-400 text-xs">Allow AI to join your calls</p>
              </div>
              <ToggleSwitch
                checked={settings.ai.enabled}
                onChange={(checked) => setSettings({
                  ...settings,
                  ai: { ...settings.ai, enabled: checked }
                })}
              />
            </div>

            <div>
              <label className="block text-dark-300 text-sm mb-2">Voice Preference</label>
              <select
                value={settings.ai.voicePreference}
                onChange={(e) => setSettings({
                  ...settings,
                  ai: { ...settings.ai, voicePreference: e.target.value as any }
                })}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white focus:outline-none focus:border-primary-500 transition-all"
              >
                <option value="neutral">Neutral</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800/30 rounded-lg">
              <div className="flex-1">
                <p className="text-white font-medium text-sm mb-1">Auto Transcribe</p>
                <p className="text-dark-400 text-xs">Automatically transcribe calls</p>
              </div>
              <ToggleSwitch
                checked={settings.ai.autoTranscribe}
                onChange={(checked) => setSettings({
                  ...settings,
                  ai: { ...settings.ai, autoTranscribe: checked }
                })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800/30 rounded-lg">
              <div className="flex-1">
                <p className="text-white font-medium text-sm mb-1">Auto Summarize</p>
                <p className="text-dark-400 text-xs">Automatically generate call summaries</p>
              </div>
              <ToggleSwitch
                checked={settings.ai.autoSummarize}
                onChange={(checked) => setSettings({
                  ...settings,
                  ai: { ...settings.ai, autoSummarize: checked }
                })}
              />
            </div>
          </div>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => isMobile && toggleSection('privacy')}
            className={`w-full flex items-center justify-between p-6 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">Privacy</h2>
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${expandedSections.privacy ? 'rotate-180' : ''}`} />
            )}
          </button>
          <div className={`px-6 pb-6 ${isMobile && !expandedSections.privacy ? 'hidden' : ''}`}>

          <div className="space-y-4">
            <div>
              <label className="block text-dark-300 text-sm mb-2">Who Can Call You</label>
              <select
                value={settings.privacy.whoCanCall}
                onChange={(e) => setSettings({
                  ...settings,
                  privacy: { ...settings.privacy, whoCanCall: e.target.value as any }
                })}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white focus:outline-none focus:border-primary-500 transition-all"
              >
                <option value="everyone">Everyone</option>
                <option value="contacts">Contacts Only</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            <div>
              <label className="block text-dark-300 text-sm mb-2">Chat History</label>
              <select
                value={settings.privacy.chatHistory}
                onChange={(e) => setSettings({
                  ...settings,
                  privacy: { ...settings.privacy, chatHistory: e.target.value as any }
                })}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white focus:outline-none focus:border-primary-500 transition-all"
              >
                <option value="forever">Keep Forever</option>
                <option value="30days">30 Days</option>
                <option value="7days">7 Days</option>
                <option value="delete">Delete Immediately</option>
              </select>
            </div>

            <div>
              <label className="block text-dark-300 text-sm mb-2">Profile Visibility</label>
              <select
                value={settings.privacy.profileVisibility}
                onChange={(e) => setSettings({
                  ...settings,
                  privacy: { ...settings.privacy, profileVisibility: e.target.value as any }
                })}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white focus:outline-none focus:border-primary-500 transition-all"
              >
                <option value="public">Public</option>
                <option value="contacts">Contacts Only</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => isMobile && toggleSection('appearance')}
            className={`w-full flex items-center justify-between p-6 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Palette className="w-5 h-5 text-orange-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">Appearance</h2>
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${expandedSections.appearance ? 'rotate-180' : ''}`} />
            )}
          </button>
          <div className={`px-6 pb-6 ${isMobile && !expandedSections.appearance ? 'hidden' : ''}`}>

          <div className="space-y-4">
            <div>
              <label className="block text-dark-300 text-sm mb-2">Theme</label>
              <select
                value={settings.appearance.theme}
                onChange={(e) => setSettings({
                  ...settings,
                  appearance: { ...settings.appearance, theme: e.target.value as any }
                })}
                className="w-full px-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg 
                         text-white focus:outline-none focus:border-primary-500 transition-all"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>

            <div>
              <label className="block text-dark-300 text-sm mb-2">Accent Color</label>
              <div className="grid grid-cols-5 gap-3">
                {(['purple', 'blue', 'green', 'red', 'orange'] as const).map((color) => (
                  <button
                    key={color}
                    onClick={() => setSettings({
                      ...settings,
                      appearance: { ...settings.appearance, accentColor: color }
                    })}
                    className={`h-12 rounded-lg border-2 transition-all ${
                      settings.appearance.accentColor === color
                        ? `border-${color}-500 bg-${color}-500/20`
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                    style={{
                      backgroundColor: settings.appearance.accentColor === color 
                        ? `var(--${color}-500)` 
                        : undefined,
                      opacity: settings.appearance.accentColor === color ? 0.2 : 1,
                    }}
                  >
                    {settings.appearance.accentColor === color && (
                      <Check className="w-5 h-5 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => isMobile && toggleSection('account')}
            className={`w-full flex items-center justify-between p-6 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">Account</h2>
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${expandedSections.account ? 'rotate-180' : ''}`} />
            )}
          </button>
          <div className={`px-6 pb-6 ${isMobile && !expandedSections.account ? 'hidden' : ''}`}>

          <div className="space-y-4">
            <button
              onClick={() => {
                logout();
                navigate('/');
                toast.success('Logged Out', 'You have been logged out successfully');
              }}
              className="w-full flex items-center justify-center space-x-3 px-4 py-3 
                       bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg 
                       text-red-400 hover:text-red-300 transition"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center space-x-3 px-4 py-3 
                       bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg 
                       text-red-400 hover:text-red-300 transition"
            >
              <Trash2 className="w-5 h-5" />
              <span className="font-medium">Delete Account</span>
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 max-w-md mx-4 border border-red-500/30">
            <h3 className="text-white font-semibold text-lg mb-2">Delete Account</h3>
            <p className="text-dark-300 text-sm mb-6">
              Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data.
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 glass-card border border-dark-700/50 text-dark-300 
                         hover:text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white 
                         font-semibold rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 
                    peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full 
                    peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
                    after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 
                    after:transition-all peer-checked:bg-primary-500"></div>
    </label>
  );
}
