import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { Contact } from '../models/Contact';
import { Message } from '../models/Message';
import { Transcript } from '../models/Transcript';
import { CallSession } from '../models/CallSession';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';
import mongoose from 'mongoose';

const router = Router();

// GET /api/search - Global search across contacts, messages, and transcripts
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const query = req.query.q as string;
    const filter = (req.query.filter as string) || 'all';

    if (!query || query.trim().length < 2) {
      return res.json({
        contacts: [],
        messages: [],
        transcripts: [],
      });
    }

    const searchQuery = query.trim();
    const searchRegex = new RegExp(searchQuery, 'i');

    const results: {
      contacts: any[];
      messages: any[];
      transcripts: any[];
    } = {
      contacts: [],
      messages: [],
      transcripts: [],
    };

    // Search Contacts
    if (filter === 'all' || filter === 'contacts') {
      const contacts = await Contact.find({ userId })
        .populate('contactUserId', 'name email avatar')
        .populate({
          path: 'conversationId',
          populate: {
            path: 'lastMessage',
            populate: {
              path: 'senderId',
              select: 'name avatar',
            },
          },
        })
        .limit(10)
        .lean();

      const filteredContacts = contacts.filter((contact: any) => {
        const contactName = contact.contactUserId?.name || '';
        const contactEmail = contact.contactUserId?.email || '';
        const nickname = contact.nickname || '';
        return (
          searchRegex.test(contactName) ||
          searchRegex.test(contactEmail) ||
          searchRegex.test(nickname)
        );
      });

      results.contacts = filteredContacts.map((contact: any) => ({
        _id: contact._id,
        contact: {
          _id: contact.contactUserId?._id,
          name: contact.contactUserId?.name || 'Unknown',
          email: contact.contactUserId?.email || '',
          avatar: contact.contactUserId?.avatar,
        },
        lastMessage: contact.conversationId?.lastMessage
          ? {
              content: contact.conversationId.lastMessage.content || '',
              timestamp: contact.conversationId.lastMessage.timestamp || new Date(),
            }
          : undefined,
      }));
    }

    // Search Messages
    if (filter === 'all' || filter === 'messages') {
      // Find conversations where user is a participant
      const userConversations = await Conversation.find({
        participants: userId,
      })
        .select('_id')
        .lean();

      const conversationIds = userConversations.map((c: any) => c._id);

      if (conversationIds.length > 0) {
        const messages = await Message.find({
          conversationId: { $in: conversationIds },
          content: searchRegex,
        })
          .populate('senderId', 'name avatar')
          .populate('conversationId', 'type')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        results.messages = messages.map((message: any) => ({
          _id: message._id,
          content: message.content,
          senderId: {
            _id: message.senderId?._id || message.senderId,
            name: message.senderId?.name || 'Unknown',
            avatar: message.senderId?.avatar,
          },
          conversationId: {
            _id: message.conversationId?._id || message.conversationId,
            type: message.conversationId?.type || 'direct',
          },
          createdAt: message.createdAt,
        }));
      }
    }

    // Search Transcripts
    if (filter === 'all' || filter === 'transcripts') {
      // Find calls where user is a participant
      const userCalls = await CallSession.find({
        $or: [{ hostId: userId }, { guestIds: userId }],
        status: 'ended',
      })
        .select('_id roomId createdAt')
        .lean();

      const callIds = userCalls.map((call: any) => call._id);

      if (callIds.length > 0) {
        const transcripts = await Transcript.find({
          callId: { $in: callIds },
          $or: [
            { fullText: searchRegex },
            { 'segments.text': searchRegex },
          ],
        })
          .populate('callId', 'roomId createdAt')
          .limit(10)
          .lean();

        results.transcripts = transcripts.map((transcript: any) => {
          // Find the matching segment
          const matchedSegment = transcript.segments?.find((seg: any) =>
            searchRegex.test(seg.text)
          ) || transcript.segments?.[0];

          return {
            _id: transcript._id,
            callId: {
              _id: transcript.callId?._id || transcript.callId,
              roomId: transcript.callId?.roomId || '',
              createdAt: transcript.callId?.createdAt || new Date(),
            },
            segments: transcript.segments || [],
            matchedSegment: matchedSegment
              ? {
                  speaker: matchedSegment.speaker || 'Unknown',
                  text: matchedSegment.text || '',
                  timestamp: matchedSegment.timestamp || 0,
                }
              : undefined,
          };
        });
      }
    }

    res.json(results);
  })
);

export default router;

