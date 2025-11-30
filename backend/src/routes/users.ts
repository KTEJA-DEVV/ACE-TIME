import { Router, Response } from 'express';
import { CallSession } from '../models/CallSession';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/users/history - Get user's call history
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { page = 1, limit = 20, search } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Find calls where user is host or guest
    const query: any = {
      $or: [
        { hostId: userId },
        { guestIds: userId },
      ],
      status: 'ended',
    };

    const calls = await CallSession.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('hostId', 'name email avatar')
      .populate('guestIds', 'name email avatar')
      .populate('transcriptId', 'fullText wordCount')
      .populate('notesId', 'summary keyTopics');

    const total = await CallSession.countDocuments(query);

    res.json({
      calls,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  })
);

// GET /api/users/stats - Get user stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const [totalCalls, totalDuration, recentCalls] = await Promise.all([
      CallSession.countDocuments({
        $or: [{ hostId: userId }, { guestIds: userId }],
        status: 'ended',
      }),
      CallSession.aggregate([
        {
          $match: {
            $or: [{ hostId: userId }, { guestIds: userId }],
            status: 'ended',
            duration: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$duration' },
          },
        },
      ]),
      CallSession.find({
        $or: [{ hostId: userId }, { guestIds: userId }],
        status: 'ended',
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('roomId duration createdAt'),
    ]);

    res.json({
      totalCalls,
      totalDuration: totalDuration[0]?.total || 0,
      recentCalls,
    });
  })
);

// PUT /api/users/settings - Update user settings
router.put(
  '/settings',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { defaultMic, defaultCamera, autoRecord } = req.body;

    const updates: any = {};
    if (typeof defaultMic === 'boolean') updates['settings.defaultMic'] = defaultMic;
    if (typeof defaultCamera === 'boolean') updates['settings.defaultCamera'] = defaultCamera;
    if (typeof autoRecord === 'boolean') updates['settings.autoRecord'] = autoRecord;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        settings: user.settings,
      }
    });
  })
);

// PUT /api/users/profile - Update user profile
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, avatar } = req.body;

    const updates: any = {};
    if (name) updates.name = name;
    if (avatar) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        settings: user.settings,
      }
    });
  })
);

// DELETE /api/users/account - Delete user account
router.delete(
  '/account',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    // This would need more comprehensive cleanup in production
    // (delete all calls, recordings, etc.)
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully' });
  })
);

export default router;

