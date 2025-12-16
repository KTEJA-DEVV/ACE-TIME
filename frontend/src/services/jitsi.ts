/**
 * Jitsi Meet External API Service
 * Uses Jitsi Meet's iframe API for stable SFU-based video conferencing
 */

export interface JitsiParticipant {
  id: string;
  displayName: string;
  role: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  tracks: {
    audio?: MediaStreamTrack;
    video?: MediaStreamTrack;
  };
}

export interface JitsiRoomOptions {
  roomName: string;
  displayName: string;
  userId: string;
  domain?: string;
  width?: string | number;
  height?: string | number;
  parentNode?: HTMLElement;
  configOverwrite?: any;
  interfaceConfigOverwrite?: any;
}

class JitsiService {
  private api: any = null;
  private participants: Map<string, JitsiParticipant> = new Map();
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private onParticipantJoinedCallback?: (participant: JitsiParticipant) => void;
  private onParticipantLeftCallback?: (participantId: string) => void;
  private onTrackAddedCallback?: (track: MediaStreamTrack, participant: JitsiParticipant) => void;
  private onTrackRemovedCallback?: (track: MediaStreamTrack, participant: JitsiParticipant) => void;
  private onParticipantMutedCallback?: (participant: JitsiParticipant, muted: boolean, audio: boolean) => void;
  private onConnectionFailedCallback?: (error: Error) => void;
  private onReadyToCloseCallback?: () => void;

  /**
   * Initialize Jitsi Meet API
   */
  async initialize(options: JitsiRoomOptions): Promise<void> {
    try {
      console.log('[JITSI] 🚀 Initializing Jitsi Meet for room:', options.roomName);
      
      // Load Jitsi Meet External API script if not already loaded
      if (!(window as any).JitsiMeetExternalAPI) {
        await this.loadJitsiScript();
      }

      const domain = options.domain || 'meet.jit.si';
      const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;

      // Create iframe container if not provided
      let container = options.parentNode;
      if (!container) {
        container = document.createElement('div');
        container.id = 'jitsi-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
      }

      // Default configuration
      const defaultConfig = {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        enableWelcomePage: false,
        enableClosePage: false,
        disableDeepLinking: true,
        enableInsecureRoomNameWarning: false,
        ...options.configOverwrite,
      };

      // Initialize API
      this.api = new JitsiMeetExternalAPI(domain, {
        roomName: options.roomName,
        parentNode: container,
        width: options.width || '100%',
        height: options.height || '100%',
        config: defaultConfig,
        interfaceConfig: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'settings', 'raisehand', 'videoquality', 'filmstrip',
            'invite', 'feedback', 'stats', 'shortcuts', 'tileview', 'videobackgroundblur',
            'download', 'help', 'mute-everyone', 'security'
          ],
          SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile'],
          ...options.interfaceConfigOverwrite,
        },
        userInfo: {
          displayName: options.displayName,
          email: options.userId,
        },
      });

      // Set up event listeners
      this.setupEventListeners();

      console.log('[JITSI] ✅ Jitsi Meet initialized');
    } catch (error: any) {
      console.error('[JITSI] ❌ Error initializing:', error);
      throw error;
    }
  }

  /**
   * Load Jitsi Meet External API script
   */
  private loadJitsiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://8x8.vc/external_api.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Jitsi Meet External API'));
      document.head.appendChild(script);
    });
  }

  /**
   * Set up Jitsi Meet event listeners
   */
  private setupEventListeners(): void {
    if (!this.api) return;

    // Participant joined
    this.api.on('participantJoined', (participant: any) => {
      console.log('[JITSI] 👤 Participant joined:', participant.displayName);
      const jitsiParticipant: JitsiParticipant = {
        id: participant.id,
        displayName: participant.displayName || 'Unknown',
        role: participant.role || 'participant',
        isAudioMuted: false,
        isVideoMuted: false,
        tracks: {},
      };
      this.participants.set(participant.id, jitsiParticipant);
      this.onParticipantJoinedCallback?.(jitsiParticipant);
    });

    // Participant left
    this.api.on('participantLeft', (participant: any) => {
      console.log('[JITSI] 👤 Participant left:', participant.id);
      this.participants.delete(participant.id);
      this.remoteStreams.delete(participant.id);
      this.onParticipantLeftCallback?.(participant.id);
    });

    // Track added
    this.api.on('trackAdded', (track: any) => {
      if (track.isLocal) {
        return; // Skip local tracks
      }
      const participant = this.participants.get(track.participantId);
      if (participant && track.jitsiTrack) {
        const mediaStreamTrack = track.jitsiTrack.getOriginalStream()?.getTracks()[0];
        if (mediaStreamTrack) {
          if (track.type === 'audio') {
            participant.tracks.audio = mediaStreamTrack;
            participant.isAudioMuted = false;
          } else if (track.type === 'video') {
            participant.tracks.video = mediaStreamTrack;
            participant.isVideoMuted = false;
          }
          this.onTrackAddedCallback?.(mediaStreamTrack, participant);
        }
      }
    });

    // Track removed
    this.api.on('trackRemoved', (track: any) => {
      if (track.isLocal) {
        return; // Skip local tracks
      }
      const participant = this.participants.get(track.participantId);
      if (participant) {
        if (track.type === 'audio') {
          participant.tracks.audio = undefined;
        } else if (track.type === 'video') {
          participant.tracks.video = undefined;
        }
        this.onTrackRemovedCallback?.(track.jitsiTrack?.getOriginalStream()?.getTracks()[0], participant);
      }
    });

    // Participant muted/unmuted
    this.api.on('trackMuteChanged', (track: any) => {
      const participant = this.participants.get(track.participantId);
      if (participant) {
        if (track.type === 'audio') {
          participant.isAudioMuted = track.muted;
        } else if (track.type === 'video') {
          participant.isVideoMuted = track.muted;
        }
        this.onParticipantMutedCallback?.(participant, track.muted, track.type === 'audio');
      }
    });

    // Connection failed
    this.api.on('connectionFailed', () => {
      console.error('[JITSI] ❌ Connection failed');
      this.onConnectionFailedCallback?.(new Error('Jitsi connection failed'));
    });

    // Ready to close
    this.api.on('readyToClose', () => {
      console.log('[JITSI] ✅ Ready to close');
      this.onReadyToCloseCallback?.();
    });

    // Video conference joined
    this.api.on('videoConferenceJoined', () => {
      console.log('[JITSI] ✅ Video conference joined');
    });

    // Error
    this.api.on('error', (error: any) => {
      console.error('[JITSI] ❌ Error:', error);
      this.onConnectionFailedCallback?.(new Error(error || 'Unknown Jitsi error'));
    });
  }

  /**
   * Join the room
   */
  async joinRoom(options: JitsiRoomOptions): Promise<void> {
    try {
      await this.initialize(options);
      console.log('[JITSI] ✅ Joined room:', options.roomName);
    } catch (error: any) {
      console.error('[JITSI] ❌ Error joining room:', error);
      throw error;
    }
  }

  /**
   * Leave the room
   */
  async leaveRoom(): Promise<void> {
    try {
      console.log('[JITSI] 🚪 Leaving room');

      if (this.api) {
        this.api.dispose();
        this.api = null;
      }

      // Remove iframe container
      const container = document.getElementById('jitsi-container');
      if (container) {
        container.remove();
      }

      // Clear state
      this.participants.clear();
      this.remoteStreams.clear();
      this.localStream = null;
    } catch (error: any) {
      console.error('[JITSI] ❌ Error leaving room:', error);
      throw error;
    }
  }

  /**
   * Mute/unmute audio
   */
  async setAudioMuted(muted: boolean): Promise<void> {
    try {
      if (this.api) {
        if (muted) {
          this.api.executeCommand('toggleAudio');
        } else {
          this.api.executeCommand('toggleAudio');
        }
      }
    } catch (error: any) {
      console.error('[JITSI] ❌ Error setting audio muted:', error);
      throw error;
    }
  }

  /**
   * Mute/unmute video
   */
  async setVideoMuted(muted: boolean): Promise<void> {
    try {
      if (this.api) {
        if (muted) {
          this.api.executeCommand('toggleVideo');
        } else {
          this.api.executeCommand('toggleVideo');
        }
      }
    } catch (error: any) {
      console.error('[JITSI] ❌ Error setting video muted:', error);
      throw error;
    }
  }

  /**
   * Get local media stream (from Jitsi iframe)
   * Note: This is a workaround since Jitsi iframe API doesn't expose local stream directly
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote participant streams
   */
  getRemoteStreams(): Map<string, MediaStream> {
    const streams = new Map<string, MediaStream>();

    this.participants.forEach((participant, id) => {
      const stream = new MediaStream();
      
      if (participant.tracks.audio) {
        stream.addTrack(participant.tracks.audio);
      }

      if (participant.tracks.video) {
        stream.addTrack(participant.tracks.video);
      }

      if (stream.getTracks().length > 0) {
        streams.set(id, stream);
      }
    });

    return streams;
  }

  /**
   * Get all participants
   */
  getParticipants(): JitsiParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Execute Jitsi command
   */
  executeCommand(command: string, ...args: any[]): void {
    if (this.api) {
      this.api.executeCommand(command, ...args);
    }
  }

  // Event callbacks
  onParticipantJoined(callback: (participant: JitsiParticipant) => void): void {
    this.onParticipantJoinedCallback = callback;
  }

  onParticipantLeft(callback: (participantId: string) => void): void {
    this.onParticipantLeftCallback = callback;
  }

  onTrackAdded(callback: (track: MediaStreamTrack, participant: JitsiParticipant) => void): void {
    this.onTrackAddedCallback = callback;
  }

  onTrackRemoved(callback: (track: MediaStreamTrack, participant: JitsiParticipant) => void): void {
    this.onTrackRemovedCallback = callback;
  }

  onParticipantMuted(callback: (participant: JitsiParticipant, muted: boolean, audio: boolean) => void): void {
    this.onParticipantMutedCallback = callback;
  }

  onConnectionFailed(callback: (error: Error) => void): void {
    this.onConnectionFailedCallback = callback;
  }

  onReadyToClose(callback: () => void): void {
    this.onReadyToCloseCallback = callback;
  }
}

export const jitsiService = new JitsiService();

