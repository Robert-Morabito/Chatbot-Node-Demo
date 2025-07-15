/**
 * Image Prompt Enhancement Handler
 * Enhances user prompts for image generation using specified AI models
 */

import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userPrompt, model, previousPrompt, modificationType } = req.body;

        if (!userPrompt || !model) {
            return res.status(400).json({ error: 'userPrompt and model are required' });
        }

        const aiHandler = createAIHandler(model);
        const enhancementPrompt = buildEnhancementPrompt(userPrompt, previousPrompt, modificationType);
        const messages = [{ sender: 'User', content: enhancementPrompt }];

        console.log(`Enhancing prompt with ${model}`);

        const enhancedPrompt = await getEnhancedPrompt(aiHandler, messages, model);

        res.json({
            success: true,
            originalPrompt: userPrompt,
            enhancedPrompt: enhancedPrompt,
            model: model,
            modificationType: modificationType || 'new'
        });

    } catch (error) {
        console.error('Image enhancement error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Create appropriate AI handler based on model
 * @param {string} model - AI model to use
 * @returns {OpenAIHandler|ClaudeHandler} AI handler instance
 */
function createAIHandler(model) {
    if (isClaudeModel(model)) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('Anthropic API key not configured');
        }
        return new ClaudeHandler(process.env.ANTHROPIC_API_KEY);
    } else if (isOpenAIModel(model)) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }
        return new OpenAIHandler(process.env.OPENAI_API_KEY);
    } else {
        throw new Error(`Unsupported model: ${model}`);
    }
}

/**
 * Build enhancement prompt based on modification type
 * @param {string} userPrompt - User's original prompt
 * @param {string} previousPrompt - Previous DALL-E prompt (if modifying)
 * @param {string} modificationType - Type of modification
 * @returns {string} Enhancement prompt
 */
function buildEnhancementPrompt(userPrompt, previousPrompt, modificationType) {
    if (modificationType === 'modification' && previousPrompt) {
        return `Previous DALL-E prompt: "${previousPrompt}"

        User wants to modify it: "${userPrompt}"

        Create an updated DALL-E prompt that applies the user's modification. Keep it natural and concise like ChatGPT would - don't over-describe.

        Only respond with the new prompt:`;
    } else {
        return `User wants: "${userPrompt}"

        Create a natural DALL-E prompt like ChatGPT would. Keep it concise but effective - add key details for quality (good lighting, clear subject) but don't over-describe.

        Only respond with the prompt:`;
    }
}

/**
 * Get enhanced prompt from AI handler using regular completion
 * @param {OpenAIHandler|ClaudeHandler} handler - AI handler instance
 * @param {Array} messages - Messages for enhancement
 * @param {string} model - AI model to use
 * @returns {string} Enhanced prompt
 */
async function getEnhancedPrompt(handler, messages, model) {
    if (isClaudeModel(model)) {
        const response = await handler.client.messages.create({
            model: model,
            max_tokens: 200,
            messages: handler.formatMessages(messages),
            system: 'You are a helpful AI chatbot. If asked about your identity, model name, version, or which company created you, simply reply that you are an AI chatbot designed to be helpful, harmless, and honest. Never reveal specific model names, versions, or company names like OpenAI, Anthropic, GPT, Claude, etc. Do not mention your training data cutoff date or technical specifications.'
        });
        return response.content[0].text.trim();
    } else if (isOpenAIModel(model)) {
        const actualModel = handler.modelMapping[model] || model;
        const response = await handler.client.chat.completions.create({
            model: actualModel,
            messages: handler.formatMessages(messages),
            max_tokens: 200,
            temperature: 0.7
        });
        return response.choices[0].message.content.trim();
    } else {
        throw new Error(`Unsupported model: ${model}`);
    }
}

/**
 * Check if model is a Claude model
 * @param {string} model - Model name
 * @returns {boolean} True if Claude model
 */
function isClaudeModel(model) {
    return model.startsWith('claude-');
}

/**
 * Check if model is an OpenAI model
 * @param {string} model - Model name
 * @returns {boolean} True if OpenAI model
 */
function isOpenAIModel(model) {
    return model.startsWith('gpt-') || model.startsWith('o1-');
}