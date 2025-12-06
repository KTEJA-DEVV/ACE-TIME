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
    const model = 'mistralai/Mistral-7B-Instruct-v0.2'; // Free model
    
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
            inputs: `<s>[INST] ${systemPrompt}\n\n${userPrompt} [/INST]`,
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
 * Uses runwayml/stable-diffusion-v1-5 (free, no API key required)
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
    const model = 'runwayml/stable-diffusion-v1-5'; // Free Stable Diffusion model
    
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
 * Check if free AI is available (always true, but may have rate limits)
 */
export const isFreeAIAvailable = (): boolean => {
  return true; // Always available, no API key required
};

