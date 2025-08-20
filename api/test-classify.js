// api/test-classify.js
import { OpenAIHandler } from '../handlers/openaiHandler.js';

export default async function handler(req, res) {
    console.log('🧪 [Test Classify] Testing classification...');

    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.json({
                success: false,
                error: 'No OpenAI API key found'
            });
        }

        const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);

        // In the test endpoint, try multiple messages:
        const testMessages = [
            "draw a dog",
            "generate an image of a cat",
            "create a picture",
            "make me an image",
            "hello there",
            "what's the weather"
        ];

        const results = [];


        for (const testMessage of testMessages) {
            // Use the EXACT same prompt as classify.js
            const classificationPrompt = `The user said: "${testMessage}"

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

            const messages = [
                { sender: 'User', content: classificationPrompt }
            ];

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

            classification = classification.trim().toUpperCase();
            const intent = classification.includes('YES') ? 'new_image' : 'none';

            results.push({
                message: testMessage,
                classification: classification,
                intent: intent
            });
        }
        res.json({
            success: true,
            results: results,
            model_used: 'gpt-3.5-turbo-0125'
        });


    } catch (error) {
        console.error('❌ [Test Classify] Error:', error);
        res.json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}