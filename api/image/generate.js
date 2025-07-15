import { OpenAIHandler } from '../../handlers/openaiHandler.js';

export default async function handler(req, res) {
    console.log('🖼️ [Image Generate] Request received');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { enhancedPrompt, originalPrompt, model } = req.body;
        
        console.log('🖼️ [Image Generate] Processing:', {
            enhancedPrompt,
            originalPrompt,
            model
        });

        if (!enhancedPrompt) {
            return res.status(400).json({ error: 'enhancedPrompt is required' });
        }

        // Always use OpenAI for image generation (DALL-E)
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        const openai = new OpenAIHandler(process.env.OPENAI_API_KEY);
        
        console.log('🖼️ [Image Generate] Generating with DALL-E...');
        const result = await openai.generateImage(enhancedPrompt);

        console.log('🖼️ [Image Generate] Success! Image URL:', result.url);

        res.json({
            success: true,
            imageUrl: result.url,
            enhancedPrompt: enhancedPrompt,
            originalPrompt: originalPrompt,
            revisedPrompt: result.revisedPrompt,
            model: model
        });

    } catch (error) {
        console.error('❌ [Image Generate] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}