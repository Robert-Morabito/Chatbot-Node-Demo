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

            Analyze what the user wants:
            - If they want a completely NEW/DIFFERENT image, respond: NEW
            - If they want to MODIFY/CHANGE the existing image (color, size, add/remove things), respond: MODIFY  
            - If they're just having normal conversation, respond: NEITHER

            Respond with only one word: NEW, MODIFY, or NEITHER`;
        } else {
            classificationPrompt = `The user said: "${userMessage}"

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

        console.log('🔍 [Image Classify] Classifying with GPT-3.5...');

        // Use simple completion instead of streaming
        const classification = await classifier.simpleCompletion(classificationPrompt, 'gpt-3.5-turbo-0125');

        // Clean up classification
        const cleanClassification = classification.trim().toUpperCase();
        console.log('🔍 [Image Classify] Raw classification:', cleanClassification);

        // Determine intent
        let intent;
        if (hasImageContext) {
            if (cleanClassification.includes('NEW')) {
                intent = 'new_image';
            } else if (cleanClassification.includes('MODIFY')) {
                intent = 'modify_image';
            } else {
                intent = 'none';
            }
        } else {
            if (cleanClassification.includes('YES')) {
                intent = 'new_image';
            } else {
                intent = 'none';
            }
        }

        console.log('🔍 [Image Classify] Final intent:', intent);

        res.json({
            success: true,
            intent: intent,
            classification: cleanClassification,
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