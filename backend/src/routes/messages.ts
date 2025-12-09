import { Router, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import multer from 'multer';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { CallSession } from '../models/CallSession';
import { Connection } from '../models/Connection';
import { Contact } from '../models/Contact';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { uploadRecording } from '../services/storage';
import OpenAI from 'openai';

const router = Router();

// Helper: Generate dedupe key for thread
const generateThreadKey = (participantIds: string[]): string => {
  const sorted = participantIds.map(id => id.toString()).sort();
  return crypto.createHash('sha256').update(sorted.join(':')).digest('hex');
};

// Helper: Auto-create friend connection after private message exchange
const ensureFriendConnection = async (userId1: string, userId2: string) => {
  try {
    const user1Id = new mongoose.Types.ObjectId(userId1);
    const user2Id = new mongoose.Types.ObjectId(userId2);

    // Check if connection already exists in either direction
    const existingConnection = await Connection.findOne({
      $or: [
        { userId: user1Id, connectedUserId: user2Id },
        { userId: user2Id, connectedUserId: user1Id },
      ],
    });

    if (existingConnection) {
      // Update last interaction time
      existingConnection.lastInteractionAt = new Date();
      await existingConnection.save();
      console.log(`[FRIENDS] Updated existing connection between ${userId1} and ${userId2}`);
      return existingConnection;
    }

    // Create bi-directional friend connections (auto-accepted from private chat)
    const connection1 = new Connection({
      userId: user1Id,
      connectedUserId: user2Id,
      status: 'accepted',
      lastInteractionAt: new Date(),
      connectionStrength: 50, // Medium strength for chat-initiated connection
    });

    const connection2 = new Connection({
      userId: user2Id,
      connectedUserId: user1Id,
      status: 'accepted',
      lastInteractionAt: new Date(),
      connectionStrength: 50,
    });

    await Promise.all([connection1.save(), connection2.save()]);
    console.log(`[FRIENDS] Auto-created friend connection between ${userId1} and ${userId2}`);
    
    return connection1;
  } catch (error: any) {
    // Ignore duplicate key errors (connection already exists)
    if (error.code === 11000) {
      console.log(`[FRIENDS] Connection already exists between ${userId1} and ${userId2}`);
      return null;
    }
    console.error('[FRIENDS] Error creating connection:', error);
    return null;
  }
};

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// GET /api/messages/conversations - Get all conversations
router.get(
  '/conversations',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const conversations = await Conversation.find({
      participants: req.userId,
    })
      .populate('participants', 'name email avatar')
      .sort({ 'lastMessage.timestamp': -1 });

    res.json({ conversations });
  })
);

// POST /api/messages/conversations - Create conversation
router.post(
  '/conversations',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { participantIds, type = 'direct', name, aiEnabled = true } = req.body;

    const allParticipants = [...new Set([req.userId, ...participantIds])];

    // Check for existing direct conversation
    if (type === 'direct' && allParticipants.length === 2) {
      const existing = await Conversation.findOne({
        type: 'direct',
        participants: { $all: allParticipants, $size: 2 },
      });
      if (existing) {
        res.json({ conversation: existing });
        return;
      }
    }

    const conversation = new Conversation({
      type,
      name,
      participants: allParticipants,
      admins: [req.userId],
      aiEnabled,
    });

    await conversation.save();

    res.status(201).json({ conversation });
  })
);

// POST /api/messages/conversations/from-call - Create conversation from call
router.post(
  '/conversations/from-call',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { callId } = req.body;

    if (!callId) {
      res.status(400).json({ error: 'Call ID required' });
      return;
    }

    // Get call session - don't populate first to check raw IDs
    let callSession = await CallSession.findById(callId);

    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check if user participated in the call
    const userId = req.userId!;
    const userIdStr = userId.toString();
    
    // Check host (handle both ObjectId and populated)
    const hostIdStr = callSession.hostId._id ? callSession.hostId._id.toString() : callSession.hostId.toString();
    const isHost = hostIdStr === userIdStr;
    
    // Check guests (handle both ObjectId and populated)
    let isGuest = callSession.guestIds.some((g: any) => {
      const guestIdStr = g._id ? g._id.toString() : g.toString();
      return guestIdStr === userIdStr;
    });

    // If user is not in guestIds yet, add them (race condition fix)
    // This can happen if they join via socket before the REST API call completes
    if (!isHost && !isGuest) {
      try {
        const userObjectId = new mongoose.Types.ObjectId(userId);
        // Double-check they're not already there
        const alreadyGuest = callSession.guestIds.some((g: any) => {
          const guestIdStr = g._id ? g._id.toString() : g.toString();
          return guestIdStr === userIdStr;
        });
        
        if (!alreadyGuest) {
          callSession.guestIds.push(userObjectId);
          await callSession.save();
          isGuest = true; // Now they are a guest
          console.log(`[CONVERSATION] Added user ${userId} to call ${callId} guestIds`);
        }
      } catch (error) {
        console.error('[CONVERSATION] Error adding user to guestIds:', error);
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Now populate for creating conversation
    await callSession.populate('hostId', 'name email avatar');
    await callSession.populate('guestIds', 'name email avatar');

    // Check if conversation already exists for this call
    const existing = await Conversation.findOne({ linkedCallId: callId });
    if (existing) {
      res.json({ conversation: existing });
      return;
    }

    // Get all participants (handle both populated and non-populated)
    const participants = [
      callSession.hostId._id || callSession.hostId,
      ...callSession.guestIds.map((g: any) => g._id || g),
    ];

    // Create conversation
    const conversation = new Conversation({
      type: participants.length > 2 ? 'group' : 'direct',
      name: `Call: ${new Date(callSession.startedAt || callSession.createdAt).toLocaleDateString()}`,
      participants,
      admins: [callSession.hostId._id || callSession.hostId],
      aiEnabled: true,
      linkedCallId: callId,
    });

    await conversation.save();

    // Optionally add initial message with call summary
    if (callSession.notesId) {
      // Could add a system message here with call summary
    }

    res.status(201).json({ conversation });
  })
);

// GET /api/messages/conversations/:id - Get conversation by ID
router.get(
  '/conversations/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    const conversation = await Conversation.findById(id)
      .populate('participants', 'name email avatar');

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      (p: any) => p._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ conversation });
  })
);

// GET /api/messages/conversations/:id/messages - Get messages
router.get(
  '/conversations/:id/messages',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    const conversation = await Conversation.findById(id);
    // Use string comparison for ObjectIds
    const userIdStr = req.userId!.toString();
    const isParticipant = conversation?.participants?.some(
      (p: any) => p.toString() === userIdStr
    );
    if (!conversation || !isParticipant) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const query: any = { conversationId: id };
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ messages: messages.reverse() });
  })
);

// POST /api/messages/conversations/:id/messages - Send message
router.post(
  '/conversations/:id/messages',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { content, type = 'text', requestAiResponse = false, attachments } = req.body;

    const conversation = await Conversation.findById(id);
    // Use string comparison for ObjectIds
    const userIdStr = req.userId!.toString();
    const isParticipant = conversation?.participants?.some(
      (p: any) => p.toString() === userIdStr
    );
    if (!conversation || !isParticipant) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Create user message
    const message = new Message({
      conversationId: id,
      senderId: req.userId,
      content,
      type: attachments && attachments.length > 0 ? 'image' : type,
      aiGenerated: false,
      attachments: attachments || [],
    });
    await message.save();

    // Update conversation last message
    conversation.lastMessage = {
      content,
      senderId: req.user!._id,
      timestamp: new Date(),
    };
    await conversation.save();

    // Update Contact records for direct conversations
    if (conversation.type === 'direct' && conversation.participants.length === 2) {
      const otherParticipantId = conversation.participants.find(
        (p: any) => p.toString() !== userIdStr
      );
      
      if (otherParticipantId) {
        // Update contact for current user
        const contact = await Contact.findOne({
          userId: new mongoose.Types.ObjectId(userIdStr),
          contactUserId: new mongoose.Types.ObjectId(otherParticipantId.toString()),
          conversationId: conversation._id,
        });

        if (contact) {
          contact.totalMessages = (contact.totalMessages || 0) + 1;
          contact.lastInteractionAt = new Date();
          await contact.save();
          
          // Trigger context update in background (non-blocking)
          const { generateContactContext } = await import('../services/contactContext');
          const contactUser = await User.findById(otherParticipantId);
          generateContactContext(
            contactUser?.name || 'Contact',
            userIdStr,
            otherParticipantId.toString(),
            conversation._id.toString()
          ).then((context) => {
            contact.aiContext = {
              summary: context.summary,
              keyTopics: context.keyTopics,
              relationship: context.relationship,
              lastUpdated: new Date(),
            };
            contact.save().catch(console.error);
          }).catch(console.error);
        } else {
          // Auto-create contact if it doesn't exist
          try {
            const newContact = new Contact({
              userId: new mongoose.Types.ObjectId(userIdStr),
              contactUserId: new mongoose.Types.ObjectId(otherParticipantId.toString()),
              conversationId: conversation._id,
              lastInteractionAt: new Date(),
              totalMessages: 1,
            });
            await newContact.save();
          } catch (err: any) {
            // Ignore duplicate key errors (contact might have been created concurrently)
            if (err.code !== 11000) {
              console.error('[CONTACTS] Error creating contact:', err);
            }
          }
        }

        // Auto-add to friends for direct/private conversations
        // Run in background - don't block message sending
        ensureFriendConnection(userIdStr, otherParticipantId.toString()).catch(err => {
          console.error('[FRIENDS] Background friend creation failed:', err);
        });
      }
    }

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
        // Populate sender info before emitting
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name avatar')
          .lean();
        
        if (!populatedMessage) {
          console.error('[MESSAGES] ❌ Failed to populate message after save');
          res.status(500).json({ error: 'Failed to send message' });
          return;
        }
        
        console.log(`[MESSAGES] 📤 Emitting message:new to conversation:${id}`);
        console.log(`[MESSAGES] Message ID: ${message._id}, Sender: ${req.userId}`);
        console.log(`[MESSAGES] Message content: ${content.substring(0, 50)}...`);
        
        // Ensure conversationId is included in the message object (as string for consistency)
        // Handle populated senderId (could be ObjectId or populated object)
        const senderIdData = populatedMessage.senderId;
        let senderData: any;
        
        if (senderIdData && typeof senderIdData === 'object' && 'name' in senderIdData && !Array.isArray(senderIdData)) {
          // Populated user object
          const senderObj = senderIdData as any;
          senderData = {
            _id: senderObj._id?.toString() || senderObj.toString(),
            name: senderObj.name || 'Unknown',
            avatar: senderObj.avatar || undefined,
          };
        } else {
          // Just ObjectId - fetch user info
          const userId = Array.isArray(senderIdData) ? senderIdData[0] : senderIdData;
          const user = await User.findById(userId).select('name avatar').lean();
          senderData = {
            _id: userId?.toString() || userId,
            name: (user as any)?.name || 'Unknown',
            avatar: (user as any)?.avatar || undefined,
          };
        }
        
        const messageToEmit = {
          ...populatedMessage,
          conversationId: id.toString(), // Ensure it's a string
          _id: populatedMessage._id.toString(),
          senderId: senderData,
        };
      
      // Emit to all participants in the conversation room
      // This ensures both users receive the message
      io.to(`conversation:${id}`).emit('message:new', {
        message: messageToEmit,
      });
      
      // Also log how many sockets are in the room for debugging
      const room = io.sockets.adapter.rooms.get(`conversation:${id}`);
      const socketCount = room ? room.size : 0;
      console.log(`[MESSAGES] ✅ Room 'conversation:${id}' has ${socketCount} socket(s) - message broadcasted`);
      
      if (socketCount === 0) {
        console.warn(`[MESSAGES] ⚠️ No sockets in room 'conversation:${id}' - message saved but not delivered in real-time`);
      }
    } else {
      console.warn('[MESSAGES] ⚠️ Socket.IO not available - message not broadcasted');
    }

    // Generate AI response if requested or auto-respond enabled
    const shouldRespond = requestAiResponse || 
      (conversation.aiEnabled && conversation.settings.aiAutoRespond) ||
      (conversation.aiEnabled && content.toLowerCase().includes('@ai'));

    if (shouldRespond && openai) {
      try {
        // Get recent messages for context
        const recentMessages = await Message.find({ conversationId: id })
          .sort({ createdAt: -1 })
          .limit(10);

        const aiResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a helpful AI assistant in a group chat. Be conversational, helpful, and concise. Personality: ${conversation.aiPersonality || 'friendly and helpful'}.`,
            },
            ...recentMessages.reverse().map(m => ({
              role: m.aiGenerated ? 'assistant' as const : 'user' as const,
              content: m.content,
            })),
          ],
          max_tokens: 500,
        });

        const aiContent = aiResponse.choices[0]?.message?.content;
        if (aiContent) {
          const aiMessage = new Message({
            conversationId: id,
            senderId: req.userId, // System user
            content: aiContent,
            type: 'ai_response',
            aiGenerated: true,
            aiContext: content,
          });
          await aiMessage.save();

          if (io) {
            io.to(`conversation:${id}`).emit('message:new', {
              message: aiMessage,
              isAi: true,
            });
          }
        }
      } catch (error) {
        console.error('AI response error:', error);
      }
    }

    res.status(201).json({ message });
  })
);

// POST /api/messages/conversations/:id/breakout - Create private breakout
router.post(
  '/conversations/:id/breakout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { targetUserId, originalMessageId, context } = req.body;

    const parentConversation = await Conversation.findById(id);
    if (!parentConversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // For one-on-one calls, create a direct private conversation instead of showing error
    // This allows private chat during any call, not just group calls
    if (parentConversation.type !== 'group') {
      // Instead of error, create/retrieve direct private conversation
      const currentUserObjectId = new mongoose.Types.ObjectId(req.userId!.toString());
      const targetUserObjectId = new mongoose.Types.ObjectId(targetUserId.toString());
      const participants = [currentUserObjectId, targetUserObjectId];
      
      const existingPrivate = await Conversation.findOne({
        type: 'direct',
        participants: { $all: participants, $size: 2 },
      }).populate('participants', 'name avatar').populate('lastMessage.senderId', 'name avatar');

      if (existingPrivate) {
        // If context provided, add it as a message
        if (context) {
          const contextMessage = new Message({
            conversationId: existingPrivate._id,
            senderId: currentUserObjectId,
            content: context,
            type: 'text',
            metadata: {
              originalMessageId: originalMessageId ? new mongoose.Types.ObjectId(originalMessageId) : undefined,
              originalConversationId: id ? new mongoose.Types.ObjectId(id) : undefined,
              isContext: true,
            },
          });
          await contextMessage.save();
          existingPrivate.lastMessage = {
            content: context,
            senderId: currentUserObjectId,
            timestamp: new Date(),
          };
          await existingPrivate.save();
        }
        
        res.json({ conversation: existingPrivate });
        return;
      }
      
      // Create new direct conversation
      const newPrivate = new Conversation({
        type: 'direct',
        participants: participants,
        lastMessage: context ? {
          content: context,
          senderId: currentUserObjectId,
          timestamp: new Date(),
        } : undefined,
      });
      await newPrivate.save();
      
      // If context provided, add it as initial message
      if (context) {
        const contextMessage = new Message({
          conversationId: newPrivate._id,
          senderId: currentUserObjectId,
          content: context,
          type: 'text',
          metadata: {
            originalMessageId: originalMessageId ? new mongoose.Types.ObjectId(originalMessageId) : undefined,
            originalConversationId: id ? new mongoose.Types.ObjectId(id) : undefined,
            isContext: true,
          },
        });
        await contextMessage.save();
      }
      
      const populated = await Conversation.findById(newPrivate._id)
        .populate('participants', 'name avatar')
        .populate('lastMessage.senderId', 'name avatar');
      
      res.json({ conversation: populated });
      return;
    }

    // Create or find direct conversation (deduplicated)
    // Use ObjectId for proper MongoDB comparison
    const currentUserObjectId = new mongoose.Types.ObjectId(req.userId!.toString());
    const targetUserObjectId = new mongoose.Types.ObjectId(targetUserId.toString());
    const participants = [currentUserObjectId, targetUserObjectId];
    
    let breakout = await Conversation.findOne({
      type: 'direct',
      participants: { $all: participants, $size: 2 },
    });

    if (!breakout) {
      breakout = new Conversation({
        type: 'direct',
        participants,
        admins: participants,
        aiEnabled: true,
      });
      await breakout.save();
    }

    // If context is provided, prepopulate with a message
    if (context && originalMessageId) {
      const originalMessage = await Message.findById(originalMessageId);
      if (originalMessage) {
        const contextMessage = new Message({
          conversationId: breakout._id,
          senderId: req.userId,
          content: context,
          type: 'text',
          metadata: {
            originalMessageId: originalMessageId,
            originalConversationId: id,
            isContext: true,
          },
        });
        await contextMessage.save();
        
        // Update last message
        breakout.lastMessage = {
          content: contextMessage.content,
          senderId: contextMessage.senderId,
          timestamp: contextMessage.createdAt,
        };
        await breakout.save();
      }
    }

    res.json({ conversation: breakout });
  })
);

// POST /api/messages/conversations/private - Create or get private conversation with user
router.post(
  '/conversations/private',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { targetUserId, context, originalMessageId } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: 'Target user ID required' });
      return;
    }

    const currentUserId = req.userId!.toString();
    const targetId = targetUserId.toString();

    if (targetId === currentUserId) {
      res.status(400).json({ error: 'Cannot create private conversation with yourself' });
      return;
    }

    // Find or create direct conversation (deduplicated)
    // Use ObjectId for proper MongoDB comparison
    const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
    const targetUserObjectId = new mongoose.Types.ObjectId(targetId);
    const participants = [currentUserObjectId, targetUserObjectId];
    
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: participants, $size: 2 },
    }).populate('participants', 'name email avatar');

    if (!conversation) {
      conversation = new Conversation({
        type: 'direct',
        participants,
        admins: participants,
        aiEnabled: true,
      });
      await conversation.save();
      await conversation.populate('participants', 'name email avatar');
    }

    const { originalConversationId, groupName } = req.body;
    const isNewConversation = !conversation.lastMessage;
    
    // If this is a new conversation from a group, add a system message
    if (isNewConversation && originalConversationId && groupName) {
      const systemMessage = new Message({
        conversationId: conversation._id,
        senderId: req.userId, // System messages still need a senderId, but we'll mark them as system type
        content: `Private reply from ${groupName}`,
        type: 'system',
        metadata: {
          originalConversationId: new mongoose.Types.ObjectId(originalConversationId),
          groupName: groupName,
          isPrivateReply: true,
        },
      });
      await systemMessage.save();
    }
    
    // If context is provided, prepopulate with a message
    if (context) {
      const contextMessage = new Message({
        conversationId: conversation._id,
        senderId: req.userId,
        content: context,
        type: 'text',
        metadata: {
          originalMessageId: originalMessageId ? new mongoose.Types.ObjectId(originalMessageId) : undefined,
          originalConversationId: originalConversationId ? new mongoose.Types.ObjectId(originalConversationId) : undefined,
          groupName: groupName,
          isContext: true,
        },
      });
      await contextMessage.save();
      
      // Update last message
      conversation.lastMessage = {
        content: contextMessage.content,
        senderId: contextMessage.senderId,
        timestamp: contextMessage.createdAt,
      };
      await conversation.save();
    }

    res.json({ conversation });
  })
);

// GET /api/messages/conversations/private - Get all private (direct) conversations
router.get(
  '/conversations/private',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const conversations = await Conversation.find({
      type: 'direct',
      participants: userId,
    })
      .populate('participants', 'name email avatar')
      .populate('lastMessage.senderId', 'name')
      .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

    // Filter out self and get the other participant, calculate unread count
    const privateConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherParticipant = conv.participants.find(
          (p: any) => p._id.toString() !== userId.toString()
        );
        
        if (!otherParticipant) return null;
        
        // Calculate unread count (messages not read by current user)
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          senderId: { $ne: userId },
          readBy: { $ne: userId },
        });
        
        return {
          ...conv.toObject(),
          otherParticipant: otherParticipant || null,
          unreadCount,
        };
      })
    );

    const filtered = privateConversations.filter(conv => conv !== null && conv.otherParticipant !== null);

    res.json({ conversations: filtered });
  })
);

// ============================================================================
// THREADS API (Alias endpoints matching the spec)
// These provide a cleaner API surface for thread management
// ============================================================================

// POST /api/messages/threads - Create or get thread (with bulletproof deduplication)
// Request: { type: 'private'|'group', participants: [ids], initialMessage?: { body } }
// Response: { thread } - returns existing thread if found, or creates new one
router.post(
  '/threads',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { type = 'private', participants: participantIds, initialMessage } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      res.status(400).json({ error: 'Participants array required' });
      return;
    }

    const currentUserId = req.userId!.toString();
    
    // Ensure current user is included in participants
    const allParticipantIds = [...new Set([currentUserId, ...participantIds.map((id: string) => id.toString())])];

    // For private (1:1) threads, enforce exactly 2 participants
    if (type === 'private') {
      if (allParticipantIds.length !== 2) {
        res.status(400).json({ error: 'Private threads require exactly 2 participants' });
        return;
      }

      // Check for self-chat
      if (allParticipantIds[0] === allParticipantIds[1]) {
        res.status(400).json({ error: 'Cannot create private thread with yourself' });
        return;
      }
    }

    // Generate dedupe key
    const threadKey = generateThreadKey(allParticipantIds);
    console.log(`[THREADS] Dedupe key: ${threadKey} for participants: ${allParticipantIds.join(', ')}`);

    // Convert to ObjectIds
    const participantObjectIds = allParticipantIds.map(id => new mongoose.Types.ObjectId(id));

    // Try to find existing thread
    let thread = await Conversation.findOne({
      type: type === 'private' ? 'direct' : 'group',
      participants: { $all: participantObjectIds, $size: participantObjectIds.length },
    }).populate('participants', 'name email avatar');

    const isNew = !thread;

    if (!thread) {
      // Create new thread
      thread = new Conversation({
        type: type === 'private' ? 'direct' : 'group',
        participants: participantObjectIds,
        admins: participantObjectIds,
        aiEnabled: true,
      });
      await thread.save();
      await thread.populate('participants', 'name email avatar');
      console.log(`[THREADS] Created new thread: ${thread._id}`);
    } else {
      console.log(`[THREADS] Found existing thread: ${thread._id}`);
    }

    // If initial message provided, send it
    if (initialMessage?.body) {
      const message = new Message({
        conversationId: thread._id,
        senderId: req.userId,
        content: initialMessage.body,
        type: 'text',
      });
      await message.save();

      // Update last message
      thread.lastMessage = {
        content: message.content,
        senderId: message.senderId,
        timestamp: message.createdAt,
      };
      await thread.save();

      // Emit via Socket.IO
      const io = req.app.get('io');
      if (io) {
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name avatar')
          .lean();
        
        io.to(`conversation:${thread._id}`).emit('message:new', {
          message: { ...populatedMessage, conversationId: thread._id.toString() },
        });
      }
    }

    // Format response with otherParticipant for private threads
    const response: any = {
      thread: thread.toObject(),
      isNew,
    };

    if (type === 'private') {
      response.thread.otherParticipant = thread.participants.find(
        (p: any) => p._id.toString() !== currentUserId
      );
    }

    res.json(response);
  })
);

// GET /api/messages/threads - Get all threads for user
router.get(
  '/threads',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { type } = req.query;
    const userId = req.userId!;

    const query: any = { participants: userId };
    if (type === 'private') {
      query.type = 'direct';
    } else if (type === 'group') {
      query.type = 'group';
    }

    const threads = await Conversation.find(query)
      .populate('participants', 'name email avatar')
      .populate('lastMessage.senderId', 'name')
      .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

    // Add otherParticipant for direct threads
    const formattedThreads = threads.map(thread => {
      const obj = thread.toObject();
      if (thread.type === 'direct') {
        (obj as any).otherParticipant = thread.participants.find(
          (p: any) => p._id.toString() !== userId.toString()
        );
      }
      return obj;
    });

    res.json({ threads: formattedThreads });
  })
);

// GET /api/messages/threads/:id - Get thread by ID
router.get(
  '/threads/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!.toString();

    const thread = await Conversation.findById(id)
      .populate('participants', 'name email avatar');

    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    // Check if user is participant
    const isParticipant = thread.participants.some(
      (p: any) => p._id.toString() === userId
    );

    if (!isParticipant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const response: any = { thread: thread.toObject() };
    if (thread.type === 'direct') {
      response.thread.otherParticipant = thread.participants.find(
        (p: any) => p._id.toString() !== userId
      );
    }

    res.json(response);
  })
);

// GET /api/messages/threads/:id/messages - Get messages in thread
router.get(
  '/threads/:id/messages',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { cursor, limit = 50 } = req.query;
    const userId = req.userId!.toString();

    const thread = await Conversation.findById(id);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const isParticipant = thread.participants.some(
      (p: any) => p.toString() === userId
    );

    if (!isParticipant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const query: any = { conversationId: id };
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor as string) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ messages: messages.reverse() });
  })
);

// POST /api/messages/threads/:id/messages - Send message to thread
router.post(
  '/threads/:id/messages',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { body, replyTo } = req.body;
    const userId = req.userId!.toString();

    if (!body || !body.trim()) {
      res.status(400).json({ error: 'Message body required' });
      return;
    }

    const thread = await Conversation.findById(id);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const isParticipant = thread.participants.some(
      (p: any) => p.toString() === userId
    );

    if (!isParticipant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const message = new Message({
      conversationId: id,
      senderId: req.userId,
      content: body.trim(),
      type: 'text',
      replyTo: replyTo || undefined,
    });
    await message.save();

    // Update thread last message
    thread.lastMessage = {
      content: message.content,
      senderId: message.senderId,
      timestamp: message.createdAt,
    };
    await thread.save();

    // Auto-add to friends for direct/private threads
    if (thread.type === 'direct' && thread.participants.length === 2) {
      const otherParticipantId = thread.participants.find(
        (p: any) => p.toString() !== userId
      );
      if (otherParticipantId) {
        // Run in background - don't block message sending
        ensureFriendConnection(userId, otherParticipantId.toString()).catch(err => {
          console.error('[FRIENDS] Background friend creation failed:', err);
        });
      }
    }

    // Populate and emit via Socket.IO
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name avatar')
      .lean();

    const io = req.app.get('io');
    if (io) {
      const messageToEmit = {
        ...populatedMessage,
        conversationId: id,
      };
      
      io.to(`conversation:${id}`).emit('message:new', { message: messageToEmit });
      
      // Log delivery
      const room = io.sockets.adapter.rooms.get(`conversation:${id}`);
      console.log(`[THREADS] Message sent to ${room?.size || 0} socket(s) in thread ${id}`);
    }

    res.status(201).json({ message: populatedMessage });
  })
);

// POST /api/messages/conversations/:id/messages/:messageId/read - Mark message as read
router.post(
  '/conversations/:id/messages/:messageId/read',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, messageId } = req.params;
    const userId = req.userId!;

    const conversation = await Conversation.findById(id);
    const userIdStr = userId.toString();
    const isParticipant = conversation?.participants?.some(
      (p: any) => p.toString() === userIdStr
    );
    
    if (!conversation || !isParticipant) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message || message.conversationId.toString() !== id) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Add user to readBy if not already there
    const userIdObjectId = new mongoose.Types.ObjectId(userIdStr);
    if (!message.readBy.some((id: any) => id.toString() === userIdStr)) {
      message.readBy.push(userIdObjectId);
      await message.save();
    }

    res.json({ success: true });
  })
);

// ============================================================================
// End of THREADS API
// ============================================================================

// POST /api/messages/conversations/:id/messages/:messageId/reaction - Add/remove reaction
router.post(
  '/conversations/:id/messages/:messageId/reaction',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, messageId } = req.params;
    const { emoji } = req.body;

    const conversation = await Conversation.findById(id);
    // Use string comparison for ObjectIds
    const userIdStr = req.userId!.toString();
    const isParticipant = conversation?.participants?.some(
      (p: any) => p.toString() === userIdStr
    );
    if (!conversation || !isParticipant) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message || message.conversationId.toString() !== id) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Initialize reactions array if it doesn't exist
    if (!message.reactions) {
      message.reactions = [];
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      (r: any) => r.emoji === emoji && r.userId.toString() === req.userId
    );

    if (existingReaction) {
      // Remove reaction
      message.reactions = message.reactions.filter(
        (r: any) => !(r.emoji === emoji && r.userId.toString() === req.userId)
      );
    } else {
      // Add reaction
      if (req.userId) {
        message.reactions.push({
          emoji,
          userId: new mongoose.Types.ObjectId(req.userId),
        });
      }
    }

    await message.save();

    // Populate and emit via Socket.IO
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name avatar')
      .populate('reactions.userId', 'name avatar')
      .lean();

    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${id}`).emit('message:reaction:updated', {
        messageId: message._id.toString(),
        message: populatedMessage,
      });
    }

    res.json({ message: populatedMessage, reactions: message.reactions });
  })
);

// POST /api/messages/upload - Upload file for message attachment
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    try {
      // Upload to GridFS
      const result = await uploadRecording(
        req.file.buffer,
        `message-${Date.now()}-${req.file.originalname}`,
        req.file.mimetype,
        { userId: req.userId }
      );

      // Return URL for accessing the file
      const fileUrl = `/api/messages/files/${result.fileId}`;
      
      res.json({
        url: fileUrl,
        fileId: result.fileId,
        filename: result.filename,
        type: req.file.mimetype.startsWith('image/') ? 'image' : 
              req.file.mimetype.startsWith('audio/') ? 'audio' : 'file',
        name: req.file.originalname,
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  })
);

// GET /api/messages/files/:fileId - Get uploaded file
router.get(
  '/files/:fileId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fileId } = req.params;
    
    try {
      const { getRecordingStream } = await import('../services/storage');
      const stream = getRecordingStream(fileId);
      
      stream.on('error', (error: any) => {
        if (error.name === 'FileNotFound') {
          res.status(404).json({ error: 'File not found' });
        } else {
          res.status(500).json({ error: 'Failed to retrieve file' });
        }
      });
      
      stream.pipe(res);
    } catch (error: any) {
      console.error('File retrieval error:', error);
      res.status(500).json({ error: 'Failed to retrieve file' });
    }
  })
);

export default router;

