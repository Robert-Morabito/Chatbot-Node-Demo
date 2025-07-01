import express from 'express';
import { OpenAIHandler } from '../handlers/openaiHandler.js';

const router = express.Router();

// NO handler creation here - we'll create it inside each route

/**
 * POST /api/chat/stream
 * Streaming chat endpoint
 */
router.post('/stream', async (req, res) => {
    try {
        // Create handler here where we're sure env vars are loaded
        console.log('🔑 Creating OpenAI handler with key:', process.env.OPENAI_API_KEY ? 
            `${process.env.OPENAI_API_KEY.substring(0, 8)}...${process.env.OPENAI_API_KEY.slice(-4)}` : 
            'undefined');
            
        const openaiHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        
        const { messages, model, conversationId } = req.body;
        
        // Validate request
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages array is required' });
        }
        
        if (!model) {
            return res.status(400).json({ error: 'Model is required' });
        }
        
        // Set up Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Send initial connection confirmation
        res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);
        
        console.log(`🌊 Starting stream for conversation: ${conversationId}, model: ${model}`);
        
        // Process the streaming response
        try {
            for await (const chunk of openaiHandler.chatStream(messages, model)) {
                // Send each chunk to the client
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                
                // If stream is done or error, break
                if (chunk.type === 'done' || chunk.type === 'error') {
                    break;
                }
            }
        } catch (streamError) {
            console.error('Stream processing error:', streamError);
            res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                error: 'Stream processing failed',
                details: streamError.message 
            })}\n\n`);
        }
        
        // End the stream
        res.write(`data: ${JSON.stringify({ type: 'stream_end' })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error('Chat stream endpoint error:', error);
        
        // Send error if headers haven't been sent yet
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to process chat request',
                details: error.message 
            });
        } else {
            // Send error through stream
            res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                error: 'Server error occurred',
                details: error.message 
            })}\n\n`);
            res.end();
        }
    }
});

/**
 * POST /api/chat
 * Non-streaming chat endpoint (fallback)
 */
router.post('/', async (req, res) => {
    try {
        // Create handler here where we're sure env vars are loaded
        const openaiHandler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        
        const { messages, model, conversationId } = req.body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages array is required' });
        }
        
        if (!model) {
            return res.status(400).json({ error: 'Model is required' });
        }
        
        console.log(`💬 Non-streaming chat for conversation: ${conversationId}, model: ${model}`);
        
        const response = await openaiHandler.chat(messages, model);
        
        res.json({
            success: true,
            response: response,
            conversationId: conversationId,
            model: model
        });
        
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({ 
            error: 'Failed to process chat request',
            details: error.message 
        });
    }
});

export { router as chatRouter };