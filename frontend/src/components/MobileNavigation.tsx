import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Users, Clock, Settings } from 'lucide-react';
import { useAuthStore } from '../store/auth';

export default function MobileNavigation() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return null;

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/contacts', icon: Users, label: 'Contacts' },
    { path: '/history', icon: Clock, label: 'History' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  // Don't show on call pages
  if (location.pathname.startsWith('/call/') || location.pathname.startsWith('/private-call/')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-dark-800 bg-dark-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                         (item.path === '/home' && location.pathname === '/');
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary-400'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

