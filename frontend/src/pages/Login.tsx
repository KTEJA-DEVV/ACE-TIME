import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validation
    const errors: { email?: string; password?: string } = {};
    if (!email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      if (rememberMe) {
        localStorage.setItem('rememberEmail', email);
      } else {
        localStorage.removeItem('rememberEmail');
      }
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: 'google' | 'apple') => {
    // TODO: Implement social login
    console.log(`Login with ${provider}`);
    // For now, just show a message
    setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login coming soon!`);
  };

  // Load remembered email
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width=%22100%22%20height=%22100%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cdefs%3E%3Cpattern%20id=%22grid%22%20width=%22100%22%20height=%22100%22%20patternUnits=%22userSpaceOnUse%22%3E%3Cpath%20d=%22M%20100%200%20L%200%200%200%20100%22%20fill=%22none%22%20stroke=%22%231a1a2e%22%20stroke-width=%221%22/%3E%3C/pattern%3E%3C/defs%3E%3Crect%20width=%22100%22%20height=%22100%22%20fill=%22url(%23grid)%22/%3E%3C/svg%3E')] opacity-30" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-8"
          >
            <Link to="/" className="inline-flex items-center space-x-3 group">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-14 h-14 bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30"
              >
                <Video className="w-7 h-7 text-white" />
              </motion.div>
              <span className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                AceTime
              </span>
            </Link>
            <p className="text-dark-400 mt-4 text-lg">Welcome back! Sign in to continue.</p>
          </motion.div>

          {/* Glass morphism card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-card rounded-3xl p-8 md:p-10 border border-white/10 shadow-2xl backdrop-blur-xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-center space-x-2"
                >
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Email field */}
              <div>
                <label className="block text-dark-300 text-sm font-medium mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                    }}
                    className={`w-full pl-12 pr-4 py-3.5 bg-dark-800/50 border ${
                      fieldErrors.email ? 'border-red-500/50' : 'border-dark-700'
                    } rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all`}
                    placeholder="you@example.com"
                  />
                </div>
                {fieldErrors.email && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-400 text-xs mt-1.5 ml-1"
                  >
                    {fieldErrors.email}
                  </motion.p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label className="block text-dark-300 text-sm font-medium mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                    }}
                    className={`w-full pl-12 pr-12 py-3.5 bg-dark-800/50 border ${
                      fieldErrors.password ? 'border-red-500/50' : 'border-dark-700'
                    } rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-400 text-xs mt-1.5 ml-1"
                  >
                    {fieldErrors.password}
                  </motion.p>
                )}
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-800 text-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-sm text-dark-300 group-hover:text-dark-200 transition">
                    Remember me
                  </span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-400 hover:text-primary-300 transition font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-primary-500/30 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </motion.button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dark-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-dark-900/50 text-dark-500">Or continue with</span>
                </div>
              </div>

              {/* Social login buttons */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 h-12 sm:h-12 md:h-14 bg-dark-800/50 border border-dark-700 rounded-xl text-white hover:bg-dark-800 transition group overflow-hidden"
                  style={{ borderRadius: '12px' }}
                >
                  <svg 
                    className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9" 
                    viewBox="0 0 24 24"
                    style={{ 
                      minWidth: '28px',
                      maxWidth: '36px'
                    }}
                  >
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-sm font-medium group-hover:text-white transition whitespace-nowrap">Google</span>
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => handleSocialLogin('apple')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 h-12 sm:h-12 md:h-14 bg-dark-800/50 border border-dark-700 rounded-xl text-white hover:bg-dark-800 transition group overflow-hidden"
                  style={{ borderRadius: '12px' }}
                >
                  <svg 
                    className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                    style={{ 
                      minWidth: '28px',
                      maxWidth: '36px'
                    }}
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.17 2.08-1.85 3.86-3.74 4.25z" />
                  </svg>
                  <span className="text-sm font-medium group-hover:text-white transition whitespace-nowrap">Apple</span>
                </motion.button>
              </div>

              {/* Sign up link */}
              <div className="mt-6 text-center">
                <span className="text-dark-400">Don't have an account? </span>
                <Link
                  to="/register"
                  className="text-primary-400 hover:text-primary-300 font-semibold transition"
                >
                  Sign Up
                </Link>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
