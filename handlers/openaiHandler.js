/**
 * OpenAI API Handler
 * 
 * Manages interactions with OpenAI's APIs including chat completions and image generation.
 * Handles different model types (GPT-3.5, GPT-4, GPT-5) with appropriate parameter management.
 */

import OpenAI from 'openai';

export class OpenAIHandler {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }

        this.client = new OpenAI({ apiKey });
    }

    /**
     * Formats conversation messages for OpenAI API
     * @param {Array} messages - Raw conversation messages
     * @param {boolean} includeSystem - Whether to include system prompt
     * @returns {Array} Formatted messages array
     */
    formatMessages(messages, includeSystem = true) {
        const formattedMessages = messages.map(msg => ({
            role: msg.sender === 'User' ? 'user' : 'assistant',
            content: msg.content
        }));

        if (includeSystem) {
            const systemMessage = {
                role: 'system',
                content: 'You are a helpful AI chatbot. If asked about your identity, model name, version, or which company created you, simply reply that you are an AI chatbot.'
            };
            return [systemMessage, ...formattedMessages];
        }

        return formattedMessages;
    }

    /**
     * Generates images using DALL-E
     * @param {string} prompt - Image generation prompt
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generation result with URL and revised prompt
     */
    async generateImage(prompt, options = {}) {
        const {
            model = "dall-e-3",
            size = "1024x1024",
            quality = "standard",
            n = 1
        } = options;

        try {
            const response = await this.client.images.generate({
                model,
                prompt,
                n,
                size,
                quality
            });

            return {
                success: true,
                url: response.data[0].url,
                revisedPrompt: response.data[0].revised_prompt || prompt
            };

        } catch (error) {
            console.error('DALL-E generation failed:', error.message);
            throw error;
        }
    }

    /**
     * Streams chat completions from OpenAI models
     * @param {Array} messages - Conversation messages
     * @param {string} model - Model identifier
     * @param {Object} options - Streaming options
     */
    async* streamChat(messages, model, options = {}) {
        const {
            includeSystemPrompt = true,
            temperature = 0.7,
            maxTokens = 800
        } = options;

        try {
            const formattedMessages = this.formatMessages(messages, includeSystemPrompt);
            const streamConfig = this.buildStreamConfig(model, formattedMessages, temperature, maxTokens);

            const stream = await this.client.chat.completions.create(streamConfig);
            let fullResponse = '';

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;

                if (delta?.content) {
                    fullResponse += delta.content;
                    yield {
                        type: 'content',
                        content: delta.content,
                        fullContent: fullResponse
                    };
                }

                if (chunk.choices[0]?.finish_reason) {
                    yield {
                        type: 'done',
                        fullContent: fullResponse,
                        finishReason: chunk.choices[0].finish_reason
                    };
                    break;
                }
            }

        } catch (error) {
            console.error('Chat stream failed:', error.message);
            yield {
                type: 'error',
                error: error.message
            };
        }
    }

    /**
     * Gets a complete response from OpenAI (non-streaming)
     * Useful for internal operations like classification and enhancement
     * @param {Array} messages - Conversation messages
     * @param {string} model - Model identifier  
     * @param {Object} options - Completion options
     * @returns {Promise<string>} Complete response text
     */
    async getCompletion(messages, model, options = {}) {
        const {
            includeSystemPrompt = true,
            temperature = 0.7,
            maxTokens = 800
        } = options;

        try {
            const formattedMessages = this.formatMessages(messages, includeSystemPrompt);
            const config = this.buildStreamConfig(model, formattedMessages, temperature, maxTokens);

            // Remove stream flag for regular completion
            delete config.stream;

            const response = await this.client.chat.completions.create(config);
            return response.choices[0].message.content;

        } catch (error) {
            console.error('OpenAI completion failed:', error.message);
            throw error;
        }
    }

    /**
     * Builds stream configuration based on model type
     * @private
     */
    buildStreamConfig(model, messages, temperature, maxTokens) {
        const config = {
            model,
            messages,
            stream: true
        };

        // GPT-5 has different parameter requirements
        if (model.startsWith('gpt-5')) {
            config.max_completion_tokens = maxTokens;
            // GPT-5 uses default temperature only
        } else {
            config.max_tokens = maxTokens;
            config.temperature = temperature;
        }

        return config;
    }
}