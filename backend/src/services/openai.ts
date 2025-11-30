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
  
  // If no OpenAI key, return mock notes for development
  if (!client) {
    console.warn('⚠️ OpenAI not configured - using mock notes');
    return {
      summary: 'AI notes unavailable - configure OPENAI_API_KEY to enable this feature.',
      bullets: ['Configure your OpenAI API key in .env file'],
      actionItems: [{ text: 'Add OPENAI_API_KEY to environment variables' }],
      decisions: [],
      suggestedReplies: [],
      keyTopics: ['Setup', 'Configuration'],
    };
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

// Check if OpenAI is configured
export const isOpenAIConfigured = (): boolean => {
  return !!process.env.OPENAI_API_KEY;
};
