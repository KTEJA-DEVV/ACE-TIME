import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { CallSession } from '../models/CallSession';
import { Transcript } from '../models/Transcript';
import { Notes } from '../models/Notes';
import { getOpenAI } from '../services/openai';
import { generateFreeText } from '../services/freeAI';

const router = Router();

// Get or create AI conversation for user
async function getOrCreateAIConversation(userId: string): Promise<mongoose.Types.ObjectId> {
  // Find existing AI conversation
  const existing = await Conversation.findOne({
    type: 'ai_assisted',
    participants: new mongoose.Types.ObjectId(userId),
    name: 'AI Chat',
  });

  if (existing) {
    return existing._id;
  }

  // Create new AI conversation
  const conversation = new Conversation({
    type: 'ai_assisted',
    name: 'AI Chat',
    participants: [new mongoose.Types.ObjectId(userId)],
    aiEnabled: true,
    aiPersonality: 'helpful assistant',
    settings: {
      allowPrivateBreakout: false,
      aiAutoRespond: true,
      aiResponseTrigger: 'always',
    },
  });

  await conversation.save();
  return conversation._id;
}

// Get context from user's previous calls and chats
async function getUserContext(userId: string): Promise<string> {
  const contextParts: string[] = [];

  // Get recent call transcripts (last 3 calls)
  const recentCalls = await CallSession.find({
    $or: [
      { hostId: new mongoose.Types.ObjectId(userId) },
      { guestIds: new mongoose.Types.ObjectId(userId) },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('transcriptId')
    .lean();

  for (const call of recentCalls) {
    if (call.transcriptId && (call.transcriptId as any).segments) {
      const transcript = call.transcriptId as any;
      const summary = transcript.segments
        .slice(-10) // Last 10 segments
        .map((seg: any) => `${seg.speaker}: ${seg.text}`)
        .join('\n');
      if (summary) {
        contextParts.push(`Recent call:\n${summary}`);
      }
    }
  }

  // Get recent AI notes from calls
  const recentCallsWithNotes = await CallSession.find({
    $or: [
      { hostId: new mongoose.Types.ObjectId(userId) },
      { guestIds: new mongoose.Types.ObjectId(userId) },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(2)
    .populate('notesId')
    .lean();

  for (const call of recentCallsWithNotes) {
    if (call.notesId) {
      const notes = call.notesId as any;
      if (notes.summary) {
        contextParts.push(`Call summary: ${notes.summary}`);
      }
      if (notes.keyTopics && notes.keyTopics.length > 0) {
        contextParts.push(`Key topics: ${notes.keyTopics.join(', ')}`);
      }
    }
  }

  return contextParts.length > 0
    ? `User context from recent activity:\n${contextParts.join('\n\n')}`
    : '';
}

// POST /api/ai-chat/message - Send message to AI (with streaming)
router.post(
  '/message',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, conversationId } = req.body;
    const userId = req.userId!;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Get or create AI conversation
    const convId = conversationId
      ? new mongoose.Types.ObjectId(conversationId)
      : await getOrCreateAIConversation(userId);

    // Verify conversation belongs to user
    const conversation = await Conversation.findById(convId);
    if (!conversation || !conversation.participants.some((p: any) => p.toString() === userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Save user message
    const userMessage = new Message({
      conversationId: convId,
      senderId: new mongoose.Types.ObjectId(userId),
      content: message,
      type: 'text',
      aiGenerated: false,
    });
    await userMessage.save();

    // Update conversation last message
    conversation.lastMessage = {
      content: message,
      senderId: userMessage.senderId,
      timestamp: userMessage.createdAt,
    };
    await conversation.save();

    // Get conversation history for context
    const recentMessages = await Message.find({
      conversationId: convId,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Build message history for AI
    const messageHistory = recentMessages
      .reverse()
      .map((msg: any) => {
        const isAI = msg.aiGenerated || msg.type === 'ai_response';
        return {
          role: (isAI ? 'assistant' : 'user') as 'assistant' | 'user',
          content: msg.content,
        };
      });

    // Get user context from calls/chats
    const userContext = await getUserContext(userId);

    // System prompt with context
    const systemPrompt = `You are AceTime AI, a helpful and intelligent assistant integrated into the AceTime communication platform.

${userContext ? `\n${userContext}\n` : ''}

You have access to the user's recent call transcripts and meeting summaries. Use this context to provide more personalized and relevant responses.

Be conversational, helpful, and concise. You can reference their recent activities when relevant, but don't overdo it.`;

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create AI message placeholder
    const aiMessage = new Message({
      conversationId: convId,
      senderId: new mongoose.Types.ObjectId(userId), // AI messages use user's ID for now
      content: '',
      type: 'ai_response',
      aiGenerated: true,
    });
    await aiMessage.save();

    let fullResponse = '';

    try {
      // PRIORITY: Try free AI first (always available, no cost)
      try {
        console.log('[AI CHAT] 🆓 Using free AI service for chat response');
        
        // Build conversation context for free AI
        const conversationContext = messageHistory
          .map(msg => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}`)
          .join('\n');
        
        const userPrompt = conversationContext 
          ? `${conversationContext}\n\nUser: ${message}\n\nAssistant:`
          : `User: ${message}\n\nAssistant:`;
        
        const response = await generateFreeText(systemPrompt, userPrompt, 1000);
        fullResponse = response;
        
        // Simulate streaming for better UX (word-by-word)
        const words = fullResponse.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? '' : ' ') + words[i];
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          // Small delay to simulate streaming
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        
        res.write(`data: ${JSON.stringify({ type: 'done', messageId: aiMessage._id.toString() })}\n\n`);
        console.log('[AI CHAT] ✅ Free AI response generated');
      } catch (freeError: any) {
        console.warn('[AI CHAT] ⚠️ Free AI failed, trying OpenAI fallback:', freeError.message);
        
        // Fallback to OpenAI
        const openai = getOpenAI();
        if (openai) {
          try {
            // Use OpenAI streaming
            const stream = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: systemPrompt },
                ...messageHistory,
                { role: 'user', content: message },
              ],
              stream: true,
              temperature: 0.7,
              max_tokens: 1000,
            });

            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                // Send chunk to client
                res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
              }
            }

            // Send completion
            res.write(`data: ${JSON.stringify({ type: 'done', messageId: aiMessage._id.toString() })}\n\n`);
          } catch (openaiError: any) {
            // If quota exceeded, return helpful message
            if (openaiError.status === 429 || openaiError.code === 'insufficient_quota') {
              const errorMessage = 'AI service temporarily unavailable due to quota limits. Please try again later.';
              fullResponse = errorMessage;
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: errorMessage })}\n\n`);
              res.write(`data: ${JSON.stringify({ type: 'done', messageId: aiMessage._id.toString() })}\n\n`);
            } else {
              throw openaiError;
            }
          }
        } else {
          // No OpenAI available - return helpful message
          const mockResponse = `I understand you're asking about "${message}". 

As AceTime AI, I'm here to help! AI services are currently unavailable. Please try again later or configure API keys for enhanced features.`;

          // Simulate word-by-word streaming
          const words = mockResponse.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = (i === 0 ? '' : ' ') + words[i];
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          res.write(`data: ${JSON.stringify({ type: 'done', messageId: aiMessage._id.toString() })}\n\n`);
        }
      }

      // Update AI message with full response
      aiMessage.content = fullResponse;
      await aiMessage.save();

      // Update conversation last message
      conversation.lastMessage = {
        content: fullResponse,
        senderId: aiMessage.senderId,
        timestamp: aiMessage.createdAt,
      };
      await conversation.save();

      res.end();
    } catch (error: any) {
      console.error('AI chat error:', error);
      
      // Send error to client
      res.write(
        `data: ${JSON.stringify({ type: 'error', error: error.message || 'Failed to get AI response' })}\n\n`
      );
      
      // Delete failed message
      await Message.findByIdAndDelete(aiMessage._id);
      
      res.end();
    }
  })
);

// GET /api/ai-chat/conversation - Get AI conversation and messages
router.get(
  '/conversation',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const conversationId = await getOrCreateAIConversation(userId);
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'name avatar')
      .lean();

    const messages = await Message.find({
      conversationId: conversationId,
    })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    res.json({
      conversation,
      messages: messages.map((msg: any) => ({
        _id: msg._id,
        content: msg.content,
        type: msg.type,
        aiGenerated: msg.aiGenerated,
        createdAt: msg.createdAt,
        senderId: msg.senderId,
      })),
    });
  })
);

// GET /api/ai-chat/messages - Get messages with pagination
router.get(
  '/messages',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { conversationId, limit = 50, before } = req.query;

    const convId = conversationId
      ? new mongoose.Types.ObjectId(conversationId as string)
      : await getOrCreateAIConversation(userId);

    // Verify access
    const conversation = await Conversation.findById(convId);
    if (!conversation || !conversation.participants.some((p: any) => p.toString() === userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const query: any = { conversationId: convId };
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({
      messages: messages.reverse(),
      hasMore: messages.length === Number(limit),
    });
  })
);

export default router;

