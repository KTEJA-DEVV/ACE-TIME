import { Router, Response } from 'express';
import { CallSession } from '../models/CallSession';
import { Transcript } from '../models/Transcript';
import { Notes } from '../models/Notes';
import { Message } from '../models/Message';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  uploadRecording, 
  getRecordingStream, 
  deleteRecording as deleteRecordingFile,
  getRecordingInfo 
} from '../services/storage';
import { generateNotes, generateFinalSummary, generateComprehensiveNotes, getOpenAI } from '../services/openai';
import multer from 'multer';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// GET /api/calls/:id - Get call metadata
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id)
      .populate('hostId', 'name email avatar')
      .populate('guestIds', 'name email avatar')
      .populate('transcriptId')
      .populate('notesId');

    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check if user has access
    const userId = req.userId!;
    const isHost = callSession.hostId._id.toString() === userId;
    const isGuest = callSession.guestIds.some((g: any) => g._id.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      call: callSession,
      hasRecording: !!callSession.recordingKey,
    });
  })
);

// POST /api/calls/:id/recording - Upload recording directly
router.post(
  '/:id/recording',
  authenticate,
  upload.single('recording'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);

    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check if user has access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No recording file provided' });
      return;
    }

    // Upload to GridFS - ensure video mime type
    const mimeType = req.file.mimetype || 'video/webm';
    const result = await uploadRecording(
      req.file.buffer,
      `recording-${id}-${Date.now()}.webm`,
      mimeType.startsWith('video/') ? mimeType : 'video/webm',
      { callId: id, userId }
    );

    // Update call session with recording info
    callSession.recordingKey = result.fileId;
    callSession.recordingUrl = `/api/calls/${id}/recording/stream`;
    callSession.metadata.recordingSize = req.file.size;
    await callSession.save();

    // Emit notification to all participants
    const io = req.app.get('io');
    if (io) {
      const participants = [callSession.hostId, ...(callSession.guestIds || [])];
      participants.forEach((participantId) => {
        io.to(`user:${participantId}`).emit('call:recording:ready', {
          callId: id,
          recordingUrl: callSession.recordingUrl,
          duration: callSession.duration,
        });
      });
    }

    res.json({
      message: 'Recording uploaded successfully',
      fileId: result.fileId,
      filename: result.filename,
    });
  })
);

// GET /api/calls/:id/recording/stream - Stream recording
router.get(
  '/:id/recording/stream',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);

    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check if user has access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!callSession.recordingKey) {
      res.status(404).json({ error: 'No recording found' });
      return;
    }

    try {
      const fileInfo = await getRecordingInfo(callSession.recordingKey);
      if (!fileInfo) {
        res.status(404).json({ error: 'Recording file not found' });
        return;
      }

      res.set({
        'Content-Type': fileInfo.contentType || 'video/webm',
        'Content-Length': fileInfo.length?.toString(),
        'Accept-Ranges': 'bytes',
      });

      const downloadStream = getRecordingStream(callSession.recordingKey);
      downloadStream.pipe(res);
    } catch (error) {
      console.error('Error streaming recording:', error);
      res.status(500).json({ error: 'Failed to stream recording' });
    }
  })
);

// GET /api/calls/:id/transcript - Get call transcript
router.get(
  '/:id/transcript',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);
    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const transcript = await Transcript.findOne({ callId: id });
    
    res.json({ transcript });
  })
);

// GET /api/calls/:id/notes - Get AI notes
router.get(
  '/:id/notes',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);
    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const notes = await Notes.findOne({ callId: id });
    
    res.json({ notes });
  })
);

// POST /api/calls/:id/analyze-transcript - Analyze transcript with AI (real-time or post-call)
router.post(
  '/:id/analyze-transcript',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { transcript, participants, duration, isFinal } = req.body;

    const callSession = await CallSession.findById(id);
    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check access
    const userId = req.userId!;
    const isHost = callSession.hostId.toString() === userId;
    const isGuest = callSession.guestIds.some(g => g.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!transcript || typeof transcript !== 'string') {
      res.status(400).json({ error: 'Transcript text is required' });
      return;
    }

    try {
      // Get existing notes if available
      let existingNotes = null;
      const existingNotesDoc = await Notes.findOne({ callId: id });
      if (existingNotesDoc) {
        // Convert IDecision[] to string[] for NotesResult compatibility
        const decisionsArray = existingNotesDoc.decisions ? existingNotesDoc.decisions.map((d: any) => 
          typeof d === 'string' ? d : d.decision
        ) : [];
        
        existingNotes = {
          summary: existingNotesDoc.summary,
          bullets: existingNotesDoc.bullets,
          actionItems: existingNotesDoc.actionItems,
          decisions: decisionsArray,
          suggestedReplies: existingNotesDoc.suggestedReplies,
          keyTopics: existingNotesDoc.keyTopics,
        };
      }

      // Generate AI analysis
      let analysis;
      if (isFinal) {
        // Generate final comprehensive summary
        analysis = await generateFinalSummary(transcript, participants || [], duration || 0);
      } else {
        // Generate incremental notes
        analysis = await generateNotes(transcript, existingNotes || undefined);
      }

      // Save or update notes in database
      const notesData = {
        callId: id,
        summary: analysis.summary,
        bullets: analysis.bullets,
        actionItems: analysis.actionItems,
        decisions: analysis.decisions,
        suggestedReplies: analysis.suggestedReplies,
        keyTopics: analysis.keyTopics,
        isFinal: isFinal || false,
        updatedAt: new Date(),
      };

      if (existingNotesDoc) {
        await Notes.updateOne({ callId: id }, notesData);
      } else {
        await Notes.create(notesData);
      }

      // Update call session with notes reference
      if (!callSession.notesId) {
        const notesDoc = await Notes.findOne({ callId: id });
        if (notesDoc) {
          callSession.notesId = notesDoc._id;
          await callSession.save();
        }
      }

      res.json({
        summary: analysis.summary,
        keyPoints: analysis.bullets,
        actionItems: analysis.actionItems,
        decisions: analysis.decisions,
        topics: analysis.keyTopics,
        nextSteps: analysis.suggestedReplies || [],
      });
    } catch (error: any) {
      console.error('Error analyzing transcript:', error);
      res.status(500).json({ error: 'Failed to analyze transcript', details: error.message });
    }
  })
);

// POST /api/calls/:id/ai-command - Handle AI command in call chat (with streaming)
router.post(
  '/:id/ai-command',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { command, requestedBy } = req.body;

    const callSession = await CallSession.findById(id)
      .populate('hostId', 'name')
      .populate('guestIds', 'name')
      .lean();
    
    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Check access
    const userId = req.userId!;
    const isHost = callSession.hostId._id.toString() === userId;
    const isGuest = callSession.guestIds.some((g: any) => g._id.toString() === userId);

    if (!isHost && !isGuest) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!command || typeof command !== 'string') {
      res.status(400).json({ error: 'Command is required' });
      return;
    }

    // Get call context
    const transcript = await Transcript.findOne({ callId: id });
    const notes = await Notes.findOne({ callId: id });
    
    // Get recent chat messages for this call (if conversationId exists)
    let recentMessages: any[] = [];
    if ((callSession as any).conversationId) {
      recentMessages = await Message.find({
        conversationId: (callSession as any).conversationId,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('senderId', 'name')
        .lean();
    }

    // Build context
    const hostName = (callSession.hostId as any)?.name || 'Host';
    const guestNames = ((callSession.guestIds || []) as any[]).map((g: any) => 
      (typeof g === 'object' && g?.name) ? g.name : 'Guest'
    );
    const participants = [hostName, ...guestNames];

    let transcriptText = '';
    if (transcript && transcript.segments) {
      transcriptText = transcript.segments
        .map((seg: any) => `${seg.speaker}: ${seg.text}`)
        .join('\n');
    }

    const chatHistory = recentMessages
      .reverse()
      .map((msg: any) => `${msg.senderId.name}: ${msg.content}`)
      .join('\n');

    // Build system prompt with context
    const systemPrompt = `You are AceTime AI, an intelligent assistant integrated into the AceTime video calling platform.

Current Call Context:
- Participants: ${participants.join(', ')}
- Call Duration: ${callSession.duration ? Math.round(callSession.duration / 60) : 0} minutes
${transcriptText ? `\nCall Transcript:\n${transcriptText}\n` : ''}
${chatHistory ? `\nRecent Chat Messages:\n${chatHistory}\n` : ''}
${notes?.summary ? `\nAI Notes Summary: ${notes.summary}\n` : ''}
${notes?.keyTopics?.length ? `Key Topics: ${notes.keyTopics.join(', ')}\n` : ''}

You are responding to a user's command in the call chat. Be helpful, concise, and context-aware.
${requestedBy ? `The user "${requestedBy}" requested this.` : ''}

Special commands you can handle:
- "summarize" or "summary" - Provide a summary of the call
- "action items" - List action items from the call
- "decisions" - List decisions made
- "key points" - List key discussion points
- "translate [language]" - Translate transcript (if requested)
- "extract [topic]" - Extract discussion about specific topic

Always be conversational and helpful. Reference the call context when relevant.`;

    const openai = getOpenAI();

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      if (openai) {
        const stream = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: command },
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 1000,
        });

        let fullResponse = '';

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
          }
        }

        // Send completion
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        
        // Emit to all call participants via Socket.IO
        const io = req.app.get('io');
        if (io) {
          io.to(`room:${callSession.roomId}`).emit('chat:ai:response', {
            callId: id,
            command,
            response: fullResponse,
            requestedBy: requestedBy || userId,
            timestamp: Date.now(),
          });
        }
      } else {
        // Mock response
        const mockResponse = `I understand you're asking: "${command}". 

As AceTime AI, I'm here to help! While OpenAI is not configured, I can still assist with general questions about the call.

To enable full AI capabilities, please configure OPENAI_API_KEY.`;

        const words = mockResponse.split(' ');
        let fullResponse = '';
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? '' : ' ') + words[i];
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      }

      res.end();
    } catch (error: any) {
      console.error('AI command error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Failed to process AI command' })}\n\n`);
      res.end();
    }
  })
);

// DELETE /api/calls/:id - Delete call and associated data
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const callSession = await CallSession.findById(id);
    if (!callSession) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    // Only host can delete
    if (callSession.hostId.toString() !== req.userId) {
      res.status(403).json({ error: 'Only the host can delete this call' });
      return;
    }

    // Delete recording from GridFS
    if (callSession.recordingKey) {
      try {
        await deleteRecordingFile(callSession.recordingKey);
      } catch (error) {
        console.error('Error deleting recording:', error);
      }
    }

    // Delete transcript and notes
    await Transcript.deleteOne({ callId: id });
    await Notes.deleteOne({ callId: id });
    await CallSession.deleteOne({ _id: id });

    res.json({ message: 'Call deleted successfully' });
  })
);

export default router;
