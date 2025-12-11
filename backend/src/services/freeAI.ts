/**
 * Free AI Service using Hugging Face Inference API
 * No API key required for public models (rate limits apply)
 * Optional HUGGINGFACE_API_KEY for higher rate limits
 */

export interface NotesResult {
  summary: string;
  bullets: string[];
  actionItems: Array<{ text: string; assignee?: string }>;
  decisions: string[];
  suggestedReplies: string[];
  keyTopics: string[];
}

interface HuggingFaceImageResponse {
  image?: string; // base64 encoded image
  error?: string;
}

let huggingFaceApiKey: string | null = null;

export const getHuggingFaceAPIKey = (): string | null => {
  if (huggingFaceApiKey) return huggingFaceApiKey;
  
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (apiKey) {
    huggingFaceApiKey = apiKey;
    console.log('[FREE AI] ✅ Hugging Face API key loaded (higher rate limits)');
  } else {
    console.log('[FREE AI] ℹ️ Using Hugging Face public API (no key required, rate limits apply)');
  }
  
  return huggingFaceApiKey;
};

/**
 * Generate meeting notes using free Hugging Face models
 * Uses Mistral-7B-Instruct for summarization (free, no API key required)
 */
export const generateFreeNotes = async (
  transcriptText: string,
  previousNotes?: Partial<NotesResult>
): Promise<NotesResult> => {
  try {
    // Extract key information from transcript using pattern matching
    // This is a fallback if Hugging Face API fails
    const extractSimpleNotes = (text: string): NotesResult => {
      const lines = text.split('\n').filter(l => l.trim());
      const sentences = text.split(/[.!?]+/).filter(s => s.trim());
      
      // Extract action items (look for patterns like "need to", "should", "will", "let's")
      const actionItemPatterns = [
        /(?:need to|should|will|let's|must|have to)\s+([^.!?]+)/gi,
        /(?:action|todo|task):\s*([^.!?]+)/gi,
      ];
      const actionItems: Array<{ text: string }> = [];
      for (const pattern of actionItemPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].trim().length > 5) {
            actionItems.push({ text: match[1].trim() });
          }
        }
      }
      
      // Extract decisions (look for "decided", "agreed", "chose")
      const decisionPatterns = [
        /(?:decided|agreed|chose|concluded)\s+([^.!?]+)/gi,
      ];
      const decisions: string[] = [];
      for (const pattern of decisionPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].trim().length > 5) {
            decisions.push(match[1].trim());
          }
        }
      }
      
      // Generate summary (first 2-3 sentences)
      const summary = sentences.slice(0, 3).join('. ').substring(0, 200) + (sentences.length > 3 ? '...' : '');
      
      // Extract key topics (look for repeated words or important terms)
      const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
      const wordFreq: Record<string, number> = {};
      words.forEach(word => {
        if (!['that', 'this', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should'].includes(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
      const keyTopics = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
      
      // Key bullets (important sentences)
      const bullets = sentences
        .filter(s => s.length > 20 && s.length < 150)
        .slice(0, 5)
        .map(s => s.trim());
      
      return {
        summary: summary || 'Meeting in progress...',
        bullets: bullets.length > 0 ? bullets : ['Discussion ongoing'],
        actionItems: actionItems.length > 0 ? actionItems.slice(0, 5) : [],
        decisions: decisions.length > 0 ? decisions.slice(0, 5) : [],
        suggestedReplies: [],
        keyTopics: keyTopics.length > 0 ? keyTopics : ['General Discussion'],
      };
    };

    // Try Hugging Face API first (if available)
    const apiKey = getHuggingFaceAPIKey();
    // Use Llama 3.2 3B for better responses (faster, free, good quality)
    const model = 'meta-llama/Llama-3.2-3B-Instruct';
    
    const systemPrompt = `You are AceTime AI assistant. Generate structured meeting notes from the transcript.
Return ONLY valid JSON with these exact fields:
{
  "summary": "1-2 sentence summary",
  "bullets": ["key point 1", "key point 2", ...],
  "actionItems": [{"text": "action item"}],
  "decisions": ["decision 1", ...],
  "suggestedReplies": ["suggestion 1", ...],
  "keyTopics": ["topic 1", ...]
}`;

    const userPrompt = previousNotes
      ? `Previous notes: ${JSON.stringify(previousNotes)}\n\nNew transcript: ${transcriptText}\n\nUpdate the notes.`
      : `Transcript: ${transcriptText}\n\nGenerate meeting notes.`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            inputs: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
            parameters: {
              max_new_tokens: 500,
              temperature: 0.7,
              return_full_text: false,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json() as any;
        
        // Handle different response formats from Hugging Face
        let generatedText = '';
        if (Array.isArray(data)) {
          generatedText = data[0]?.generated_text || data[0]?.text || '';
        } else if (typeof data === 'string') {
          generatedText = data;
        } else {
          generatedText = data?.generated_text || data?.text || '';
        }
        
        // Try to extract JSON from response
        if (generatedText) {
          const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const notes = JSON.parse(jsonMatch[0]) as NotesResult;
              console.log('[FREE AI] ✅ Notes generated using Hugging Face');
              return {
                summary: notes.summary || '',
                bullets: notes.bullets || [],
                actionItems: notes.actionItems || [],
                decisions: notes.decisions || [],
                suggestedReplies: notes.suggestedReplies || [],
                keyTopics: notes.keyTopics || [],
              };
            } catch (parseError) {
              console.warn('[FREE AI] ⚠️ Failed to parse JSON, using extraction method');
            }
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        // If model is loading (503), that's okay - we'll use extraction
        if (response.status !== 503) {
          console.warn('[FREE AI] ⚠️ Hugging Face API error:', errorData);
        }
      }
    } catch (hfError) {
      console.warn('[FREE AI] ⚠️ Hugging Face API unavailable, using extraction method:', hfError);
    }

    // Fallback to simple extraction
    console.log('[FREE AI] Using pattern-based extraction for notes');
    const extractedNotes = extractSimpleNotes(transcriptText);
    
    // Merge with previous notes if provided
    if (previousNotes) {
      return {
        summary: previousNotes.summary || extractedNotes.summary,
        bullets: [...(previousNotes.bullets || []), ...extractedNotes.bullets].slice(0, 5),
        actionItems: [...(previousNotes.actionItems || []), ...extractedNotes.actionItems].slice(0, 5),
        decisions: [...(previousNotes.decisions || []), ...extractedNotes.decisions].slice(0, 5),
        suggestedReplies: extractedNotes.suggestedReplies,
        keyTopics: [...new Set([...(previousNotes.keyTopics || []), ...extractedNotes.keyTopics])].slice(0, 5),
      };
    }
    
    return extractedNotes;
  } catch (error) {
    console.error('[FREE AI] ❌ Notes generation error:', error);
    // Return basic fallback
    return {
      summary: 'Meeting notes are being generated...',
      bullets: ['Processing transcript'],
      actionItems: [],
      decisions: [],
      suggestedReplies: [],
      keyTopics: ['Meeting'],
    };
  }
};

/**
 * Generate image using free Hugging Face Stable Diffusion models
 * Uses stabilityai/stable-diffusion-2-1 (better quality, free, no API key required)
 */
export const generateFreeImage = async (options: {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
}): Promise<string> => {
  const {
    prompt,
    style = 'dream',
    width = 512,
    height = 512,
  } = options;

  // Enhance prompt based on style
  const stylePrompts: Record<string, string> = {
    realistic: 'photorealistic, highly detailed, 8k resolution, professional photography',
    artistic: 'artistic, painterly style, expressive brushstrokes, vibrant colors',
    sketch: 'pencil sketch, hand-drawn, detailed linework, black and white',
    dream: 'dreamlike, surreal, ethereal, magical atmosphere, soft lighting',
    abstract: 'abstract art, geometric shapes, vibrant colors, modern art',
  };

  const styleSuffix = stylePrompts[style] || stylePrompts.dream;
  const enhancedPrompt = `${prompt}, ${styleSuffix}`;

  console.log('[FREE AI] Generating image with prompt:', enhancedPrompt);
  console.log('[FREE AI] Using free Hugging Face Stable Diffusion model');

  try {
    const apiKey = getHuggingFaceAPIKey();
    // Use SD 2.1 for better quality, or fallback to v1.5 if 2.1 unavailable
    const model = 'stabilityai/stable-diffusion-2-1';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: enhancedPrompt,
          parameters: {
            num_inference_steps: 30,
            guidance_scale: 7.5,
          },
        }),
      }
    );

    if (!response.ok) {
      // If model is loading, wait and retry once
      if (response.status === 503) {
        console.log('[FREE AI] Model is loading, waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const retryResponse = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              inputs: enhancedPrompt,
              parameters: {
                num_inference_steps: 30,
                guidance_scale: 7.5,
              },
            }),
          }
        );
        
        if (!retryResponse.ok) {
          throw new Error(`Hugging Face API error: ${retryResponse.status}`);
        }
        
        const retryData = await retryResponse.blob();
        const arrayBuffer = await retryData.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const imageUrl = `data:image/png;base64,${base64}`;
        console.log('[FREE AI] ✅ Image generated successfully (retry)');
        return imageUrl;
      }
      
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = `data:image/png;base64,${base64}`;

    console.log('[FREE AI] ✅ Image generated successfully');
    return imageUrl;
  } catch (error: any) {
    console.error('[FREE AI] ❌ Image generation error:', error);
    throw new Error(`Free image generation failed: ${error.message}`);
  }
};

/**
 * Transcribe audio using free Hugging Face Whisper model
 * Uses openai/whisper-large-v2 (free, no API key required)
 */
export const transcribeFreeAudio = async (
  audioBuffer: Buffer,
  language: string = 'en'
): Promise<{ text: string; segments?: Array<{ start: number; end: number; text: string }> }> => {
  try {
    const apiKey = getHuggingFaceAPIKey();
    const model = 'openai/whisper-large-v2'; // Free Whisper model
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Convert buffer to base64
    const base64Audio = audioBuffer.toString('base64');
    
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: base64Audio,
          parameters: {
            language: language,
            return_timestamps: true,
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json() as any;
      const text = data.text || '';
      const chunks = data.chunks || [];
      
      const segments = chunks.map((chunk: any) => ({
        start: chunk.timestamp[0] || 0,
        end: chunk.timestamp[1] || 0,
        text: chunk.text || '',
      }));
      
      console.log('[FREE AI] ✅ Transcription successful using Hugging Face Whisper');
      return { text, segments };
    } else if (response.status === 503) {
      // Model loading, wait and retry
      console.log('[FREE AI] Model is loading, waiting 15 seconds...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      const retryResponse = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            inputs: base64Audio,
            parameters: {
              language: language,
              return_timestamps: true,
            },
          }),
        }
      );
      
      if (retryResponse.ok) {
        const data = await retryResponse.json() as any;
        const text = data.text || '';
        const chunks = data.chunks || [];
        const segments = chunks.map((chunk: any) => ({
          start: chunk.timestamp[0] || 0,
          end: chunk.timestamp[1] || 0,
          text: chunk.text || '',
        }));
        return { text, segments };
      }
    }
    
    throw new Error(`Hugging Face API error: ${response.status}`);
  } catch (error: any) {
    console.error('[FREE AI] ❌ Transcription error:', error);
    throw new Error(`Free transcription failed: ${error.message}`);
  }
};

/**
 * Generate text/prompts using free Hugging Face models
 * Uses meta-llama/Llama-3.2-3B-Instruct or mistralai/Mistral-7B-Instruct-v0.2
 */
export const generateFreeText = async (
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 200
): Promise<string> => {
  try {
    const apiKey = getHuggingFaceAPIKey();
    // Use Llama 3.2 3B for better responses (faster and free)
    const model = 'meta-llama/Llama-3.2-3B-Instruct';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
          parameters: {
            max_new_tokens: maxTokens,
            temperature: 0.7,
            return_full_text: false,
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json() as any;
      let generatedText = '';
      
      if (Array.isArray(data)) {
        generatedText = data[0]?.generated_text || data[0]?.text || '';
      } else if (typeof data === 'string') {
        generatedText = data;
      } else {
        generatedText = data?.generated_text || data?.text || '';
      }
      
      // Clean up the response (remove prompt if included)
      if (generatedText.includes(userPrompt)) {
        generatedText = generatedText.split(userPrompt).pop() || generatedText;
      }
      
      console.log('[FREE AI] ✅ Text generated using Hugging Face');
      return generatedText.trim();
    } else if (response.status === 503) {
      // Model loading, wait and retry
      console.log('[FREE AI] Model is loading, waiting 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const retryResponse = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            inputs: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userPrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
            parameters: {
              max_new_tokens: maxTokens,
              temperature: 0.7,
              return_full_text: false,
            },
          }),
        }
      );
      
      if (retryResponse.ok) {
        const data = await retryResponse.json() as any;
        let generatedText = '';
        if (Array.isArray(data)) {
          generatedText = data[0]?.generated_text || data[0]?.text || '';
        } else {
          generatedText = data?.generated_text || data?.text || '';
        }
        if (generatedText.includes(userPrompt)) {
          generatedText = generatedText.split(userPrompt).pop() || generatedText;
        }
        return generatedText.trim();
      }
    }
    
    throw new Error(`Hugging Face API error: ${response.status}`);
  } catch (error: any) {
    console.error('[FREE AI] ❌ Text generation error:', error);
    throw new Error(`Free text generation failed: ${error.message}`);
  }
};

/**
 * Generate comprehensive notes using free AI
 */
export const generateFreeComprehensiveNotes = async (
  transcriptText: string,
  participants: string[],
  duration: number,
  callDate: Date
): Promise<{
  title: string;
  summary: string;
  sections: Array<{ topic: string; timestamp: string; notes: string[]; relatedTranscript: string }>;
  actionItems: Array<{ item: string; assignee?: string; dueDate?: string; priority: 'high' | 'medium' | 'low' }>;
  decisions: Array<{ decision: string; context: string; timestamp: string }>;
  keyPoints: string[];
  questionsRaised: string[];
  nextSteps: string[];
  suggestedFollowUp?: string;
}> => {
  try {
    const systemPrompt = `You are AceTime AI assistant. Generate comprehensive, structured meeting notes from a completed call transcript.

Participants: ${participants.join(', ') || 'Unknown'}
Duration: ${Math.round(duration / 60)} minutes
Date: ${callDate.toLocaleDateString()}

Return ONLY valid JSON with these exact fields:
{
  "title": "Meeting title (3-8 words)",
  "summary": "2-3 sentence executive summary",
  "sections": [{"topic": "...", "timestamp": "...", "notes": ["..."], "relatedTranscript": "..."}],
  "actionItems": [{"item": "...", "assignee": "...", "dueDate": "...", "priority": "high|medium|low"}],
  "decisions": [{"decision": "...", "context": "...", "timestamp": "..."}],
  "keyPoints": ["..."],
  "questionsRaised": ["..."],
  "nextSteps": ["..."],
  "suggestedFollowUp": "..."
}`;

    const userPrompt = `Complete meeting transcript:\n${transcriptText}\n\nGenerate comprehensive meeting notes.`;

    const generatedText = await generateFreeText(systemPrompt, userPrompt, 2000);
    
    // Extract JSON from response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const notes = JSON.parse(jsonMatch[0]);
        console.log('[FREE AI] ✅ Comprehensive notes generated');
        return {
          title: notes.title || 'Meeting Notes',
          summary: notes.summary || '',
          sections: notes.sections || [],
          actionItems: notes.actionItems || [],
          decisions: notes.decisions || [],
          keyPoints: notes.keyPoints || [],
          questionsRaised: notes.questionsRaised || [],
          nextSteps: notes.nextSteps || [],
          suggestedFollowUp: notes.suggestedFollowUp,
        };
      } catch (parseError) {
        console.warn('[FREE AI] ⚠️ Failed to parse JSON, using extraction');
      }
    }
    
    // Fallback to basic extraction
    return {
      title: 'Meeting Notes',
      summary: transcriptText.substring(0, 200) + '...',
      sections: [],
      actionItems: [],
      decisions: [],
      keyPoints: [],
      questionsRaised: [],
      nextSteps: [],
    };
  } catch (error: any) {
    console.error('[FREE AI] ❌ Comprehensive notes error:', error);
    return {
      title: 'Meeting Notes',
      summary: 'Notes generation temporarily unavailable.',
      sections: [],
      actionItems: [],
      decisions: [],
      keyPoints: [],
      questionsRaised: [],
      nextSteps: [],
    };
  }
};

/**
 * Check if free AI is available (always true, but may have rate limits)
 */
export const isFreeAIAvailable = (): boolean => {
  return true; // Always available, no API key required
};

