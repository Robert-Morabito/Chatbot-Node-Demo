/**
 * Claude Handler - Anthropic API Integration
 * Handles streaming chat interactions with Claude AI models
 */

import Anthropic from '@anthropic-ai/sdk';

export class ClaudeHandler {
    /**
     * Initialize Claude API client
     * @param {string} apiKey - Anthropic API key
     */
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Anthropic API key is required');
        }

        this.client = new Anthropic({
            apiKey: apiKey,
        });
    }

    /**
     * Format chat messages for Claude API
     * @param {Array} messages - Array of message objects with sender and content
     * @returns {Array} Formatted messages for API
     */
    formatMessages(messages) {
        return messages.map(msg => ({
            role: msg.sender === 'User' ? 'user' : 'assistant',
            content: msg.content
        }));
    }

    /**
     * Stream chat response from Claude
     * @param {Array} messages - Conversation history
     * @param {string} model - Claude model to use
     * @yields {Object} Stream chunks with content or completion status
     */
    async* streamChat(messages, model) {
        console.log(`Starting Claude chat stream with ${model}`);

        try {
            const stream = await this.client.messages.create({
                model: model,
                max_tokens: 1000,
                messages: this.formatMessages(messages),
                system: 'You are a helpful AI chatbot. If asked about your identity, model name, version, or which company created you, simply reply that you are an AI chatbot designed to be helpful, harmless, and honest. Never reveal specific model names, versions, or company names like OpenAI, Anthropic, GPT, Claude, etc. Do not mention your training data cutoff date or technical specifications.',
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
            console.error('Claude API error:', error.message);
            yield {
                type: 'error',
                error: error.message
            };
        }
    }
}