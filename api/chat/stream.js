/**
 * Chat Streaming API with Image Generation
 * 
 * Main endpoint for handling chat conversations with integrated image generation.
 * Includes real-time message classification and DALL-E integration.
 * 
 */

import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';

// Supported model configurations
const VALID_MODELS = {
    openai: ['gpt-3.5-turbo-0125', 'gpt-4-0125-preview', 'gpt-5-2025-08-07'],
    claude: ['claude-3-haiku-20240307', 'claude-3-5-haiku-20241022', 'claude-sonnet-4-20250514']
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, model, sessionId, conversationId, imageContext } = req.body;

        // Validate request
        const validation = validateRequest(messages, model);
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.error });
        }

        // Set up server-sent events
        setupSSEHeaders(res);
        res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

        const lastMessage = messages[messages.length - 1];

        // Handle image classification for image-generation task
        if (shouldClassifyForImages(lastMessage, conversationId)) {
            const imageIntent = await classifyImageIntent(lastMessage.content, imageContext);

            if (imageIntent === 'new_image' || imageIntent === 'modify_image') {
                res.write(`data: ${JSON.stringify({ type: 'image_request_detected' })}\n\n`);

                const imageGenerated = await generateImage(
                    lastMessage.content, model, imageContext, imageIntent, res
                );

                if (imageGenerated) {
                    res.end();
                    return;
                }
            }
        }

        // Handle regular chat
        await streamRegularChat(messages, model, res);
        res.end();

    } catch (error) {
        console.error('Stream handler error:', error.message);
        handleStreamError(res, error);
    }
}

/**
 * Validates incoming request parameters
 */
function validateRequest(messages, model) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return { isValid: false, error: 'Valid messages array is required' };
    }
    if (!model) {
        return { isValid: false, error: 'Model is required' };
    }

    const modelType = getModelType(model);
    if (!modelType) {
        return { isValid: false, error: `Invalid model: ${model}` };
    }

    return { isValid: true, modelType };
}

/**
 * Determines model type and validates against supported models
 */
function getModelType(model) {
    for (const [type, models] of Object.entries(VALID_MODELS)) {
        if (models.includes(model)) return type;
    }
    return null;
}

/**
 * Sets up Server-Sent Events headers
 */
function setupSSEHeaders(res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
}

/**
 * Determines if message should be classified for image generation
 */
function shouldClassifyForImages(lastMessage, conversationId) {
    if (lastMessage?.sender !== 'User') return false;

    const currentTask = conversationId ? conversationId.split('_')[0] : 'unknown';
    return currentTask === 'image-generation';
}

/**
 * Classifies user message for image generation intent
 * 
 * CRITICAL: No system prompt used to avoid classification bias
 * CRITICAL: Uses GPT-3.5 specifically for fast, reliable classification
 */
async function classifyImageIntent(userMessage, imageContext) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured for classification');
        }

        const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);

        // Build classification prompt based on context
        const prompt = buildClassificationPrompt(userMessage, imageContext);
        const messages = [{ sender: 'User', content: prompt }];

        // Get classification (no system prompt - critical for accuracy)
        const classification = await classifier.getCompletion(messages, 'gpt-3.5-turbo-0125', {
            includeSystemPrompt: false
        });

        return parseClassificationResult(classification.trim().toUpperCase(), imageContext);

    } catch (error) {
        console.error('Image classification failed:', error.message);
        return 'none';
    }
}

/**
 * Builds appropriate classification prompt based on image context
 */
function buildClassificationPrompt(userMessage, imageContext) {
    if (imageContext?.lastPrompt) {
        return `The user previously generated an image. Now they said: "${userMessage}"
            Analyze what the user wants:
            - If they want a completely NEW/DIFFERENT image, respond: NEW
            - If they want to MODIFY/CHANGE the existing image (color, size, add/remove things), respond: MODIFY  
            - If they're just having normal conversation, respond: NEITHER

            Respond with only one word: NEW, MODIFY, or NEITHER`;
    }

    return `The user said: "${userMessage}"
        Does this request involve creating, generating, drawing, or making an image, picture, or visual?

        Examples that should be YES:
        - "draw a dog"
        - "generate an image of a cat"  
        - "create a picture of a sunset"
        - "make an image of a car"
        - "I want a picture of flowers"
        - "show me an image of a mountain"

        Examples that should be NO:
        - "hello"
        - "how are you?"
        - "what's the weather?"
        - "tell me a joke"

        Respond with only: YES or NO`;
}

/**
 * Parses classification result into intent
 */
function parseClassificationResult(classification, imageContext) {
    if (imageContext?.lastPrompt) {
        if (classification.includes('NEW')) return 'new_image';
        if (classification.includes('MODIFY')) return 'modify_image';
        return 'none';
    }

    return classification.includes('YES') ? 'new_image' : 'none';
}

/**
 * Generates image using DALL-E with prompt enhancement
 */
async function generateImage(userMessage, model, imageContext, intent, res) {
    try {
        // Step 1: Enhance the prompt using the assigned model
        const enhancedPrompt = await enhanceImagePrompt(userMessage, model, imageContext, intent);

        // Step 2: Generate image with DALL-E
        const imageHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        const imageResult = await imageHandler.generateImage(enhancedPrompt);

        if (!imageResult?.success || !imageResult?.url) {
            throw new Error('Image generation failed or returned no URL');
        }

        // Step 3: Send response to client
        const responseMessage = intent === 'modify_image'
            ? `I've modified the image based on your request:\n\n![Generated Image](${imageResult.url})`
            : `I've generated an image for you:\n\n![Generated Image](${imageResult.url})`;

        const responseData = {
            type: 'content',
            content: responseMessage,
            fullContent: responseMessage,
            imageUrl: imageResult.url,
            imagePrompt: enhancedPrompt,
            originalPrompt: userMessage,
            revisedPrompt: imageResult.revisedPrompt
        };

        res.write(`data: ${JSON.stringify(responseData)}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', finishReason: 'image_generated' })}\n\n`);

        return true;

    } catch (error) {
        console.error('Image generation failed:', error.message);

        const errorMessage = `I apologize, but I couldn't generate the image. Error: ${error.message}`;
        res.write(`data: ${JSON.stringify({ type: 'content', content: errorMessage, fullContent: errorMessage })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', finishReason: 'error' })}\n\n`);

        return false;
    }
}

/**
 * Enhances user prompt for DALL-E using the assigned model
 */
async function enhanceImagePrompt(userMessage, model, imageContext, intent) {
    const enhancementPrompt = buildEnhancementPrompt(userMessage, imageContext, intent);
    const messages = [{ sender: 'User', content: enhancementPrompt }];

    try {
        // Use GPT-4 for enhancement if GPT-5 is assigned (for reliability)
        let enhancementModel = model;
        if (model.startsWith('gpt-5')) {
            console.log('⚠️ Using GPT-4 for image prompt enhancement (GPT-5 fallback)');
            enhancementModel = 'gpt-4-0125-preview';
        }

        // Use appropriate handler based on model type
        const handler = getModelType(enhancementModel) === 'claude'
            ? new ClaudeHandler(process.env.ANTHROPIC_API_KEY)
            : new OpenAIHandler(process.env.OPENAI_API_KEY);

        const enhancedPrompt = await handler.getCompletion(messages, enhancementModel);

        // Validate the response
        if (!enhancedPrompt || enhancedPrompt.trim().length === 0) {
            console.error('⚠️ Empty enhancement response, using original prompt');
            return userMessage; // Fallback to original
        }

        return enhancedPrompt.trim();

    } catch (error) {
        console.error('❌ Prompt enhancement failed:', error.message);
        // Fallback to original prompt
        return userMessage;
    }
}

/**
 * Builds prompt enhancement request
 */
function buildEnhancementPrompt(userMessage, imageContext, intent) {
    if (intent === 'modify_image' && imageContext?.lastPrompt) {
        return `Previous DALL-E prompt: "${imageContext.lastPrompt}"
        User wants to modify it: "${userMessage}"
        Create an updated DALL-E prompt that applies the user's modification. Keep it natural and concise like ChatGPT would - don't over-describe.
        Only respond with the new prompt:`;
    }

    return `User wants: "${userMessage}"
        Create a natural DALL-E prompt like ChatGPT would. Keep it concise but effective - add key details for quality (good lighting, clear subject) but don't over-describe.
        Only respond with the prompt:`;
}

/**
 * Handles regular chat streaming
 */
// In stream.js, wrap the streaming call:
async function streamRegularChat(messages, model, res) {
    res.write(`data: ${JSON.stringify({ type: 'typing_start' })}\n\n`);

    const modelType = getModelType(model);
    const handler = modelType === 'claude'
        ? new ClaudeHandler(process.env.ANTHROPIC_API_KEY)
        : new OpenAIHandler(process.env.OPENAI_API_KEY);

    let retryCount = 0;
    const maxRetries = model.startsWith('gpt-5') ? 2 : 0; // Only retry for GPT-5

    while (retryCount <= maxRetries) {
        try {
            let hasContent = false;

            for await (const chunk of handler.streamChat(messages, model)) {
                if (chunk.type === 'content') {
                    hasContent = true;
                }
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                if (chunk.type === 'done' || chunk.type === 'error') break;
            }

            // Success - exit retry loop
            if (hasContent) break;

        } catch (error) {
            retryCount++;

            if (retryCount > maxRetries) {
                console.error('❌ GPT-5 failed after', retryCount, 'retries');
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'GPT-5 is currently experiencing delays. Please try again or use GPT-4 instead.'
                })}\n\n`);
                break;
            }

            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log('⏳ Retrying GPT-5 after', delay / 1000, 'seconds (attempt', retryCount + 1, ')');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Handles streaming errors
 */
function handleStreamError(res, error) {
    if (!res.headersSent) {
        res.status(500).json({ error: error.message });
    } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
}

export const config = {
    api: {
        bodyParser: { sizeLimit: '10mb' },
        responseLimit: false,
    },
};