import { motion } from 'framer-motion';
import { Users, Bot, Video, MessageSquare } from 'lucide-react';

interface HowAIScreenProps {
  onNext: () => void;
  onPrevious: () => void;
}

export default function HowAIScreen({ onNext, onPrevious }: HowAIScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-4xl"
      >
        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-4xl md:text-5xl font-bold text-white mb-4"
        >
          How AI{' '}
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Joins Your Calls
          </span>
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-lg text-dark-300 mb-12"
        >
          AceTime AI appears as a third participant in every call, working silently in the background.
        </motion.p>

        {/* Visual Flow */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="relative mb-12"
        >
          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {/* User 1 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full 
                            flex items-center justify-center mb-4 shadow-xl">
                <Users className="w-12 h-12 text-white" />
              </div>
              <p className="text-white font-medium">You</p>
            </motion.div>

            {/* Arrow */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="hidden md:block"
            >
              <div className="flex items-center justify-center space-x-2">
                <div className="w-12 h-1 bg-gradient-to-r from-primary-500 to-purple-500" />
                <Video className="w-6 h-6 text-primary-400" />
                <div className="w-12 h-1 bg-gradient-to-r from-purple-500 to-primary-500" />
              </div>
            </motion.div>

            {/* AI */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex flex-col items-center relative"
            >
              <motion.div
                className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full 
                          flex items-center justify-center mb-4 shadow-xl relative"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(139, 92, 246, 0.5)',
                    '0 0 40px rgba(139, 92, 246, 0.8)',
                    '0 0 20px rgba(139, 92, 246, 0.5)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Bot className="w-12 h-12 text-white" />
              </motion.div>
              <p className="text-white font-medium">AI Assistant</p>
            </motion.div>

            {/* Arrow */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="hidden md:block"
            >
              <div className="flex items-center justify-center space-x-2">
                <div className="w-12 h-1 bg-gradient-to-r from-primary-500 to-purple-500" />
                <Video className="w-6 h-6 text-primary-400" />
                <div className="w-12 h-1 bg-gradient-to-r from-purple-500 to-primary-500" />
              </div>
            </motion.div>

            {/* User 2 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full 
                            flex items-center justify-center mb-4 shadow-xl">
                <Users className="w-12 h-12 text-white" />
              </div>
              <p className="text-white font-medium">Team Member</p>
            </motion.div>
          </div>
        </motion.div>

        {/* What AI Does */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
        >
          {[
            { icon: MessageSquare, title: 'Transcribes', desc: 'Real-time speech-to-text for every participant' },
            { icon: Bot, title: 'Summarizes', desc: 'Key points and action items extracted automatically' },
          ].map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
              className="glass-card p-6 rounded-xl border border-dark-700/50"
            >
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 
                              rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                  <p className="text-dark-400 text-sm">{item.desc}</p>
                </div>
              </div>
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

