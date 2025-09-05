/**
 * Image Processing Handler
 * 
 * Handles image-related requests including intent classification 
 * and prompt enhancement for DALL-E generation.
 */

import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action } = req.body;

        switch (action) {
            case 'classify':
                return await handleClassification(req, res);
            case 'enhance':
                return await handleEnhancement(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action. Use "classify" or "enhance"' });
        }

    } catch (error) {
        console.error('Image handler error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Classifies user intent for image generation
 */
async function handleClassification(req, res) {
    const { userMessage, hasImageContext } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'userMessage is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);

    // Create classification prompt
    const classificationPrompt = hasImageContext 
        ? createModificationClassificationPrompt(userMessage)
        : createNewImageClassificationPrompt(userMessage);

    const messages = [{ sender: 'User', content: classificationPrompt }];

    // Use NO system prompt for better classification accuracy
    let classification = '';
    for await (const chunk of classifier.streamChat(messages, 'gpt-3.5-turbo-0125', { 
        includeSystemPrompt: false 
    })) {
        if (chunk.type === 'content') {
            classification += chunk.content;
        } else if (chunk.type === 'done') {
            break;
        } else if (chunk.type === 'error') {
            throw new Error(chunk.error);
        }
    }

    classification = classification.trim().toUpperCase();
    const intent = determineIntent(classification, hasImageContext);

    res.json({
        success: true,
        intent,
        classification,
        userMessage
    });
}

/**
 * Enhances prompts for DALL-E generation
 */
async function handleEnhancement(req, res) {
    const { userPrompt, model, previousPrompt, modificationType } = req.body;

    if (!userPrompt || !model) {
        return res.status(400).json({ error: 'userPrompt and model are required' });
    }

    const enhancementPrompt = modificationType === 'modification' && previousPrompt
        ? createModificationPrompt(userPrompt, previousPrompt)
        : createNewImagePrompt(userPrompt);

    const messages = [{ sender: 'User', content: enhancementPrompt }];
    const handler = createModelHandler(model);

    let enhancedPrompt = '';
    for await (const chunk of handler.streamChat(messages, model)) {
        if (chunk.type === 'content') {
            enhancedPrompt += chunk.content;
        } else if (chunk.type === 'done') {
            break;
        } else if (chunk.type === 'error') {
            throw new Error(chunk.error);
        }
    }

    res.json({
        success: true,
        originalPrompt: userPrompt,
        enhancedPrompt: enhancedPrompt.trim(),
        model,
        modificationType: modificationType || 'new'
    });
}

/**
 * Helper functions for prompt creation
 */
function createNewImageClassificationPrompt(userMessage) {
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

function createModificationClassificationPrompt(userMessage) {
    return `The user previously generated an image. Now they said: "${userMessage}"

Analyze what the user wants:
- If they want a completely NEW/DIFFERENT image, respond: NEW
- If they want to MODIFY/CHANGE the existing image (color, size, add/remove things), respond: MODIFY  
- If they're just having normal conversation, respond: NEITHER

Respond with only one word: NEW, MODIFY, or NEITHER`;
}

function createNewImagePrompt(userPrompt) {
    return `User wants: "${userPrompt}"

Create a natural DALL-E prompt like ChatGPT would. Keep it concise but effective - add key details for quality (good lighting, clear subject) but don't over-describe.

Only respond with the prompt:`;
}

function createModificationPrompt(userPrompt, previousPrompt) {
    return `Previous DALL-E prompt: "${previousPrompt}"

User wants to modify it: "${userPrompt}"

Create an updated DALL-E prompt that applies the user's modification. Keep it natural and concise like ChatGPT would - don't over-describe.

Only respond with the new prompt:`;
}

function determineIntent(classification, hasImageContext) {
    if (hasImageContext) {
        if (classification.includes('NEW')) return 'new_image';
        if (classification.includes('MODIFY')) return 'modify_image';
        return 'none';
    } else {
        return classification.includes('YES') ? 'new_image' : 'none';
    }
}

function createModelHandler(model) {
    if (model.startsWith('claude-')) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('Anthropic API key not configured');
        }
        return new ClaudeHandler(process.env.ANTHROPIC_API_KEY);
    } else {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }
        return new OpenAIHandler(process.env.OPENAI_API_KEY);
    }
}