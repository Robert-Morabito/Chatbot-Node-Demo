import Anthropic from '@anthropic-ai/sdk';

export class ClaudeHandler {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Anthropic API key is required');
        }
        
        this.client = new Anthropic({
            apiKey: apiKey,
        });
    }

    formatMessages(messages) {
        return messages.map(msg => ({
            role: msg.sender === 'User' ? 'user' : 'assistant',
            content: msg.content
        }));
    }

    async* streamChat(messages, model) {
        console.log('💬 [Claude] Starting chat stream with model:', model);

        try {
            const stream = await this.client.messages.create({
                model: model,
                max_tokens: 1000,
                messages: this.formatMessages(messages),
                stream: true,
            });

            let fullResponse = '';
            
            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta') {
                    const delta = chunk.delta;
                    
                    if (delta.text) {
                        fullResponse += delta.text;
                        yield {
                            type: 'content',
                            content: delta.text,
                            fullContent: fullResponse
                        };
                    }
                } else if (chunk.type === 'message_stop') {
                    yield {
                        type: 'done',
                        fullContent: fullResponse,
                        finishReason: 'stop'
                    };
                }
            }
        } catch (error) {
            console.error('❌ [Claude] Chat stream error:', error);
            yield {
                type: 'error',
                error: error.message
            };
        }
    }
}