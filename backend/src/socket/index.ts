import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { CallSession } from '../models/CallSession';
import { CallParticipant } from '../models/CallParticipant';
import { Transcript } from '../models/Transcript';
import { Notes } from '../models/Notes';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { Contact } from '../models/Contact';
import { transcribeAudio, generateNotes, generateComprehensiveNotes, getOpenAI } from '../services/openai';
import { User } from '../models/User';
import { detectVisualConcept, generateImagePromptFromContext } from '../services/imageKeywordDetection';
import { GeneratedImage } from '../models/GeneratedImage';
import { generateImage, isStabilityConfigured } from '../services/stability';
import { generateFreeImage, isFreeAIAvailable } from '../services/freeAI';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
  roomId?: string;
}

interface RoomState {
  participants: Map<string, { userId: string; userName: string; socketId: string }>;
  callStarted: boolean;
  callStartedAt?: number; // Timestamp when call started
  createdAt: number; // Timestamp when room was created
  callId?: string;
  transcriptBuffer: string;
  lastNotesUpdate: number;
  lastImageGeneration?: number; // Track last auto-generation time for debouncing
  audioBuffer: Map<string, Buffer[]>;
}

const rooms = new Map<string, RoomState>();

// Track online users (userId -> socketId[])
const onlineUsers = new Map<string, Set<string>>();

// Notes update interval (30 seconds)
const NOTES_UPDATE_INTERVAL = 30000;
// Minimum transcript length for notes generation
const MIN_TRANSCRIPT_FOR_NOTES = 100;
// Image generation debounce (prevent too many generations)
const IMAGE_GENERATION_DEBOUNCE = 30000; // 30 seconds between auto-generations

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        // Allow anonymous connections for demo
        socket.userId = `anon-${socket.id}`;
        socket.userName = 'Anonymous';
        return next();
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default-secret'
      ) as { userId: string; email: string };

      socket.userId = decoded.userId;
      socket.userName = socket.handshake.auth.userName || 'User';
      next();
    } catch (error) {
      // Allow connection but mark as anonymous
      socket.userId = `anon-${socket.id}`;
      socket.userName = 'Anonymous';
      next();
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 User connected: ${socket.userId} (${socket.id})`);
    
    // Join user-specific room for call invitations
    if (socket.userId && !socket.userId.startsWith('anon-')) {
      socket.join(`user:${socket.userId}`);
    }

    // Join a room
    socket.on('room:join', async (data: { roomId: string; userName?: string }) => {
      const { roomId, userName } = data;
      
      if (userName) {
        socket.userName = userName;
      }

      // Leave previous room if any
      if (socket.roomId) {
        socket.leave(socket.roomId);
        const prevRoom = rooms.get(socket.roomId);
        if (prevRoom) {
          prevRoom.participants.delete(socket.id);
        }
      }

      socket.roomId = roomId;
      socket.join(roomId);

      // Initialize room state if needed
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          participants: new Map(),
          callStarted: false,
          createdAt: Date.now(),
          transcriptBuffer: '',
          lastNotesUpdate: Date.now(),
          audioBuffer: new Map(),
        });
      }

      const room = rooms.get(roomId)!;
      room.participants.set(socket.id, {
        userId: socket.userId!,
        userName: socket.userName!,
        socketId: socket.id,
      });

      // Get call session
      const callSession = await CallSession.findOne({ roomId });
      if (callSession) {
        room.callId = callSession._id.toString();
        
        // CRITICAL: Upsert participant record to prevent duplicates
        // Use findOneAndUpdate with upsert to ensure unique (callId, userId) constraint
        await CallParticipant.findOneAndUpdate(
          { callId: callSession._id, userId: socket.userId },
          {
            $setOnInsert: {
              callId: callSession._id,
              userId: socket.userId!,
              joinedAt: new Date(),
            },
            $set: {
              leftAt: null, // Reset if user rejoins
              duration: null,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );
        
        // Also update guestIds array (deduplicate to prevent duplicates)
        const userId = socket.userId!.toString();
        const isHost = callSession.hostId.toString() === userId;
        if (!isHost) {
          const guestIdStrings = callSession.guestIds.map(id => id.toString());
          if (!guestIdStrings.includes(userId)) {
            callSession.guestIds.push(socket.userId! as any);
            // Deduplicate guestIds array
            const uniqueGuestIds = Array.from(
              new Map(callSession.guestIds.map(id => [id.toString(), id])).values()
            );
            callSession.guestIds = uniqueGuestIds;
            callSession.metadata.participantCount = callSession.guestIds.length + 1;
            await callSession.save();
          }
        }
      }

      // Notify room of new participant
      socket.to(roomId).emit('user:joined', {
        userId: socket.userId,
        userName: socket.userName,
        socketId: socket.id,
        participantCount: room.participants.size,
      });

      // Send room state to joining user
      socket.emit('room:joined', {
        roomId,
        participants: Array.from(room.participants.values()),
        callStarted: room.callStarted,
        callId: room.callId,
      });

      console.log(`📍 User ${socket.userName} joined room ${roomId}`);

      // Notify all existing participants about the new user joining
      // This allows them to create peer connections
      const existingParticipants = Array.from(room.participants.values()).filter(
        p => p.socketId !== socket.id
      );
      
      if (existingParticipants.length > 0) {
        socket.to(roomId).emit('user:joined', {
          userId: socket.userId,
          userName: socket.userName,
          socketId: socket.id,
          participantCount: room.participants.size,
        });
      }

      // Auto-start call when 2 participants
      if (room.participants.size >= 2 && !room.callStarted) {
        room.callStarted = true;
        room.callStartedAt = Date.now();
        
        if (callSession) {
          callSession.status = 'active';
          await callSession.save();
        }

        io.to(roomId).emit('call:started', {
          roomId,
          callId: room.callId,
          participants: Array.from(room.participants.values()),
        });
      }
    });

    // Leave room
    socket.on('room:leave', () => {
      handleLeaveRoom(socket, io);
    });

    // WebRTC Signaling: Offer
    socket.on('signal:offer', (data: { targetId: string; offer: any }) => {
      const { targetId, offer } = data;
      console.log('[SIGNALING] 📤 Forwarding offer:', {
        from: socket.id,
        fromUser: socket.userName,
        to: targetId,
        offerType: offer?.type,
      });
      io.to(targetId).emit('signal:offer', {
        fromId: socket.id,
        userId: socket.userId,
        userName: socket.userName,
        offer,
      });
    });

    // WebRTC Signaling: Answer
    socket.on('signal:answer', (data: { targetId: string; answer: any }) => {
      const { targetId, answer } = data;
      console.log('[SIGNALING] 📥 Forwarding answer:', {
        from: socket.id,
        fromUser: socket.userName,
        to: targetId,
        answerType: answer?.type,
      });
      io.to(targetId).emit('signal:answer', {
        fromId: socket.id,
        answer,
      });
    });

    // WebRTC Signaling: ICE Candidate
    socket.on('signal:candidate', (data: { targetId: string; candidate: any }) => {
      const { targetId, candidate } = data;
      if (candidate) {
        console.log('[SIGNALING] 🧊 Forwarding ICE candidate:', {
          from: socket.id,
          to: targetId,
          candidateType: candidate.type,
          candidateProtocol: candidate.protocol,
        });
      } else {
        console.log('[SIGNALING] 🧊 Forwarding null ICE candidate (end of candidates):', {
          from: socket.id,
          to: targetId,
        });
      }
      io.to(targetId).emit('signal:candidate', {
        fromId: socket.id,
        candidate,
      });
    });

    // Audio chunk for transcription
    socket.on('audio:chunk', async (data: any) => {
      console.log('[TRANSCRIPT] ⚡ audio:chunk event received!', {
        hasRoomId: !!socket.roomId,
        roomId: socket.roomId,
        dataType: typeof data,
        hasChunk: !!data?.chunk,
        chunkType: typeof data?.chunk,
        chunkIsArray: Array.isArray(data?.chunk),
        timestamp: data?.timestamp,
      });

      if (!socket.roomId) {
        console.log('[TRANSCRIPT] ❌ No roomId for audio chunk');
        return;
      }

      const room = rooms.get(socket.roomId);
      if (!room) {
        console.log('[TRANSCRIPT] ❌ Room not found:', socket.roomId);
        return;
      }

      console.log('[TRANSCRIPT] ✅ Room found, callStarted:', room.callStarted);

      // Allow transcription even if call hasn't officially started (for testing)
      // if (!room.callStarted) {
      //   console.log('[TRANSCRIPT] Call not started yet, but processing audio');
      // }

      try {
        // Handle different audio chunk formats
        let audioBuffer: Buffer;
        if (data.chunk instanceof ArrayBuffer) {
          audioBuffer = Buffer.from(data.chunk);
        } else if (data.chunk instanceof Uint8Array) {
          audioBuffer = Buffer.from(data.chunk);
        } else if (Array.isArray(data.chunk)) {
          audioBuffer = Buffer.from(data.chunk);
        } else {
          console.error('[TRANSCRIPT] Invalid audio chunk format:', typeof data.chunk);
          return;
        }

        console.log(`[TRANSCRIPT] Received audio chunk: ${audioBuffer.length} bytes from ${socket.userName}`);
        
        // Store audio chunks per user
        if (!room.audioBuffer.has(socket.id)) {
          room.audioBuffer.set(socket.id, []);
        }
        room.audioBuffer.get(socket.id)!.push(audioBuffer);

        // Process when we have enough audio (~3 seconds worth)
        const chunks = room.audioBuffer.get(socket.id)!;
        const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);

        // Lower threshold for faster transcription (1 second instead of 3)
        const THRESHOLD = 16000; // ~1 second of audio at 16kHz

        if (totalSize >= THRESHOLD) {
          console.log(`[TRANSCRIPT] Processing ${chunks.length} chunks (${totalSize} bytes) for transcription`);
          const combinedBuffer = Buffer.concat(chunks);
          room.audioBuffer.set(socket.id, []);

          // Transcribe
          try {
            const result = await transcribeAudio(combinedBuffer);
            console.log('[TRANSCRIPT] Transcription result:', result.text);
            
            if (result.text && result.text.trim() && !result.text.includes('unavailable')) {
              const segment = {
                speaker: socket.userName || 'Unknown',
                speakerId: socket.userId,
                text: result.text.trim(),
                timestamp: data.timestamp || Date.now(),
              };

              console.log(`[TRANSCRIPT] Emitting transcript: ${segment.speaker}: ${segment.text}`);

              // CRITICAL: Save to database IMMEDIATELY before emitting
              if (room.callId) {
                try {
                  const transcriptDoc = await Transcript.findOneAndUpdate(
                    { callId: room.callId },
                    { 
                      $push: { segments: segment },
                    },
                    { 
                      upsert: true,
                      new: true,
                      setDefaultsOnInsert: true,
                    }
                  );
                  console.log('[TRANSCRIPT] ✅ Saved to database immediately:', {
                    callId: room.callId,
                    segmentCount: transcriptDoc?.segments?.length || 0,
                    speaker: segment.speaker,
                    textLength: segment.text.length,
                  });
                } catch (dbError: any) {
                  console.error('[TRANSCRIPT] ❌ Database save error:', {
                    error: dbError.message,
                    callId: room.callId,
                    segment: segment,
                  });
                  // Continue even if save fails - emit anyway so users see transcript
                }
              } else {
                console.warn('[TRANSCRIPT] ⚠️ No callId, cannot save to database');
              }

              // Update transcript buffer for notes
              room.transcriptBuffer += `${segment.speaker}: ${segment.text}\n`;

      // CRITICAL: Emit to all participants in real-time
      console.log('[TRANSCRIPT] 📤 Broadcasting transcript chunk to room:', {
        roomId: socket.roomId,
        participantCount: room.participants.size,
        speaker: segment.speaker,
        textPreview: segment.text.substring(0, 50) + '...',
      });
      io.to(socket.roomId).emit('transcript:chunk', segment);
      console.log('[TRANSCRIPT] ✅ Broadcast complete');

      // Check if we should update notes
      const now = Date.now();
      if (
        now - room.lastNotesUpdate >= NOTES_UPDATE_INTERVAL &&
        room.transcriptBuffer.length >= MIN_TRANSCRIPT_FOR_NOTES
      ) {
        room.lastNotesUpdate = now;
        updateNotes(room, socket.roomId, io);
      }

      // CRITICAL: Auto-detect visual concepts and generate images (for manual transcript too)
      if (room.callId && room.callStarted) {
        // Debounce: only check if enough time has passed since last generation
        const lastGen = room.lastImageGeneration || 0;
        if (now - lastGen >= IMAGE_GENERATION_DEBOUNCE) {
          // Get recent transcript segments for context
          const transcriptDoc = await Transcript.findOne({ callId: room.callId });
          const recentSegments = transcriptDoc?.segments?.slice(-5) || [];
          const recentTexts = recentSegments.map(s => s.text);
          
          // Detect visual concept
          const detection = await detectVisualConcept(segment.text, recentTexts);
          
          if (detection.shouldGenerate && detection.confidence > 0.6) {
            console.log('[IMAGE AUTO] 🎨 Visual concept detected in manual transcript!', {
              text: segment.text.substring(0, 100),
              confidence: detection.confidence,
              prompt: detection.prompt?.substring(0, 100),
            });
            
            // Update last generation time
            room.lastImageGeneration = now;
            
            // Generate image asynchronously (don't block transcript)
            generateImageFromTranscript(
              room.callId,
              detection.prompt || segment.text,
              socket.userId!,
              socket.userName || 'User',
              io,
              socket.roomId
            ).catch((error) => {
              console.error('[IMAGE AUTO] ❌ Auto-generation failed:', error);
            });
          }
        }
      }

              // CRITICAL: Auto-detect visual concepts and generate images
              if (room.callId && room.callStarted) {
                // Debounce: only check if enough time has passed since last generation
                const lastGen = room.lastImageGeneration || 0;
                if (now - lastGen >= IMAGE_GENERATION_DEBOUNCE) {
                  // Get recent transcript segments for context
                  const transcriptDoc = await Transcript.findOne({ callId: room.callId });
                  const recentSegments = transcriptDoc?.segments?.slice(-5) || [];
                  const recentTexts = recentSegments.map(s => s.text);
                  
                  // Detect visual concept
                  const detection = await detectVisualConcept(segment.text, recentTexts);
                  
                  if (detection.shouldGenerate && detection.confidence > 0.6) {
                    console.log('[IMAGE AUTO] 🎨 Visual concept detected!', {
                      text: segment.text.substring(0, 100),
                      confidence: detection.confidence,
                      prompt: detection.prompt?.substring(0, 100),
                    });
                    
                    // Update last generation time
                    room.lastImageGeneration = now;
                    
                    // Generate image asynchronously (don't block transcript)
                    generateImageFromTranscript(
                      room.callId,
                      detection.prompt || segment.text,
                      socket.userId!,
                      socket.userName || 'User',
                      io,
                      socket.roomId
                    ).catch((error) => {
                      console.error('[IMAGE AUTO] ❌ Auto-generation failed:', error);
                    });
                  }
                }
              }
            } else {
              console.log('[TRANSCRIPT] Empty or unavailable transcription result');
            }
          } catch (transcribeError: any) {
            console.error('[TRANSCRIPT] Transcription error:', transcribeError.message);
          }
        } else {
          console.log(`[TRANSCRIPT] Buffering audio: ${totalSize}/${THRESHOLD} bytes`);
        }
      } catch (error: any) {
        console.error('[TRANSCRIPT] Audio processing error:', error.message);
      }
    });

    // Manual transcript input (for testing or fallback)
    socket.on('transcript:manual', async (data: { text: string; timestamp: number }) => {
      console.log('[TRANSCRIPT] 📥 Received transcript:manual event:', {
        text: data.text,
        roomId: socket.roomId,
        userName: socket.userName,
        userId: socket.userId,
        timestamp: data.timestamp,
        socketId: socket.id,
      });
      
      if (!socket.roomId) {
        console.error('[TRANSCRIPT] ❌ No roomId for transcript');
        return;
      }

      const room = rooms.get(socket.roomId);
      if (!room) {
        console.error('[TRANSCRIPT] ❌ Room not found:', socket.roomId);
        return;
      }

      console.log('[TRANSCRIPT] 🔍 Room state:', {
        roomId: socket.roomId,
        callId: room.callId,
        participantsCount: room.participants.size,
        participantSocketIds: Array.from(room.participants.keys()),
        callStarted: room.callStarted,
      });

      // Calculate timestamp relative to call start
      const callStartTime = room.callStartedAt || room.createdAt;
      const timestampSeconds = callStartTime 
        ? Math.floor((Date.now() - callStartTime) / 1000)
        : 0;

      const segment = {
        speaker: socket.userName || 'Unknown',
        speakerId: socket.userId,
        text: data.text.trim(),
        timestamp: data.timestamp || Date.now(), // Use absolute timestamp for better matching
      };

      console.log('[TRANSCRIPT] ✅ Created segment:', {
        speaker: segment.speaker,
        speakerId: segment.speakerId,
        text: segment.text.substring(0, 50) + (segment.text.length > 50 ? '...' : ''),
        fullTextLength: segment.text.length,
        timestamp: segment.timestamp,
        timestampSeconds,
      });

      // CRITICAL: Save to database IMMEDIATELY before emitting
      if (room.callId) {
        try {
          const transcriptDoc = await Transcript.findOneAndUpdate(
            { callId: room.callId },
            { 
              $push: { segments: segment },
            },
            { 
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            }
          );
          console.log('[TRANSCRIPT] ✅ Saved to database immediately:', {
            callId: room.callId,
            segmentCount: transcriptDoc?.segments?.length || 0,
            speaker: segment.speaker,
            speakerId: segment.speakerId,
            textLength: segment.text.length,
            timestamp: segment.timestamp,
          });
        } catch (error: any) {
          console.error('[TRANSCRIPT] ❌ Database save error:', {
            error: error.message,
            stack: error.stack,
            callId: room.callId,
            segment: segment,
          });
          // Continue even if save fails - emit anyway so users see transcript
        }
      } else {
        console.warn('[TRANSCRIPT] ⚠️ No callId, cannot save to database');
      }

      room.transcriptBuffer += `${segment.speaker}: ${segment.text}\n`;
      console.log('[TRANSCRIPT] 📝 Updated transcript buffer, length:', room.transcriptBuffer.length);

      // CRITICAL: Emit to all participants in real-time
      console.log('[TRANSCRIPT] 📤 Broadcasting transcript chunk to room:', {
        roomId: socket.roomId,
        participantCount: room.participants.size,
        participantSocketIds: Array.from(room.participants.keys()),
        segment: {
          speaker: segment.speaker,
          speakerId: segment.speakerId,
          textPreview: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
          textLength: segment.text.length,
          timestamp: segment.timestamp,
        },
      });
      
      io.to(socket.roomId).emit('transcript:chunk', segment);
      console.log('[TRANSCRIPT] ✅ Broadcast complete to all participants');

      // Update notes if enough content
      const now = Date.now();
      if (
        now - room.lastNotesUpdate >= NOTES_UPDATE_INTERVAL &&
        room.transcriptBuffer.length >= MIN_TRANSCRIPT_FOR_NOTES
      ) {
        room.lastNotesUpdate = now;
        updateNotes(room, socket.roomId, io);
      }
    });

    // Request notes update
    socket.on('notes:request', async () => {
      if (!socket.roomId) return;

      const room = rooms.get(socket.roomId);
      if (!room || room.transcriptBuffer.length < MIN_TRANSCRIPT_FOR_NOTES) return;

      room.lastNotesUpdate = Date.now();
      updateNotes(room, socket.roomId, io);
    });

    // User leaves call (but call continues for others)
    socket.on('call:end', async () => {
      if (!socket.roomId) return;

      // Use the same logic as disconnect - just remove this user
      await handleLeaveRoom(socket, io);
    });

    // Join conversation (for messaging)
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`💬 User ${socket.userName} joined conversation ${conversationId}`);
      
      // Notify other participants that a friend joined
      socket.to(`conversation:${conversationId}`).emit('friend:joined', {
        friendId: socket.userId,
        friendName: socket.userName,
        conversationId,
      });
    });

    // Leave conversation
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Participant video/mute state updates
    socket.on('participant:video:toggle', (data: { isVideoOff: boolean }) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('participant:video:changed', {
          socketId: socket.id,
          userId: socket.userId,
          userName: socket.userName,
          isVideoOff: data.isVideoOff,
        });
      }
    });

    socket.on('participant:audio:toggle', (data: { isMuted: boolean }) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('participant:audio:changed', {
          socketId: socket.id,
          userId: socket.userId,
          userName: socket.userName,
          isMuted: data.isMuted,
        });
      }
    });

    // Typing indicator
    socket.on('typing:start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        userId: socket.userId,
        userName: socket.userName,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        userId: socket.userId,
      });
    });

    // Image generation request during call
    socket.on('image:request', async (data: { prompt: string; style?: string }) => {
      if (!socket.roomId) return;

      // Emit that image generation started
      io.to(socket.roomId).emit('image:generating', {
        prompt: data.prompt,
        requestedBy: socket.userName,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      // Update online status
      if (socket.userId && !socket.userId.startsWith('anon-')) {
        const userSockets = onlineUsers.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            onlineUsers.delete(socket.userId);
            // Notify friends that user is offline
            io.emit('user:offline', { userId: socket.userId });
          }
        }
      }
      handleLeaveRoom(socket, io);
      console.log(`🔌 User disconnected: ${socket.userId}`);
    });
  });
};

async function handleLeaveRoom(socket: AuthenticatedSocket, io: Server) {
  if (!socket.roomId) return;

  const room = rooms.get(socket.roomId);
  if (room) {
    room.participants.delete(socket.id);

    socket.to(socket.roomId).emit('user:left', {
      userId: socket.userId,
      userName: socket.userName,
      socketId: socket.id,
      participantCount: room.participants.size,
    });

    // End call only if no participants left (last person left)
    if (room.participants.size === 0 && room.callStarted) {
      room.callStarted = false;
      
      if (room.callId) {
        const callSession = await CallSession.findById(room.callId);
        if (callSession && callSession.status === 'active') {
          callSession.status = 'ended';
          callSession.endedAt = new Date();
          if (callSession.startedAt) {
            callSession.duration = Math.floor(
              (callSession.endedAt.getTime() - callSession.startedAt.getTime()) / 1000
            );
          }
          await callSession.save();
          
          // Update full transcript text first
          const transcript = await Transcript.findOne({ callId: room.callId });
          if (transcript) {
            transcript.fullText = transcript.segments
              .map(s => `${s.speaker}: ${s.text}`)
              .join('\n');
            transcript.wordCount = transcript.fullText.split(/\s+/).filter(w => w.length > 0).length;
            await transcript.save();
          }
          
          // Generate comprehensive AI summary asynchronously (don't block call ending)
          if (transcript && transcript.fullText && transcript.fullText.length > 50) {
            console.log('[AI SUMMARY] 🚀 Starting comprehensive notes generation for call:', room.callId);
            // Run asynchronously - don't await
            generateComprehensivePostCallSummary(room.callId, callSession, transcript, io).catch((error) => {
              console.error('[AI SUMMARY] ❌ Error generating comprehensive summary:', error);
            });
          } else {
            // Fallback to basic notes if transcript is too short
            if (room.transcriptBuffer.length >= MIN_TRANSCRIPT_FOR_NOTES) {
              await updateNotes(room, socket.roomId, io, true);
            }
          }
          
          // Attach call data to conversation if linked
          if (callSession.metadata?.conversationId) {
            await attachCallToConversation(callSession);
          }
        }
      }

      // Emit call:ended only when room is empty (last person left)
      io.to(socket.roomId).emit('call:ended', {
        roomId: socket.roomId,
        callId: room.callId,
        reason: 'last_participant_left',
      });
    }

    // Clean up empty rooms
    if (room.participants.size === 0) {
      rooms.delete(socket.roomId);
    }
  }

  socket.leave(socket.roomId);
  socket.roomId = undefined;
}

// Attach call recording, transcript, and notes to conversation
async function attachCallToConversation(callSession: any) {
  try {
    const conversationId = callSession.metadata?.conversationId;
    if (!conversationId) return;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return;

    // Get transcript and notes
    const transcript = callSession.transcriptId 
      ? await Transcript.findById(callSession.transcriptId)
      : null;
    const notes = callSession.notesId
      ? await Notes.findById(callSession.notesId)
      : null;

    // Create system message with call summary
    const callSummary = `Call ended • Duration: ${Math.floor((callSession.duration || 0) / 60)}:${String((callSession.duration || 0) % 60).padStart(2, '0')}`;
    
    const systemMessage = new Message({
      conversationId: conversation._id,
      senderId: callSession.hostId,
      content: callSummary,
      type: 'system',
      metadata: {
        callId: callSession._id,
        callDuration: callSession.duration,
        hasRecording: !!callSession.recordingKey,
        hasTranscript: !!transcript,
        hasNotes: !!notes,
      },
    });
    await systemMessage.save();

    // If transcript exists, create a message with transcript link
    if (transcript && transcript.segments && transcript.segments.length > 0) {
      const transcriptPreview = transcript.segments
        .slice(0, 3)
        .map((seg: any) => `${seg.speaker}: ${seg.text}`)
        .join('\n');
      
      const transcriptMessage = new Message({
        conversationId: conversation._id,
        senderId: callSession.hostId,
        content: `📝 Call Transcript:\n${transcriptPreview}${transcript.segments.length > 3 ? '\n...' : ''}`,
        type: 'call_transcript',
        metadata: {
          callId: callSession._id,
          callDuration: callSession.duration,
          callRecordingUrl: callSession.recordingUrl,
          transcriptId: transcript._id,
          isCallTranscript: true,
        },
        attachments: callSession.recordingUrl ? [{
          type: 'call_recording',
          url: callSession.recordingUrl,
          name: `Call Recording - ${new Date(callSession.startedAt).toLocaleString()}`,
          duration: callSession.duration,
        }] : undefined,
      });
      await transcriptMessage.save();
    }

    // If notes exist, create a message with AI notes summary including key points and action items
    if (notes && notes.summary) {
      let summaryContent = `🤖 AI Call Summary:\n\n${notes.summary}`;
      
      // Add key points if available
      if (notes.bullets && notes.bullets.length > 0) {
        summaryContent += `\n\n📌 Key Points:\n${notes.bullets.map((bullet: string) => `• ${bullet}`).join('\n')}`;
      }
      
      // Add action items if available
      if (notes.actionItems && notes.actionItems.length > 0) {
        summaryContent += `\n\n✅ Action Items:\n${notes.actionItems.map((item: any) => {
          const assignee = item.assignee ? ` (@${item.assignee})` : '';
          return `• ${item.text}${assignee}`;
        }).join('\n')}`;
      }
      
      // Add decisions if available
      if (notes.decisions && notes.decisions.length > 0) {
        // Handle both string[] (legacy) and IDecision[] (new format)
        const decisionsText = notes.decisions.map((decision: any) => {
          if (typeof decision === 'string') {
            return `• ${decision}`;
          } else {
            // IDecision object
            return `• ${decision.decision}${decision.context ? ` (${decision.context})` : ''}`;
          }
        }).join('\n');
        summaryContent += `\n\n🎯 Decisions Made:\n${decisionsText}`;
      }
      
      const notesMessage = new Message({
        conversationId: conversation._id,
        senderId: callSession.hostId,
        content: summaryContent,
        type: 'ai_notes',
        metadata: {
          callId: callSession._id,
          callDuration: callSession.duration,
          notesId: notes._id,
          aiSummary: notes.summary,
          aiActionItems: notes.actionItems,
          aiDecisions: notes.decisions,
          aiKeyTopics: notes.keyTopics,
          isCallNotes: true,
        },
      });
      await notesMessage.save();
    }

    // Update conversation last message
    conversation.lastMessage = {
      content: systemMessage.content,
      senderId: systemMessage.senderId,
      timestamp: systemMessage.createdAt,
    };
    await conversation.save();

    // Update Contact records for both participants and trigger context update
    try {
      const participants = [callSession.hostId, ...(callSession.guestIds || [])];
      
      for (const participantId of participants) {
        // Find contact where this user is the owner and the other participant is the contact
        const otherParticipants = participants.filter(p => p.toString() !== participantId.toString());
        
        for (const otherParticipantId of otherParticipants) {
          const contact = await Contact.findOne({
            userId: participantId,
            contactUserId: otherParticipantId,
            conversationId: conversation._id,
          });

          if (contact) {
            // Update contact stats
            contact.totalCalls = (contact.totalCalls || 0) + 1;
            contact.lastInteractionAt = new Date();
            await contact.save();
          }
        }
      }
    } catch (contactError) {
      console.error('[CALL] Error updating contacts:', contactError);
      // Don't fail the whole operation if contact update fails
    }

    console.log(`[CALL] ✅ Attached call ${callSession._id} data to conversation ${conversationId}`);
  } catch (error) {
    console.error('[CALL] Error attaching call to conversation:', error);
  }
}

async function updateNotes(room: RoomState, roomId: string, io: Server, isFinal: boolean = false) {
  try {
    // Get existing notes
    let existingNotes = null;
    if (room.callId) {
      existingNotes = await Notes.findOne({ callId: room.callId });
    }

    // Generate new notes
    const newNotes = await generateNotes(
      room.transcriptBuffer,
      existingNotes ? {
        summary: existingNotes.summary,
        bullets: existingNotes.bullets,
        actionItems: existingNotes.actionItems,
        // Convert IDecision[] to string[] for NotesResult compatibility
        decisions: existingNotes.decisions ? existingNotes.decisions.map((d: any) => 
          typeof d === 'string' ? d : d.decision
        ) : [],
      } : undefined
    );

    // Save to database
    if (room.callId) {
      await Notes.findOneAndUpdate(
        { callId: room.callId },
        {
          ...newNotes,
          lastUpdatedAt: new Date(),
          $inc: { version: 1 },
        },
        { upsert: true }
      );
    }

    // Emit to room
    io.to(roomId).emit('ai:notes', {
      ...newNotes,
      isFinal,
      timestamp: Date.now(),
    });

    // Emit AI insight notification when final notes are ready
    if (isFinal && room.callId) {
      const callSession = await CallSession.findById(room.callId);
      if (callSession) {
        const participants = [callSession.hostId, ...(callSession.guestIds || [])];
        participants.forEach((participantId) => {
          io.to(`user:${participantId}`).emit('ai:insight:ready', {
            callId: room.callId,
            conversationId: callSession.metadata?.conversationId,
            summary: newNotes.summary,
          });
        });
      }
    }

    // Clear buffer after processing (keep last bit for context)
    if (!isFinal) {
      const lines = room.transcriptBuffer.split('\n');
      room.transcriptBuffer = lines.slice(-5).join('\n');
    }
  } catch (error) {
    console.error('Notes update error:', error);
  }
}

/**
 * Automatically generate image from transcript when visual concepts are detected
 */
async function generateImageFromTranscript(
  callId: string,
  prompt: string,
  userId: string,
  userName: string,
  io: Server,
  roomId: string
) {
  try {
    console.log('[IMAGE AUTO] 🎨 Starting automatic image generation:', {
      callId,
      prompt: prompt.substring(0, 100),
      userId,
      userName,
    });

    // Emit that image generation started
    io.to(roomId).emit('image:generating', {
      prompt: prompt.substring(0, 100),
      requestedBy: userName,
      autoGenerated: true,
    });

    // Generate enhanced prompt from context
    const enhancedPrompt = await generateImagePromptFromContext(prompt);
    console.log('[IMAGE AUTO] 📝 Enhanced prompt:', enhancedPrompt.substring(0, 150));

    // Get image generation services
    const useFreeAI = isFreeAIAvailable();
    const useStability = isStabilityConfigured();
    const openai = getOpenAI();

    let imageUrl: string;
    let revisedPrompt: string = enhancedPrompt;

    // Try free AI first (always available, no cost)
    if (useFreeAI) {
      console.log('[IMAGE AUTO] ✅ Using free Hugging Face AI');
      try {
        imageUrl = await generateFreeImage({
          prompt: enhancedPrompt,
          style: 'dream',
          width: 512,
          height: 512,
        });
      } catch (freeError: any) {
        console.warn('[IMAGE AUTO] ⚠️ Free AI failed, trying fallback:', freeError);
        // Fallback to Stability AI or OpenAI
        if (useStability) {
          imageUrl = await generateImage({
            prompt: enhancedPrompt,
            style: 'dream',
            width: 1024,
            height: 1024,
            steps: 30,
          });
        } else if (openai) {
          try {
            const response = await openai.images.generate({
              model: 'dall-e-3',
              prompt: `${enhancedPrompt}. Style: dreamlike, surreal, ethereal, magical atmosphere`,
              n: 1,
              size: '1024x1024',
            });
            imageUrl = response.data?.[0]?.url || '';
            revisedPrompt = response.data?.[0]?.revised_prompt || enhancedPrompt;
          } catch (openaiError: any) {
            // If OpenAI quota exceeded, throw a more helpful error
            if (openaiError.status === 429 || openaiError.code === 'insufficient_quota' || openaiError.error?.code === 'insufficient_quota') {
              throw new Error('OpenAI quota exceeded. Please check your billing or use free AI services.');
            }
            throw openaiError;
          }
        } else {
          throw new Error('No image generation service available');
        }
      }
    } else if (useStability) {
      imageUrl = await generateImage({
        prompt: enhancedPrompt,
        style: 'dream',
        width: 1024,
        height: 1024,
        steps: 30,
      });
    } else if (openai) {
      try {
        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: `${enhancedPrompt}. Style: dreamlike, surreal, ethereal, magical atmosphere`,
          n: 1,
          size: '1024x1024',
        });
        imageUrl = response.data?.[0]?.url || '';
        revisedPrompt = response.data?.[0]?.revised_prompt || enhancedPrompt;
      } catch (openaiError: any) {
        // If OpenAI quota exceeded, throw a more helpful error
        if (openaiError.status === 429 || openaiError.code === 'insufficient_quota' || openaiError.error?.code === 'insufficient_quota') {
          throw new Error('OpenAI quota exceeded. Please check your billing or use free AI services.');
        }
        throw openaiError;
      }
    } else {
      throw new Error('No image generation service available');
    }

    if (!imageUrl) {
      throw new Error('No image URL generated');
    }

    // Save to database
    const generatedImage = new GeneratedImage({
      callId,
      creatorId: userId,
      prompt: enhancedPrompt,
      revisedPrompt,
      imageUrl,
      style: 'dream',
      contextSource: 'auto_detected',
      transcriptContext: prompt,
      autoGenerated: true,
    });
    await generatedImage.save();

    console.log('[IMAGE AUTO] ✅ Image generated and saved:', {
      imageId: generatedImage._id,
      callId,
    });

    // Emit to all participants in the room
    io.to(roomId).emit('image:generated', {
      image: generatedImage,
      creator: userName,
      autoGenerated: true,
      fromTranscript: true,
    });

    console.log('[IMAGE AUTO] ✅ Image broadcasted to room:', roomId);
  } catch (error: any) {
    console.error('[IMAGE AUTO] ❌ Error generating image:', error);
    // Emit error to room
    io.to(roomId).emit('image:generation:error', {
      error: error.message || 'Failed to generate image',
      prompt: prompt.substring(0, 100),
    });
  }
}

// Generate comprehensive post-call AI summary with retry logic
export async function generateComprehensivePostCallSummary(
  callId: string,
  callSession: any,
  transcript: any,
  io: Server
) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[AI SUMMARY] 📝 Attempt ${attempt}/${MAX_RETRIES} - Generating comprehensive notes for call ${callId}`);
      
      // Get participants
      const host = await User.findById(callSession.hostId).select('name').lean();
      const guests = await Promise.all(
        (callSession.guestIds || []).map((id: any) => 
          User.findById(id).select('name').lean()
        )
      );
      
      const participants = [
        host?.name || 'Host',
        ...guests.map((g: any) => g?.name || 'Guest').filter(Boolean)
      ];
      
      // Get full transcript text
      const transcriptText = transcript.fullText || transcript.segments
        ?.map((s: any) => `${s.speaker || s.speakerName || 'Speaker'}: ${s.text}`)
        .join('\n') || '';
      
      if (!transcriptText || transcriptText.length < 50) {
        console.warn('[AI SUMMARY] ⚠️ Transcript too short, skipping comprehensive notes');
        return;
      }
      
      // Emit "generating" status to all participants
      const allParticipants = [callSession.hostId, ...(callSession.guestIds || [])];
      allParticipants.forEach((participantId) => {
        io.to(`user:${participantId}`).emit('ai:summary:generating', {
          callId,
          status: 'generating',
          message: 'Generating comprehensive meeting summary...',
        });
      });
      
      // Generate comprehensive notes using GPT-4
      const comprehensiveNotes = await generateComprehensiveNotes(
        transcriptText,
        participants,
        callSession.duration || 0,
        callSession.startedAt || new Date()
      );
      
      console.log('[AI SUMMARY] ✅ Comprehensive notes generated:', {
        title: comprehensiveNotes.title,
        summaryLength: comprehensiveNotes.summary?.length || 0,
        actionItemsCount: comprehensiveNotes.actionItems?.length || 0,
        decisionsCount: comprehensiveNotes.decisions?.length || 0,
        sectionsCount: comprehensiveNotes.sections?.length || 0,
      });
      
      // Convert to Notes model format
      const notesData: any = {
        callId: callSession._id,
        title: comprehensiveNotes.title || 'Meeting Notes',
        date: callSession.startedAt || new Date(),
        duration: callSession.duration || 0,
        participants: participants,
        summary: comprehensiveNotes.summary || '',
        sections: comprehensiveNotes.sections || [],
        actionItems: (comprehensiveNotes.actionItems || []).map((item: any) => ({
          text: item.item || item.text || item,
          assignee: item.assignee || undefined,
          completed: false,
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          priority: item.priority || 'medium',
        })),
        decisions: (comprehensiveNotes.decisions || []).map((decision: any) => ({
          decision: typeof decision === 'string' ? decision : (decision.decision || decision),
          context: typeof decision === 'object' ? (decision.context || '') : '',
          timestamp: typeof decision === 'object' ? (decision.timestamp || '') : '',
        })),
        keyPoints: comprehensiveNotes.keyPoints || [],
        questionsRaised: comprehensiveNotes.questionsRaised || [],
        nextSteps: comprehensiveNotes.nextSteps || [],
        suggestedFollowUp: comprehensiveNotes.suggestedFollowUp 
          ? new Date(comprehensiveNotes.suggestedFollowUp) 
          : undefined,
        generatedAt: new Date(),
        lastUpdatedAt: new Date(),
        version: 1,
        isEditable: true,
        // Legacy fields for backward compatibility
        bullets: comprehensiveNotes.keyPoints || [],
        suggestedReplies: comprehensiveNotes.nextSteps || [],
        keyTopics: comprehensiveNotes.sections?.map((s: any) => s.topic) || [],
      };
      
      // Save to database
      const savedNotes = await Notes.findOneAndUpdate(
        { callId: callSession._id },
        notesData,
        { upsert: true, new: true }
      );
      
      console.log('[AI SUMMARY] 💾 Comprehensive notes saved to database:', savedNotes._id);
      
      // Emit success to all participants
      allParticipants.forEach((participantId) => {
        io.to(`user:${participantId}`).emit('ai:summary:ready', {
          callId,
          status: 'ready',
          notesId: savedNotes._id,
          summary: comprehensiveNotes.summary,
          title: comprehensiveNotes.title,
          actionItemsCount: comprehensiveNotes.actionItems?.length || 0,
          decisionsCount: comprehensiveNotes.decisions?.length || 0,
        });
      });
      
      // Emit comprehensive notes update
      io.to(`call:${callId}`).emit('ai:notes:comprehensive', {
        notes: savedNotes,
        isFinal: true,
        timestamp: Date.now(),
      });
      
      console.log('[AI SUMMARY] ✅ Comprehensive summary generation completed successfully');
      return; // Success - exit retry loop
      
    } catch (error: any) {
      console.error(`[AI SUMMARY] ❌ Attempt ${attempt}/${MAX_RETRIES} failed:`, error.message);
      
      if (attempt === MAX_RETRIES) {
        // Final attempt failed - emit error and fallback to basic notes
        console.error('[AI SUMMARY] ❌ All retry attempts failed, falling back to basic notes');
        
        const allParticipants = [callSession.hostId, ...(callSession.guestIds || [])];
        allParticipants.forEach((participantId) => {
          io.to(`user:${participantId}`).emit('ai:summary:error', {
            callId,
            status: 'error',
            message: 'Failed to generate comprehensive summary. Basic notes available.',
          });
        });
        
        // Fallback: try to generate basic notes
        try {
          const transcriptText = transcript.fullText || transcript.segments
            ?.map((s: any) => `${s.speaker || s.speakerName || 'Speaker'}: ${s.text}`)
            .join('\n') || '';
          const basicNotes = await generateNotes(transcriptText || '');
          await Notes.findOneAndUpdate(
            { callId: callSession._id },
            {
              ...basicNotes,
              callId: callSession._id,
              generatedAt: new Date(),
              lastUpdatedAt: new Date(),
            },
            { upsert: true }
          );
          console.log('[AI SUMMARY] ✅ Fallback basic notes generated');
        } catch (fallbackError) {
          console.error('[AI SUMMARY] ❌ Fallback notes generation also failed:', fallbackError);
        }
      } else {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }
}

