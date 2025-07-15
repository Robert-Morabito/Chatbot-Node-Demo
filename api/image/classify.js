/**
 * Image Classification Handler
 * Classifies user prompts to determine if they're requesting image generation or modification
 */

import { OpenAIHandler } from '../../handlers/openaiHandler.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userMessage, hasImageContext } = req.body;

        if (!userMessage) {
            return res.status(400).json({ error: 'userMessage is required' });
        }

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);
        const classificationPrompt = buildClassificationPrompt(userMessage, hasImageContext);
        const messages = [{ sender: 'User', content: classificationPrompt }];

        console.log('Classifying user intent with GPT-3.5');

        const classification = await getClassification(classifier, messages);
        const intent = determineIntent(classification, hasImageContext);

        res.json({
            success: true,
            intent: intent,
            classification: classification,
            userMessage: userMessage
        });

    } catch (error) {
        console.error('Image classification error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Build classification prompt based on context
 * @param {string} userMessage - User's message to classify
 * @param {boolean} hasImageContext - Whether user has previously generated an image
 * @returns {string} Classification prompt
 */
function buildClassificationPrompt(userMessage, hasImageContext) {
    if (hasImageContext) {
        return `The user previously generated an image. Now they said: "${userMessage}"

        Analyze what the user wants:
        - If they want a completely NEW/DIFFERENT image, respond: NEW
        - If they want to MODIFY/CHANGE the existing image (color, size, add/remove things), respond: MODIFY  
        - If they're just having normal conversation, respond: NEITHER

        Respond with only one word: NEW, MODIFY, or NEITHER`;
    } else {
        return `The user said: "${userMessage}"

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
}

/**
 * Get classification result from OpenAI using regular completion
 * @param {OpenAIHandler} classifier - OpenAI handler instance
 * @param {Array} messages - Messages for classification
 * @returns {string} Classification result
 */
async function getClassification(classifier, messages) {
    const response = await classifier.client.chat.completions.create({
        model: 'gpt-3.5-turbo-0125', // Hardcoded for cost efficiency
        messages: classifier.formatMessages(messages),
        max_tokens: 10,
        temperature: 0.1
    });
    
    return response.choices[0].message.content.trim().toUpperCase();
}

/**
 * Determine user intent from classification result
 * @param {string} classification - Raw classification from AI
 * @param {boolean} hasImageContext - Whether user has image context
 * @returns {string} Intent classification
 */
function determineIntent(classification, hasImageContext) {
    if (hasImageContext) {
        if (classification.includes('NEW')) {
            return 'new_image';
        } else if (classification.includes('MODIFY')) {
            return 'modify_image';
        } else {
            return 'none';
        }
    } else {
        return classification.includes('YES') ? 'new_image' : 'none';
    }
}