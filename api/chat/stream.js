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

            // In the main handler function, update the call to generateImage:
            if (imageIntent === 'new_image' || imageIntent === 'modify_image') {
                res.write(`data: ${JSON.stringify({ type: 'image_request_detected' })}\n\n`);

                // Calculate chat and message numbers
                const chatNumber = messages.filter(m => m.sender === 'User').length; // Rough estimate
                const messageNumber = messages.length + 1;

                const conversationContext = {
                    participantId: sessionId || 'unknown', // You may need to pass this from request
                    chatNumber,
                    messageNumber
                };

                const imageGenerated = await generateImage(
                    lastMessage.content,
                    model,
                    imageContext,
                    imageIntent,
                    res,
                    conversationContext // Add this parameter
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
 * Detect if DALL-E returned an error message instead of generating an image
 */
function detectImageErrorInText(text) {
    const errorPatterns = [
        /i\s+cannot\s+generate/i,
        /i'm\s+unable\s+to\s+create/i,
        /i\s+can't\s+create/i,
        /i\s+apologize.*cannot/i,
        /unable\s+to\s+generate/i,
        /failed\s+to\s+generate/i,
        /couldn't\s+generate/i
    ];

    // Content policy is legitimate feedback - should be shown to user
    const contentPolicyPatterns = [
        /content\s+policy/i,
        /violates.*policy/i,
        /against.*guidelines/i,
        /inappropriate.*request/i
    ];

    // Check if it's a content policy violation (don't retry these)
    const isContentPolicy = contentPolicyPatterns.some(pattern => pattern.test(text));

    // Check if it's a generation error (retry these)
    const isGenerationError = errorPatterns.some(pattern => pattern.test(text));

    return {
        isError: isGenerationError || isContentPolicy,
        isContentPolicy,
        shouldRetry: isGenerationError && !isContentPolicy
    };
}

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(imageUrl) {
    try {
        console.log('📥 Downloading image from DALL-E...');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'ChatBot-Study/1.0'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;

        console.log(`✅ Image downloaded and converted to base64 (${(base64.length / 1024).toFixed(2)} KB)`);

        return {
            dataUrl,
            base64,
            sizeKB: base64.length / 1024
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Image download timeout');
        }
        throw error;
    }
}

/**
 * Generate filename for image with consistent naming
 */
function generateImageFilename(participantId, chatNumber, messageNumber) {
    return `${participantId}_chat${chatNumber}_msg${messageNumber}_image.png`;
}

/**
 * Generates image using DALL-E with error handling and retry logic
 */
async function generateImage(userMessage, model, imageContext, intent, res, conversationContext) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRIES) {
        attempt++;

        try {
            console.log(`🎨 Image generation attempt ${attempt}/${MAX_RETRIES}`);

            // Step 1: Enhance the prompt using the assigned model
            const enhancedPrompt = await enhanceImagePrompt(userMessage, model, imageContext, intent);

            // Step 2: Generate image with DALL-E
            const imageHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
            const imageResult = await imageHandler.generateImage(enhancedPrompt);

            if (!imageResult?.success || !imageResult?.url) {
                throw new Error('Image generation failed or returned no URL');
            }

            // Step 3: Check if the result is actually an error message
            const errorCheck = detectImageErrorInText(imageResult.revisedPrompt || enhancedPrompt);

            if (errorCheck.isError) {
                if (errorCheck.isContentPolicy) {
                    // Content policy violation - show to user, don't retry
                    console.log('⚠️ Content policy violation detected');
                    const errorMessage = `I cannot generate that image as it may violate content policy guidelines. Please try a different prompt.`;

                    res.write(`data: ${JSON.stringify({
                        type: 'content',
                        content: errorMessage,
                        fullContent: errorMessage
                    })}\n\n`);
                    res.write(`data: ${JSON.stringify({ type: 'done', finishReason: 'content_policy' })}\n\n`);

                    return true;
                }

                if (errorCheck.shouldRetry && attempt < MAX_RETRIES) {
                    // Retry-able error
                    console.log(`⚠️ Generation error detected, retrying in ${RETRY_DELAY}ms...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    continue; // Retry
                }
            }

            // Step 4: Download and convert to base64
            console.log('📥 Converting image to base64...');
            const imageData = await downloadImageAsBase64(imageResult.url);

            // Step 5: Generate consistent filename
            const { participantId, chatNumber, messageNumber } = conversationContext || {};
            const filename = generateImageFilename(
                participantId || 'unknown',
                chatNumber || 1,
                messageNumber || 1
            );

            console.log(`📝 Image filename: ${filename}`);

            // Step 6: Send response to client with base64 data
            const responseMessage = intent === 'modify_image'
                ? `I've modified the image based on your request:\n\n![Generated Image](${imageData.dataUrl})`
                : `I've generated an image for you:\n\n![Generated Image](${imageData.dataUrl})`;

            const responseData = {
                type: 'content',
                content: responseMessage,
                fullContent: responseMessage,
                imageData: imageData.dataUrl, // Base64 data URL
                imageFilename: filename,
                imagePrompt: enhancedPrompt,
                originalPrompt: userMessage,
                revisedPrompt: imageResult.revisedPrompt,
                sizeKB: imageData.sizeKB
            };

            res.write(`data: ${JSON.stringify(responseData)}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'done', finishReason: 'image_generated' })}\n\n`);

            // Step 7: Save to GitHub asynchronously (don't block response)
            saveImageToGitHub(participantId, filename, imageData.base64).catch(error => {
                console.error('⚠️ Async GitHub save failed:', error.message);
                // Log but don't fail the response - participant already has the image
            });

            return true;

        } catch (error) {
            lastError = error;
            console.error(`❌ Image generation attempt ${attempt} failed:`, error.message);

            if (attempt < MAX_RETRIES) {
                console.log(`⏳ Retrying in ${RETRY_DELAY}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }

    // All retries failed
    console.error('❌ All image generation attempts failed');

    const errorMessage = `I apologize, but I encountered an error while generating the image. Please try again with a different prompt. Error: ${lastError?.message || 'Unknown error'}`;
    res.write(`data: ${JSON.stringify({ type: 'content', content: errorMessage, fullContent: errorMessage })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done', finishReason: 'error' })}\n\n`);

    return false;
}

/**
 * Save image to GitHub asynchronously
 */
async function saveImageToGitHub(participantId, filename, base64Data) {
    try {
        const GitHubStorage = (await import('../../utils/githubStorage.js')).default;
        const storage = new GitHubStorage();

        await storage.saveImageDirect(participantId, filename, base64Data);
        console.log(`✅ Image saved to GitHub: ${filename}`);

    } catch (error) {
        console.error(`❌ GitHub image save failed for ${filename}:`, error.message);
        throw error;
    }
}

/**
 * Enhances user prompt for DALL-E using the assigned model
 */
async function enhanceImagePrompt(userMessage, model, imageContext, intent) {
    const enhancementPrompt = buildEnhancementPrompt(userMessage, imageContext, intent);
    const messages = [{ sender: 'User', content: enhancementPrompt }];

    // Use appropriate handler based on model type
    const handler = getModelType(model) === 'claude'
        ? new ClaudeHandler(process.env.ANTHROPIC_API_KEY)
        : new OpenAIHandler(process.env.OPENAI_API_KEY);

    const enhancedPrompt = await handler.getCompletion(messages, model);

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