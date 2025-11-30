import { create } from 'zustand';
import { parseApiError, getUserFriendlyMessage } from '../utils/errorHandler';
import { toast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  settings: {
    defaultMic: boolean;
    defaultCamera: boolean;
    autoRecord: boolean;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadStoredAuth: () => void;
  refreshAccessToken: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ error: null });
    
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Check if response has content before parsing JSON
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text.trim()) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error('Invalid response from server');
          }
        } else {
          throw new Error('Empty response from server');
        }
      } else {
        const text = await response.text();
        throw new Error(`Server error: ${text || 'Unknown error'}`);
      }

      if (!response.ok) {
        const error = parseApiError(data);
        const message = getUserFriendlyMessage(error);
        set({ error: message });
        throw new Error(message);
      }
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        error: null,
      });

      toast.success('Welcome back!', `Logged in as ${data.user.name}`);
    } catch (error: any) {
      // Abort error (timeout)
      if (error.name === 'AbortError') {
        const message = 'Request timed out. Please check if the backend is running.';
        set({ error: message });
        toast.error('Timeout Error', message);
        throw new Error(message);
      }
      
      // Network error
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const message = 'Unable to connect to server. Please check if the backend is running on port 3001.';
        set({ error: message });
        toast.error('Connection Error', message);
        throw new Error(message);
      }
      
      // Re-throw other errors
      set({ error: error.message || 'Login failed. Please try again.' });
      throw error;
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ error: null });
    
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      // Handle empty or non-JSON responses
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text.trim()) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error('Invalid response from server. Please try again.');
          }
        } else {
          throw new Error('Empty response from server. Please check if the backend is running.');
        }
      } else {
        const text = await response.text();
        throw new Error(`Server error: ${text || 'Unknown error'}`);
      }

      if (!response.ok) {
        const error = parseApiError(data);
        const message = getUserFriendlyMessage(error);
        set({ error: message });
        throw new Error(message);
      }
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        error: null,
      });

      toast.success('Account created!', `Welcome to AceTime, ${data.user.name}`);
    } catch (error: any) {
      // Network error
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const message = 'Unable to connect to server. Please try again.';
        set({ error: message });
        toast.error('Connection Error', message);
        throw new Error(message);
      }
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });

    toast.info('Logged out', 'You have been signed out.');
  },

  loadStoredAuth: async () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userJson = localStorage.getItem('user');

    if (accessToken && refreshToken && userJson) {
      try {
        const user = JSON.parse(userJson);
        
        // Verify token is still valid
        try {
          const response = await fetch(`${API_URL}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          
          if (!response.ok) {
            // Token invalid, try refresh
            const refreshed = await get().refreshAccessToken();
            if (!refreshed) {
              // Both failed, clear and logout
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
              set({ isLoading: false, isAuthenticated: false, user: null, accessToken: null, refreshToken: null });
              return;
            }
            // Use new token
            const newToken = get().accessToken;
            set({
              user,
              accessToken: newToken,
              refreshToken: get().refreshToken || refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return;
          }
        } catch (verifyError) {
          console.error('Token verification failed:', verifyError);
          // Network error, assume token is valid for now
        }
        
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        // Clear corrupted data
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        set({ isLoading: false, error: null });
      }
    } else {
      set({ isLoading: false, error: null });
    }
  },

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh token expired, logout
        get().logout();
        return false;
      }

      const data = await response.json();
      
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken,
      });

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      get().logout();
      return false;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

