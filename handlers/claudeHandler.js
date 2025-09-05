/**
 * Claude API Handler
 * 
 * Manages interactions with Anthropic's Claude models for chat completions.
 * Handles streaming responses with proper error handling and message formatting.
 */

import Anthropic from '@anthropic-ai/sdk';

export class ClaudeHandler {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Anthropic API key is required');
        }

        this.client = new Anthropic({ apiKey });
    }

    /**
     * Formats conversation messages for Claude API
     * @param {Array} messages - Raw conversation messages
     * @returns {Array} Formatted messages array
     */
    formatMessages(messages) {
        return messages.map(msg => ({
            role: msg.sender === 'User' ? 'user' : 'assistant',
            content: msg.content
        }));
    }

    /**
     * Streams chat completions from Claude models
     * @param {Array} messages - Conversation messages
     * @param {string} model - Claude model identifier
     */
    async* streamChat(messages, model) {
        try {
            const stream = await this.client.messages.create({
                model,
                max_tokens: 1000,
                messages: this.formatMessages(messages),
                system: 'You are a helpful AI chatbot. If asked about your identity, model name, version, or which company created you, simply reply that you are an AI chatbot.',
                stream: true,
            });

            let fullResponse = '';

            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                    fullResponse += chunk.delta.text;
                    yield {
                        type: 'content',
                        content: chunk.delta.text,
                        fullContent: fullResponse
                    };
                } else if (chunk.type === 'message_stop') {
                    yield {
                        type: 'done',
                        fullContent: fullResponse,
                        finishReason: 'stop'
                    };
                    break;
                }
            }

        } catch (error) {
            console.error('Claude stream failed:', error.message);
            yield {
                type: 'error',
                error: error.message
            };
        }
    }

    /**
     * Gets a complete response from Claude (non-streaming)
     * Useful for internal operations like classification and enhancement
     * @param {Array} messages - Conversation messages  
     * @param {string} model - Claude model identifier
     * @returns {Promise<string>} Complete response text
     */
    async getCompletion(messages, model) {
        try {
            const response = await this.client.messages.create({
                model,
                max_tokens: 1000,
                messages: this.formatMessages(messages),
                system: 'You are a helpful AI chatbot.',
                stream: false
            });

            return response.content[0].text;

        } catch (error) {
            console.error('Claude completion failed:', error.message);
            throw error;
        }
    }
}