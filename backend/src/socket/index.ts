import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { CallSession } from '../models/CallSession';
import { Transcript } from '../models/Transcript';
import { Notes } from '../models/Notes';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { Contact } from '../models/Contact';
import { transcribeAudio, generateNotes } from '../services/openai';

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
  audioBuffer: Map<string, Buffer[]>;
}

const rooms = new Map<string, RoomState>();

// Track online users (userId -> socketId[])
const onlineUsers = new Map<string, Set<string>>();

// Notes update interval (30 seconds)
const NOTES_UPDATE_INTERVAL = 30000;
// Minimum transcript length for notes generation
const MIN_TRANSCRIPT_FOR_NOTES = 100;

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
      io.to(targetId).emit('signal:answer', {
        fromId: socket.id,
        answer,
      });
    });

    // WebRTC Signaling: ICE Candidate
    socket.on('signal:candidate', (data: { targetId: string; candidate: any }) => {
      const { targetId, candidate } = data;
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

              // Save to database
              if (room.callId) {
                await Transcript.findOneAndUpdate(
                  { callId: room.callId },
                  { 
                    $push: { segments: segment },
                  },
                  { upsert: true }
                );
              }

              // Update transcript buffer for notes
              room.transcriptBuffer += `${segment.speaker}: ${segment.text}\n`;

              // Emit to all participants
              io.to(socket.roomId).emit('transcript:chunk', segment);

              // Check if we should update notes
              const now = Date.now();
              if (
                now - room.lastNotesUpdate >= NOTES_UPDATE_INTERVAL &&
                room.transcriptBuffer.length >= MIN_TRANSCRIPT_FOR_NOTES
              ) {
                room.lastNotesUpdate = now;
                updateNotes(room, socket.roomId, io);
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

      // Save to database
      if (room.callId) {
        try {
          const result = await Transcript.findOneAndUpdate(
            { callId: room.callId },
            { $push: { segments: segment } },
            { upsert: true, new: true }
          );
          console.log('[TRANSCRIPT] ✅ Saved to database, total segments:', result?.segments?.length || 0);
        } catch (error: any) {
          console.error('[TRANSCRIPT] ❌ Database save error:', error.message);
          console.error('[TRANSCRIPT] Error stack:', error.stack);
        }
      } else {
        console.warn('[TRANSCRIPT] ⚠️ No callId, skipping database save');
      }

      room.transcriptBuffer += `${segment.speaker}: ${segment.text}\n`;
      console.log('[TRANSCRIPT] 📝 Updated transcript buffer, length:', room.transcriptBuffer.length);

      // Emit to all participants in the room (including sender for confirmation)
      console.log('[TRANSCRIPT] 📤 Emitting transcript:chunk to room:', socket.roomId);
      console.log('[TRANSCRIPT] Segment details:', {
        speaker: segment.speaker,
        speakerId: segment.speakerId,
        text: segment.text.substring(0, 50) + (segment.text.length > 50 ? '...' : ''),
        timestamp: segment.timestamp,
      });
      
      // Check how many participants should receive this (room already retrieved above)
      const participantCount = room ? room.participants.size : 0;
      console.log('[TRANSCRIPT] Room has', participantCount, 'participant(s)');
      console.log('[TRANSCRIPT] Participant socket IDs:', Array.from(room.participants.keys()));
      
      // Emit to all in the room
      const emitResult = io.to(socket.roomId).emit('transcript:chunk', segment);
      console.log('[TRANSCRIPT] ✅ Emitted transcript chunk to all participants in room');
      console.log('[TRANSCRIPT] Socket.IO emit result:', emitResult);

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

    // End call
    socket.on('call:end', async () => {
      if (!socket.roomId) return;

      const room = rooms.get(socket.roomId);
      if (!room) return;

      room.callStarted = false;

      // Update call session
      if (room.callId) {
        const callSession = await CallSession.findById(room.callId);
        if (callSession) {
          callSession.status = 'ended';
          callSession.endedAt = new Date();
          if (callSession.startedAt) {
            callSession.duration = Math.floor(
              (callSession.endedAt.getTime() - callSession.startedAt.getTime()) / 1000
            );
          }
          await callSession.save();

          // Final notes update
          if (room.transcriptBuffer.length >= MIN_TRANSCRIPT_FOR_NOTES) {
            await updateNotes(room, socket.roomId, io, true);
          }

          // Update full transcript text
          const transcript = await Transcript.findOne({ callId: room.callId });
          if (transcript) {
            transcript.fullText = transcript.segments
              .map(s => `${s.speaker}: ${s.text}`)
              .join('\n');
            transcript.wordCount = transcript.fullText.split(/\s+/).filter(w => w.length > 0).length;
            await transcript.save();
          }

          // Trigger comprehensive notes generation (async, don't block)
          if (transcript && transcript.segments && transcript.segments.length > 0) {
            // Import and call the comprehensive notes generation
            // This will be handled by the API endpoint when frontend requests it
            // or we can trigger it here directly
            console.log('[NOTES] Call ended, comprehensive notes can be generated via API');
          }
        }
      }

      io.to(socket.roomId).emit('call:ended', {
        roomId: socket.roomId,
        callId: room.callId,
      });
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

    // End call if only one participant left
    if (room.participants.size < 2 && room.callStarted) {
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
          
          // Attach call data to conversation if linked
          if (callSession.metadata?.conversationId) {
            await attachCallToConversation(callSession);
          }
        }
      }

      io.to(socket.roomId).emit('call:ended', {
        roomId: socket.roomId,
        callId: room.callId,
        reason: 'participant_left',
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
        summaryContent += `\n\n🎯 Decisions Made:\n${notes.decisions.map((decision: string) => `• ${decision}`).join('\n')}`;
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
        decisions: existingNotes.decisions,
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

