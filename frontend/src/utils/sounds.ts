/**
 * Sound effects for notifications
 */

class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();

  async init() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('[SOUNDS] AudioContext not supported:', error);
    }
  }

  async loadSound(name: string, frequency: number, duration: number = 200) {
    if (!this.audioContext) return;

    try {
      // Generate a simple tone
      const sampleRate = this.audioContext.sampleRate;
      const frameCount = sampleRate * duration / 1000;
      const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 2);
      }

      this.sounds.set(name, buffer);
    } catch (error) {
      console.warn(`[SOUNDS] Failed to load sound ${name}:`, error);
    }
  }

  playSound(name: string, volume: number = 0.3) {
    if (!this.audioContext || !this.sounds.has(name)) {
      // Fallback: Use Web Audio API to generate tone on the fly
      this.playTone(name);
      return;
    }

    try {
      const buffer = this.sounds.get(name)!;
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = buffer;
      gainNode.gain.value = volume;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    } catch (error) {
      console.warn(`[SOUNDS] Failed to play sound ${name}:`, error);
    }
  }

  private playTone(type: string) {
    if (!this.audioContext) return;

    try {
      const frequencies: Record<string, number> = {
        incoming_call: 800,
        new_message: 600,
        ai_insight: 700,
        call_recording_ready: 500,
        friend_joined: 650,
        default: 600,
      };

      const frequency = frequencies[type] || frequencies.default;
      const duration = 0.2;
      const sampleRate = this.audioContext.sampleRate;
      const frameCount = sampleRate * duration;
      const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 3);
      }

      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = buffer;
      gainNode.gain.value = 0.2;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    } catch (error) {
      console.warn('[SOUNDS] Failed to play tone:', error);
    }
  }

  vibrate(pattern: number[] = [100, 50, 100]) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        console.warn('[SOUNDS] Vibration not supported:', error);
      }
    }
  }
}

export const soundManager = new SoundManager();

// Initialize on load
if (typeof window !== 'undefined') {
  soundManager.init();
}

