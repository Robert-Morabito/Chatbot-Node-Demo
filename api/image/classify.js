import { OpenAIHandler } from '../../handlers/openaiHandler.js';

export default async function handler(req, res) {
    console.log('🔍 [Image Classify] Request received');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userMessage, hasImageContext } = req.body;
        
        console.log('🔍 [Image Classify] Processing:', {
            userMessage,
            hasImageContext
        });

        if (!userMessage) {
            return res.status(400).json({ error: 'userMessage is required' });
        }

        // Always use OpenAI for classification (reliable and fast)
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);

        // Create classification prompt
        let classificationPrompt;
        if (hasImageContext) {
            classificationPrompt = `The user previously generated an image. Now they said: "${userMessage}"

Does this message request:
- A NEW image (completely different subject)
- MODIFY the existing image (change color, add/remove elements, etc.)
- NEITHER (just regular conversation)

Respond with only: NEW, MODIFY, or NEITHER`;
        } else {
            classificationPrompt = `The user said: "${userMessage}"

Does this message request creating an image or picture?

Respond with only: YES or NO`;
        }

        // Create fake conversation for classification
        const messages = [
            { sender: 'User', content: classificationPrompt }
        ];

        console.log('🔍 [Image Classify] Classifying with GPT-3.5...');

        // Get classification using GPT-3.5 (fast and reliable)
        let classification = '';
        for await (const chunk of classifier.streamChat(messages, 'gpt-3.5-turbo-0125')) {
            if (chunk.type === 'content') {
                classification += chunk.content;
            } else if (chunk.type === 'done') {
                break;
            } else if (chunk.type === 'error') {
                throw new Error(chunk.error);
            }
        }

        // Clean up classification
        classification = classification.trim().toUpperCase();
        console.log('🔍 [Image Classify] Raw classification:', classification);

        // Determine intent
        let intent;
        if (hasImageContext) {
            if (classification.includes('NEW')) {
                intent = 'new_image';
            } else if (classification.includes('MODIFY')) {
                intent = 'modify_image';
            } else {
                intent = 'none';
            }
        } else {
            if (classification.includes('YES')) {
                intent = 'new_image';
            } else {
                intent = 'none';
            }
        }

        console.log('🔍 [Image Classify] Final intent:', intent);

        res.json({
            success: true,
            intent: intent,
            classification: classification,
            userMessage: userMessage
        });

    } catch (error) {
        console.error('❌ [Image Classify] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}