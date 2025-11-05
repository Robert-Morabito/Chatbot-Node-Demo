/**
 * OpenAI API Handler - Updated for GPT-5 Support
 * Version: 2.1.0 (GPT-5 Optimized)
 * 
 * Manages interactions with OpenAI's APIs including chat completions and image generation.
 * Handles different model types (GPT-3.5, GPT-4, GPT-5) with appropriate parameter management.
 */

import OpenAI from 'openai';

// ===================================================================
// VERSION TRACKING
// ===================================================================
const HANDLER_VERSION = '2.1.0';
console.log(`🔧 OpenAI Handler initialized - Version ${HANDLER_VERSION}`);

export class OpenAIHandler {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }

        // Increase timeout for GPT-5
        this.client = new OpenAI({ 
            apiKey,
            timeout: 180000, // 3 minutes (increased from default 90s)
            maxRetries: 2
        });
        
        console.log('✅ OpenAI client initialized with 3-minute timeout');
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
            // Validate prompt is not empty
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Image prompt cannot be empty');
            }

            console.log('🎨 [DALL-E] Generating image:', {
                promptLength: prompt.length,
                model,
                size,
                quality
            });

            const response = await this.client.images.generate({
                model,
                prompt: prompt.trim(), // Ensure no whitespace issues
                n,
                size,
                quality
            });

            console.log('✅ [DALL-E] Image generated successfully');

            return {
                success: true,
                url: response.data[0].url,
                revisedPrompt: response.data[0].revised_prompt || prompt
            };

        } catch (error) {
            console.error('❌ [DALL-E] Generation failed:', {
                error: error.message,
                status: error.status,
                prompt: prompt?.substring(0, 100)
            });
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

            // Enhanced debug logging
            console.log('🚀 [OpenAI] Starting stream:', {
                model,
                messageCount: formattedMessages.length,
                config: {
                    temperature: streamConfig.temperature,
                    maxTokens: streamConfig.max_completion_tokens || streamConfig.max_tokens,
                    hasReasoningEffort: !!streamConfig.reasoning
                },
                timestamp: new Date().toISOString()
            });

            const startTime = Date.now();
            const stream = await this.client.chat.completions.create(streamConfig);
            let fullResponse = '';
            let firstChunkTime = null;

            for await (const chunk of stream) {
                if (!firstChunkTime) {
                    firstChunkTime = Date.now();
                    console.log(`⚡ [OpenAI] First chunk received after ${firstChunkTime - startTime}ms`);
                }

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
                    console.log('✅ [OpenAI] Stream completed:', {
                        model,
                        totalTime: `${totalTime}ms`,
                        responseLength: fullResponse.length,
                        finishReason: chunk.choices[0].finish_reason
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
            console.error('❌ [OpenAI] Stream failed:', {
                model,
                error: error.message,
                status: error.status,
                type: error.constructor.name,
                timestamp: new Date().toISOString()
            });
            
            yield {
                type: 'error',
                error: error.message,
                errorType: error.constructor.name
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

            console.log('🔄 [OpenAI] Non-streaming completion:', {
                model,
                messageCount: formattedMessages.length,
                maxTokens: config.max_completion_tokens || config.max_tokens
            });

            const startTime = Date.now();
            const response = await this.client.chat.completions.create(config);
            const duration = Date.now() - startTime;

            console.log(`✅ [OpenAI] Completion received in ${duration}ms`);

            return response.choices[0].message.content;

        } catch (error) {
            console.error('❌ [OpenAI] Completion failed:', {
                model,
                error: error.message,
                status: error.status
            });
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
            // Use max_completion_tokens for GPT-5
            const adjustedMaxTokens = Math.min(maxTokens, 600);
            config.max_completion_tokens = adjustedMaxTokens;
            
            // GPT-5 DOES support temperature - set it!
            config.temperature = temperature;
            
            // Add reasoning effort control for faster responses
            // "minimal" = fastest, best for your chat use case
            config.reasoning = {
                effort: "low"  // Critical for reducing timeouts!
            };

            console.log('⚙️ [GPT-5 Config]:', {
                max_completion_tokens: adjustedMaxTokens,
                temperature: temperature,
                reasoning_effort: 'minimal',
                note: 'Using minimal reasoning for speed'
            });

        } else {
            // GPT-3.5 and GPT-4 use standard parameters
            config.max_tokens = maxTokens;
            config.temperature = temperature;
        }

        return config;
    }
}