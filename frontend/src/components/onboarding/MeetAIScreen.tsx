import { motion } from 'framer-motion';
import { Sparkles, Bot, Zap, Brain } from 'lucide-react';

interface MeetAIScreenProps {
  onNext: () => void;
  onPrevious: () => void;
}

export default function MeetAIScreen({ onNext, onPrevious }: MeetAIScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl"
      >
        {/* AI Avatar Animation */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.8, type: 'spring' }}
          className="mb-8 relative"
        >
          <div className="relative inline-block">
            {/* Glow Effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-2xl opacity-50"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.7, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* AI Avatar */}
            <div className="relative w-32 h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 
                          rounded-full flex items-center justify-center shadow-2xl">
              <Bot className="w-16 h-16 text-white" />
              
              {/* Floating Sparkles */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    x: [0, Math.cos(i * 120 * Math.PI / 180) * 60],
                    y: [0, Math.sin(i * 120 * Math.PI / 180) * 60],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                    ease: 'easeInOut',
                  }}
                >
                  <Sparkles className="w-6 h-6 text-yellow-400" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-4xl md:text-5xl font-bold text-white mb-4"
        >
          Meet Your{' '}
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Assistant
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-lg text-dark-300 mb-12"
        >
          AceTime AI joins every call to help you stay focused, capture insights, and never miss important details.
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {[
            { icon: Brain, title: 'Real-time Transcription', desc: 'Every word captured instantly' },
            { icon: Zap, title: 'Smart Summaries', desc: 'Key points extracted automatically' },
            { icon: Sparkles, title: 'Action Items', desc: 'Tasks identified and tracked' },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
              className="glass-card p-6 rounded-xl border border-dark-700/50"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 
                            rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
              <p className="text-dark-400 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex items-center justify-center space-x-4"
        >
          <button
            onClick={onPrevious}
            className="px-6 py-3 glass-card border border-dark-700/50 text-dark-300 
                     hover:text-white rounded-xl transition-all duration-200"
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-500 
                     text-white font-semibold rounded-xl shadow-lg hover:shadow-xl 
                     transition-all duration-200"
          >
            Continue
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

