import express from 'express';
import { OpenAIHandler } from '../handlers/openaiHandler.js';

const router = express.Router();

// Image detection utilities
const IMAGE_KEYWORDS = [
    'generate an image', 'create an image', 'draw', 'make a picture',
    'generate a picture', 'create a picture', 'image of', 'picture of',
    'draw me', 'show me a picture', 'visualize', 'illustrate',
    'make an image', 'create a visual', 'show me an image'
];

function isImageRequest(message) {
    const content = message.toLowerCase();
    return IMAGE_KEYWORDS.some(keyword => content.includes(keyword));
}

function extractImagePrompt(message) {
    let prompt = message;
    
    // Remove common prefixes
    const prefixes = [
        'generate an image of', 'create an image of', 'draw me',
        'make a picture of', 'generate a picture of', 'create a picture of',
        'show me a picture of', 'image of', 'picture of', 'draw',
        'generate an image', 'create an image', 'make a picture',
        'show me a picture', 'visualize', 'illustrate',
        'make an image of', 'create a visual of'
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

router.post('/stream', async (req, res) => {
    console.log('🚀 [Chat Route] Stream endpoint hit');
    
    try {
        const { messages, model, sessionId, conversationId } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        const lastMessage = messages[messages.length - 1];
        console.log('📨 [Chat Route] Last message:', lastMessage);

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

        // Check if this is an image request
        if (lastMessage?.sender === 'User' && isImageRequest(lastMessage.content)) {
            console.log('🎨 [Chat Route] Image request detected!');
            
            res.write(`data: ${JSON.stringify({ type: 'image_request_detected' })}\n\n`);

            try {
                // Initialize OpenAI handler
                const openai = new OpenAIHandler(process.env.OPENAI_API_KEY);
                
                // Extract and clean the prompt
                const imagePrompt = extractImagePrompt(lastMessage.content);
                console.log('🖼️ [Chat Route] Image prompt:', imagePrompt);

                // Generate the image
                const result = await openai.generateImage(imagePrompt);
                
                // Create response with the image
                const imageResponse = `I've generated an image for you:\n\n![Generated Image](${result.url})\n\n*Prompt: "${imagePrompt}"*`;

                // Send the image response
                res.write(`data: ${JSON.stringify({
                    type: 'content',
                    content: imageResponse,
                    fullContent: imageResponse,
                    imageUrl: result.url
                })}\n\n`);

                res.write(`data: ${JSON.stringify({
                    type: 'done',
                    finishReason: 'image_generated'
                })}\n\n`);

            } catch (error) {
                console.error('❌ [Chat Route] Image generation error:', error);
                
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
        console.log('💬 [Chat Route] Regular chat request');
        
        const openai = new OpenAIHandler(process.env.OPENAI_API_KEY);
        
        // Stream the chat response
        for await (const chunk of openai.streamChat(messages, model)) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            
            if (chunk.type === 'done' || chunk.type === 'error') {
                break;
            }
        }

        res.end();

    } catch (error) {
        console.error('❌ [Chat Route] Stream error:', error);
        
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
    }
});

// Test endpoint for image generation
router.post('/test-image', async (req, res) => {
    console.log('🧪 [Chat Route] Testing image generation directly');
    
    try {
        const { prompt = "a cute cat playing with yarn" } = req.body;
        
        const openai = new OpenAIHandler(process.env.OPENAI_API_KEY);
        const result = await openai.generateImage(prompt);
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('❌ [Chat Route] Test image error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data || error
        });
    }
});

export { router as chatRouter };