import { OpenAIHandler } from '../../handlers/openaiHandler.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // For now, return a simple mock response
        const { messages } = req.body;
        
        const mockResponse = "This is a test response from the API. Your message was: " + 
                           (messages && messages.length > 0 ? messages[messages.length - 1].content : "No message");

        res.json({
            success: true,
            response: mockResponse,
            model: "gpt-4-turbo"
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Failed to process chat',
            details: error.message 
        });
    }
}