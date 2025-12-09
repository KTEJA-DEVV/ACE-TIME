import { Router, Response } from 'express';
import { CallSession } from '../models/CallSession';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { Contact } from '../models/Contact';
import { Connection } from '../models/Connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/users/history - Get user's call history with filters
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { 
      page = 1, 
      limit = 20, 
      search,
      contactId,
      dateFrom,
      dateTo,
      minDuration,
      maxDuration,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Base query: Find calls where user is host or guest
    const query: any = {
      $or: [
        { hostId: userId },
        { guestIds: userId },
      ],
      status: 'ended',
    };

    // Filter by contact
    if (contactId) {
      query.$or = [
        { hostId: contactId, guestIds: userId },
        { hostId: userId, guestIds: contactId },
      ];
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo as string);
      }
    }

    // Filter by duration
    if (minDuration || maxDuration) {
      query.duration = {};
      if (minDuration) {
        query.duration.$gte = parseInt(minDuration as string);
      }
      if (maxDuration) {
        query.duration.$lte = parseInt(maxDuration as string);
      }
    }

    let calls = await CallSession.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('hostId', 'name email avatar')
      .populate('guestIds', 'name email avatar')
      .populate('transcriptId')
      .populate('notesId')
      .lean();

    // Search within transcripts and notes if search query provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      calls = calls.filter((call: any) => {
        // Search in transcript
        if (call.transcriptId?.fullText?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in notes summary
        if (call.notesId?.summary?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in key topics
        if (call.notesId?.keyTopics?.some((topic: string) => topic.toLowerCase().includes(searchLower))) {
          return true;
        }
        // Search in participant names
        const hostName = call.hostId?.name?.toLowerCase() || '';
        const guestNames = call.guestIds?.map((g: any) => g?.name?.toLowerCase()).join(' ') || '';
        if (hostName.includes(searchLower) || guestNames.includes(searchLower)) {
          return true;
        }
        return false;
      });
    }

    const total = search 
      ? calls.length // If searching, count filtered results
      : await CallSession.countDocuments(query);

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

// GET /api/users/:userId/profile - Get user profile with stats
router.get(
  '/:userId/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId!;

    const targetUser = await User.findById(targetUserId).select('name email avatar bio settings createdAt');
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check privacy settings
    const isOwnProfile = targetUserId === currentUserId.toString();
    const isPublic = targetUser.settings?.privacy?.profileVisibility === 'public';
    const isContact = await Connection.findOne({
      $or: [
        { userId: currentUserId, connectedUserId: targetUserId, status: 'accepted' },
        { userId: targetUserId, connectedUserId: currentUserId, status: 'accepted' },
      ],
    });

    if (!isOwnProfile && !isPublic && !isContact) {
      res.status(403).json({ error: 'Profile is private' });
      return;
    }

    // Get stats
    const [totalCalls, totalMessages, totalAIChats, totalDuration] = await Promise.all([
      CallSession.countDocuments({
        $or: [{ hostId: targetUserId }, { guestIds: targetUserId }],
        status: 'ended',
      }),
      Message.countDocuments({
        $or: [{ senderId: targetUserId }, { 'conversationId.participants': targetUserId }],
      }),
      Message.countDocuments({
        senderId: targetUserId,
        type: 'ai_response',
      }),
      CallSession.aggregate([
        {
          $match: {
            $or: [{ hostId: targetUserId }, { guestIds: targetUserId }],
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
    ]);

    // Get recent activity (last 10 items)
    const recentActivity = await Promise.all([
      CallSession.find({
        $or: [{ hostId: targetUserId }, { guestIds: targetUserId }],
        status: 'ended',
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('hostId', 'name avatar')
        .select('roomId duration createdAt type'),
      Message.find({
        senderId: targetUserId,
        type: { $in: ['text', 'ai_response'] },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('conversationId', 'participants')
        .select('content type createdAt conversationId'),
    ]);

    // Get common contacts (if viewing other user's profile)
    let commonContacts = [];
    if (!isOwnProfile) {
      const currentUserContacts = await Contact.find({ userId: currentUserId })
        .populate('contactUserId', 'name avatar')
        .select('contactUserId');
      const targetUserContacts = await Contact.find({ userId: targetUserId })
        .populate('contactUserId', 'name avatar')
        .select('contactUserId');

      const currentContactIds = new Set(
        currentUserContacts.map((c: any) => c.contactUserId._id.toString())
      );
      commonContacts = targetUserContacts
        .filter((c: any) => currentContactIds.has(c.contactUserId._id.toString()))
        .map((c: any) => c.contactUserId)
        .slice(0, 10);
    }

    // Get call history with this person (if viewing other user's profile)
    let callHistoryWithUser: any[] = [];
    if (!isOwnProfile) {
      callHistoryWithUser = await CallSession.find({
        $or: [
          { hostId: currentUserId, guestIds: targetUserId },
          { hostId: targetUserId, guestIds: currentUserId },
        ],
        status: 'ended',
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('roomId duration createdAt type')
        .lean();
    }

    // Get mutual topics (from AI context in contacts)
    let mutualTopics: string[] = [];
    if (!isOwnProfile) {
      const currentUserContact = await Contact.findOne({
        userId: currentUserId,
        contactUserId: targetUserId,
      });
      const targetUserContact = await Contact.findOne({
        userId: targetUserId,
        contactUserId: currentUserId,
      });

      const currentTopics = currentUserContact?.aiContext?.keyTopics || [];
      const targetTopics = targetUserContact?.aiContext?.keyTopics || [];
      mutualTopics = [...new Set([...currentTopics, ...targetTopics])].slice(0, 10);
    }

    res.json({
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: isOwnProfile ? targetUser.email : undefined,
        avatar: targetUser.avatar,
        bio: targetUser.bio,
        createdAt: targetUser.createdAt,
      },
      stats: {
        totalCalls,
        totalMessages,
        totalAIChats,
        totalDuration: totalDuration[0]?.total || 0,
      },
      recentActivity: recentActivity.flat().sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ).slice(0, 10),
      commonContacts,
      callHistoryWithUser,
      mutualTopics,
      isOwnProfile,
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
    const { name, avatar, bio } = req.body;

    const updates: any = {};
    if (name) updates.name = name;
    if (avatar !== undefined) updates.avatar = avatar;
    if (bio !== undefined) updates.bio = bio;

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
        bio: user.bio,
        settings: user.settings,
      }
    });
  })
);

// GET /api/users/settings - Get user settings
router.get(
  '/settings',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await User.findById(req.userId).select('settings bio');
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ 
      settings: user.settings,
      bio: user.bio,
    });
  })
);

// PUT /api/users/settings - Update user settings
router.put(
  '/settings',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { settings, bio } = req.body;

    const updates: any = {};
    if (settings) {
      updates['settings'] = settings;
    }
    if (bio !== undefined) {
      updates.bio = bio;
    }

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
      settings: user.settings,
      bio: user.bio,
      message: 'Settings updated successfully',
    });
  })
);

// POST /api/users/settings/reset - Reset settings to defaults
router.post(
  '/settings/reset',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        $set: {
          'settings.defaultMic': true,
          'settings.defaultCamera': true,
          'settings.autoRecord': true,
          'settings.notifications.incomingCalls': true,
          'settings.notifications.newMessages': true,
          'settings.notifications.friendRequests': true,
          'settings.notifications.aiInsights': true,
          'settings.notifications.callRecordings': true,
          'settings.callQuality.videoResolution': 'auto',
          'settings.callQuality.bandwidth': 'auto',
          'settings.callQuality.audioQuality': 'high',
          'settings.ai.enabled': true,
          'settings.ai.voicePreference': 'neutral',
          'settings.ai.autoTranscribe': true,
          'settings.ai.autoSummarize': true,
          'settings.privacy.whoCanCall': 'everyone',
          'settings.privacy.chatHistory': 'forever',
          'settings.privacy.profileVisibility': 'public',
          'settings.appearance.theme': 'dark',
          'settings.appearance.accentColor': 'purple',
        }
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ 
      settings: user.settings,
      message: 'Settings reset to defaults',
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

