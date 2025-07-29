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
                !!(imageContext?.lastPrompt),
                req
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

        // Send typing indicator start signal for regular chat
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