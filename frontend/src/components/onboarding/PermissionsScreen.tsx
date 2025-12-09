import { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Mic, Check, X } from 'lucide-react';

interface PermissionsScreenProps {
  onNext: () => void;
  onPrevious: () => void;
}

export default function PermissionsScreen({ onNext, onPrevious }: PermissionsScreenProps) {
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);

  const requestPermissions = async () => {
    setRequesting(true);
    
    try {
      // Request camera permission
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraGranted(true);
        cameraStream.getTracks().forEach(track => track.stop());
      } catch (err) {
        setCameraGranted(false);
      }

      // Request microphone permission
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicGranted(true);
        micStream.getTracks().forEach(track => track.stop());
      } catch (err) {
        setMicGranted(false);
      }
    } catch (err) {
      console.error('Permission request error:', err);
    } finally {
      setRequesting(false);
    }
  };

  const canContinue = cameraGranted !== null && micGranted !== null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl"
      >
        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-4xl md:text-5xl font-bold text-white mb-4"
        >
          Enable{' '}
          <span className="bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
            Permissions
          </span>
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-lg text-dark-300 mb-12"
        >
          Grant camera and microphone access to start making calls
        </motion.p>

        {/* Permission Cards */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="space-y-6 mb-12"
        >
          {/* Camera Permission */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className={`glass-card p-6 rounded-xl border-2 transition-all duration-300 ${
              cameraGranted === true
                ? 'border-green-500/50 bg-green-500/5'
                : cameraGranted === false
                ? 'border-red-500/50 bg-red-500/5'
                : 'border-dark-700/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  cameraGranted === true
                    ? 'bg-green-500/20'
                    : cameraGranted === false
                    ? 'bg-red-500/20'
                    : 'bg-primary-500/20'
                }`}>
                  <Camera className={`w-7 h-7 ${
                    cameraGranted === true
                      ? 'text-green-400'
                      : cameraGranted === false
                      ? 'text-red-400'
                      : 'text-primary-400'
                  }`} />
                </div>
                <div className="text-left">
                  <h3 className="text-white font-semibold text-lg">Camera</h3>
                  <p className="text-dark-400 text-sm">
                    {cameraGranted === true
                      ? 'Permission granted'
                      : cameraGranted === false
                      ? 'Permission denied'
                      : 'Required for video calls'}
                  </p>
                </div>
              </div>
              {cameraGranted !== null && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    cameraGranted ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}
                >
                  {cameraGranted ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Microphone Permission */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className={`glass-card p-6 rounded-xl border-2 transition-all duration-300 ${
              micGranted === true
                ? 'border-green-500/50 bg-green-500/5'
                : micGranted === false
                ? 'border-red-500/50 bg-red-500/5'
                : 'border-dark-700/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  micGranted === true
                    ? 'bg-green-500/20'
                    : micGranted === false
                    ? 'bg-red-500/20'
                    : 'bg-primary-500/20'
                }`}>
                  <Mic className={`w-7 h-7 ${
                    micGranted === true
                      ? 'text-green-400'
                      : micGranted === false
                      ? 'text-red-400'
                      : 'text-primary-400'
                  }`} />
                </div>
                <div className="text-left">
                  <h3 className="text-white font-semibold text-lg">Microphone</h3>
                  <p className="text-dark-400 text-sm">
                    {micGranted === true
                      ? 'Permission granted'
                      : micGranted === false
                      ? 'Permission denied'
                      : 'Required for audio calls'}
                  </p>
                </div>
              </div>
              {micGranted !== null && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    micGranted ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}
                >
                  {micGranted ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* Request Button */}
        {!canContinue && (
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={requestPermissions}
            disabled={requesting}
            className="px-8 py-4 bg-gradient-to-r from-primary-500 to-purple-500 
                     text-white font-semibold rounded-xl shadow-lg hover:shadow-xl 
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {requesting ? 'Requesting...' : 'Grant Permissions'}
          </motion.button>
        )}

        {/* Navigation Buttons */}
        {canContinue && (
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
        )}
      </motion.div>
    </div>
  );
}

