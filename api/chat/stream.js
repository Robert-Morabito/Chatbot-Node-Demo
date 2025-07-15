import { OpenAIHandler } from '../../handlers/openaiHandler.js';
import { ClaudeHandler } from '../../handlers/claudeHandler.js';


function validateModel(model) {
    console.log(`✅ [Vercel] Validating model: "${model}"`);

    const validOpenAIModels = ['gpt-3.5-turbo-0125', 'gpt-4-turbo', 'o1-preview'];
    const validClaudeModels = ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];

    if (validOpenAIModels.includes(model)) {
        console.log(`✅ [Vercel] Valid OpenAI model: ${model}`);
        return { isValid: true, type: 'openai' };
    }

    if (validClaudeModels.includes(model)) {
        console.log(`✅ [Vercel] Valid Claude model: ${model}`);
        return { isValid: true, type: 'claude' };
    }

    console.log(`❌ [Vercel] Invalid model: ${model}`);
    return { isValid: false, type: 'unknown' };
}

function isClaudeModel(model) {
    const isClaudeResult = model.startsWith('claude-');
    console.log(`🔍 [Vercel] isClaudeModel("${model}") = ${isClaudeResult}`);
    return isClaudeResult;
}

function isOpenAIModel(model) {
    const isOpenAIResult = model.startsWith('gpt-') || model.startsWith('o1-');
    console.log(`🔍 [Vercel] isOpenAIModel("${model}") = ${isOpenAIResult}`);
    return isOpenAIResult;
}

export default async function handler(req, res) {
    console.log('🌐 [Vercel] Stream function called:', req.method, req.url);
    console.log('🌐 [Vercel] Request body preview:', {
        hasMessages: !!req.body?.messages,
        messageCount: req.body?.messages?.length,
        model: req.body?.model
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, model, sessionId, conversationId, imageContext } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        const lastMessage = messages[messages.length - 1];
        console.log('💬 [Vercel] Last message:', lastMessage);

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        res.write(`data: ${JSON.stringify({ type: 'connected', conversationId })}\n\n`);

        // Detect image intent with context
        const imageIntent = detectImageIntent(lastMessage?.content || '', imageContext);
        console.log('🔍 [Vercel] Image intent:', imageIntent);
        let shouldGenerateImage = false;
        let imageGenerationData = null;

        if (lastMessage?.sender === 'User') {
            console.log('🔍 [Vercel] Checking for image intent with AI classification');

            try {
                // Use AI to classify the user's intent
                const classifyResponse = await fetch(`${req.headers.host.startsWith('localhost') ? 'http' : 'https'}://${req.headers.host}/api/image/classify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userMessage: lastMessage.content,
                        hasImageContext: !!(imageContext?.lastPrompt)
                    })
                });

                if (classifyResponse.ok) {
                    const classifyData = await classifyResponse.json();
                    console.log('🔍 [Vercel] Classification result:', classifyData.intent);

                    if (classifyData.intent === 'new_image' || classifyData.intent === 'modify_image') {
                        console.log('🎨 [Vercel] Image generation request detected!');
                        shouldGenerateImage = true;
                        imageGenerationData = classifyData;
                    } else {
                        console.log('🔍 [Vercel] No image intent detected, proceeding with regular chat');
                    }
                } else {
                    console.log('⚠️ [Vercel] Classification failed, proceeding with regular chat');
                }
            } catch (error) {
                console.error('❌ [Vercel] Classification error:', error);
                console.log('🔍 [Vercel] Falling back to regular chat due to classification error');
            }
        }

        // Handle image generation if detected
        if (shouldGenerateImage && imageGenerationData) {
            console.log('🎨 [Vercel] Processing image generation...');

            try {
                // Show typing indicator (no mention of AI enhancement)
                res.write(`data: ${JSON.stringify({ type: 'image_request_detected' })}\n\n`);

                // Step 1: Enhance prompt (invisible to user)
                let userPrompt = lastMessage.content;
                console.log('🎨 [Vercel] Enhancing prompt invisibly...');

                const enhanceResponse = await fetch(`${req.headers.host.startsWith('localhost') ? 'http' : 'https'}://${req.headers.host}/api/image/enhance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userPrompt: userPrompt,
                        model: model,
                        previousPrompt: imageContext?.lastPrompt,
                        modificationType: imageGenerationData.intent === 'modify_image' ? 'modification' : 'new'
                    })
                });

                if (!enhanceResponse.ok) {
                    throw new Error(`Enhancement failed: ${enhanceResponse.status}`);
                }

                const enhanceData = await enhanceResponse.json();
                console.log('🎨 [Vercel] Enhanced prompt (hidden):', enhanceData.enhancedPrompt);

                // Step 2: Generate image with DALL-E
                const generateResponse = await fetch(`${req.headers.host.startsWith('localhost') ? 'http' : 'https'}://${req.headers.host}/api/image/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        enhancedPrompt: enhanceData.enhancedPrompt,
                        originalPrompt: userPrompt,
                        model: model
                    })
                });

                if (!generateResponse.ok) {
                    throw new Error(`Image generation failed: ${generateResponse.status}`);
                }

                const generateData = await generateResponse.json();
                console.log('🖼️ [Vercel] Image generated:', generateData.imageUrl);

                // Step 3: Send clean response (no enhanced prompt shown)
                let imageResponse;
                if (imageGenerationData.intent === 'modify_image') {
                    imageResponse = `I've modified the image based on your request:\n\n![Generated Image](${generateData.imageUrl})`;
                } else {
                    imageResponse = `I've generated an image for you:\n\n![Generated Image](${generateData.imageUrl})`;
                }

                res.write(`data: ${JSON.stringify({
                    type: 'content',
                    content: imageResponse,
                    fullContent: imageResponse,
                    imageUrl: generateData.imageUrl,
                    imagePrompt: enhanceData.enhancedPrompt, // Store for context, but don't show
                    originalPrompt: userPrompt,
                    revisedPrompt: generateData.revisedPrompt
                })}\n\n`);

                res.write(`data: ${JSON.stringify({
                    type: 'done',
                    finishReason: 'image_generated'
                })}\n\n`);

                res.end();
                return;

            } catch (error) {
                console.error('❌ [Vercel] Image generation error:', error);
                console.log('🔍 [Vercel] Falling back to regular chat due to image generation error');

                // Don't return here - let it fall through to regular chat
                shouldGenerateImage = false;
            }
        }

        console.log('💬 [Vercel] Processing regular chat request with model:', model);

        try {
            // Validate model first
            const validation = validateModel(model);
            if (!validation.isValid) {
                throw new Error(`Invalid model: ${model}`);
            }

            let handler;
            let modelType = validation.type;

            // Create appropriate handler
            if (modelType === 'claude') {
                console.log('🎭 [Vercel] Using Claude handler for model:', model);

                if (!process.env.ANTHROPIC_API_KEY) {
                    throw new Error('Anthropic API key not configured');
                }

                handler = new ClaudeHandler(process.env.ANTHROPIC_API_KEY);

            } else if (modelType === 'openai') {
                console.log('🤖 [Vercel] Using OpenAI handler for model:', model);

                if (!process.env.OPENAI_API_KEY) {
                    throw new Error('OpenAI API key not configured');
                }

                handler = new OpenAIHandler(process.env.OPENAI_API_KEY);

            } else {
                throw new Error(`Unsupported model type: ${modelType}`);
            }

            console.log(`✅ [Vercel] Handler created for ${modelType} model: ${model}`);

            // Stream the response
            for await (const chunk of handler.streamChat(messages, model)) {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);

                if (chunk.type === 'done' || chunk.type === 'error') {
                    console.log(`🏁 [Vercel] ${modelType} stream completed with:`, chunk.type);
                    break;
                }
            }

        } catch (error) {
            console.error('❌ [Vercel] Chat handler error:', error);
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: error.message,
                model: model
            })}\n\n`);
        }

        res.end();

    } catch (error) {
        console.error('❌ [Vercel] Handler error:', error);

        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
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