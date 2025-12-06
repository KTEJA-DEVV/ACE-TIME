import { Router, Response } from 'express';
import { GeneratedImage } from '../models/GeneratedImage';
import { CallSession } from '../models/CallSession';
import { Transcript } from '../models/Transcript';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import OpenAI from 'openai';
import { getOpenAI } from '../services/openai';
import { generateImage, isStabilityConfigured } from '../services/stability';
import { generateFreeImage, isFreeAIAvailable } from '../services/freeAI';

const router = Router();

// POST /api/images/generate - Generate image from prompt
router.post(
  '/generate',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { prompt, style = 'dream', callId, conversationId } = req.body;

    console.log('[IMAGES] 📝 Image generation request:', { prompt, style, callId, conversationId });
    
    // Priority: Free AI > Stability AI > OpenAI
    const useFreeAI = isFreeAIAvailable();
    const useStability = isStabilityConfigured();
    const openai = getOpenAI();

    try {
      let imageUrl: string;
      let revisedPrompt: string | undefined = undefined;

      // Try free AI first (always available, no cost)
      if (useFreeAI) {
        console.log('[IMAGES] ✅ Using free Hugging Face AI for image generation (no cost)');
        try {
          imageUrl = await generateFreeImage({
            prompt,
            style,
            width: 512,
            height: 512,
          });
          revisedPrompt = prompt;
        } catch (freeError) {
          console.warn('[IMAGES] ⚠️ Free AI failed, trying fallback:', freeError);
          // Fallback to Stability AI or OpenAI if free AI fails
          if (useStability) {
            console.log('[IMAGES] ✅ Falling back to Stability AI');
            imageUrl = await generateImage({
              prompt,
              style,
              width: 1024,
              height: 1024,
              steps: 30,
            });
            revisedPrompt = prompt;
          } else if (openai) {
            // Fallback to OpenAI DALL-E
            console.log('[IMAGES] ✅ Falling back to OpenAI DALL-E');
            const stylePrompts: Record<string, string> = {
              realistic: 'photorealistic, high detail, 8k resolution',
              artistic: 'artistic, painterly, expressive brushstrokes',
              sketch: 'pencil sketch, hand-drawn, detailed linework',
              dream: 'dreamlike, surreal, ethereal, magical atmosphere',
              abstract: 'abstract art, geometric shapes, vibrant colors',
            };

            const enhancedPrompt = `${prompt}. Style: ${stylePrompts[style] || stylePrompts.dream}`;

            console.log('[IMAGES] Generating image with prompt:', enhancedPrompt);
            const response = await openai.images.generate({
              model: 'dall-e-3',
              prompt: enhancedPrompt,
              n: 1,
              size: '1024x1024',
              quality: 'standard',
            });

            console.log('[IMAGES] OpenAI response:', JSON.stringify(response, null, 2));
            const imageData = response.data?.[0];
            imageUrl = imageData?.url || '';
            revisedPrompt = imageData?.revised_prompt;

            if (!imageUrl) {
              console.error('[IMAGES] No image URL in response:', response);
              throw new Error('No image URL returned from OpenAI');
            }
          } else {
            throw freeError;
          }
        }
      } else if (useStability) {
        // Use Stability AI (free tier)
        console.log('[IMAGES] ✅ Using Stability AI for image generation');
        imageUrl = await generateImage({
          prompt,
          style,
          width: 1024,
          height: 1024,
          steps: 30,
        });
        revisedPrompt = prompt; // Stability AI doesn't revise prompts
      } else if (openai) {
        // Fallback to OpenAI DALL-E
        console.log('[IMAGES] ✅ Using OpenAI DALL-E for image generation');
        
        // Enhance prompt based on style
        const stylePrompts: Record<string, string> = {
          realistic: 'photorealistic, high detail, 8k resolution',
          artistic: 'artistic, painterly, expressive brushstrokes',
          sketch: 'pencil sketch, hand-drawn, detailed linework',
          dream: 'dreamlike, surreal, ethereal, magical atmosphere',
          abstract: 'abstract art, geometric shapes, vibrant colors',
        };

        const enhancedPrompt = `${prompt}. Style: ${stylePrompts[style] || stylePrompts.dream}`;

        console.log('[IMAGES] Generating image with prompt:', enhancedPrompt);
        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: enhancedPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        });

        console.log('[IMAGES] OpenAI response:', JSON.stringify(response, null, 2));
        const imageData = response.data?.[0];
        imageUrl = imageData?.url || '';
        revisedPrompt = imageData?.revised_prompt;

        if (!imageUrl) {
          console.error('[IMAGES] No image URL in response:', response);
          throw new Error('No image URL returned from OpenAI');
        }
      } else {
        throw new Error('No image generation service available');
      }

      console.log('[IMAGES] Image generated successfully');

      // Save to database
      const generatedImage = new GeneratedImage({
        callId,
        conversationId,
        creatorId: req.userId,
        prompt,
        revisedPrompt,
        imageUrl,
        style,
        contextSource: callId ? 'call_transcript' : conversationId ? 'chat' : 'manual',
      });
      await generatedImage.save();

      // Emit to call room if during a call
      if (callId) {
        const io = req.app.get('io');
        const callSession = await CallSession.findById(callId);
        if (io && callSession) {
          io.to(callSession.roomId).emit('image:generated', {
            image: generatedImage,
            creator: req.user?.name,
          });
        }
      }

      console.log('[IMAGES] ✅ Image saved and sent to client');
      res.json({ image: generatedImage });
    } catch (error: any) {
      console.error('[IMAGES] ❌ Image generation error:', error);
      console.error('[IMAGES] Error details:', {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        response: error.response?.data,
        error: error.error,
      });
      
      // Extract error message from various possible locations
      let errorMessage = 'Failed to generate image';
      
      // Check OpenAI API error response
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.error) {
        errorMessage = typeof error.response.data.error === 'string' 
          ? error.response.data.error 
          : JSON.stringify(error.response.data.error);
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Provide user-friendly messages for common errors
      if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.';
      } else if (errorMessage.includes('invalid_api_key') || errorMessage.includes('401')) {
        errorMessage = 'Invalid API key. Please check your configuration.';
      } else if (errorMessage.includes('insufficient_quota') || errorMessage.includes('quota')) {
        errorMessage = 'API quota exceeded. Please check your account or use Stability AI (free tier available).';
      } else if (errorMessage.includes('content_policy_violation')) {
        errorMessage = 'Image generation failed due to content policy. Please try a different prompt.';
      } else if (errorMessage.includes('Stability AI')) {
        // Keep Stability AI specific messages
      }
      
      console.error('[IMAGES] Returning error to client:', errorMessage);
      res.status(500).json({ error: errorMessage });
    }
  })
);

// POST /api/images/generate-from-call - Generate from call transcript
router.post(
  '/generate-from-call',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { callId, style = 'dream' } = req.body;

    const useFreeAI = isFreeAIAvailable();
    const useStability = isStabilityConfigured();
    const openai = getOpenAI();

    // Get recent transcript
    const transcript = await Transcript.findOne({ callId });
    if (!transcript || transcript.segments.length === 0) {
      res.status(400).json({ error: 'No transcript available' });
      return;
    }

    // Get last few segments for context
    const recentSegments = transcript.segments.slice(-5);
    const context = recentSegments.map(s => s.text).join(' ');

    try {
      let generatedPrompt: string;
      let imageUrl: string;

      // Generate image prompt from transcript (use OpenAI GPT if available, otherwise use simple extraction)
      if (openai) {
        const promptResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a creative AI that generates visual prompts from conversations. Create a vivid, imaginative image prompt based on the conversation context. Focus on the main ideas, emotions, or concepts being discussed. Output only the image prompt, nothing else.',
            },
            {
              role: 'user',
              content: `Generate an image prompt from this conversation:\n\n${context}`,
            },
          ],
          max_tokens: 200,
        });

        generatedPrompt = promptResponse.choices[0]?.message?.content || context;
      } else {
        // Simple extraction if no OpenAI
        generatedPrompt = context.substring(0, 200);
      }

      // Generate image - try free AI first
      if (useFreeAI) {
        console.log('[IMAGES] ✅ Using free Hugging Face AI for transcript-based image generation');
        try {
          imageUrl = await generateFreeImage({
            prompt: generatedPrompt,
            style,
            width: 512,
            height: 512,
          });
        } catch (freeError) {
          console.warn('[IMAGES] ⚠️ Free AI failed, trying fallback:', freeError);
          // Fallback to Stability AI or OpenAI
          if (useStability) {
            imageUrl = await generateImage({
              prompt: generatedPrompt,
              style,
              width: 1024,
              height: 1024,
              steps: 30,
            });
          } else if (openai) {
            const stylePrompts: Record<string, string> = {
              realistic: 'photorealistic, high detail',
              artistic: 'artistic, painterly',
              sketch: 'pencil sketch, hand-drawn',
              dream: 'dreamlike, surreal, ethereal',
              abstract: 'abstract art, geometric',
            };

            const imageResponse = await openai.images.generate({
              model: 'dall-e-3',
              prompt: `${generatedPrompt}. Style: ${stylePrompts[style]}`,
              n: 1,
              size: '1024x1024',
            });

            const imageData = imageResponse.data?.[0];
            imageUrl = imageData?.url || '';
            if (!imageUrl) {
              throw new Error('No image generated');
            }
          } else {
            throw freeError;
          }
        }
      } else if (useStability) {
        imageUrl = await generateImage({
          prompt: generatedPrompt,
          style,
          width: 1024,
          height: 1024,
          steps: 30,
        });
      } else if (openai) {
        const stylePrompts: Record<string, string> = {
          realistic: 'photorealistic, high detail',
          artistic: 'artistic, painterly',
          sketch: 'pencil sketch, hand-drawn',
          dream: 'dreamlike, surreal, ethereal',
          abstract: 'abstract art, geometric',
        };

        const imageResponse = await openai.images.generate({
          model: 'dall-e-3',
          prompt: `${generatedPrompt}. Style: ${stylePrompts[style]}`,
          n: 1,
          size: '1024x1024',
        });

        const imageData = imageResponse.data?.[0];
        imageUrl = imageData?.url || '';
        if (!imageUrl) {
          throw new Error('No image generated');
        }
      } else {
        throw new Error('No image generation service available');
      }

      // Save
      const generatedImage = new GeneratedImage({
        callId,
        creatorId: req.userId,
        prompt: generatedPrompt,
        revisedPrompt: generatedPrompt, // Stability AI doesn't revise prompts
        imageUrl,
        style,
        contextSource: 'call_transcript',
        transcriptContext: context,
      });
      await generatedImage.save();

      // Emit to call room
      const io = req.app.get('io');
      const callSession = await CallSession.findById(callId);
      if (io && callSession) {
        io.to(callSession.roomId).emit('image:generated', {
          image: generatedImage,
          creator: req.user?.name,
          fromTranscript: true,
        });
      }

      res.json({ image: generatedImage });
    } catch (error: any) {
      console.error('Image generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate image' });
    }
  })
);

// GET /api/images/call/:callId - Get images for a call
router.get(
  '/call/:callId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { callId } = req.params;

    const images = await GeneratedImage.find({ callId })
      .populate('creatorId', 'name avatar')
      .sort({ createdAt: -1 });

    res.json({ images });
  })
);

// GET /api/images/my - Get user's generated images
router.get(
  '/my',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { limit = 20, page = 1 } = req.query;

    const images = await GeneratedImage.find({ creatorId: req.userId })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await GeneratedImage.countDocuments({ creatorId: req.userId });

    res.json({
      images,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  })
);

// POST /api/images/:id/like - Like an image
router.post(
  '/:id/like',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const image = await GeneratedImage.findById(id);
    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    const userId = req.user!._id;
    const isLiked = image.likes.includes(userId);

    if (isLiked) {
      image.likes = image.likes.filter(l => !l.equals(userId));
    } else {
      image.likes.push(userId);
    }

    await image.save();

    res.json({ liked: !isLiked, likeCount: image.likes.length });
  })
);

export default router;

