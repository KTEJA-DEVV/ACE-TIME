import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Shield, Volume2, Moon, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { toast } from '../components/Toast';

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged Out', 'You have been logged out successfully');
  };

  const settingsSections = [
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { label: 'Call Notifications', description: 'Get notified about incoming calls', enabled: true },
        { label: 'Message Notifications', description: 'Get notified about new messages', enabled: true },
        { label: 'Friend Requests', description: 'Get notified about friend requests', enabled: true },
      ],
    },
    {
      title: 'Privacy',
      icon: Shield,
      items: [
        { label: 'Profile Visibility', description: 'Control who can see your profile', enabled: true },
        { label: 'Call Recording', description: 'Allow calls to be recorded', enabled: true },
        { label: 'AI Processing', description: 'Allow AI to process your conversations', enabled: true },
      ],
    },
    {
      title: 'Audio & Video',
      icon: Volume2,
      items: [
        { label: 'Microphone', description: 'Default microphone settings', enabled: true },
        { label: 'Camera', description: 'Default camera settings', enabled: true },
        { label: 'Audio Quality', description: 'High quality audio', enabled: true },
      ],
    },
    {
      title: 'Appearance',
      icon: Moon,
      items: [
        { label: 'Dark Mode', description: 'Use dark theme', enabled: true },
        { label: 'Language', description: 'English (US)', enabled: false },
      ],
    },
  ];

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
              <h1 className="text-white font-semibold text-lg">Settings</h1>
              <p className="text-dark-400 text-xs">Customize your experience</p>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {settingsSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="glass-card rounded-2xl p-6 mb-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                <section.icon className="w-5 h-5 text-primary-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">{section.title}</h2>
            </div>

            <div className="space-y-4">
              {section.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="flex items-center justify-between p-4 bg-dark-800/30 rounded-lg hover:bg-dark-800/50 transition"
                >
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm mb-1">{item.label}</p>
                    <p className="text-dark-400 text-xs">{item.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={item.enabled}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Logout Section */}
        <div className="glass-card rounded-2xl p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}

