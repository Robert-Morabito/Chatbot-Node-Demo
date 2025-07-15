import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';

// Model detection functions
function isClaudeModel(model) {
    const result = model.startsWith('claude-');
    console.log(`🔍 [Stream] isClaudeModel("${model}") = ${result}`);
    return result;
}

function isOpenAIModel(model) {
    const result = model.startsWith('gpt-') || model.startsWith('o1-');
    console.log(`🔍 [Stream] isOpenAIModel("${model}") = ${result}`);
    return result;
}

// Model validation
function validateModel(model) {
    console.log(`✅ [Stream] Validating model: "${model}"`);

    const validOpenAIModels = ['gpt-3.5-turbo-0125', 'gpt-4-turbo', 'o1-preview'];
    const validClaudeModels = ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];

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
    console.log('🔍 [Stream] === CLASSIFICATION DEBUG START ===');
    console.log('🔍 [Stream] User message:', userMessage);
    console.log('🔍 [Stream] Has image context:', hasImageContext);

    try {
        console.log('🔍 [Stream] Checking OpenAI API key...');
        if (!process.env.OPENAI_API_KEY) {
            console.log('❌ [Stream] No OpenAI key for classification');
            return { intent: 'none' };
        }
        console.log('✅ [Stream] OpenAI API key found');

        console.log('🔍 [Stream] Creating classifier...');
        const classifier = new OpenAIHandler(process.env.OPENAI_API_KEY);
        console.log('✅ [Stream] Classifier created');

        let classificationPrompt;
        if (hasImageContext) {
            classificationPrompt = `The user previously generated an image. Now they said: "${userMessage}"

Does this message request:
- A NEW image (completely different subject)
- MODIFY the existing image (change color, add/remove elements, etc.)
- NEITHER (just regular conversation)

Respond with only: NEW, MODIFY, or NEITHER`;
        } else {
            classificationPrompt = `The user said: "${userMessage}"

Does this message request creating an image or picture?

Respond with only: YES or NO`;
        }

        console.log('🔍 [Stream] Classification prompt:', classificationPrompt);

        const messages = [{ sender: 'User', content: classificationPrompt }];
        console.log('🔍 [Stream] Messages for classification:', messages);

        console.log('🔍 [Stream] Starting classification stream...');
        let classification = '';
        for await (const chunk of classifier.streamChat(messages, 'gpt-3.5-turbo-0125')) {
            console.log('🔍 [Stream] Classification chunk:', chunk);
            if (chunk.type === 'content') {
                classification += chunk.content;
                console.log('🔍 [Stream] Classification building:', classification);
            } else if (chunk.type === 'done') {
                console.log('🔍 [Stream] Classification stream done');
                break;
            } else if (chunk.type === 'error') {
                console.log('❌ [Stream] Classification stream error:', chunk.error);
                throw new Error(chunk.error);
            }
        }

        classification = classification.trim().toUpperCase();
        console.log('🔍 [Stream] Final classification:', classification);

        let intent = 'none';
        if (hasImageContext) {
            if (classification.includes('NEW')) intent = 'new_image';
            else if (classification.includes('MODIFY')) intent = 'modify_image';
        } else {
            if (classification.includes('YES')) intent = 'new_image';
        }

        console.log('🔍 [Stream] Final intent:', intent);
        console.log('🔍 [Stream] === CLASSIFICATION DEBUG END ===');
        return { intent, classification };

    } catch (error) {
        console.error('❌ [Stream] Classification error:', error);
        console.log('🔍 [Stream] === CLASSIFICATION DEBUG END (ERROR) ===');
        return { intent: 'none' };
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

            const imageClassification = await classifyImageIntent(
                lastMessage.content,
                !!(imageContext?.lastPrompt)
            );

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
                console.log('💬 [Stream] Regular chat message detected');
            }
        }

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