/**
 * Chat Streaming API
 * 
 * Main endpoint for handling chat conversations with LLM streaming responses.
 * Supports both regular text chat and image generation requests.
 * Routes image requests to specialized handlers while managing SSE streaming.
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
 * Handles potential image generation requests
 */
async function handleImageRequest(userMessage, imageContext, model, res) {
    try {
        // Call the dedicated classification endpoint
        const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/chat/imageHandler`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'classify', // or 'enhance'
                userPrompt: userMessage,
                hasImageContext: !!(imageContext?.lastPrompt)
            })
        });

        if (!response.ok) {
            throw new Error('Classification failed');
        }

        const classification = await response.json();

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
 * Generates images using the dedicated enhancement endpoint
 */
async function generateImage(userMessage, model, imageContext, intent, res) {
    try {
        // Call the dedicated enhancement endpoint
        const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/chat/imageHandler`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'enhance',
                userPrompt: userMessage,
                hasImageContext: !!(imageContext?.lastPrompt)
            })
        });

        if (!response.ok) {
            throw new Error('Prompt enhancement failed');
        }

        const enhancement = await response.json();

        // Generate image with DALL-E
        const imageHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        const imageResult = await imageHandler.generateImage(enhancement.enhancedPrompt);

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
            imagePrompt: enhancement.enhancedPrompt,
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