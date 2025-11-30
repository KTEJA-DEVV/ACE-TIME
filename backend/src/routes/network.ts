import { Router, Response } from 'express';
import { Vision } from '../models/Vision';
import { Lead } from '../models/Lead';
import { Offer } from '../models/Offer';
import { Match } from '../models/Match';
import { Connection } from '../models/Connection';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import OpenAI from 'openai';

const router = Router();

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ============ VISIONS ============

// POST /api/network/visions - Create vision
router.post(
  '/visions',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, description, category, tags, visibility } = req.body;

    const vision = new Vision({
      userId: req.userId,
      title,
      description,
      category,
      tags: tags || [],
      visibility: visibility || 'connections',
    });

    await vision.save();
    res.status(201).json({ vision });
  })
);

// GET /api/network/visions - Get user's visions
router.get(
  '/visions',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const visions = await Vision.find({ userId: req.userId })
      .sort({ createdAt: -1 });

    res.json({ visions });
  })
);

// ============ LEADS ============

// POST /api/network/leads - Create lead
router.post(
  '/leads',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, email, phone, company, role, source, notes, tags, interests } = req.body;

    const lead = new Lead({
      userId: req.userId,
      name,
      email,
      phone,
      company,
      role,
      source: source || 'manual',
      notes: notes || '',
      tags: tags || [],
      interests: interests || [],
    });

    await lead.save();
    res.status(201).json({ lead });
  })
);

// GET /api/network/leads - Get user's leads
router.get(
  '/leads',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.query;
    const query: any = { userId: req.userId };
    if (status) query.status = status;

    const leads = await Lead.find(query).sort({ createdAt: -1 });
    res.json({ leads });
  })
);

// PUT /api/network/leads/:id - Update lead
router.put(
  '/leads/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const lead = await Lead.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: req.body },
      { new: true }
    );

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json({ lead });
  })
);

// ============ OFFERS ============

// POST /api/network/offers - Create offer
router.post(
  '/offers',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, description, category, type, tags, targetAudience, pricing, visibility } = req.body;

    const offer = new Offer({
      userId: req.userId,
      title,
      description,
      category,
      type: type || 'service',
      tags: tags || [],
      targetAudience: targetAudience || [],
      pricing,
      visibility: visibility || 'connections',
    });

    await offer.save();
    res.status(201).json({ offer });
  })
);

// GET /api/network/offers - Get user's offers
router.get(
  '/offers',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const offers = await Offer.find({ userId: req.userId })
      .sort({ createdAt: -1 });

    res.json({ offers });
  })
);

// GET /api/network/offers/discover - Discover offers from network
router.get(
  '/offers/discover',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { category, tags } = req.query;

    // Get user's connections
    const connections = await Connection.find({
      userId: req.userId,
      status: 'accepted',
    }).select('connectedUserId');

    const connectionIds = connections.map(c => c.connectedUserId);

    const query: any = {
      userId: { $in: connectionIds },
      status: 'active',
      visibility: { $in: ['connections', 'public', 'premium_network'] },
    };

    if (category) query.category = category;
    if (tags) query.tags = { $in: (tags as string).split(',') };

    const offers = await Offer.find(query)
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ offers });
  })
);

// ============ CONNECTIONS ============

// POST /api/network/connections/request - Send connection request
router.post(
  '/connections/request',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { targetUserId } = req.body;

    if (targetUserId === req.userId) {
      res.status(400).json({ error: 'Cannot connect with yourself' });
      return;
    }

    // Check existing
    const existing = await Connection.findOne({
      $or: [
        { userId: req.userId, connectedUserId: targetUserId },
        { userId: targetUserId, connectedUserId: req.userId },
      ],
    });

    if (existing) {
      res.status(400).json({ error: 'Connection already exists', status: existing.status });
      return;
    }

    const connection = new Connection({
      userId: req.userId,
      connectedUserId: targetUserId,
      status: 'pending',
    });

    await connection.save();
    res.status(201).json({ connection });
  })
);

// PUT /api/network/connections/:id/accept - Accept connection
router.put(
  '/connections/:id/accept',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const connection = await Connection.findOne({
      _id: id,
      connectedUserId: req.userId,
      status: 'pending',
    });

    if (!connection) {
      res.status(404).json({ error: 'Connection request not found' });
      return;
    }

    connection.status = 'accepted';
    await connection.save();

    // Create reverse connection
    await Connection.create({
      userId: req.userId,
      connectedUserId: connection.userId,
      status: 'accepted',
    });

    res.json({ connection });
  })
);

// GET /api/network/connections - Get connections
router.get(
  '/connections',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status = 'accepted' } = req.query;

    const connections = await Connection.find({
      userId: req.userId,
      status,
    }).populate('connectedUserId', 'name email avatar');

    res.json({ connections });
  })
);

// ============ MATCHING ENGINE ============

// POST /api/network/match/find - Find matches for vision/offer
router.post(
  '/match/find',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entityType, entityId } = req.body;

    if (!openai) {
      res.status(503).json({ error: 'Matching engine requires AI configuration' });
      return;
    }

    let sourceEntity: any;
    let searchCriteria: any = {};

    if (entityType === 'vision') {
      sourceEntity = await Vision.findOne({ _id: entityId, userId: req.userId });
      if (!sourceEntity) {
        res.status(404).json({ error: 'Vision not found' });
        return;
      }
      searchCriteria = { tags: sourceEntity.tags, category: sourceEntity.category };
    } else if (entityType === 'offer') {
      sourceEntity = await Offer.findOne({ _id: entityId, userId: req.userId });
      if (!sourceEntity) {
        res.status(404).json({ error: 'Offer not found' });
        return;
      }
      searchCriteria = { tags: sourceEntity.tags, targetAudience: sourceEntity.targetAudience };
    }

    // Get user's connections for mutual matching
    const connections = await Connection.find({
      userId: req.userId,
      status: 'accepted',
    });
    const connectionIds = connections.map(c => c.connectedUserId);

    // Find potential matches
    const potentialOffers = await Offer.find({
      userId: { $ne: req.userId },
      status: 'active',
      $or: [
        { tags: { $in: searchCriteria.tags || [] } },
        { category: searchCriteria.category },
      ],
    }).populate('userId', 'name avatar');

    const potentialVisions = await Vision.find({
      userId: { $ne: req.userId },
      status: 'active',
      $or: [
        { tags: { $in: searchCriteria.tags || [] } },
        { category: searchCriteria.category },
      ],
    }).populate('userId', 'name avatar');

    // Use AI to score and rank matches
    const matches: any[] = [];
    const allPotentialItems = [...potentialOffers.map(o => ({ ...o.toObject(), _type: 'offer' })), 
                               ...potentialVisions.map(v => ({ ...v.toObject(), _type: 'vision' }))];

    for (const item of allPotentialItems) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a business matching AI. Score how well two items match on a scale of 0-100 and provide 2-3 brief reasons. Return JSON: { "score": number, "reasons": string[] }',
            },
            {
              role: 'user',
              content: `Source: ${sourceEntity.title} - ${sourceEntity.description}\n\nTarget: ${item.title} - ${item.description}`,
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 200,
        });

        const result = JSON.parse(response.choices[0]?.message?.content || '{}');
        
        if (result.score >= 50) {
          const isMutual = connectionIds.some(id => id.equals(item.userId._id));
          
          matches.push({
            targetEntity: item,
            targetType: item._type,
            score: result.score,
            reasons: result.reasons,
            isMutualConnection: isMutual,
          });
        }
      } catch (error) {
        console.error('Match scoring error:', error);
      }
    }

    // Sort by score
    matches.sort((a, b) => b.score - a.score);

    res.json({ matches: matches.slice(0, 20) });
  })
);

// GET /api/network/matches - Get user's matches
router.get(
  '/matches',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status = 'pending' } = req.query;

    const matches = await Match.find({
      $or: [{ initiatorId: req.userId }, { targetId: req.userId }],
      status,
    })
      .populate('initiatorId', 'name avatar')
      .populate('targetId', 'name avatar')
      .sort({ matchScore: -1 });

    res.json({ matches });
  })
);

// PUT /api/network/matches/:id/respond - Respond to match
router.put(
  '/matches/:id/respond',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { accept } = req.body;

    const match = await Match.findOne({
      _id: id,
      targetId: req.userId,
      status: 'pending',
    });

    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    match.status = accept ? 'accepted' : 'rejected';
    await match.save();

    // If accepted, create connection
    if (accept) {
      const existingConnection = await Connection.findOne({
        userId: req.userId,
        connectedUserId: match.initiatorId,
      });

      if (!existingConnection) {
        await Connection.create({
          userId: req.userId,
          connectedUserId: match.initiatorId,
          status: 'accepted',
        });
        await Connection.create({
          userId: match.initiatorId,
          connectedUserId: req.userId,
          status: 'accepted',
        });
      }
    }

    res.json({ match });
  })
);

// GET /api/network/stats - Get network stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const [
      visionsCount,
      leadsCount,
      offersCount,
      connectionsCount,
      pendingMatches,
    ] = await Promise.all([
      Vision.countDocuments({ userId: req.userId }),
      Lead.countDocuments({ userId: req.userId }),
      Offer.countDocuments({ userId: req.userId }),
      Connection.countDocuments({ userId: req.userId, status: 'accepted' }),
      Match.countDocuments({
        $or: [{ initiatorId: req.userId }, { targetId: req.userId }],
        status: 'pending',
      }),
    ]);

    res.json({
      visions: visionsCount,
      leads: leadsCount,
      offers: offersCount,
      connections: connectionsCount,
      pendingMatches,
    });
  })
);

export default router;

