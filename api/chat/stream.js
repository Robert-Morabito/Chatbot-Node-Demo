/**
 * Chat Streaming API with Image Generation
 * 
 * Main endpoint for handling chat conversations with integrated image generation.
 * Includes real-time message classification and DALL-E integration.
 * 
 */

import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';

/**
 * Send server log through SSE stream (for testing/debugging)
 * @param {Response} res - Response object
 * @param {string} message - Log message
 */
function streamLog(res, message) {
    if (!res.headersSent) return; // Only log after stream started

    try {
        res.write(`data: ${JSON.stringify({ type: 'server_log', message })}\n\n`);
    } catch (error) {
        // Silently fail if stream is closed
    }
}

/**
 * Download blob image and convert to base64 data URL
 * @param {string} blobUrl - DALL-E blob URL
 * @param {string} prompt - Original prompt for logging
 * @returns {Promise<Object>} Image data with base64 URL
 */
async function downloadAndConvertToBase64(blobUrl, prompt, res = null) {
    console.log('🖼️ Downloading image blob...');
    if (res) streamLog(res, '🖼️ Downloading image blob...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(blobUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'ChatBot-Study/1.0' }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to download blob: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;

        const sizeKB = (buffer.length / 1024).toFixed(2);
        console.log(`✅ Image converted to base64 (${sizeKB} KB)`);
        if (res) streamLog(res, `✅ Image converted to base64 (${sizeKB} KB)`);

        console.log(`📝 Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"`);

        return {
            dataUrl,
            base64,
            size: buffer.length,
            sizeKB,
            format: 'base64'
        };

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Image download timeout (30s)');
        }
        throw error;
    }
}

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

        console.log('🔍 Classifying user intent...');

        // Build classification prompt based on context
        const prompt = buildClassificationPrompt(userMessage, imageContext);
        const messages = [{ sender: 'User', content: prompt }];

        // Get classification (no system prompt - critical for accuracy)
        const classification = await classifier.getCompletion(messages, 'gpt-3.5-turbo-0125', {
            includeSystemPrompt: false
        });

        const result = parseClassificationResult(classification.trim().toUpperCase(), imageContext);
        console.log(`✅ Intent classified as: ${result}`);
        return result;

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
        const enhancedPrompt = await enhanceImagePrompt(userMessage, model, imageContext, intent, res);

        // Step 2: Generate image with DALL-E
        const imageHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        console.log('🎨 Requesting image from DALL-E...');
        streamLog(res, '🎨 Requesting image from DALL-E...');

        const promptPreview = `${enhancedPrompt.substring(0, 100)}${enhancedPrompt.length > 100 ? '...' : ''}`;
        console.log(`📝 Enhanced prompt: "${promptPreview}"`);
        streamLog(res, `📝 Enhanced prompt: "${promptPreview}"`);

        const imageResult = await imageHandler.generateImage(enhancedPrompt);

        if (!imageResult?.success || !imageResult?.url) {
            throw new Error('Image generation failed or returned no URL');
        }

        console.log('✅ DALL-E returned blob URL');
        streamLog(res, '✅ DALL-E returned blob URL');

        // Step 2.5: Download and convert blob to base64 (BLOCKING - critical!)
        console.log('🔄 Converting blob to base64 data URL...');
        streamLog(res, '🔄 Converting blob to base64 data URL...');

        const imageData = await downloadAndConvertToBase64(imageResult.url, userMessage, res);

        // Step 3: Send response to client with base64 data URL
        const responseMessage = intent === 'modify_image'
            ? `I've modified the image based on your request:\n\n![Generated Image](${imageData.dataUrl})`
            : `I've generated an image for you:\n\n![Generated Image](${imageData.dataUrl})`;

        const responseData = {
            type: 'content',
            content: responseMessage,
            fullContent: responseMessage,
            imageUrl: imageData.dataUrl,  // ✅ Now base64 data URL, not blob
            imageFormat: 'base64',
            imageSize: imageData.sizeKB,
            imagePrompt: enhancedPrompt,
            originalPrompt: userMessage,
            revisedPrompt: imageResult.revisedPrompt
        };

        streamLog(res, `✅ Image response sent (${imageData.sizeKB} KB base64)`);

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
async function enhanceImagePrompt(userMessage, model, imageContext, intent, res = null) {
    console.log(`🔄 Enhancing prompt with ${model}...`);
    if (res) streamLog(res, `🔄 Enhancing prompt with ${model}...`);

    const enhancementPrompt = buildEnhancementPrompt(userMessage, imageContext, intent);
    const messages = [{ sender: 'User', content: enhancementPrompt }];

    // Use appropriate handler based on model type
    const handler = getModelType(model) === 'claude'
        ? new ClaudeHandler(process.env.ANTHROPIC_API_KEY)
        : new OpenAIHandler(process.env.OPENAI_API_KEY);

    const enhancedPrompt = await handler.getCompletion(messages, model);

    console.log('✅ Prompt enhancement complete');
    if (res) streamLog(res, '✅ Prompt enhancement complete');

    return enhancedPrompt.trim();
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
async function streamRegularChat(messages, model, res) {
    res.write(`data: ${JSON.stringify({ type: 'typing_start' })}\n\n`);

    const modelType = getModelType(model);
    const handler = modelType === 'claude'
        ? new ClaudeHandler(process.env.ANTHROPIC_API_KEY)
        : new OpenAIHandler(process.env.OPENAI_API_KEY);

    for await (const chunk of handler.streamChat(messages, model)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.type === 'done' || chunk.type === 'error') break;
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