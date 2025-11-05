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
        const defaultMaxTokens = model.startsWith('gpt-5') ? 2000 : 800; // Give GPT-5 more room

        const {
            includeSystemPrompt = true,
            temperature = 0.7,
            maxTokens = defaultMaxTokens,
            timeout = model.startsWith('gpt-5') ? 180000 : 60000 // 3 min for GPT-5, 1 min for others
        } = options;

        const startTime = Date.now();
        let hasStartedStreaming = false;

        try {
            const formattedMessages = this.formatMessages(messages, includeSystemPrompt);
            const streamConfig = this.buildStreamConfig(model, formattedMessages, temperature, maxTokens);

            // Add timeout wrapper for GPT-5
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                if (!hasStartedStreaming && model.startsWith('gpt-5')) {
                    console.error('⏱️ GPT-5 timeout - no response after', timeout / 1000, 'seconds');
                    controller.abort();
                }
            }, timeout);

            const stream = await this.client.chat.completions.create({
                ...streamConfig,
                signal: controller.signal
            });

            let fullResponse = '';
            let chunkCount = 0;

            for await (const chunk of stream) {
                if (!hasStartedStreaming) {
                    hasStartedStreaming = true;
                    clearTimeout(timeoutId);
                    const timeToFirstChunk = Date.now() - startTime;
                    console.log('✅ GPT-5 first chunk received after', timeToFirstChunk / 1000, 'seconds');
                }

                chunkCount++;
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
                    const totalTime = Date.now() - startTime;
                    console.log('✅ GPT-5 completed:', {
                        totalTime: totalTime / 1000 + 's',
                        chunks: chunkCount,
                        responseLength: fullResponse.length
                    });

                    yield {
                        type: 'done',
                        fullContent: fullResponse,
                        finishReason: chunk.choices[0].finish_reason
                    };
                    break;
                }
            }

        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error('❌ GPT-5 stream failed after', totalTime / 1000, 'seconds:', error.message);

            // Check if it's a timeout
            if (error.name === 'AbortError') {
                yield {
                    type: 'error',
                    error: 'GPT-5 response timeout - the model took too long to respond. Try a simpler prompt or use GPT-4 instead.'
                };
            } else {
                yield {
                    type: 'error',
                    error: error.message
                };
            }
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
        console.log('🔧 Building config for model:', model, {
            messageCount: messages.length,
            totalInputTokens: JSON.stringify(messages).length / 4, // rough estimate
            maxTokens,
            temperature
        });

        const config = {
            model,
            messages,
            stream: true
        };

        // GPT-5 has different parameter requirements
        if (model.startsWith('gpt-5')) {
            config.max_completion_tokens = maxTokens;
            // GPT-5 uses default temperature only
            console.log('⚠️ GPT-5 detected - using max_completion_tokens:', maxTokens);
        } else {
            config.max_tokens = maxTokens;
            config.temperature = temperature;
        }

        return config;
    }
}