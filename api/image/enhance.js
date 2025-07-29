import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';

function isClaudeModel(model) {
    return model.startsWith('claude-');
}

function isOpenAIModel(model) {
    return model.startsWith('gpt-') || model.startsWith('o1-');
}

export default async function handler(req, res) {
    console.log('🎨 [Image Enhance] Request received');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userPrompt, model, previousPrompt, modificationType } = req.body;

        console.log('🎨 [Image Enhance] Processing:', {
            userPrompt,
            model,
            previousPrompt: previousPrompt ? 'exists' : 'none',
            modificationType
        });

        if (!userPrompt || !model) {
            return res.status(400).json({ error: 'userPrompt and model are required' });
        }

        // Create the enhancement prompt for the LLM
        let enhancementPrompt;

        if (modificationType === 'modification' && previousPrompt) {
            // User is modifying an existing image
            enhancementPrompt = `Previous DALL-E prompt: "${previousPrompt}"

            User wants to modify it: "${userPrompt}"

            Create an updated DALL-E prompt that applies the user's modification. Keep it natural and concise like ChatGPT would - don't over-describe.

            Only respond with the new prompt:`;

        } else {
            // User is creating a new image
            enhancementPrompt = `User wants: "${userPrompt}"

            Create a natural DALL-E prompt like ChatGPT would. Keep it concise but effective - add key details for quality (good lighting, clear subject) but don't over-describe.

            Only respond with the prompt:`;
        }

        console.log('🎨 [Image Enhance] Enhancement prompt created');

        // Get the appropriate handler
        let handler;
        if (isClaudeModel(model)) {
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key not configured');
            }
            handler = new ClaudeHandler(process.env.ANTHROPIC_API_KEY);
            console.log('🎨 [Image Enhance] Using Claude handler');
        } else if (isOpenAIModel(model)) {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API key not configured');
            }
            handler = new OpenAIHandler(process.env.OPENAI_API_KEY);
            console.log('🎨 [Image Enhance] Using OpenAI handler');
        } else {
            throw new Error(`Unsupported model: ${model}`);
        }

        // Use simple completion instead of streaming
        const enhancedPrompt = await handler.simpleCompletion(enhancementPrompt, model);

        console.log('🎨 [Image Enhance] Original prompt:', userPrompt);
        console.log('🎨 [Image Enhance] Enhanced prompt:', enhancedPrompt.trim());

        res.json({
            success: true,
            originalPrompt: userPrompt,
            enhancedPrompt: enhancedPrompt.trim(),
            model: model,
            modificationType: modificationType || 'new'
        });

    } catch (error) {
        console.error('❌ [Image Enhance] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}