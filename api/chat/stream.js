/**
 * Chat Streaming API
 * 
 * Main endpoint for handling chat conversations with LLM streaming responses.
 * Supports both regular text chat and image generation requests.
 * Uses direct function calls for image processing (no HTTP calls).
 */

import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';

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

        // Validate required fields
        if (!messages?.length || !model) {
            return res.status(400).json({ error: 'Messages array and model are required' });
        }

        // Set up SSE headers
        setupSSEHeaders(res);
        res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

        const lastMessage = messages[messages.length - 1];
        const currentTask = conversationId ? conversationId.split('_')[0] : 'unknown';

        // Check for image generation requests
        if (shouldCheckForImageIntent(lastMessage, currentTask)) {
            const imageResult = await handleImageRequest(
                lastMessage.content,
                imageContext,
                model,
                res
            );

            if (imageResult) {
                res.end();
                return;
            }
        }

        // Handle regular chat
        await handleRegularChat(messages, model, res);
        res.end();

    } catch (error) {
        console.error('Stream handler error:', error.message);
        handleStreamError(res, error);
    }
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
 * Determines if we should check for image generation intent
 */
function shouldCheckForImageIntent(lastMessage, currentTask) {
    return lastMessage?.sender === 'User' && currentTask === 'image-generation';
}

/**
 * Handles image generation requests using DIRECT function calls
 */
async function handleImageRequest(userMessage, imageContext, model, res) {
    try {
        // DIRECT classification (no HTTP call)
        const classification = await classifyImageIntent(userMessage, !!(imageContext?.lastPrompt));

        if (classification.intent === 'new_image' || classification.intent === 'modify_image') {
            res.write(`data: ${JSON.stringify({ type: 'image_request_detected' })}\n\n`);
            return await generateImage(userMessage, model, imageContext, classification.intent, res);
        }

        return false;

    } catch (error) {
        console.error('Image classification error:', error.message);
        return false;
    }
}

/**
 * Direct image classification (inline, no HTTP call)
 */
async function classifyImageIntent(userMessage, hasImageContext) {
    if (!process.env.OPENAI_API_KEY) {
        return { intent: 'none', error: 'No OpenAI API key' };
    }

    const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);

    // Create classification prompt
    const classificationPrompt = hasImageContext
        ? createModificationClassificationPrompt(userMessage)
        : createNewImageClassificationPrompt(userMessage);

    const messages = [{ sender: 'User', content: classificationPrompt }];

    // Use NO system prompt for better classification accuracy
    let classification = '';
    for await (const chunk of classifier.streamChat(messages, 'gpt-3.5-turbo-0125', {
        includeSystemPrompt: false
    })) {
        if (chunk.type === 'content') {
            classification += chunk.content;
        } else if (chunk.type === 'done') {
            break;
        } else if (chunk.type === 'error') {
            throw new Error(chunk.error);
        }
    }

    classification = classification.trim().toUpperCase();
    const intent = determineIntent(classification, hasImageContext);

    return { intent, classification, userMessage };
}

/**
 * Direct prompt enhancement (inline, no HTTP call)
 */
async function enhancePrompt(userPrompt, model, previousPrompt, modificationType) {
    const enhancementPrompt = modificationType === 'modification' && previousPrompt
        ? createModificationPrompt(userPrompt, previousPrompt)
        : createNewImagePrompt(userPrompt);

    const messages = [{ sender: 'User', content: enhancementPrompt }];
    const handler = createModelHandler(model);

    let enhancedPrompt = '';
    for await (const chunk of handler.streamChat(messages, model)) {
        if (chunk.type === 'content') {
            enhancedPrompt += chunk.content;
        } else if (chunk.type === 'done') {
            break;
        } else if (chunk.type === 'error') {
            throw new Error(chunk.error);
        }
    }

    return enhancedPrompt.trim();
}

/**
 * Generates images using DIRECT function calls
 */
async function generateImage(userMessage, model, imageContext, intent, res) {
    try {
        // DIRECT enhancement (no HTTP call)
        const enhancedPrompt = await enhancePrompt(
            userMessage,
            model,
            imageContext?.lastPrompt,
            intent === 'modify_image' ? 'modification' : 'new'
        );

        // Generate image with DALL-E
        const imageHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        const imageResult = await imageHandler.generateImage(enhancedPrompt);

        if (!imageResult?.success || !imageResult.url) {
            throw new Error('Image generation failed');
        }

        // Send successful response
        const responseMessage = intent === 'modify_image'
            ? `I've modified the image based on your request:\n\n![Generated Image](${imageResult.url})`
            : `I've generated an image for you:\n\n![Generated Image](${imageResult.url})`;

        res.write(`data: ${JSON.stringify({
            type: 'content',
            content: responseMessage,
            fullContent: responseMessage,
            imageUrl: imageResult.url,
            imagePrompt: enhancedPrompt,
            originalPrompt: userMessage,
            revisedPrompt: imageResult.revisedPrompt
        })}\n\n`);

        res.write(`data: ${JSON.stringify({
            type: 'done',
            finishReason: 'image_generated'
        })}\n\n`);

        return true;

    } catch (error) {
        console.error('Image generation error:', error.message);

        res.write(`data: ${JSON.stringify({
            type: 'content',
            content: `I apologize, but I couldn't generate the image. Error: ${error.message}`,
            fullContent: `I apologize, but I couldn't generate the image. Error: ${error.message}`
        })}\n\n`);

        res.write(`data: ${JSON.stringify({
            type: 'done',
            finishReason: 'error'
        })}\n\n`);

        return true;
    }
}

// Helper functions (same as before)
function createNewImageClassificationPrompt(userMessage) {
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

function createModificationClassificationPrompt(userMessage) {
    return `The user previously generated an image. Now they said: "${userMessage}"

    Analyze what the user wants:
    - If they want a completely NEW/DIFFERENT image, respond: NEW
    - If they want to MODIFY/CHANGE the existing image (color, size, add/remove things), respond: MODIFY  
    - If they're just having normal conversation, respond: NEITHER

    Respond with only one word: NEW, MODIFY, or NEITHER`;
}

function createNewImagePrompt(userPrompt) {
    return `User wants: "${userPrompt}"

    Create a natural DALL-E prompt like ChatGPT would. Keep it concise but effective - add key details for quality (good lighting, clear subject) but don't over-describe.

    Only respond with the prompt:`;
}

function createModificationPrompt(userPrompt, previousPrompt) {
    return `Previous DALL-E prompt: "${previousPrompt}"

    User wants to modify it: "${userPrompt}"

    Create an updated DALL-E prompt that applies the user's modification. Keep it natural and concise like ChatGPT would - don't over-describe.

    Only response with the new prompt:`;
}

function determineIntent(classification, hasImageContext) {
    if (hasImageContext) {
        if (classification.includes('NEW')) return 'new_image';
        if (classification.includes('MODIFY')) return 'modify_image';
        return 'none';
    } else {
        return classification.includes('YES') ? 'new_image' : 'none';
    }
}

/**
 * Handles regular text chat with LLM streaming
 */
async function handleRegularChat(messages, model, res) {
    res.write(`data: ${JSON.stringify({ type: 'typing_start' })}\n\n`);

    const validation = validateModel(model);
    if (!validation.isValid) {
        throw new Error(`Invalid model: ${model}`);
    }

    // Create appropriate handler
    const handler = createModelHandler(validation.type);

    // Stream the response
    for await (const chunk of handler.streamChat(messages, model)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);

        if (chunk.type === 'done' || chunk.type === 'error') {
            break;
        }
    }
}

/**
 * Validates the requested model
 */
function validateModel(model) {
    for (const [type, models] of Object.entries(VALID_MODELS)) {
        if (models.includes(model)) {
            return { isValid: true, type };
        }
    }
    return { isValid: false, type: 'unknown' };
}

/**
 * Creates the appropriate model handler
 */
function createModelHandler(type) {
    switch (type) {
        case 'claude':
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key not configured');
            }
            return new ClaudeHandler(process.env.ANTHROPIC_API_KEY);

        case 'openai':
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API key not configured');
            }
            return new OpenAIHandler(process.env.OPENAI_API_KEY);

        default:
            throw new Error(`Unsupported model type: ${type}`);
    }
}

/**
 * Handles streaming errors
 */
function handleStreamError(res, error) {
    if (!res.headersSent) {
        res.status(500).json({ error: error.message });
    } else {
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
        })}\n\n`);
        res.end();
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
        responseLimit: false,
    },
};