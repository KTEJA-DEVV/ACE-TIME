import OpenAI from 'openai';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

export const getOpenAI = (): OpenAI | null => {
  if (openai) return openai;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    console.log('[OPENAI] ✅ Initializing OpenAI client with API key');
    openai = new OpenAI({ apiKey });
  } else {
    console.warn('[OPENAI] ⚠️ OPENAI_API_KEY not found in environment variables');
  }
  
  return openai;
};

export interface TranscriptionResult {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface NotesResult {
  summary: string;
  bullets: string[];
  actionItems: Array<{ text: string; assignee?: string }>;
  decisions: string[];
  suggestedReplies: string[];
  keyTopics: string[];
}

export interface ComprehensiveNotesResult {
  title: string;
  summary: string;
  sections: Array<{
    topic: string;
    timestamp: string;
    notes: string[];
    relatedTranscript: string;
  }>;
  actionItems: Array<{
    item: string;
    assignee?: string;
    dueDate?: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  decisions: Array<{
    decision: string;
    context: string;
    timestamp: string;
  }>;
  keyPoints: string[];
  questionsRaised: string[];
  nextSteps: string[];
  suggestedFollowUp?: string;
}

// Transcribe audio using Whisper
export const transcribeAudio = async (
  audioBuffer: Buffer,
  language: string = 'en'
): Promise<TranscriptionResult> => {
  const client = getOpenAI();
  
  // If no OpenAI key, return mock transcription for development
  if (!client) {
    console.warn('⚠️ OpenAI not configured - using mock transcription');
    return {
      text: '[Transcription unavailable - configure OPENAI_API_KEY]',
      segments: [],
    };
  }

  try {
    console.log('[WHISPER] Transcribing audio buffer:', audioBuffer.length, 'bytes');
    
    // In Node.js, OpenAI SDK accepts File, Blob, or ReadStream
    // Create a File-like object that works in Node.js
    // Using the buffer directly with proper metadata
    const file = new File([audioBuffer], 'audio.webm', { 
      type: 'audio/webm',
      lastModified: Date.now(),
    });

    console.log('[WHISPER] Calling OpenAI Whisper API with file size:', file.size, 'bytes');
    const response = await client.audio.transcriptions.create({
      file: file as any,
      model: 'whisper-1',
      language,
      response_format: 'verbose_json',
    });

    const transcribedText = response.text || '';
    console.log('[WHISPER] ✅ Transcription successful:', transcribedText.substring(0, 100) + (transcribedText.length > 100 ? '...' : ''));

    return {
      text: response.text,
      segments: (response as any).segments?.map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
    };
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
};

// Generate AI notes from transcript
export const generateNotes = async (
  transcriptText: string,
  previousNotes?: Partial<NotesResult>
): Promise<NotesResult> => {
  const client = getOpenAI();
  
  // If no OpenAI key, use free AI service
  if (!client) {
    console.log('[OPENAI] ⚠️ OpenAI not configured - using free AI service');
    const { generateFreeNotes } = await import('./freeAI');
    return generateFreeNotes(transcriptText, previousNotes);
  }

  const systemPrompt = `You are AceTime AI assistant. Based on the meeting transcript provided, generate structured notes.

Return a JSON object with these exact fields:
- summary: A 1-2 sentence summary of the conversation progress
- bullets: Array of 3-5 key points discussed
- actionItems: Array of objects with "text" and optional "assignee" fields
- decisions: Array of any decisions made
- suggestedReplies: Array of 1-2 suggested follow-up questions or responses
- keyTopics: Array of main topics/themes discussed

Be concise and actionable. Focus on what's most important.`;

  const userPrompt = previousNotes
    ? `Previous notes context:
${JSON.stringify(previousNotes, null, 2)}

New transcript chunk to incorporate:
${transcriptText}

Update the notes with this new information.`
    : `Transcript:
${transcriptText}

Generate meeting notes from this transcript.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o', // Updated to valid model name
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const notes = JSON.parse(content) as NotesResult;
    
    // Ensure all fields exist with defaults
    return {
      summary: notes.summary || '',
      bullets: notes.bullets || [],
      actionItems: notes.actionItems || [],
      decisions: notes.decisions || [],
      suggestedReplies: notes.suggestedReplies || [],
      keyTopics: notes.keyTopics || [],
    };
  } catch (error) {
    console.error('Notes generation error:', error);
    throw error;
  }
};

// Generate comprehensive final summary after call ends
export const generateFinalSummary = async (
  transcriptText: string,
  participants: string[],
  duration: number
): Promise<NotesResult> => {
  const client = getOpenAI();
  
  // If no OpenAI key, use free AI service
  if (!client) {
    console.log('[OPENAI] ⚠️ OpenAI not configured - using free AI service');
    const { generateFreeNotes } = await import('./freeAI');
    return generateFreeNotes(transcriptText);
  }

  const systemPrompt = `You are AceTime AI assistant. Generate a comprehensive executive summary and analysis of a completed meeting/call.

Participants: ${participants.join(', ') || 'Unknown'}
Duration: ${Math.round(duration / 60)} minutes

Return a JSON object with these exact fields:
- summary: A 2-3 sentence executive summary of the entire conversation
- bullets: Array of 5-8 key points discussed throughout the call
- actionItems: Array of objects with "text" (action item) and "assignee" (person responsible, if mentioned)
- decisions: Array of all decisions made during the call
- suggestedReplies: Array of 2-3 recommended follow-up actions or next steps
- keyTopics: Array of main topics/themes discussed

Be comprehensive, accurate, and actionable. Extract all important information.`;

  const userPrompt = `Complete meeting transcript:
${transcriptText}

Generate a comprehensive executive summary and analysis.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const notes = JSON.parse(content) as NotesResult;
    
    // Ensure all fields exist with defaults
    return {
      summary: notes.summary || '',
      bullets: notes.bullets || [],
      actionItems: notes.actionItems || [],
      decisions: notes.decisions || [],
      suggestedReplies: notes.suggestedReplies || [],
      keyTopics: notes.keyTopics || [],
    };
  } catch (error) {
    console.error('Final summary generation error:', error);
    throw error;
  }
};

// Generate comprehensive meeting notes
export const generateComprehensiveNotes = async (
  transcriptText: string,
  participants: string[],
  duration: number,
  callDate: Date
): Promise<ComprehensiveNotesResult> => {
  const client = getOpenAI();
  
  if (!client) {
    console.log('[OPENAI] ⚠️ OpenAI not configured - using mock notes');
    return {
      title: 'Meeting Notes',
      summary: 'Meeting notes will be generated when OpenAI is configured.',
      sections: [],
      actionItems: [],
      decisions: [],
      keyPoints: [],
      questionsRaised: [],
      nextSteps: [],
    };
  }

  const systemPrompt = `You are AceTime AI assistant. Generate comprehensive, structured meeting notes from a completed call transcript.

Participants: ${participants.join(', ') || 'Unknown'}
Duration: ${Math.round(duration / 60)} minutes
Date: ${callDate.toLocaleDateString()}

Return a JSON object with these exact fields:
- title: A concise, descriptive meeting title (3-8 words) extracted from the content
- summary: A 2-3 sentence executive summary of the entire meeting
- sections: Array of objects with:
  - topic: Main discussion topic (e.g., "Product Roadmap", "Budget Planning")
  - timestamp: When this topic was discussed (format: "HH:MM" or "MM:SS")
  - notes: Array of 3-5 bullet points summarizing the discussion
  - relatedTranscript: A 1-2 sentence excerpt from the transcript related to this topic
- actionItems: Array of objects with:
  - item: Action item description
  - assignee: Person responsible (extract from transcript if mentioned, e.g., "John will..." -> "John")
  - dueDate: Suggested due date in ISO format (YYYY-MM-DD) based on urgency keywords, or null
  - priority: "high", "medium", or "low" based on urgency indicators
- decisions: Array of objects with:
  - decision: The decision made
  - context: Brief context about why/when this decision was made
  - timestamp: When decision was made (format: "HH:MM")
- keyPoints: Array of 5-8 key discussion points
- questionsRaised: Array of important questions that came up
- nextSteps: Array of 3-5 next steps or follow-up actions
- suggestedFollowUp: Suggested follow-up date in ISO format (YYYY-MM-DD), or null

Be thorough, accurate, and actionable. Extract all important information. Organize sections by topic chronologically.`;

  const userPrompt = `Complete meeting transcript:
${transcriptText}

Generate comprehensive, structured meeting notes.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const notes = JSON.parse(content) as ComprehensiveNotesResult;
    
    // Ensure all fields exist with defaults
    return {
      title: notes.title || 'Meeting Notes',
      summary: notes.summary || '',
      sections: notes.sections || [],
      actionItems: notes.actionItems || [],
      decisions: notes.decisions || [],
      keyPoints: notes.keyPoints || [],
      questionsRaised: notes.questionsRaised || [],
      nextSteps: notes.nextSteps || [],
      suggestedFollowUp: notes.suggestedFollowUp || undefined,
    };
  } catch (error) {
    console.error('Comprehensive notes generation error:', error);
    throw error;
  }
};

// Check if OpenAI is configured
export const isOpenAIConfigured = (): boolean => {
  return !!process.env.OPENAI_API_KEY;
};
