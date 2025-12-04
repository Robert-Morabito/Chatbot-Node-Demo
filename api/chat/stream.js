/**
 * ===================================================================
 * CHAT STREAMING API WITH IMAGE GENERATION
 * ===================================================================
 * 
 * Main endpoint for handling chat conversations with integrated image generation.
 * Includes real-time message classification and DALL-E integration.
 * 
 * Flow:
 * 1. Validate request
 * 2. Check if image generation is needed (classify intent)
 * 3. Generate image with retry logic OR handle regular chat
 * 4. Stream response to client via SSE
 */

import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';
import GitHubStorage from '../../utils/githubStorage.js';

// ===================================================================
// CONFIGURATION
// ===================================================================

const VALID_MODELS = {
    openai: ['gpt-3.5-turbo-0125', 'gpt-4-0125-preview', 'gpt-5-2025-08-07'],
    claude: ['claude-3-haiku-20240307', '3-5-haiku-20241022', 'claude-sonnet-4-20250514']
};

// ===================================================================
// MAIN HANDLER
// ===================================================================

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

                // ✅ FIXED: Now properly passes req
                const imageGenerated = await generateImageWithRetry(
                    lastMessage.content,
                    model,
                    imageContext,
                    imageIntent,
                    res,
                    req,
                    3
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

// ===================================================================
// VALIDATION & SETUP FUNCTIONS
// ===================================================================

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

// ===================================================================
// ERROR HANDLING FUNCTIONS
// ===================================================================

/**
 * Classify DALL-E error for appropriate handling
 * @param {Error} error - Error object
 * @param {string} responseText - Response text if available
 * @returns {Object} Classification with type and user message
 */
function classifyImageError(error, responseText = '') {
    const message = error.message || responseText || '';

    // 500 Internal Server Error - OpenAI service issue
    if (message.includes('500') || message.includes('server had an error')) {
        return {
            type: 'transient',
            userMessage: "I'm having trouble generating the image right now. Let me try again...",
            shouldRetry: true,
            retryDelay: 2000
        };
    }

    // 429 Rate Limit
    if (message.includes('429') || message.includes('rate limit')) {
        return {
            type: 'rate_limit',
            userMessage: "I'm receiving too many requests right now. Let me try again in a moment...",
            shouldRetry: true,
            retryDelay: 3000
        };
    }

    // Content Policy Violation
    if (message.includes('content_policy') ||
        message.includes('content policy') ||
        message.includes('safety system') ||
        message.includes('violates our content policy')) {
        return {
            type: 'content_policy',
            userMessage: "I can't generate this image as it may violate content policy. Please try a different prompt that doesn't include harmful, illegal, or inappropriate content.",
            shouldRetry: false
        };
    }

    // 400 Bad Request - Usually prompt issue
    if (message.includes('400') || message.includes('bad request')) {
        return {
            type: 'bad_request',
            userMessage: "There's an issue with the image prompt. Please try rephrasing your request.",
            shouldRetry: false
        };
    }

    // Timeout
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
        return {
            type: 'timeout',
            userMessage: "The request timed out. Let me try again...",
            shouldRetry: true,
            retryDelay: 1000
        };
    }

    // Unknown error
    return {
        type: 'unknown',
        userMessage: "I encountered an error generating the image. Please try again.",
        shouldRetry: false
    };
}

/**
 * Simulate error for testing (only if X-Test-Error header is present)
 * @param {Request} req - Request object
 * @throws {Error} Simulated error based on header
 */
function simulateErrorIfTesting(req) {
    const testError = req.headers['x-test-error'];

    if (!testError || testError === 'none') return;

    console.log(`🧪 Simulating error: ${testError}`);

    switch (testError) {
        case '500':
            throw new Error('500 The server had an error processing your request. Sorry about that! You can retry your request, or contact us through our help center at help.openai.com if you keep seeing this error. (Please include the request ID req_test123 in your email.)');

        case 'content_policy':
            throw new Error('Your request was rejected as a result of our safety system. Your prompt may contain text that is not allowed by our safety system.');

        case 'rate_limit':
            throw new Error('429 Rate limit exceeded. Please try again later.');

        case 'bad_request':
            throw new Error('400 Bad request. The prompt may be invalid.');

        case 'timeout':
            throw new Error('Request timeout: ETIMEDOUT');

        default:
            return;
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

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

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
 * @param {Response} res - Response object for logging
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

// ===================================================================
// IMAGE CLASSIFICATION FUNCTIONS
// ===================================================================

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

// ===================================================================
// IMAGE GENERATION FUNCTIONS
// ===================================================================

/**
 * Generate image with retry logic
 * Handles transient errors automatically with exponential backoff
 * 
 * @param {string} userMessage - Original user message
 * @param {string} model - Model being used for enhancement
 * @param {Object} imageContext - Image context (for modifications)
 * @param {string} intent - Image intent (new_image or modify_image)
 * @param {Response} res - Response object for streaming
 * @param {Request} req - Request object (for error simulation testing)
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<boolean>} Success status
 */
async function generateImageWithRetry(userMessage, model, imageContext, intent, res, req, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🎨 Image generation attempt ${attempt}/${maxRetries}`);
            if (res) streamLog(res, `🎨 Attempt ${attempt}/${maxRetries}`);

            const success = await generateImage(
                userMessage,
                model,
                imageContext,
                intent,
                res,
                req,
                req.body?.participantId || 'unknown'
            );

            if (success) {
                if (attempt > 1) {
                    console.log(`✅ Succeeded on attempt ${attempt}`);
                    if (res) streamLog(res, `✅ Succeeded on attempt ${attempt}`);
                }
                return true;
            }

        } catch (error) {
            lastError = error;

            // Classify the error
            const classification = classifyImageError(error);

            console.log(`❌ Attempt ${attempt} failed:`, classification.type);
            if (res) streamLog(res, `❌ Attempt ${attempt} failed: ${classification.type}`);

            // If not retryable, fail immediately
            if (!classification.shouldRetry) {
                console.log('🛑 Non-retryable error, stopping');
                if (res) streamLog(res, `🛑 ${classification.userMessage}`);

                // Send error message to user
                const errorMessage = classification.userMessage;
                res.write(`data: ${JSON.stringify({
                    type: 'content',
                    content: errorMessage,
                    fullContent: errorMessage
                })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done', finishReason: 'error' })}\n\n`);

                return false;
            }

            // If retryable and not last attempt, wait and retry
            if (attempt < maxRetries) {
                const delay = classification.retryDelay || 2000;
                console.log(`⏳ Retrying in ${delay}ms...`);
                if (res) streamLog(res, `⏳ Retrying in ${delay}ms...`);

                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // Last attempt failed
                console.log('🛑 All retry attempts exhausted');
                if (res) streamLog(res, '🛑 All retry attempts exhausted');

                const errorMessage = `I apologize, but I'm unable to generate the image after multiple attempts. Please try again later or with a different prompt.`;
                res.write(`data: ${JSON.stringify({
                    type: 'content',
                    content: errorMessage,
                    fullContent: errorMessage
                })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done', finishReason: 'error' })}\n\n`);

                return false;
            }
        }
    }

    return false;
}

/**
 * Generates image using DALL-E with prompt enhancement
 * Immediately uploads to GitHub and returns filename reference
 * 
 * @param {string} userMessage - Original user message
 * @param {string} model - Model for enhancement
 * @param {Object} imageContext - Image context
 * @param {string} intent - new_image or modify_image
 * @param {Response} res - Response object
 * @param {Request} req - Request object (for error simulation)
 * @param {string} participantId - Participant ID for filename
 * @param {string} conversationId - Conversation ID for chat number
 * @returns {Promise<boolean>} Success status
 */
async function generateImage(userMessage, model, imageContext, intent, res, req = null, participantId = null) {
    try {
        // Simulate error if testing
        if (req) {
            simulateErrorIfTesting(req);
        }

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

        // Step 3: Download and convert blob to base64
        console.log('🔄 Converting blob to base64...');
        streamLog(res, '🔄 Converting blob to base64...');

        const imageData = await downloadAndConvertToBase64(imageResult.url, userMessage, res);

        // Step 4: Generate filename and upload to GitHub immediately
        const filename = generateImageFilename(participantId, imageContext);

        console.log(`☁️ Uploading to GitHub as: ${filename}`);
        streamLog(res, `☁️ Uploading to GitHub as: ${filename}`);

        const githubStorage = new GitHubStorage();
        await githubStorage.uploadImageDirect(participantId, filename, imageData.base64);

        console.log(`✅ Image uploaded to GitHub: ${filename}`);
        streamLog(res, `✅ Image uploaded to GitHub: ${filename}`);

        // Step 5: Send response with BOTH data URL (for display) and filename (for saving)
        const responseMessage = intent === 'modify_image'
            ? `I've modified the image based on your request:\n\n![Generated Image](${imageData.dataUrl})`
            : `I've generated an image for you:\n\n![Generated Image](${imageData.dataUrl})`;

        const responseData = {
            type: 'content',
            content: responseMessage,
            fullContent: responseMessage,
            imageUrl: imageData.dataUrl,      // ✅ Data URL for display
            imageFilename: filename,           // ✅ Filename for saving
            imageFormat: 'png',
            imageSize: imageData.sizeKB,
            imagePrompt: enhancedPrompt,
            originalPrompt: userMessage,
            revisedPrompt: imageResult.revisedPrompt,
            githubPath: `images/${participantId}/${filename}`
        };

        console.log(`✅ Image response sent with filename: ${filename}`);
        streamLog(res, `✅ Image response sent with filename: ${filename}`);

        res.write(`data: ${JSON.stringify(responseData)}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', finishReason: 'image_generated' })}\n\n`);

        return true;

    } catch (error) {
        console.error('❌ Image generation error:', error.message);
        if (res) streamLog(res, `❌ Error: ${error.message}`);

        // Re-throw so retry handler can classify and handle
        throw error;
    }
}

/**
 * Generate standardized image filename
 * Format: {participantId}_chat{n}_msg{m}.png
 */
function generateImageFilename(participantId, imageContext) {
    const chatNumber = imageContext?.chatNumber || 1;
    const messageNumber = imageContext?.messageNumber || 1;

    console.log(`📝 Generating filename: ${participantId}_chat${chatNumber}_msg${messageNumber}.png`);

    return `${participantId}_chat${chatNumber}_msg${messageNumber}.png`;
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

// ===================================================================
// REGULAR CHAT FUNCTIONS
// ===================================================================

/**
 * Handles regular chat streaming (non-image generation)
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

// ===================================================================
// VERCEL CONFIG
// ===================================================================

export const config = {
    api: {
        bodyParser: { sizeLimit: '10mb' },
        responseLimit: false,
    },
};