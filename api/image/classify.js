import { OpenAIHandler } from '../../handlers/openaiHandler.js';

export default async function handler(req, res) {
    console.log('🔍 [Image Classify] Request received');

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            debug: 'classify.js method check failed'
        });
    }

    try {
        const { userMessage, hasImageContext } = req.body;

        if (!userMessage) {
            return res.status(400).json({
                success: false,
                error: 'userMessage is required',
                debug: 'classify.js missing userMessage'
            });
        }

        // CHECK: OpenAI API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ [Image Classify] Missing OpenAI API key');
            return res.status(500).json({
                success: false,
                error: 'OpenAI API key not configured',
                debug: 'classify.js missing OPENAI_API_KEY'
            });
        }

        console.log('🔍 [Image Classify] Processing message:', userMessage.substring(0, 50) + '...');

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

        // Create fake conversation for classification
        const messages = [
            { sender: 'User', content: classificationPrompt }
        ];

        console.log('🔍 [Image Classify] Classifying with GPT-3.5...');

        // Get classification using GPT-3.5 (fast and reliable)
        let classification = '';
        for await (const chunk of classifier.streamChatNoSystem(messages, 'gpt-3.5-turbo-0125')) {
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
            error: error.message,
            debug: 'classify.js caught exception',
            stack: error.stack
        });
    }
}