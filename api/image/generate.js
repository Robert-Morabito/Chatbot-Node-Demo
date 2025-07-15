/**
 * Image Generation Handler
 * Generates images using DALL-E based on enhanced prompts
 */

import { OpenAIHandler } from '../../handlers/openaiHandler.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { enhancedPrompt, originalPrompt, model } = req.body;

        if (!enhancedPrompt) {
            return res.status(400).json({ error: 'enhancedPrompt is required' });
        }

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        const openai = new OpenAIHandler(process.env.OPENAI_API_KEY);
        
        console.log('Generating image with DALL-E');
        const result = await openai.generateImage(enhancedPrompt);

        res.json({
            success: true,
            imageUrl: result.url,
            enhancedPrompt: enhancedPrompt,
            originalPrompt: originalPrompt,
            revisedPrompt: result.revisedPrompt,
            model: model
        });

    } catch (error) {
        console.error('Image generation error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}