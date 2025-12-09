import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Upload, Check } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

interface ProfileSetupScreenProps {
  onComplete: () => void;
  onPrevious: () => void;
  user: any;
  setUser: (user: any) => void;
}

export default function ProfileSetupScreen({ onComplete, onPrevious, user, setUser }: ProfileSetupScreenProps) {
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      // Update user profile via API
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = useAuthStore.getState().accessToken;
      
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          avatar: avatar,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        onComplete();
      } else {
        // If API fails, just update locally and continue
        setUser({ ...user, name: name.trim(), avatar });
        onComplete();
      }
    } catch (error) {
      // If API fails, just update locally and continue
      setUser({ ...user, name: name.trim(), avatar });
      onComplete();
    } finally {
      setSaving(false);
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl w-full"
      >
        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-4xl md:text-5xl font-bold text-white mb-4"
        >
          Complete Your{' '}
          <span className="bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
            Profile
          </span>
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-lg text-dark-300 mb-12"
        >
          Add your name and avatar to personalize your experience
        </motion.p>

        {/* Avatar Upload */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary-500/50 
                          bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center 
                          cursor-pointer relative group"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-white text-4xl font-bold">
                    {name ? getInitials(name) : <User className="w-16 h-16" />}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 
                              transition-opacity flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white" />
                </div>
              </motion.div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-primary-400 hover:text-primary-300 text-sm font-medium transition"
            >
              {avatarPreview ? 'Change Avatar' : 'Upload Avatar'}
            </button>
          </div>
        </motion.div>

        {/* Name Input */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-8"
        >
          <label className="block text-left text-dark-300 mb-2">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 bg-dark-900/50 border border-dark-700/50 rounded-xl 
                     text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 
                     transition-all duration-200"
            autoFocus
          />
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex items-center justify-center space-x-4"
        >
          <button
            onClick={onPrevious}
            className="px-6 py-3 glass-card border border-dark-700/50 text-dark-300 
                     hover:text-white rounded-xl transition-all duration-200"
          >
            Back
          </button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 
                     text-white font-semibold rounded-xl shadow-lg hover:shadow-xl 
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center space-x-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>Complete Setup</span>
              </>
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

