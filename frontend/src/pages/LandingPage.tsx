import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Video,
  Mic,
  Sparkles,
  FileText,
  Clock,
  Shield,
  ChevronRight,
  Menu,
  X,
  Check,
  Zap,
  Users,
  LogIn,
} from 'lucide-react';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: <Mic className="w-6 h-6" />,
      title: 'Live Transcription',
      description: 'Real-time speech-to-text powered by OpenAI Whisper with <5 second latency.',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'AI Meeting Notes',
      description: 'Automatic summaries, action items, and key decisions generated during your call.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: <Video className="w-6 h-6" />,
      title: 'HD Video Calls',
      description: 'Crystal clear 1:1 video calls with WebRTC peer-to-peer technology.',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Call Recording',
      description: 'Every call is automatically recorded and saved to your secure cloud storage.',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: 'Searchable History',
      description: 'Find any conversation instantly with full-text search across all transcripts.',
      color: 'from-yellow-500 to-orange-500',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Privacy First',
      description: 'End-to-end encryption. Your data stays yours. Delete anytime.',
      color: 'from-indigo-500 to-purple-500',
    },
  ];

  const stats = [
    { value: '<5s', label: 'Transcription Latency' },
    { value: '99.9%', label: 'Uptime' },
    { value: '256-bit', label: 'Encryption' },
    { value: '∞', label: 'Call History' },
  ];

  return (
    <div className="min-h-screen bg-dark-950 bg-animated">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AceTime</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-dark-300 hover:text-white transition">Features</a>
              <a href="#how-it-works" className="text-dark-300 hover:text-white transition">How It Works</a>
              <Link to="/login" className="text-dark-300 hover:text-white transition flex items-center space-x-1">
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-full font-medium transition btn-glow"
              >
                Get Started Free
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden glass border-t border-white/10">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-dark-300 hover:text-white">Features</a>
              <a href="#how-it-works" className="block text-dark-300 hover:text-white">How It Works</a>
              <Link to="/login" className="block text-dark-300 hover:text-white">Sign In</Link>
              <Link
                to="/register"
                className="block bg-primary-500 text-white px-5 py-2 rounded-full font-medium text-center"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-primary-500/10 border border-primary-500/30 rounded-full px-4 py-2 mb-8">
              <Zap className="w-4 h-4 text-primary-400" />
              <span className="text-primary-300 text-sm font-medium">Now in Beta on TestFlight</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Video calls with{' '}
              <span className="gradient-text">AI superpowers</span>
            </h1>

            <p className="text-xl text-dark-300 max-w-2xl mx-auto mb-10">
              Every call transcribed in real-time. AI-generated notes, summaries, and action items.
              Never miss a detail again.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                to="/register"
                className="group flex items-center space-x-2 bg-white text-dark-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-dark-100 transition glow-primary btn-glow"
              >
                <Video className="w-5 h-5" />
                <span>Start Free Now</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </Link>
              <Link 
                to="/login"
                className="flex items-center space-x-2 text-dark-300 hover:text-white px-8 py-4 rounded-full font-medium border border-dark-700 hover:border-dark-500 transition"
              >
                <LogIn className="w-5 h-5" />
                <span>Sign In</span>
              </Link>
            </div>

            {/* Hero Image / Demo */}
            <div className="relative max-w-5xl mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 via-purple-500/20 to-pink-500/20 blur-3xl" />
              <div className="relative glass rounded-3xl p-2 glow-accent">
                <div className="bg-dark-900 rounded-2xl overflow-hidden">
                  {/* Mock Call Interface */}
                  <div className="aspect-video relative">
                    {/* Video area */}
                    <div className="absolute inset-0 bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-32 h-32 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                          <Users className="w-16 h-16 text-white" />
                        </div>
                        <p className="text-dark-400">Live call preview</p>
                      </div>
                    </div>

                    {/* Transcript overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-dark-950 to-transparent p-6">
                      <div className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <span className="text-primary-400 font-medium text-sm">Alex:</span>
                          <span className="text-white text-sm">Let's schedule the product launch for next Tuesday...</span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-accent-mint font-medium text-sm">Jordan:</span>
                          <span className="text-white text-sm">Sounds good! I'll prepare the marketing assets.</span>
                        </div>
                      </div>
                    </div>

                    {/* AI Notes sidebar */}
                    <div className="absolute top-4 right-4 w-72 glass rounded-xl p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300 text-sm font-medium">AI Notes</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start space-x-2">
                          <Check className="w-4 h-4 text-green-400 mt-0.5" />
                          <span className="text-dark-200">Product launch: Tuesday</span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <Check className="w-4 h-4 text-green-400 mt-0.5" />
                          <span className="text-dark-200">Jordan: Marketing assets</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold gradient-text mb-2">{stat.value}</div>
                <div className="text-dark-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto">
              Powerful features that transform how you communicate
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group glass rounded-2xl p-6 hover:border-primary-500/50 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-dark-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-dark-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How it works</h2>
            <p className="text-dark-400 text-lg">Get started in three simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Start or Join',
                description: 'Create a room and share the code, or join with a code from someone else.',
                icon: <Video className="w-8 h-8" />,
              },
              {
                step: '02',
                title: 'Talk Naturally',
                description: 'Have your conversation while AI transcribes and takes notes in real-time.',
                icon: <Mic className="w-8 h-8" />,
              },
              {
                step: '03',
                title: 'Review & Share',
                description: 'Access your transcript, AI notes, and recording anytime from your history.',
                icon: <FileText className="w-8 h-8" />,
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="text-8xl font-bold text-dark-800 absolute -top-4 -left-2">
                  {item.step}
                </div>
                <div className="relative glass rounded-2xl p-8 pt-16">
                  <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mb-4 text-primary-400">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-dark-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="download" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 via-purple-500/10 to-pink-500/10" />
            <div className="relative">
              <h2 className="text-4xl font-bold mb-4">Ready to transform your calls?</h2>
              <p className="text-dark-300 text-lg mb-8 max-w-xl mx-auto">
                Join the beta and be among the first to experience AI-powered video calling.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/register"
                  className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 rounded-full font-semibold transition btn-glow flex items-center space-x-2"
                >
                  <span>Create Free Account</span>
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/login"
                  className="text-dark-300 hover:text-white px-8 py-4 rounded-full font-medium border border-dark-700 hover:border-dark-500 transition flex items-center space-x-2"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-dark-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-lg flex items-center justify-center">
                <Video className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold">AceTime</span>
            </div>
            <div className="flex items-center space-x-6 text-dark-400 text-sm">
              <a href="#" className="hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>
            <div className="text-dark-500 text-sm mt-4 md:mt-0">
              © 2024 AceTime. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

