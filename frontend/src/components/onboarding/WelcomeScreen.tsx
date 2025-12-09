import { motion } from 'framer-motion';
import { Video, Sparkles, MessageSquare } from 'lucide-react';

interface WelcomeScreenProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center max-w-2xl"
      >
        {/* Logo Animation */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            <motion.div
              className="w-24 h-24 bg-gradient-to-br from-primary-500 to-purple-500 rounded-3xl 
                       flex items-center justify-center shadow-2xl"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(139, 92, 246, 0.7)',
                  '0 0 0 20px rgba(139, 92, 246, 0)',
                  '0 0 0 0 rgba(139, 92, 246, 0)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Video className="w-12 h-12 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-5xl md:text-6xl font-bold text-white mb-4"
        >
          Welcome to{' '}
          <span className="bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
            AceTime
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-xl text-dark-300 mb-12"
        >
          Next-gen communication with AI-powered transcription, insights, and collaboration
        </motion.p>

        {/* Features Grid */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {[
            { icon: Video, title: 'HD Video Calls', color: 'from-blue-500 to-cyan-500' },
            { icon: Sparkles, title: 'AI Assistant', color: 'from-purple-500 to-pink-500' },
            { icon: MessageSquare, title: 'Smart Messaging', color: 'from-green-500 to-emerald-500' },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
              className="glass-card p-6 rounded-xl border border-dark-700/50 text-center"
            >
              <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-br ${feature.color} rounded-xl 
                             flex items-center justify-center`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg">{feature.title}</h3>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNext}
          className="px-8 py-4 bg-gradient-to-r from-primary-500 to-purple-500 
                   text-white font-semibold rounded-xl shadow-lg hover:shadow-xl 
                   transition-all duration-200 text-lg"
        >
          Get Started
        </motion.button>
      </motion.div>
    </div>
  );
}

