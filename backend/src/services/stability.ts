/**
 * Stability AI Service for Image Generation
 * Uses Stable Diffusion models via Stability AI API
 * Free tier: https://platform.stability.ai/
 */

interface StabilityImageResponse {
  artifacts: Array<{
    base64: string;
    seed: number;
    finishReason: string;
  }>;
}

interface StabilityImageOptions {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
  steps?: number;
}

let stabilityApiKey: string | null = null;

export const getStabilityAPIKey = (): string | null => {
  if (stabilityApiKey) return stabilityApiKey;
  
  const apiKey = process.env.STABILITY_API_KEY;
  if (apiKey) {
    stabilityApiKey = apiKey;
    console.log('[STABILITY] ✅ Stability AI API key loaded');
  } else {
    console.warn('[STABILITY] ⚠️ STABILITY_API_KEY not found in environment variables');
    console.warn('[STABILITY] Get a free API key at: https://platform.stability.ai/');
  }
  
  return stabilityApiKey;
};

export const isStabilityConfigured = (): boolean => {
  return !!getStabilityAPIKey();
};

/**
 * Generate image using Stability AI Stable Diffusion
 */
export const generateImage = async (options: StabilityImageOptions): Promise<string> => {
  const apiKey = getStabilityAPIKey();
  if (!apiKey) {
    throw new Error('Stability AI API key not configured. Please set STABILITY_API_KEY in environment variables.');
  }

  const {
    prompt,
    style = 'dream',
    width = 1024,
    height = 1024,
    steps = 30,
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

  console.log('[STABILITY] Generating image with prompt:', enhancedPrompt);
  console.log('[STABILITY] Options:', { width, height, steps, style });

  try {
    // Use Stable Diffusion XL model (stable-diffusion-xl-1024-v1-0)
    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text_prompts: [
            {
              text: enhancedPrompt,
              weight: 1,
            },
          ],
          cfg_scale: 7,
          height,
          width,
          steps,
          samples: 1,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
      console.error('[STABILITY] API error:', errorData);
      
      let errorMessage = 'Failed to generate image';
      if (response.status === 401) {
        errorMessage = 'Invalid Stability AI API key';
      } else if (response.status === 402 || response.status === 429) {
        errorMessage = 'Stability AI quota exceeded or rate limited';
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json() as StabilityImageResponse;
    
    if (!data.artifacts || data.artifacts.length === 0) {
      throw new Error('No image generated');
    }

    // Convert base64 to data URL
    const base64Image = data.artifacts[0].base64;
    const imageUrl = `data:image/png;base64,${base64Image}`;

    console.log('[STABILITY] ✅ Image generated successfully');
    return imageUrl;
  } catch (error: any) {
    console.error('[STABILITY] ❌ Image generation error:', error);
    throw error;
  }
};

/**
 * Generate image from base64 and return as URL
 * For compatibility with existing code that expects URLs
 */
export const generateImageAsURL = async (options: StabilityImageOptions): Promise<string> => {
  return generateImage(options);
};

