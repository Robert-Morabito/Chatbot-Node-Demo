import express from 'express';
import { OpenAIHandler } from '../handlers/openaiHandler.js';

const router = express.Router();

// Image detection utilities
const GENERATION_KEYWORDS = [
    'generate an image', 'create an image', 'draw', 'make a picture',
    'generate a picture', 'create a picture', 'image of', 'picture of',
    'draw me', 'show me a picture', 'visualize', 'illustrate',
    'make an image', 'create a visual', 'show me an image'
];

const MODIFICATION_KEYWORDS = [
    'make it', 'make the', 'make them', 'make this',
    'change it', 'change the', 'change them',
    'turn it', 'turn the', 'turn them',
    'color it', 'color the', 'paint it', 'paint the',
    'add', 'remove', 'delete', 'include', 'exclude',
    'with', 'without', 'but with', 'now with',
    'more', 'less', 'bigger', 'smaller', 'larger',
    'brighter', 'darker', 'lighter',
    'in the style', 'style of', 'like',
    'modify', 'adjust', 'update', 'alter', 'transform',
    'redo', 'remake', 'regenerate', 'try again',
    'different', 'another', 'instead'
];

const COLOR_WORDS = [
    'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown',
    'black', 'white', 'gray', 'grey', 'silver', 'gold', 'cyan', 'magenta',
    'maroon', 'navy', 'olive', 'lime', 'aqua', 'teal', 'fuchsia'
];

function detectImageIntent(message, imageContext = {}) {
    const content = message.toLowerCase().trim();

    console.log('🔍 Detecting image intent for:', content);
    console.log('📦 With context:', imageContext);

    // Check direct generation
    const isDirectGeneration = GENERATION_KEYWORDS.some(keyword =>
        content.includes(keyword)
    );

    if (isDirectGeneration) {
        console.log('✅ Direct generation detected');
        return { isImageRequest: true, type: 'new' };
    }

    // If we have previous image context, check for modifications
    if (imageContext?.lastPrompt) {
        console.log('🖼️ Previous image context exists:', imageContext.lastPrompt);

        const hasModificationKeyword = MODIFICATION_KEYWORDS.some(keyword =>
            content.includes(keyword)
        );

        const startsWithModificationVerb = /^(make|change|turn|color|paint|add|remove|adjust|modify)/.test(content);
        const hasColorWord = COLOR_WORDS.some(color => content.includes(color));
        const isShortDirective = content.split(' ').length <= 5 && (hasColorWord || hasModificationKeyword);

        if (hasModificationKeyword || startsWithModificationVerb || isShortDirective) {
            console.log('✅ Modification detected');
            return { isImageRequest: true, type: 'modification' };
        }
    }

    console.log('❌ No image intent detected');
    return { isImageRequest: false, type: 'none' };
}

function extractImagePrompt(message) {
    let prompt = message;

    const prefixes = [
        'generate an image of', 'create an image of', 'draw me',
        'make a picture of', 'generate a picture of', 'create a picture of',
        'show me a picture of', 'image of', 'picture of', 'draw',
        'generate an image', 'create an image', 'make a picture',
        'show me a picture', 'visualize', 'illustrate'
    ];

    for (const prefix of prefixes) {
        const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
        if (regex.test(prompt)) {
            prompt = prompt.replace(regex, '').trim();
            break;
        }
    }

    return prompt || message;
}

function mergePromptWithModification(basePrompt, modification) {
    const modLower = modification.toLowerCase();

    console.log('🔄 Merging:', { basePrompt, modification });

    // Handle color changes specifically
    const colorMatch = modLower.match(/make (?:it|the|them|this) (\w+)/);
    if (colorMatch && COLOR_WORDS.includes(colorMatch[1])) {
        return `${basePrompt}, but ${colorMatch[1]} colored`;
    }

    // Handle "make the X Y" pattern
    const makeTheMatch = modLower.match(/make the (\w+) (\w+)/);
    if (makeTheMatch) {
        return `${basePrompt}, but make the ${makeTheMatch[1]} ${makeTheMatch[2]}`;
    }

    // Handle other patterns
    if (modLower.startsWith('make it ')) {
        const change = modification.replace(/make it /i, '');
        return `${basePrompt}, but ${change}`;
    }

    if (modLower.startsWith('add ')) {
        return `${basePrompt}, ${modification}`;
    }

    if (modLower.startsWith('with ')) {
        return `${basePrompt} ${modification}`;
    }

    if (modLower.includes('without') || modLower.includes('remove')) {
        return `${basePrompt}, ${modification}`;
    }

    // For simple color words, assume it's a modification
    if (COLOR_WORDS.some(color => modLower === color || modLower === `${color} one`)) {
        return `${basePrompt}, but ${modification}`;
    }

    // Default: treat as instruction
    return `${basePrompt}, ${modification}`;
}

router.post('/stream', async (req, res) => {
    console.log('🚀 [Express Route] Stream endpoint hit');
    console.log('📦 Request body:', req.body);
    
    try {
        const { messages, model, sessionId, conversationId, imageContext } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        const lastMessage = messages[messages.length - 1];
        console.log('💬 Last message:', lastMessage);

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

        // Detect image intent with context
        const imageIntent = detectImageIntent(lastMessage?.content || '', imageContext);
        console.log('🔍 Image intent:', imageIntent);

        if (lastMessage?.sender === 'User' && imageIntent.isImageRequest) {
            console.log('🎨 Image generation request! Type:', imageIntent.type);

            res.write(`data: ${JSON.stringify({ type: 'image_request_detected' })}\n\n`);

            try {
                const apiKey = process.env.OPENAI_API_KEY;
                if (!apiKey) {
                    throw new Error('OpenAI API key not configured');
                }

                const openai = new OpenAIHandler(apiKey);
                let finalPrompt;

                if (imageIntent.type === 'modification' && imageContext?.lastPrompt) {
                    console.log('🔄 Modifying previous prompt:', imageContext.lastPrompt);
                    finalPrompt = mergePromptWithModification(imageContext.lastPrompt, lastMessage.content);
                } else {
                    finalPrompt = extractImagePrompt(lastMessage.content);
                }

                console.log('🖼️ Final prompt:', finalPrompt);

                const result = await openai.generateImage(finalPrompt);

                let imageResponse;
                if (imageIntent.type === 'modification') {
                    imageResponse = `I've modified the image based on your request:\n\n![Generated Image](${result.url})\n\n*Updated prompt: "${finalPrompt}"*`;
                } else {
                    imageResponse = `I've generated an image for you:\n\n![Generated Image](${result.url})\n\n*Prompt: "${finalPrompt}"*`;
                }

                res.write(`data: ${JSON.stringify({
                    type: 'content',
                    content: imageResponse,
                    fullContent: imageResponse,
                    imageUrl: result.url,
                    imagePrompt: finalPrompt,
                    revisedPrompt: result.revisedPrompt || finalPrompt
                })}\n\n`);

                res.write(`data: ${JSON.stringify({
                    type: 'done',
                    finishReason: 'image_generated'
                })}\n\n`);

            } catch (error) {
                console.error('❌ Image generation error:', error);

                const errorMessage = `I apologize, but I couldn't generate the image. Error: ${error.message}`;

                res.write(`data: ${JSON.stringify({
                    type: 'content',
                    content: errorMessage,
                    fullContent: errorMessage
                })}\n\n`);

                res.write(`data: ${JSON.stringify({
                    type: 'done',
                    finishReason: 'error'
                })}\n\n`);
            }

            res.end();
            return;
        }

        // Regular chat request
        console.log('💬 Processing regular chat request');

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const openai = new OpenAIHandler(apiKey);

        // Use streamChat for all models (temporarily use OpenAI for all)
        for await (const chunk of openai.streamChat(messages, model)) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);

            if (chunk.type === 'done' || chunk.type === 'error') {
                break;
            }
        }

        res.end();

    } catch (error) {
        console.error('❌ [Express Route] Stream error:', error);
        
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
    }
});

export { router as chatRouter };