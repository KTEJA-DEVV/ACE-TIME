import express, { Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { Friendship } from '../models/Friendship';
import { User } from '../models/User';
import mongoose from 'mongoose';

const router = express.Router();

// GET /api/friends - Get user's friends list
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get all accepted friendships where user is either userId1 or userId2
    const friendships = await Friendship.find({
      $or: [
        { userId1: userId, status: 'accepted' },
        { userId2: userId, status: 'accepted' },
      ],
    })
      .populate('userId1', 'name email avatar')
      .populate('userId2', 'name email avatar')
      .sort({ lastInteraction: -1 });

    // Map to friend objects (always show the other user)
    const friends = friendships.map((friendship) => {
      const userId1Populated = friendship.userId1 as any;
      const userId2Populated = friendship.userId2 as any;
      const friend =
        userId1Populated._id.toString() === userId.toString()
          ? userId2Populated
          : userId1Populated;

      return {
        _id: friendship._id,
        friendId: friend._id,
        name: friend.name,
        email: friend.email,
        avatar: friend.avatar,
        lastInteraction: friendship.lastInteraction,
        callHistory: friendship.callHistory || [],
        friendshipId: friendship._id,
      };
    });

    res.json({ friends });
  })
);

// POST /api/friends/add - Send friend request
router.post(
  '/add',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { targetUserId } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (targetUserId === userId.toString()) {
      res.status(400).json({ error: 'Cannot add yourself as a friend' });
      return;
    }

    // Check if friendship already exists
    const existing = await Friendship.findOne({
      $or: [
        { userId1: userId, userId2: targetUserId },
        { userId1: targetUserId, userId2: userId },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        res.status(400).json({ error: 'Already friends', friendship: existing });
        return;
      }
      if (existing.status === 'pending') {
        res.status(400).json({ error: 'Friend request already pending', friendship: existing });
        return;
      }
      if (existing.status === 'blocked') {
        res.status(400).json({ error: 'User is blocked' });
        return;
      }
    }

    // Create new friendship (pending)
    const friendship = new Friendship({
      userId1: userId,
      userId2: targetUserId,
      status: 'pending',
      lastInteraction: new Date(),
    });

    await friendship.save();

    res.status(201).json({ friendship, message: 'Friend request sent' });
  })
);

// POST /api/friends/accept - Accept friend request
router.post(
  '/accept',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { friendshipId } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const friendship = await Friendship.findById(friendshipId);

    if (!friendship) {
      res.status(404).json({ error: 'Friendship not found' });
      return;
    }

    // Verify user is the recipient
    if (friendship.userId2.toString() !== userId.toString()) {
      res.status(403).json({ error: 'Not authorized to accept this request' });
      return;
    }

    if (friendship.status !== 'pending') {
      res.status(400).json({ error: 'Friendship is not pending' });
      return;
    }

    friendship.status = 'accepted';
    friendship.lastInteraction = new Date();
    await friendship.save();

    res.json({ friendship, message: 'Friend request accepted' });
  })
);

// POST /api/friends/block - Block a friend
router.post(
  '/block',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { friendshipId } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const friendship = await Friendship.findById(friendshipId);

    if (!friendship) {
      res.status(404).json({ error: 'Friendship not found' });
      return;
    }

    // Verify user is part of the friendship
    if (
      friendship.userId1.toString() !== userId.toString() &&
      friendship.userId2.toString() !== userId.toString()
    ) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    friendship.status = 'blocked';
    await friendship.save();

    res.json({ friendship, message: 'User blocked' });
  })
);

// DELETE /api/friends/:friendshipId - Remove friend
router.delete(
  '/:friendshipId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { friendshipId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const friendship = await Friendship.findById(friendshipId);

    if (!friendship) {
      res.status(404).json({ error: 'Friendship not found' });
      return;
    }

    // Verify user is part of the friendship
    if (
      friendship.userId1.toString() !== userId.toString() &&
      friendship.userId2.toString() !== userId.toString()
    ) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    await Friendship.deleteOne({ _id: friendshipId });

    res.json({ message: 'Friendship removed' });
  })
);

// GET /api/friends/pending - Get pending friend requests
router.get(
  '/pending',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get pending requests where user is the recipient
    const pending = await Friendship.find({
      userId2: userId,
      status: 'pending',
    })
      .populate('userId1', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({ requests: pending });
  })
);

// POST /api/friends/update-interaction - Update last interaction time
router.post(
  '/update-interaction',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { friendId } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const friendship = await Friendship.findOne({
      $or: [
        { userId1: userId, userId2: friendId },
        { userId1: friendId, userId2: userId },
      ],
    });

    if (friendship) {
      friendship.lastInteraction = new Date();
      await friendship.save();
    }

    res.json({ success: true });
  })
);

export default router;

