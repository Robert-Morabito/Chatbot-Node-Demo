import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';

// Model validation
function validateModel(model) {
    console.log(`✅ [Stream] Validating model: "${model}"`);

    const validOpenAIModels = ['gpt-3.5-turbo-0125', 'gpt-4-0125-preview', 'gpt-5-2025-08-07']; // Added gpt-5
    const validClaudeModels = ['claude-3-haiku-20240307', 'claude-3-5-haiku-20241022', 'claude-sonnet-4-20250514']; // Updated names

    if (validOpenAIModels.includes(model)) {
        console.log(`✅ [Stream] Valid OpenAI model: ${model}`);
        return { isValid: true, type: 'openai' };
    }

    if (validClaudeModels.includes(model)) {
        console.log(`✅ [Stream] Valid Claude model: ${model}`);
        return { isValid: true, type: 'claude' };
    }

    console.log(`❌ [Stream] Invalid model: ${model}`);
    return { isValid: false, type: 'unknown' };
}

// Image classification function
async function classifyImageIntent(userMessage, hasImageContext) {
    console.log('🔍 [Stream] Starting direct classification...');

    try {
        // Import and use the handler directly
        const { OpenAIHandler } = await import('../../handlers/openaiHandler.js');

        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ [Stream] Missing OpenAI API key for classification');
            return { intent: 'none', error: 'No OpenAI API key' };
        }

        const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);

        // Create classification prompt (same as classify.js)
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

        console.log('🔍 [Stream] Classifying with GPT-3.5 (direct)...');

        // Get classification using the no-system method
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
        console.log('🔍 [Stream] Raw classification (direct):', classification);

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

        console.log('🔍 [Stream] Final intent (direct):', intent);

        return {
            intent: intent,
            classification: classification,
            userMessage: userMessage
        };

    } catch (error) {
        console.error('❌ [Stream] Direct classification error:', error);
        return {
            intent: 'none',
            error: error.message
        };
    }
}

// Image generation function
async function generateImage(userMessage, model, imageContext, intent, req, res) {
    console.log('🎨 [Stream] Starting image generation...');

    try {
        // Step 1: Enhance prompt
        console.log('🎨 [Stream] Enhancing prompt...');

        const enhanceResponse = await fetch(`${req.headers.host.startsWith('localhost') ? 'http' : 'https'}://${req.headers.host}/api/image/enhance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userPrompt: userMessage,
                model: model,
                previousPrompt: imageContext?.lastPrompt,
                modificationType: intent === 'modify_image' ? 'modification' : 'new'
            })
        });

        if (!enhanceResponse.ok) {
            throw new Error(`Enhancement failed: ${enhanceResponse.status}`);
        }

        const enhanceData = await enhanceResponse.json();
        console.log('🎨 [Stream] Enhanced prompt:', enhanceData.enhancedPrompt);

        // Step 2: Generate image
        console.log('🖼️ [Stream] Generating image...');

        const generateResponse = await fetch(`${req.headers.host.startsWith('localhost') ? 'http' : 'https'}://${req.headers.host}/api/image/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enhancedPrompt: enhanceData.enhancedPrompt,
                originalPrompt: userMessage,
                model: model
            })
        });

        if (!generateResponse.ok) {
            throw new Error(`Image generation failed: ${generateResponse.status}`);
        }

        const generateData = await generateResponse.json();
        console.log('🖼️ [Stream] Image generated successfully');

        // Step 3: Send response
        let imageResponse;
        if (intent === 'modify_image') {
            imageResponse = `I've modified the image based on your request:\n\n![Generated Image](${generateData.imageUrl})`;
        } else {
            imageResponse = `I've generated an image for you:\n\n![Generated Image](${generateData.imageUrl})`;
        }

        res.write(`data: ${JSON.stringify({
            type: 'content',
            content: imageResponse,
            fullContent: imageResponse,
            imageUrl: generateData.imageUrl,
            imagePrompt: enhanceData.enhancedPrompt,
            originalPrompt: userMessage,
            revisedPrompt: generateData.revisedPrompt
        })}\n\n`);

        res.write(`data: ${JSON.stringify({
            type: 'done',
            finishReason: 'image_generated'
        })}\n\n`);

        return true;

    } catch (error) {
        console.error('❌ [Stream] Image generation error:', error);

        const errorMessage = `I apologize, but I couldn't generate the image. Error: ${error.message}`;
        res.write(`data: ${JSON.stringify({
            type: 'content',
            content: errorMessage,
            fullContent: errorMessage
        })}\n\n`);

        res.write(`data: ${JSON.stringify({
            type: 'done',
            finishReason: 'error'
        })}\n\n`);

        return false;
    }
}

// Main handler
export default async function handler(req, res) {
    console.log('🌐 [Stream] Function called:', req.method, req.url);

    if (req.method !== 'POST') {
        console.log('❌ [Stream] Method not allowed:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, model, sessionId, conversationId, imageContext } = req.body;

        console.log('📦 [Stream] Request data:', {
            messageCount: messages?.length,
            model,
            sessionId,
            conversationId,
            hasImageContext: !!imageContext?.lastPrompt
        });

        // Validate required fields
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            console.log('❌ [Stream] Invalid messages array');
            return res.status(400).json({ error: 'Valid messages array is required' });
        }

        if (!model) {
            console.log('❌ [Stream] No model specified');
            return res.status(400).json({ error: 'Model is required' });
        }

        const lastMessage = messages[messages.length - 1];
        console.log('💬 [Stream] Last message:', lastMessage);

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send connection confirmation
        res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

        // Check if this is a user message and might be an image request
        if (lastMessage?.sender === 'User') {
            console.log('🔍 [Stream] Checking for image intent...');
            console.log('🔍 [Stream] Message content:', lastMessage.content);
            console.log('🔍 [Stream] Has image context:', !!(imageContext?.lastPrompt));
            console.log('🔍 [Stream] Request host:', req.headers.host);

            // Send a debug message to the client
            res.write(`data: ${JSON.stringify({
                type: 'debug',
                message: `🔍 About to classify: "${lastMessage.content}"`
            })}\n\n`);

            try {
                const imageClassification = await classifyImageIntent(
                    lastMessage.content,
                    !!(imageContext?.lastPrompt)
                );

                console.log('🔍 [Stream] Classification complete:', imageClassification);

                // Send classification result to client
                res.write(`data: ${JSON.stringify({
                    type: 'debug',
                    message: `🔍 Classification result: ${imageClassification.intent}`,
                    data: imageClassification
                })}\n\n`);

                if (imageClassification.error) {
                    console.error('❌ [Stream] Classification had error:', imageClassification.error);
                    res.write(`data: ${JSON.stringify({
                        type: 'debug',
                        message: `❌ Classification error: ${imageClassification.error}`
                    })}\n\n`);
                }

                if (imageClassification.intent === 'new_image' || imageClassification.intent === 'modify_image') {
                    console.log('🎨 [Stream] Image request detected:', imageClassification.intent);

                    res.write(`data: ${JSON.stringify({ type: 'image_request_detected' })}\n\n`);

                    const imageGenerated = await generateImage(
                        lastMessage.content,
                        model,
                        imageContext,
                        imageClassification.intent,
                        req,
                        res
                    );

                    if (imageGenerated) {
                        res.end();
                        return;
                    }

                    // If image generation failed, continue to regular chat
                    console.log('🔄 [Stream] Image generation failed, falling back to regular chat');
                } else {
                    console.log('💬 [Stream] Regular chat message detected, intent:', imageClassification.intent);
                }
            } catch (error) {
                console.error('❌ [Stream] Classification error:', error);
                res.write(`data: ${JSON.stringify({
                    type: 'debug',
                    message: `❌ Classification threw error: ${error.message}`
                })}\n\n`);
            }
        }

        // Send typing start signal for regular chat (this keeps the typing indicator visible)
        res.write(`data: ${JSON.stringify({ type: 'typing_start' })}\n\n`);

        // Handle regular chat
        console.log('💬 [Stream] Processing regular chat with model:', model);

        // Validate model
        const validation = validateModel(model);
        if (!validation.isValid) {
            throw new Error(`Invalid model: ${model}`);
        }

        // Create appropriate handler
        let handler;
        if (validation.type === 'claude') {
            console.log('🎭 [Stream] Using Claude handler');

            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key not configured');
            }

            handler = new ClaudeHandler(process.env.ANTHROPIC_API_KEY);

        } else if (validation.type === 'openai') {
            console.log('🤖 [Stream] Using OpenAI handler');

            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API key not configured');
            }

            handler = new OpenAIHandler(process.env.OPENAI_API_KEY);

        } else {
            throw new Error(`Unsupported model type: ${validation.type}`);
        }

        console.log(`✅ [Stream] Handler created for ${validation.type} model`);

        // Stream the chat response
        for await (const chunk of handler.streamChat(messages, model)) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);

            if (chunk.type === 'done' || chunk.type === 'error') {
                console.log(`🏁 [Stream] Stream completed with:`, chunk.type);
                break;
            }
        }

        res.end();

    } catch (error) {
        console.error('❌ [Stream] Handler error:', error);

        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: error.message
            })}\n\n`);
            res.end();
        }
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
        responseLimit: false,
    },
};