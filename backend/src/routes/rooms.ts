import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CallSession } from '../models/CallSession';
import { Transcript } from '../models/Transcript';
import { Notes } from '../models/Notes';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Generate a short, readable room code
const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// POST /api/rooms - Create a new room
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const roomId = generateRoomCode();
    
    // Create call session
    const callSession = new CallSession({
      roomId,
      hostId: req.userId,
      guestIds: [],
      status: 'waiting',
      metadata: {
        audioOnly: req.body.audioOnly || false,
        participantCount: 1,
      },
    });

    await callSession.save();

    // Create empty transcript
    const transcript = new Transcript({
      callId: callSession._id,
      segments: [],
    });
    await transcript.save();

    // Create empty notes
    const notes = new Notes({
      callId: callSession._id,
    });
    await notes.save();

    // Link transcript and notes
    callSession.transcriptId = transcript._id;
    callSession.notesId = notes._id;
    await callSession.save();

    res.status(201).json({
      message: 'Room created',
      roomId,
      callId: callSession._id,
    });
  })
);

// POST /api/rooms/:id/join - Join a room
router.post(
  '/:id/join',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: roomId } = req.params;

    const callSession = await CallSession.findOne({ roomId });
    
    if (!callSession) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (callSession.status === 'ended') {
      res.status(400).json({ error: 'This call has ended' });
      return;
    }

    // Check if user is already in the room
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(id => id.toString() === userId);

    if (!isHost && !isGuest) {
      // Add user as guest
      callSession.guestIds.push(req.user!._id);
      callSession.metadata.participantCount = callSession.guestIds.length + 1;
      await callSession.save();
    }

    res.json({
      message: 'Joined room',
      roomId,
      callId: callSession._id,
      isHost,
      status: callSession.status,
    });
  })
);

// GET /api/rooms/:id - Get room details
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: roomId } = req.params;

    const callSession = await CallSession.findOne({ roomId })
      .populate('hostId', 'name email avatar')
      .populate('guestIds', 'name email avatar');

    if (!callSession) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    res.json({
      roomId,
      callId: callSession._id,
      host: callSession.hostId,
      guests: callSession.guestIds,
      status: callSession.status,
      startedAt: callSession.startedAt,
      metadata: callSession.metadata,
    });
  })
);

// DELETE /api/rooms/:id - End/close a room (host only)
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: roomId } = req.params;

    const callSession = await CallSession.findOne({ roomId });
    
    if (!callSession) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (callSession.hostId.toString() !== req.userId) {
      res.status(403).json({ error: 'Only the host can end the call' });
      return;
    }

    callSession.status = 'ended';
    callSession.endedAt = new Date();
    if (callSession.startedAt) {
      callSession.duration = Math.floor(
        (callSession.endedAt.getTime() - callSession.startedAt.getTime()) / 1000
      );
    }
    await callSession.save();

    // Emit call ended event via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('call:ended', { roomId, callId: callSession._id });
    }

    res.json({
      message: 'Room closed',
      roomId,
      duration: callSession.duration,
    });
  })
);

export default router;

