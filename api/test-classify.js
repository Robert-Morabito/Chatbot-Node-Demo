import { OpenAIHandler } from '../handlers/openaiHandler.js';

export default async function handler(req, res) {
    console.log('🧪 [Test Classify] Testing classification...');
    
    try {
        // Test the classification directly
        if (!process.env.OPENAI_API_KEY) {
            return res.json({
                success: false,
                error: 'No OpenAI API key found',
                env_check: {
                    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
                    key_length: process.env.OPENAI_API_KEY?.length
                }
            });
        }

        const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);
        const testMessage = "draw a dog";
        
        const messages = [
            { sender: 'User', content: `The user said: "${testMessage}"\n\nDoes this request involve creating, generating, drawing, or making an image, picture, or visual?\n\nRespond with only: YES or NO` }
        ];

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

        classification = classification.trim().toUpperCase();
        const intent = classification.includes('YES') ? 'new_image' : 'none';

        res.json({
            success: true,
            test_message: testMessage,
            raw_classification: classification,
            final_intent: intent,
            api_key_configured: true
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