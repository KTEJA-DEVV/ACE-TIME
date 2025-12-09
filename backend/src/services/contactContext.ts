import { getOpenAI } from './openai';
import { Message } from '../models/Message';
import { CallSession } from '../models/CallSession';
import { Transcript } from '../models/Transcript';
import { Notes } from '../models/Notes';

interface ContactContext {
  summary: string;
  keyTopics: string[];
  relationship: string;
  lastDiscussion?: string;
  suggestedTopics: string[];
}

/**
 * Generate AI context for a contact based on their conversation history
 */
export async function generateContactContext(
  contactName: string,
  userId: string,
  contactUserId: string,
  conversationId: string
): Promise<ContactContext> {
  const client = getOpenAI();

  // Fetch recent messages (last 50)
  const recentMessages = await Message.find({
    conversationId,
  })
    .populate('senderId', 'name')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Fetch recent calls with transcripts and notes
  const recentCalls = await CallSession.find({
    conversationId,
  })
    .populate('transcriptId')
    .populate('notesId')
    .sort({ startedAt: -1 })
    .limit(5)
    .lean();

  // Build context text
  let contextText = `Conversation history with ${contactName}:\n\n`;

  // Add messages
  if (recentMessages.length > 0) {
    contextText += 'Recent Messages:\n';
    recentMessages.reverse().forEach((msg: any) => {
      const senderName = msg.senderId?.name || 'Unknown';
      const content = msg.content || '';
      if (content) {
        contextText += `${senderName}: ${content}\n`;
      }
    });
    contextText += '\n';
  }

  // Add call summaries
  if (recentCalls.length > 0) {
    contextText += 'Recent Calls:\n';
    recentCalls.forEach((call: any) => {
      if (call.notesId?.summary) {
        contextText += `Call on ${new Date(call.startedAt).toLocaleDateString()}: ${call.notesId.summary}\n`;
      }
      if (call.notesId?.keyTopics && call.notesId.keyTopics.length > 0) {
        contextText += `Topics: ${call.notesId.keyTopics.join(', ')}\n`;
      }
    });
    contextText += '\n';
  }

  // If no OpenAI key, use mock response
  if (!client) {
    console.log('[CONTACT CONTEXT] ⚠️ OpenAI not configured - using mock context');
    return {
      summary: `You and ${contactName} have been in regular contact.`,
      keyTopics: ['General discussion'],
      relationship: 'contact',
      suggestedTopics: ['Continue conversation'],
    };
  }

  const systemPrompt = `You are AceTime AI assistant. Analyze the conversation history and generate insights about the relationship and interaction patterns.

Return a JSON object with these exact fields:
- summary: A 1-2 sentence summary of your relationship and interaction patterns (e.g., "You and Sarah frequently discuss product design and startup ideas. Last call was about AI integration.")
- keyTopics: Array of 3-5 main topics/themes you discuss together
- relationship: One word describing the relationship type (e.g., "colleague", "friend", "client", "mentor", "teammate", "contact")
- lastDiscussion: A brief sentence about the most recent discussion topic
- suggestedTopics: Array of 2-3 suggested conversation topics based on your history

Be concise, friendly, and helpful. Focus on actionable insights.`;

  const userPrompt = contextText || `No conversation history yet with ${contactName}.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Use cheaper model for context generation
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content) as ContactContext;
    
    // Validate and set defaults
    return {
      summary: parsed.summary || `You and ${contactName} have been in contact.`,
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
      relationship: parsed.relationship || 'contact',
      lastDiscussion: parsed.lastDiscussion,
      suggestedTopics: Array.isArray(parsed.suggestedTopics) ? parsed.suggestedTopics : [],
    };
  } catch (error: any) {
    console.error('[CONTACT CONTEXT] Error generating context:', error);
    // Return fallback context
    return {
      summary: `You and ${contactName} have been in contact.`,
      keyTopics: [],
      relationship: 'contact',
      suggestedTopics: [],
    };
  }
}

