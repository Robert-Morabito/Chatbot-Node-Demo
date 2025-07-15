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
            enhancementPrompt = `You are an expert at crafting prompts for DALL-E 3 image generation. 

I previously used this DALL-E prompt: "${previousPrompt}"

The user now wants to modify it with this request: "${userPrompt}"

Please provide an updated DALL-E prompt that incorporates the user's modification while maintaining the quality and style of the original. The prompt should be:
- Detailed and specific
- Include artistic/technical terms
- Mention lighting, style, and quality
- Be optimized for DALL-E 3

Only respond with the enhanced prompt, nothing else.`;

        } else {
            // User is creating a new image
            enhancementPrompt = `You are an expert at crafting prompts for DALL-E 3 image generation.

The user wants: "${userPrompt}"

Please enhance this into a detailed, high-quality DALL-E prompt. Make it:
- Specific and detailed
- Include artistic terms and techniques
- Mention lighting, composition, and style
- Add quality indicators (e.g., "high quality", "detailed", "professional")
- Be optimized for DALL-E 3

Only respond with the enhanced prompt, nothing else.`;
        }

        console.log('🎨 [Image Enhance] Enhancement prompt created');

        // Create fake conversation for the LLM
        const messages = [
            { sender: 'User', content: enhancementPrompt }
        ];

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

        // Get the enhanced prompt from the LLM
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

        // Clean up the enhanced prompt
        enhancedPrompt = enhancedPrompt.trim();
        
        console.log('🎨 [Image Enhance] Original prompt:', userPrompt);
        console.log('🎨 [Image Enhance] Enhanced prompt:', enhancedPrompt);

        res.json({
            success: true,
            originalPrompt: userPrompt,
            enhancedPrompt: enhancedPrompt,
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