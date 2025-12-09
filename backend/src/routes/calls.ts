import { Router, Response } from 'express';
import { CallSession } from '../models/CallSession';
import { Transcript } from '../models/Transcript';
import { Notes } from '../models/Notes';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  uploadRecording, 
  getRecordingStream, 
  deleteRecording as deleteRecordingFile,
  getRecordingInfo 
} from '../services/storage';
import multer from 'multer';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// GET /api/calls/:id - Get call metadata
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id)
      .populate('hostId', 'name email avatar')
      .populate('guestIds', 'name email avatar')
      .populate('transcriptId')
      .populate('notesId');

    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check if user has access
    const userId = req.userId!;
    const isHost = callSession.hostId._id.toString() === userId;
    const isGuest = callSession.guestIds.some((g: any) => g._id.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      call: callSession,
      hasRecording: !!callSession.recordingKey,
    });
  })
);

// POST /api/calls/:id/recording - Upload recording directly
router.post(
  '/:id/recording',
  authenticate,
  upload.single('recording'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);

    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check if user has access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No recording file provided' });
      return;
    }

    // Upload to GridFS - ensure video mime type
    const mimeType = req.file.mimetype || 'video/webm';
    const result = await uploadRecording(
      req.file.buffer,
      `recording-${id}-${Date.now()}.webm`,
      mimeType.startsWith('video/') ? mimeType : 'video/webm',
      { callId: id, userId }
    );

    // Update call session with recording info
    callSession.recordingKey = result.fileId;
    callSession.recordingUrl = `/api/calls/${id}/recording/stream`;
    callSession.metadata.recordingSize = req.file.size;
    await callSession.save();

    // Emit notification to all participants
    const io = req.app.get('io');
    if (io) {
      const participants = [callSession.hostId, ...(callSession.guestIds || [])];
      participants.forEach((participantId) => {
        io.to(`user:${participantId}`).emit('call:recording:ready', {
          callId: id,
          recordingUrl: callSession.recordingUrl,
          duration: callSession.duration,
        });
      });
    }

    res.json({
      message: 'Recording uploaded successfully',
      fileId: result.fileId,
      filename: result.filename,
    });
  })
);

// GET /api/calls/:id/recording/stream - Stream recording
router.get(
  '/:id/recording/stream',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);

    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check if user has access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!callSession.recordingKey) {
      res.status(404).json({ error: 'No recording found' });
      return;
    }

    try {
      const fileInfo = await getRecordingInfo(callSession.recordingKey);
      if (!fileInfo) {
        res.status(404).json({ error: 'Recording file not found' });
        return;
      }

      res.set({
        'Content-Type': fileInfo.contentType || 'video/webm',
        'Content-Length': fileInfo.length?.toString(),
        'Accept-Ranges': 'bytes',
      });

      const downloadStream = getRecordingStream(callSession.recordingKey);
      downloadStream.pipe(res);
    } catch (error) {
      console.error('Error streaming recording:', error);
      res.status(500).json({ error: 'Failed to stream recording' });
    }
  })
);

// GET /api/calls/:id/transcript - Get call transcript
router.get(
  '/:id/transcript',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);
    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const transcript = await Transcript.findOne({ callId: id });
    
    res.json({ transcript });
  })
);

// GET /api/calls/:id/notes - Get AI notes
router.get(
  '/:id/notes',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);
    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const notes = await Notes.findOne({ callId: id });
    
    res.json({ notes });
  })
);

// DELETE /api/calls/:id - Delete call and associated data
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);
    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Only host can delete
    if (callSession.hostId.toString() !== req.userId) {
      res.status(403).json({ error: 'Only the host can delete this call' });
      return;
    }

    // Delete recording from GridFS
    if (callSession.recordingKey) {
      try {
        await deleteRecordingFile(callSession.recordingKey);
      } catch (error) {
        console.error('Error deleting recording:', error);
      }
    }

    // Delete transcript and notes
    await Transcript.deleteOne({ callId: id });
    await Notes.deleteOne({ callId: id });
    await CallSession.deleteOne({ _id: id });

    res.json({ message: 'Call deleted successfully' });
  })
);

export default router;
