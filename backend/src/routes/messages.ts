import { Router, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { CallSession } from '../models/CallSession';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { uploadRecording } from '../services/storage';
import OpenAI from 'openai';

const router = Router();

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

    // Get call session
    const callSession = await CallSession.findById(callId)
      .populate('hostId', 'name email avatar')
      .populate('guestIds', 'name email avatar');

    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check if user participated in the call
    const userId = req.userId!;
    const isHost = callSession.hostId._id.toString() === userId;
    const isGuest = callSession.guestIds.some((g: any) => g._id.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if conversation already exists for this call
    const existing = await Conversation.findOne({ linkedCallId: callId });
    if (existing) {
      res.json({ conversation: existing });
      return;
    }

    // Get all participants
    const participants = [
      callSession.hostId._id,
      ...callSession.guestIds.map((g: any) => g._id),
    ];

    // Create conversation
    const conversation = new Conversation({
      type: participants.length > 2 ? 'group' : 'direct',
      name: `Call: ${new Date(callSession.startedAt).toLocaleDateString()}`,
      participants,
      admins: [callSession.hostId._id],
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

// GET /api/messages/conversations/:id/messages - Get messages
router.get(
  '/conversations/:id/messages',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.participants.includes(req.user!._id)) {
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
    if (!conversation || !conversation.participants.includes(req.user!._id)) {
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

      // Emit via Socket.IO
      const io = req.app.get('io');
      if (io) {
        // Populate sender info before emitting
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name avatar')
          .lean();
        
        console.log(`[MESSAGES] 📤 Emitting message:new to conversation:${id}`);
        console.log(`[MESSAGES] Message ID: ${message._id}, Sender: ${req.userId}`);
        console.log(`[MESSAGES] Message content: ${content.substring(0, 50)}...`);
        
        // Ensure conversationId is included in the message object
        const messageToEmit = {
          ...populatedMessage,
          conversationId: id,
        };
        
        // Emit to all participants in the conversation room (including sender)
        io.to(`conversation:${id}`).emit('message:new', {
          message: messageToEmit,
        });
        
        // Also log how many sockets are in the room for debugging
        const room = io.sockets.adapter.rooms.get(`conversation:${id}`);
        const socketCount = room ? room.size : 0;
        console.log(`[MESSAGES] ✅ Room 'conversation:${id}' has ${socketCount} socket(s) - message broadcasted`);
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
    const { targetUserId } = req.body;

    const parentConversation = await Conversation.findById(id);
    if (!parentConversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Allow private breakouts for group conversations (default enabled)
    if (parentConversation.type !== 'group') {
      res.status(400).json({ error: 'Private breakouts only available for group conversations' });
      return;
    }

    // Create or find direct conversation
    const participants = [req.userId, targetUserId];
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

    res.json({ conversation: breakout });
  })
);

// POST /api/messages/conversations/:id/messages/:messageId/reaction - Add/remove reaction
router.post(
  '/conversations/:id/messages/:messageId/reaction',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, messageId } = req.params;
    const { emoji } = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.participants.includes(req.user!._id)) {
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

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${id}`).emit('message:reaction', {
        messageId: message._id,
        reactions: message.reactions,
      });
    }

    res.json({ reactions: message.reactions });
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

