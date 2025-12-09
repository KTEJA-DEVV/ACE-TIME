import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '../store/onboarding';
import { useAuthStore } from '../store/auth';
import WelcomeScreen from './onboarding/WelcomeScreen';
import MeetAIScreen from './onboarding/MeetAIScreen';
import HowAIScreen from './onboarding/HowAIScreen';
import PermissionsScreen from './onboarding/PermissionsScreen';
import ProfileSetupScreen from './onboarding/ProfileSetupScreen';
import { X } from 'lucide-react';

const TOTAL_STEPS = 5;

export default function Onboarding() {
  const { isCompleted, setCompleted, currentStep, setCurrentStep } = useOnboardingStore();
  const { user, setUser, isAuthenticated } = useAuthStore();
  const [direction, setDirection] = useState(1);

  // Don't show if already completed or not authenticated
  if (isCompleted || !isAuthenticated) return null;

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setDirection(1);
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setCompleted(true);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const renderScreen = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeScreen onNext={handleNext} onSkip={handleSkip} />;
      case 1:
        return <MeetAIScreen onNext={handleNext} onPrevious={handlePrevious} />;
      case 2:
        return <HowAIScreen onNext={handleNext} onPrevious={handlePrevious} />;
      case 3:
        return <PermissionsScreen onNext={handleNext} onPrevious={handlePrevious} />;
      case 4:
        return <ProfileSetupScreen onComplete={handleComplete} onPrevious={handlePrevious} user={user} setUser={setUser} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-dark-950 overflow-hidden">
      {/* Skip Button */}
      {currentStep < TOTAL_STEPS - 1 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleSkip}
          className="absolute top-6 right-6 z-50 px-4 py-2 glass-card rounded-lg 
                     border border-dark-700/50 text-dark-300 hover:text-white 
                     transition-all duration-200 flex items-center space-x-2"
        >
          <X className="w-4 h-4" />
          <span className="text-sm font-medium">Skip</span>
        </motion.button>
      )}

      {/* Progress Indicator */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-dark-800 z-40">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-500 to-purple-500"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
      </div>

      {/* Screen Content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="w-full h-full"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>

      {/* Step Indicators */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 z-40">
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
          <motion.div
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentStep
                ? 'w-8 bg-primary-500'
                : index < currentStep
                ? 'w-2 bg-primary-500/50'
                : 'w-2 bg-dark-700'
            }`}
            initial={false}
            animate={{
              width: index === currentStep ? 32 : 8,
              backgroundColor:
                index === currentStep
                  ? 'rgb(139, 92, 246)'
                  : index < currentStep
                  ? 'rgba(139, 92, 246, 0.5)'
                  : 'rgb(31, 41, 55)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

