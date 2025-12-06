import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Calendar, Save, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';

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

export default function Profile() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!accessToken || !user) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update user in store
        useAuthStore.getState().setUser(data.user);
        toast.success('Profile Updated', 'Your profile has been saved successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error('Error', errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
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
              <h1 className="text-white font-semibold text-lg">Profile</h1>
              <p className="text-dark-400 text-xs">Manage your account</p>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Profile Avatar Section */}
        <div className="glass-card rounded-2xl p-8 mb-6 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-3xl">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <h2 className="text-white font-semibold text-xl mb-1">{user?.name || 'User'}</h2>
          <p className="text-dark-400 text-sm">{user?.email || ''}</p>
        </div>

        {/* Profile Form */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold text-lg mb-6">Personal Information</h3>
          
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="flex items-center space-x-2 text-dark-300 text-sm font-medium mb-2">
                <User className="w-4 h-4" />
                <span>Full Name</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500/50 transition"
                placeholder="Enter your name"
              />
            </div>

            {/* Email Field (Read-only) */}
            <div>
              <label className="flex items-center space-x-2 text-dark-300 text-sm font-medium mb-2">
                <Mail className="w-4 h-4" />
                <span>Email Address</span>
              </label>
              <div className="px-4 py-3 bg-dark-800/30 border border-dark-700 rounded-lg text-dark-400 text-sm">
                {user?.email || 'No email'}
              </div>
              <p className="text-dark-500 text-xs mt-1">Email cannot be changed</p>
            </div>

            {/* Account Info */}
            <div>
              <label className="flex items-center space-x-2 text-dark-300 text-sm font-medium mb-2">
                <Calendar className="w-4 h-4" />
                <span>User ID</span>
              </label>
              <div className="px-4 py-3 bg-dark-800/30 border border-dark-700 rounded-lg text-dark-400 text-sm font-mono">
                {user?._id || 'N/A'}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full mt-6 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

