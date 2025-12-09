import express, { Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { PrivateCall } from '../models/PrivateCall';
import { Friendship } from '../models/Friendship';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/calls/private - Initiate private call
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { recipientId, type, conversationId } = req.body;
    const callerId = req.userId;

    if (!callerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (recipientId === callerId.toString()) {
      res.status(400).json({ error: 'Cannot call yourself' });
      return;
    }

    // Verify friendship exists and is accepted
    const friendship = await Friendship.findOne({
      $or: [
        { userId1: callerId, userId2: recipientId, status: 'accepted' },
        { userId1: recipientId, userId2: callerId, status: 'accepted' },
      ],
    });

    if (!friendship) {
      res.status(403).json({ error: 'You must be friends to call' });
      return;
    }

    // Generate unique call ID
    const callId = `private-${uuidv4()}`;

    // Create private call record
    const privateCall = new PrivateCall({
      callerId,
      recipientId,
      type: type || 'video',
      status: 'ringing',
      callId,
      startTime: new Date(),
      interface: 'facetime',
      conversationId: conversationId || undefined,
    });

    await privateCall.save();

    // Update friendship last interaction
    friendship.lastInteraction = new Date();
    await friendship.save();

    res.status(201).json({
      call: privateCall,
      callId: privateCall.callId,
      message: 'Call initiated',
    });
  })
);

// GET /api/calls/private/:callId - Get call details
router.get(
  '/:callId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { callId } = req.params;
    const userId = req.userId;

    const call = await PrivateCall.findOne({ callId })
      .populate('callerId', 'name email avatar')
      .populate('recipientId', 'name email avatar');

    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Verify user is part of the call
    if (!userId || (
      call.callerId._id.toString() !== userId.toString() &&
      call.recipientId._id.toString() !== userId.toString()
    )) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    res.json({ call });
  })
);

// PUT /api/calls/private/:callId/accept - Accept call
router.put(
  '/:callId/accept',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { callId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const call = await PrivateCall.findOne({ callId });

    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Verify user is the recipient
    if (call.recipientId.toString() !== userId.toString()) {
      res.status(403).json({ error: 'Not authorized to accept this call' });
      return;
    }

    if (call.status !== 'ringing') {
      res.status(400).json({ error: 'Call is not ringing' });
      return;
    }

    call.status = 'active';
    call.startTime = new Date();
    await call.save();

    res.json({ call, message: 'Call accepted' });
  })
);

// PUT /api/calls/private/:callId/decline - Decline call
router.put(
  '/:callId/decline',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { callId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const call = await PrivateCall.findOne({ callId });

    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Verify user is the recipient
    if (call.recipientId.toString() !== userId.toString()) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    call.status = 'missed';
    call.endTime = new Date();
    await call.save();

    res.json({ call, message: 'Call declined' });
  })
);

// PUT /api/calls/private/:callId/end - End call
router.put(
  '/:callId/end',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { callId } = req.params;
    const { duration } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const call = await PrivateCall.findOne({ callId });

    if (!call) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Verify user is part of the call
    if (
      call.callerId.toString() !== userId.toString() &&
      call.recipientId.toString() !== userId.toString()
    ) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    call.status = 'ended';
    call.endTime = new Date();
    call.duration = duration || Math.floor((call.endTime.getTime() - call.startTime.getTime()) / 1000);

    await call.save();

    // Update friendship call history
    const friendship = await Friendship.findOne({
      $or: [
        { userId1: call.callerId, userId2: call.recipientId },
        { userId1: call.recipientId, userId2: call.callerId },
      ],
    });

    if (friendship) {
      if (!friendship.callHistory) {
        friendship.callHistory = [];
      }
      friendship.callHistory.push({
        callId: call.callId,
        type: call.type,
        duration: call.duration,
        timestamp: call.endTime,
      });
      // Keep only last 50 calls
      if (friendship.callHistory.length > 50) {
        friendship.callHistory = friendship.callHistory.slice(-50);
      }
      friendship.lastInteraction = new Date();
      await friendship.save();
    }

    res.json({ call, message: 'Call ended' });
  })
);

export default router;

