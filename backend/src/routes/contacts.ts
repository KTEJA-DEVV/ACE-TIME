import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Contact } from '../models/Contact';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { CallSession } from '../models/CallSession';
import { User } from '../models/User';
import { generateContactContext } from '../services/contactContext';

const router = express.Router();

/**
 * GET /api/contacts
 * Get all contacts for the current user
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    const contacts = await Contact.find({
      userId: new mongoose.Types.ObjectId(userId),
      isArchived: false,
    })
      .populate('contactUserId', 'name email avatar')
      .populate('conversationId', 'lastMessage')
      .sort({ isPinned: -1, lastInteractionAt: -1 })
      .lean();

    // Format response with last message preview
    const formattedContacts = await Promise.all(
      contacts.map(async (contact: any) => {
        const conversation = await Conversation.findById(contact.conversationId)
          .populate('lastMessage.senderId', 'name avatar')
          .lean();

        const contactUser = contact.contactUserId as any;
        const conv = conversation as any;

        return {
          _id: contact._id,
          contact: {
            _id: contactUser._id || contactUser,
            name: contactUser.name || 'Unknown',
            email: contactUser.email || '',
            avatar: contactUser.avatar,
          },
          conversationId: (contact.conversationId as any)._id || contact.conversationId,
          nickname: contact.nickname,
          tags: contact.tags,
          lastInteractionAt: contact.lastInteractionAt,
          totalMessages: contact.totalMessages,
          totalCalls: contact.totalCalls,
          unreadCount: contact.unreadCount,
          isPinned: contact.isPinned,
          lastMessage: conv?.lastMessage ? {
            content: conv.lastMessage.content,
            sender: {
              _id: (conv.lastMessage.senderId as any)?._id || conv.lastMessage.senderId,
              name: (conv.lastMessage.senderId as any)?.name || 'Unknown',
              avatar: (conv.lastMessage.senderId as any)?.avatar,
            },
            timestamp: conv.lastMessage.timestamp,
          } : null,
          aiContext: contact.aiContext,
        };
      })
    );

    res.json({ contacts: formattedContacts });
  } catch (error: any) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

/**
 * GET /api/contacts/:contactId
 * Get a specific contact with full details
 */
router.get('/:contactId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const contactId = req.params.contactId;

    const contact = await Contact.findOne({
      _id: contactId,
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate('contactUserId', 'name email avatar')
      .populate('conversationId')
      .lean();

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ contact });
  } catch (error: any) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

/**
 * POST /api/contacts
 * Create or get a contact (auto-creates conversation if needed)
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { contactUserId, nickname, tags } = req.body;

    if (!contactUserId) {
      return res.status(400).json({ error: 'contactUserId is required' });
    }

    // Check if contact already exists
    let contact = await Contact.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      contactUserId: new mongoose.Types.ObjectId(contactUserId),
    })
      .populate('contactUserId', 'name email avatar')
      .populate('conversationId');

    if (contact) {
      // Update if nickname or tags provided
      if (nickname !== undefined || tags !== undefined) {
        if (nickname !== undefined) contact.nickname = nickname;
        if (tags !== undefined) contact.tags = tags;
        await contact.save();
      }
      return res.json({ contact, created: false });
    }

    // Create conversation first
    const conversation = new Conversation({
      type: 'direct',
      participants: [
        new mongoose.Types.ObjectId(userId),
        new mongoose.Types.ObjectId(contactUserId),
      ],
      aiEnabled: true,
    });
    await conversation.save();

    // Create contact
    contact = new Contact({
      userId: new mongoose.Types.ObjectId(userId),
      contactUserId: new mongoose.Types.ObjectId(contactUserId),
      conversationId: conversation._id,
      nickname,
      tags: tags || [],
      lastInteractionAt: new Date(),
    });
    await contact.save();

    await contact.populate('contactUserId', 'name email avatar');
    await contact.populate('conversationId');

    res.status(201).json({ contact, created: true });
  } catch (error: any) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

/**
 * GET /api/contacts/:contactId/thread
 * Get full chat thread for a contact (messages, calls, AI notes)
 */
router.get('/:contactId/thread', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const contactId = req.params.contactId;
    const { limit = 50, cursor } = req.query;

    // Get contact and conversation
    const contact = await Contact.findOne({
      _id: contactId,
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate('conversationId')
      .lean();

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const conversationId = (contact.conversationId as any)._id;

    // Build query for messages
    const messageQuery: any = {
      conversationId: conversationId,
    };

    if (cursor) {
      messageQuery._id = { $lt: new mongoose.Types.ObjectId(cursor as string) };
    }

    // Get messages
    const messages = await Message.find(messageQuery)
      .populate('senderId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    // Get call history for this conversation
    const calls = await CallSession.find({
      'metadata.conversationId': conversationId,
    })
      .populate('hostId', 'name avatar')
      .populate('guestIds', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    // Format calls as thread items
    const callThreadItems = calls.map((call: any) => ({
      _id: call._id,
      type: 'call',
      callId: call._id,
      duration: call.duration,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      recordingUrl: call.recordingUrl,
      transcriptId: call.transcriptId,
      notesId: call.notesId,
      participants: [
        { _id: call.hostId._id, name: call.hostId.name, avatar: call.hostId.avatar },
        ...(call.guestIds || []).map((g: any) => ({
          _id: g._id,
          name: g.name,
          avatar: g.avatar,
        })),
      ],
      metadata: call.metadata,
    }));

    // Combine and sort by timestamp
    const threadItems = [
      ...messages.map((msg: any) => ({
        _id: msg._id,
        type: msg.type,
        content: msg.content,
        sender: {
          _id: msg.senderId._id,
          name: msg.senderId.name,
          avatar: msg.senderId.avatar,
        },
        attachments: msg.attachments,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      })),
      ...callThreadItems,
    ].sort((a: any, b: any) => {
      const timeA = a.createdAt || a.startedAt || new Date(0);
      const timeB = b.createdAt || b.startedAt || new Date(0);
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    res.json({
      contact,
      thread: threadItems,
      hasMore: messages.length === Number(limit),
      nextCursor: messages.length > 0 ? messages[messages.length - 1]._id : null,
    });
  } catch (error: any) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

/**
 * GET /api/contacts/:contactId/thread/search
 * Search messages within a contact's thread
 */
router.get('/:contactId/thread/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const contactId = req.params.contactId;
    const { q, limit = 20 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Get contact and conversation
    const contact = await Contact.findOne({
      _id: contactId,
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate('conversationId')
      .lean();

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const conversationId = (contact.conversationId as any)._id;

    // Search messages
    const messages = await Message.find({
      conversationId: conversationId,
      content: { $regex: q, $options: 'i' },
    })
      .populate('senderId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({
      results: messages.map((msg: any) => ({
        _id: msg._id,
        type: msg.type,
        content: msg.content,
        sender: {
          _id: msg.senderId._id,
          name: msg.senderId.name,
          avatar: msg.senderId.avatar,
        },
        createdAt: msg.createdAt,
        metadata: msg.metadata,
      })),
      query: q,
    });
  } catch (error: any) {
    console.error('Search thread error:', error);
    res.status(500).json({ error: 'Failed to search thread' });
  }
});

/**
 * PUT /api/contacts/:contactId
 * Update contact (nickname, tags, notes, pin, archive, block)
 */
router.put('/:contactId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const contactId = req.params.contactId;
    const { nickname, tags, notes, isPinned, isArchived, isBlocked } = req.body;

    const contact = await Contact.findOne({
      _id: contactId,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (nickname !== undefined) contact.nickname = nickname;
    if (tags !== undefined) contact.tags = tags;
    if (notes !== undefined) contact.notes = notes;
    if (isPinned !== undefined) contact.isPinned = isPinned;
    if (isArchived !== undefined) contact.isArchived = isArchived;
    if (isBlocked !== undefined) contact.isBlocked = isBlocked;

    await contact.save();
    await contact.populate('contactUserId', 'name email avatar');

    res.json({ contact });
  } catch (error: any) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

/**
 * DELETE /api/contacts/:contactId
 * Delete a contact (archives it instead of hard delete)
 */
router.delete('/:contactId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const contactId = req.params.contactId;

    const contact = await Contact.findOne({
      _id: contactId,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Archive instead of delete
    contact.isArchived = true;
    await contact.save();

    res.json({ message: 'Contact archived', contact });
  } catch (error: any) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

/**
 * GET /api/contacts/:contactId/calls
 * Get call history for a contact
 */
router.get('/:contactId/calls', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const contactId = req.params.contactId;

    const contact = await Contact.findOne({
      _id: contactId,
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate('conversationId')
      .lean();

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const conversationId = (contact.conversationId as any)._id;

    const calls = await CallSession.find({
      'metadata.conversationId': conversationId,
    })
      .populate('hostId', 'name avatar')
      .populate('guestIds', 'name avatar')
      .populate('transcriptId')
      .populate('notesId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ calls });
  } catch (error: any) {
    console.error('Get calls error:', error);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

export default router;

