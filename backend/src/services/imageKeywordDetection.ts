import { getOpenAI } from './openai';

// Helper to check if error is a quota/rate limit error
const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  
  if (error.status === 429 || error.code === 'insufficient_quota' || error.type === 'insufficient_quota') {
    return true;
  }
  
  const errorMessage = error.message?.toLowerCase() || '';
  if (errorMessage.includes('quota') || errorMessage.includes('insufficient_quota') || errorMessage.includes('rate_limit')) {
    return true;
  }
  
  if (error.error?.code === 'insufficient_quota' || error.error?.type === 'insufficient_quota') {
    return true;
  }
  
  return false;
};

/**
 * Keywords that trigger automatic image generation
 */
const TRIGGER_KEYWORDS = [
  'dream', 'dreams', 'dreaming', 'dreamy',
  'imagine', 'imagination', 'visualize', 'picture',
  'design', 'logo', 'icon', 'graphic',
  'art', 'artistic', 'painting', 'drawing',
  'architecture', 'building', 'structure',
  'landscape', 'scenery', 'view',
  'concept', 'idea', 'vision',
  'show me', 'create', 'generate',
  'visual', 'image', 'photo', 'picture',
];

/**
 * Visual concept patterns that suggest image generation
 */
const VISUAL_PATTERNS = [
  /(?:design|create|make|build)\s+(?:a|an|the)?\s*(?:logo|icon|graphic|image|picture|visual)/i,
  /(?:imagine|visualize|picture|think of)\s+(?:a|an|the)?\s*(?:.*?)/i,
  /(?:show me|display|generate)\s+(?:a|an|the)?\s*(?:.*?)/i,
  /(?:dream|vision|concept)\s+(?:of|about|for)\s*(?:.*?)/i,
  /(?:looks like|appears as|resembles)\s+(?:.*?)/i,
];

/**
 * Detect if transcript contains visual concepts that should trigger image generation
 */
export async function detectVisualConcept(
  transcriptText: string,
  recentContext?: string[]
): Promise<{ shouldGenerate: boolean; prompt?: string; confidence: number }> {
  if (!transcriptText || transcriptText.trim().length < 10) {
    return { shouldGenerate: false, confidence: 0 };
  }

  const text = transcriptText.toLowerCase();
  const fullContext = recentContext 
    ? [...recentContext, transcriptText].join(' ').toLowerCase()
    : text;

  // Check for trigger keywords
  let keywordMatches = 0;
  for (const keyword of TRIGGER_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      keywordMatches++;
    }
  }

  // Check for visual patterns
  let patternMatches = 0;
  for (const pattern of VISUAL_PATTERNS) {
    if (pattern.test(text)) {
      patternMatches++;
    }
  }

  // Basic detection: if keywords or patterns found
  if (keywordMatches > 0 || patternMatches > 0) {
    // Extract potential prompt from context
    const prompt = extractImagePrompt(fullContext, transcriptText);
    const confidence = Math.min(0.7 + (keywordMatches * 0.1) + (patternMatches * 0.15), 0.95);
    
    return {
      shouldGenerate: true,
      prompt,
      confidence,
    };
  }

  // Advanced detection using free AI first, then OpenAI fallback
  if (fullContext.length > 50) {
    try {
      const { generateFreeText } = await import('./freeAI');
      const systemPrompt = `You are an AI assistant that detects when conversations contain visual concepts that would benefit from image generation.

Analyze the conversation and determine if it contains:
1. Visual descriptions (colors, shapes, objects, scenes)
2. Creative concepts (designs, logos, artwork, architecture)
3. Imaginary scenarios (dreams, visions, fantasies)
4. Requests for visualizations ("show me", "imagine", "picture")

Respond with JSON:
{
  "shouldGenerate": boolean,
  "prompt": "extracted image prompt or null",
  "confidence": number (0-1),
  "reason": "brief explanation"
}`;
      
      const userPrompt = `Analyze this conversation for visual concepts:\n\n${fullContext.substring(-500)}`;
      
      const generatedText = await generateFreeText(systemPrompt, userPrompt, 200);
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          if (result.shouldGenerate === true) {
            console.log('[IMAGE DETECTION] ✅ Free AI detected visual concept');
            return {
              shouldGenerate: true,
              prompt: result.prompt || undefined,
              confidence: result.confidence || 0.7,
            };
          }
        } catch (parseError) {
          console.warn('[IMAGE DETECTION] Failed to parse free AI response');
        }
      }
    } catch (freeError) {
      console.warn('[IMAGE DETECTION] Free AI detection failed, trying OpenAI:', freeError);
    }
    
    // Fallback to OpenAI if free AI fails
    const openai = getOpenAI();
    if (openai) {
      try {
        const aiDetection = await detectVisualConceptWithAI(fullContext, openai);
        if (aiDetection.shouldGenerate) {
          return aiDetection;
        }
      } catch (error) {
        console.warn('[IMAGE DETECTION] OpenAI detection failed, using basic detection:', error);
      }
    }
  }

  return { shouldGenerate: false, confidence: 0 };
}

/**
 * Extract image prompt from transcript text
 */
function extractImagePrompt(context: string, currentText: string): string {
  // Try to extract the main visual concept
  // Look for phrases after trigger words
  const triggerIndices: number[] = [];
  TRIGGER_KEYWORDS.forEach(keyword => {
    const index = context.indexOf(keyword.toLowerCase());
    if (index !== -1) {
      triggerIndices.push(index);
    }
  });

  if (triggerIndices.length > 0) {
    // Get text after the last trigger keyword
    const lastTriggerIndex = Math.max(...triggerIndices);
    const afterTrigger = context.substring(lastTriggerIndex);
    
    // Extract up to 100 characters after trigger
    const extracted = afterTrigger.substring(0, 200).trim();
    
    // Clean up the prompt
    let prompt = extracted
      .replace(/^(?:dream|imagine|visualize|picture|show me|create|design|make|build)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If prompt is too short, use recent context
    if (prompt.length < 20) {
      prompt = currentText.substring(0, 150).trim();
    }

    return prompt || currentText.substring(0, 100);
  }

  // Fallback: use recent text
  return currentText.substring(0, 150).trim();
}

/**
 * Use AI to detect visual concepts with higher accuracy
 */
async function detectVisualConceptWithAI(
  context: string,
  openai: any
): Promise<{ shouldGenerate: boolean; prompt?: string; confidence: number }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that detects when conversations contain visual concepts that would benefit from image generation.

Analyze the conversation and determine if it contains:
1. Visual descriptions (colors, shapes, objects, scenes)
2. Creative concepts (designs, logos, artwork, architecture)
3. Imaginary scenarios (dreams, visions, fantasies)
4. Requests for visualizations ("show me", "imagine", "picture")

Respond with JSON:
{
  "shouldGenerate": boolean,
  "prompt": "extracted image prompt or null",
  "confidence": number (0-1),
  "reason": "brief explanation"
}`,
        },
        {
          role: 'user',
          content: `Analyze this conversation for visual concepts:\n\n${context.substring(-500)}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const result = JSON.parse(content);
      return {
        shouldGenerate: result.shouldGenerate === true,
        prompt: result.prompt || undefined,
        confidence: result.confidence || 0.5,
      };
    }
  } catch (error: any) {
    // If quota exceeded, gracefully fall back to basic detection
    if (isQuotaError(error)) {
      console.warn('[IMAGE DETECTION] ⚠️ OpenAI quota exceeded - using basic keyword detection');
    } else {
      console.error('[IMAGE DETECTION] AI detection error:', error);
    }
  }

  return { shouldGenerate: false, confidence: 0 };
}

/**
 * Generate enhanced image prompt from transcript context
 */
export async function generateImagePromptFromContext(
  transcriptText: string,
  recentSegments?: string[]
): Promise<string> {
  // PRIORITY: Try free AI first
  try {
    const { generateFreeText } = await import('./freeAI');
    const context = recentSegments 
      ? [...recentSegments, transcriptText].join(' ')
      : transcriptText;

    const systemPrompt = 'You are a creative AI that generates vivid, imaginative image prompts from conversations. Extract the main visual concept and create a detailed, artistic image prompt. Focus on colors, mood, style, and key visual elements. Output only the image prompt, nothing else.';
    const userPrompt = `Generate an image prompt from this conversation:\n\n${context.substring(-500)}`;
    
    const prompt = await generateFreeText(systemPrompt, userPrompt, 200);
    if (prompt && prompt.length > 10) {
      console.log('[IMAGE DETECTION] ✅ Free AI generated prompt');
      return prompt.trim();
    }
  } catch (freeError) {
    console.warn('[IMAGE DETECTION] Free AI prompt generation failed, trying OpenAI:', freeError);
  }
  
  // Fallback to OpenAI
  const openai = getOpenAI();
  if (openai) {
    try {
      const context = recentSegments 
        ? [...recentSegments, transcriptText].join(' ')
        : transcriptText;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a creative AI that generates vivid, imaginative image prompts from conversations. Extract the main visual concept and create a detailed, artistic image prompt. Focus on colors, mood, style, and key visual elements. Output only the image prompt, nothing else.',
          },
          {
            role: 'user',
            content: `Generate an image prompt from this conversation:\n\n${context.substring(-500)}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const prompt = response.choices[0]?.message?.content?.trim();
      if (prompt && prompt.length > 10) {
        return prompt;
      }
    } catch (error: any) {
      // If quota exceeded, gracefully fall back to simple extraction
      if (isQuotaError(error)) {
        console.warn('[IMAGE DETECTION] ⚠️ OpenAI quota exceeded - using simple prompt extraction');
      } else {
        console.error('[IMAGE DETECTION] OpenAI prompt generation error:', error);
      }
    }
  }

  // Fallback: simple extraction
  return extractImagePrompt(transcriptText, transcriptText);
}

