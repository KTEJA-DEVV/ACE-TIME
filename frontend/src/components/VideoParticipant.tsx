import { useEffect, useRef, useState } from 'react';
import { FiVideoOff as VideoOff, FiMic as Mic, FiMicOff as MicOff } from 'react-icons/fi';
import { useAudioLevel } from '../hooks/useAudioLevel';
import { SpeakingBorder, AudioWaveform, SpeakingPulse } from './SpeakingIndicator';

interface VideoParticipantProps {
  stream: MediaStream | null;
  userName: string;
  userId?: string;
  avatar?: string;
  isVideoOff: boolean;
  isMuted: boolean;
  isLocal?: boolean;
  className?: string;
  isSpeaking?: boolean; // Optional: can be passed from parent for better control
  audioLevel?: number; // Optional: can be passed from parent
}

export default function VideoParticipant({
  stream,
  userName,
  userId: _userId,
  avatar,
  isVideoOff,
  isMuted,
  isLocal = false,
  className = '',
  isSpeaking: externalIsSpeaking,
  audioLevel: externalAudioLevel,
}: VideoParticipantProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  // Detect audio level if not provided externally
  const { audioLevel: detectedAudioLevel, isSpeaking: detectedIsSpeaking } = useAudioLevel({
    stream: isMuted ? null : stream, // Only detect if not muted
    threshold: 0.015,
    smoothing: 0.8,
    enabled: !isMuted && !!stream,
  });

  // Use external values if provided, otherwise use detected values
  const isSpeaking = externalIsSpeaking !== undefined ? externalIsSpeaking : detectedIsSpeaking;
  const audioLevel = externalAudioLevel !== undefined ? externalAudioLevel : detectedAudioLevel;

  // Check if stream has video track
  useEffect(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      const hasTrack = videoTracks.length > 0 && videoTracks[0].enabled && !videoTracks[0].muted;
      setHasVideoTrack(hasTrack);
      console.log('[VIDEO PARTICIPANT] Video track check:', {
        hasStream: true,
        trackCount: videoTracks.length,
        trackEnabled: videoTracks[0]?.enabled,
        trackMuted: videoTracks[0]?.muted,
        trackReadyState: videoTracks[0]?.readyState,
        hasVideoTrack: hasTrack,
      });
    } else {
      setHasVideoTrack(false);
    }
  }, [stream]);

  // CRITICAL: Track stream ID and track count to detect changes even if stream object reference is the same
  // These must be computed outside useEffect so they can be used in the dependency array
  const videoTracks = stream?.getVideoTracks() || [];
  const videoTrack = videoTracks[0];
  const streamId = stream?.id || '';
  const videoTrackId = videoTrack?.id || '';
  const videoTrackCount = videoTracks.length;

  // Handle video stream attachment and playback
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      console.warn('[VIDEO PARTICIPANT] Video element ref is null');
      return;
    }
    
    // CRITICAL: Set required attributes for video playback
    videoElement.setAttribute('autoplay', 'true');
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    if (isLocal) {
      videoElement.setAttribute('muted', 'true');
    }
    
    // Determine if we should show video
    const trackExists = !!videoTrack;
    const trackEnabled = videoTrack?.enabled && !videoTrack.muted;
    const trackActive = videoTrack?.readyState === 'live';
    const shouldShowVideo = !isVideoOff && trackExists && trackEnabled && trackActive;
    
    console.log('[VIDEO PARTICIPANT] Video state check:', {
      hasStream: !!stream,
      streamId: stream?.id,
      trackExists,
      trackEnabled,
      trackActive,
      trackReadyState: videoTrack?.readyState,
      isVideoOff,
      shouldShowVideo,
      userName,
      isLocal,
    });
    
    if (shouldShowVideo && stream && videoTrack) {
      // CRITICAL: Always set srcObject when stream changes or tracks are added
      const currentSrcObject = videoElement.srcObject as MediaStream | null;
      const streamChanged = !currentSrcObject || currentSrcObject.id !== stream.id;
      
      // Also check if tracks changed (important for merged streams that get tracks added incrementally)
      const currentVideoTracks = currentSrcObject?.getVideoTracks() || [];
      const currentVideoTrackId = currentVideoTracks[0]?.id;
      const newVideoTrackId = videoTrack.id;
      const tracksChanged = currentVideoTrackId !== newVideoTrackId;
      
      if (streamChanged || tracksChanged) {
        console.log('[VIDEO PARTICIPANT] 🔄 Setting new video stream:', {
          oldStreamId: currentSrcObject?.id,
          newStreamId: stream.id,
          oldTrackId: currentVideoTrackId,
          newTrackId: newVideoTrackId,
          streamChanged,
          tracksChanged,
          userName,
          isLocal,
        });
        
        // Clear first to force update
        videoElement.srcObject = null;
        
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          if (videoElement && stream) {
            // CRITICAL: Set srcObject
            videoElement.srcObject = stream;
            console.log('[VIDEO PARTICIPANT] ✅ Stream attached to video element:', {
              streamId: stream.id,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              videoTrackId: videoTrack.id,
              userName,
            });
            
            // CRITICAL: For remote streams, ensure NOT muted
            if (!isLocal && videoElement.muted) {
              console.warn('[VIDEO PARTICIPANT] ⚠️ Remote video is muted, unmuting...');
              videoElement.muted = false;
            }
            
            // Force play with retry logic
            const attemptPlay = (retries = 3): Promise<void> => {
              return videoElement.play()
                .then(() => {
                  console.log('[VIDEO PARTICIPANT] ✅ Video playing successfully:', {
                    userName,
                    isLocal,
                    currentTime: videoElement.currentTime,
                    readyState: videoElement.readyState,
                  });
                  setIsVideoPlaying(true);
                })
                .catch((error) => {
                  console.error('[VIDEO PARTICIPANT] ❌ Play error:', {
                    userName,
                    error: error.message,
                    retries,
                  });
                  
                  if (retries > 0) {
                    console.log('[VIDEO PARTICIPANT] 🔄 Retrying play, attempts left:', retries);
                    return new Promise((resolve) => {
                  setTimeout(() => {
                        attemptPlay(retries - 1).then(resolve).catch(resolve);
                      }, 200);
                    });
                  } else {
                    console.error('[VIDEO PARTICIPANT] ❌ All play attempts failed');
                    }
                });
            };
            
            attemptPlay();
            }
        });
      } else {
        // Stream already attached, ensure it's playing
        console.log('[VIDEO PARTICIPANT] Stream already attached, checking playback state:', {
          userName,
          paused: videoElement.paused,
          readyState: videoElement.readyState,
          muted: videoElement.muted,
        });
        
        // CRITICAL: For remote streams, ensure NOT muted
        if (!isLocal && videoElement.muted) {
          console.warn('[VIDEO PARTICIPANT] ⚠️ Remote video is muted, unmuting...');
          videoElement.muted = false;
        }
        
        if (videoElement.paused || videoElement.readyState < 2) {
          console.log('[VIDEO PARTICIPANT] Video paused or not ready, attempting play');
          videoElement.play()
            .then(() => {
              console.log('[VIDEO PARTICIPANT] ✅ Video resumed:', userName);
              setIsVideoPlaying(true);
            })
            .catch((error) => {
              console.error('[VIDEO PARTICIPANT] Resume error:', {
                userName,
                error: error.message,
              });
            });
        } else {
          setIsVideoPlaying(true);
        }
      }
      
      // Monitor track state changes
      const handleTrackEnded = () => {
        console.log('[VIDEO PARTICIPANT] Video track ended');
        setIsVideoPlaying(false);
        setHasVideoTrack(false);
      };
      
      const handleTrackMute = () => {
        console.log('[VIDEO PARTICIPANT] Video track muted');
        setIsVideoPlaying(false);
      };
      
      const handleTrackUnmute = () => {
        console.log('[VIDEO PARTICIPANT] Video track unmuted');
        if (videoElement && videoElement.srcObject === stream) {
          videoElement.play()
            .then(() => {
              setIsVideoPlaying(true);
              setHasVideoTrack(true);
            })
            .catch(console.error);
        }
      };
      
      videoTrack.addEventListener('ended', handleTrackEnded);
      videoTrack.addEventListener('mute', handleTrackMute);
      videoTrack.addEventListener('unmute', handleTrackUnmute);
      
      return () => {
        videoTrack.removeEventListener('ended', handleTrackEnded);
        videoTrack.removeEventListener('mute', handleTrackMute);
        videoTrack.removeEventListener('unmute', handleTrackUnmute);
      };
    } else {
      // No video to show - clear element
      if (videoElement.srcObject) {
        console.log('[VIDEO PARTICIPANT] Clearing video element');
        videoElement.srcObject = null;
      }
      setIsVideoPlaying(false);
    }

    return () => {
      // Cleanup
      if (videoElement) {
        // Don't clear srcObject here as it might be needed by other components
      }
    };
    // CRITICAL: Include streamId, videoTrackId, and videoTrackCount in dependencies
    // to ensure effect runs when tracks are added to an existing stream
  }, [stream, isVideoOff, isLocal, userName, streamId, videoTrackId, videoTrackCount]);

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Show profile placeholder when video is off, no stream, or video not playing
  // CRITICAL: Only show placeholder if we truly don't have video
  const showPlaceholder = isVideoOff || !stream || !hasVideoTrack || !isVideoPlaying;

  return (
    <div 
      className={`relative bg-dark-900 rounded-xl overflow-hidden ${className}`} 
      style={{ 
        aspectRatio: '1/1', // Square tiles on all screen sizes
        minWidth: '0', // Allow tiles to shrink
        minHeight: '0', // Allow tiles to shrink vertically
        width: '100%', // Full width of grid cell
        maxWidth: '100%',
        height: '100%', // Full height of grid cell
        maxHeight: '100%',
        borderRadius: '12px',
      }}
    >
      {/* Speaking Border - Green glow when speaking */}
      <SpeakingBorder isSpeaking={isSpeaking && !isMuted} />

      {/* Video Element - ALWAYS render, but conditionally show */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted={isLocal}
        className={`w-full h-full transition-opacity duration-300 ${
          showPlaceholder ? 'opacity-0 absolute inset-0' : 'opacity-100'
        }`}
        style={{
          objectFit: 'cover',
          width: '100%',
          height: '100%',
          ...(isLocal ? { transform: 'scaleX(-1)' } : {})
        }}
        onLoadedMetadata={() => {
          console.log('[VIDEO PARTICIPANT] ✅ Video metadata loaded for', userName, {
            isLocal,
            hasStream: !!stream,
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight,
            readyState: videoRef.current?.readyState,
            muted: videoRef.current?.muted,
          });
          const video = videoRef.current;
          if (video) {
            // CRITICAL: For remote streams, ensure video is NOT muted
            if (!isLocal && video.muted) {
              console.warn('[VIDEO PARTICIPANT] ⚠️ Remote video is muted, unmuting...');
              video.muted = false;
            }
            
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise
              .then(() => {
                  console.log('[VIDEO PARTICIPANT] ✅ Auto-played after metadata for', userName);
                setIsVideoPlaying(true);
              })
              .catch((error) => {
                  console.error('[VIDEO PARTICIPANT] ❌ Auto-play failed for', userName, ':', error);
                  // Retry play after a short delay
                  setTimeout(() => {
                    if (video && video.paused) {
                      video.play()
                        .then(() => {
                          console.log('[VIDEO PARTICIPANT] ✅ Retry play succeeded for', userName);
                          setIsVideoPlaying(true);
                        })
                        .catch((retryError) => {
                          console.error('[VIDEO PARTICIPANT] ❌ Retry play failed for', userName, ':', retryError);
                        });
                    }
                  }, 500);
                });
            }
          }
        }}
        onCanPlay={() => {
          console.log('[VIDEO PARTICIPANT] ✅ Video can play for', userName, {
            isLocal,
            readyState: videoRef.current?.readyState,
            paused: videoRef.current?.paused,
            muted: videoRef.current?.muted,
          });
          const video = videoRef.current;
          if (video && !isLocal && video.muted) {
            console.warn('[VIDEO PARTICIPANT] ⚠️ Remote video muted in onCanPlay, unmuting...');
            video.muted = false;
          }
          setIsVideoPlaying(true);
        }}
        onPlaying={() => {
          console.log('[VIDEO PARTICIPANT] ✅ Video is playing for', userName);
          setIsVideoPlaying(true);
        }}
        onPlay={() => {
          console.log('[VIDEO PARTICIPANT] ✅ Video play event for', userName);
          setIsVideoPlaying(true);
        }}
        onPause={() => {
          console.log('[VIDEO PARTICIPANT] ⏸️ Video paused for', userName);
          setIsVideoPlaying(false);
        }}
        onError={(e) => {
          console.error('[VIDEO PARTICIPANT] ❌ Video error for', userName, ':', e);
          setIsVideoPlaying(false);
        }}
        onStalled={() => {
          console.warn('[VIDEO PARTICIPANT] ⚠️ Video stalled for', userName, '- attempting resume');
          const video = videoRef.current;
          if (video && !video.paused) {
            video.play().catch(console.error);
          }
        }}
        onWaiting={() => {
          console.warn('[VIDEO PARTICIPANT] ⏳ Video waiting for', userName);
        }}
      />

      {/* Profile Placeholder */}
      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-dark-800 via-dark-900 to-dark-800">
          {avatar ? (
            <div className="relative w-full h-full">
              <img
                src={avatar}
                alt={userName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image fails
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Pulse effect on avatar when speaking */}
              <SpeakingPulse isSpeaking={isSpeaking && !isMuted} />
            </div>
          ) : (
            <div className="relative w-24 h-24 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-white font-bold text-2xl relative z-10">
                {getInitials(userName)}
              </span>
              {/* Pulse effect on initials avatar when speaking */}
              <SpeakingPulse isSpeaking={isSpeaking && !isMuted} />
            </div>
          )}
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-dark-900/50">
              <VideoOff size={32} className="text-dark-400" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
            </div>
          )}
        </div>
      )}

      {/* Participant Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="text-white text-sm font-medium truncate">
              {isLocal ? 'You' : userName}
            </span>
            {/* Audio Waveform - Shows when speaking */}
            {!isMuted && isSpeaking && (
              <AudioWaveform isSpeaking={isSpeaking} audioLevel={audioLevel} />
            )}
          </div>
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {isMuted && (
              <div className="bg-red-500/80 rounded-full p-1">
                <MicOff size={12} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              </div>
            )}
            {!isMuted && (
              <div className={`rounded-full p-1 transition-colors duration-300 ${
                isSpeaking ? 'bg-green-500/80' : 'bg-dark-800/80'
              }`}>
                <Mic size={12} className="text-white" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

