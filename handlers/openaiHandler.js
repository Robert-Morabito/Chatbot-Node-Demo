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
            model = "dall-e-2",
            size = "1024x1024",
            n = 1
        } = options;

        try {
            const response = await this.client.images.generate({
                model,
                prompt,
                n,
                size,
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
        // CRITICAL: GPT-5 needs MUCH more tokens for reasoning
        const defaultMaxTokens = model.startsWith('gpt-5') ? 30000 : 800;
        
        const {
            includeSystemPrompt = true,
            temperature = 0.7,
            maxTokens = defaultMaxTokens
        } = options;

        const startTime = Date.now();
        let hasStartedStreaming = false;

        try {
            const formattedMessages = this.formatMessages(messages, includeSystemPrompt);
            const streamConfig = this.buildStreamConfig(model, formattedMessages, temperature, maxTokens);

            console.log('🚀 Starting stream for model:', model, {
                messageCount: messages.length,
                configParams: Object.keys(streamConfig),
                isGPT5: model.startsWith('gpt-5'),
                maxTokens: streamConfig.max_completion_tokens || streamConfig.max_tokens
            });

            const stream = await this.client.chat.completions.create(streamConfig);
            
            let fullResponse = '';
            let chunkCount = 0;

            for await (const chunk of stream) {
                if (!hasStartedStreaming) {
                    hasStartedStreaming = true;
                    const timeToFirstChunk = Date.now() - startTime;
                    console.log(`✅ ${model} first chunk received after ${timeToFirstChunk / 1000}s`);
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
                    
                    // Log warning if GPT-5 hit length limit with no output
                    if (model.startsWith('gpt-5') && chunk.choices[0].finish_reason === 'length' && fullResponse.length === 0) {
                        console.error(`⚠️ GPT-5 used all ${maxTokens} tokens for reasoning with no output!`);
                    }
                    
                    console.log(`✅ ${model} completed:`, {
                        totalTime: `${totalTime / 1000}s`,
                        chunks: chunkCount,
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

            // Check if we got no response at all
            if (!hasStartedStreaming) {
                console.error(`⚠️ ${model} stream ended without any chunks after ${(Date.now() - startTime) / 1000}s`);
                yield {
                    type: 'error',
                    error: `${model} did not respond. The model may be overloaded or the request may be too complex. Please try again.`
                };
            }

        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`❌ ${model} stream failed after ${totalTime / 1000}s:`, error.message);
            
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
        // CRITICAL: GPT-5 needs more tokens even for non-streaming
        const defaultMaxTokens = model.startsWith('gpt-5') ? 16000 : 800;
        
        const {
            includeSystemPrompt = true,
            temperature = 0.7,
            maxTokens = defaultMaxTokens,
            maxRetries = model.startsWith('gpt-5') ? 1 : 2  // Fewer retries for slow GPT-5
        } = options;

        let lastError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const formattedMessages = this.formatMessages(messages, includeSystemPrompt);
                const config = this.buildStreamConfig(model, formattedMessages, temperature, maxTokens);

                // Remove stream flag for regular completion
                delete config.stream;

                console.log(`🔄 Attempt ${attempt + 1} for ${model} completion with ${config.max_completion_tokens || config.max_tokens} tokens`);

                const response = await this.client.chat.completions.create(config);
                
                // Check if GPT-5 returned empty due to token limit
                if (model.startsWith('gpt-5') && !response.choices[0].message.content && response.choices[0].finish_reason === 'length') {
                    console.error('⚠️ GPT-5 returned empty response due to token limit');
                    throw new Error('GPT-5 used all tokens for reasoning, no output generated');
                }
                
                return response.choices[0].message.content;

            } catch (error) {
                lastError = error;
                console.error(`❌ ${model} completion attempt ${attempt + 1} failed:`, error.message);
                
                // Don't retry on 400 errors
                if (error.status === 400) {
                    throw error;
                }
                
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    console.log(`⏳ Retrying in ${delay / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
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
            // GPT-5 uses max_completion_tokens instead of max_tokens
            config.max_completion_tokens = maxTokens;
            // GPT-5 uses default temperature only - don't set it
            console.log(`⚠️ GPT-5 detected - using max_completion_tokens: ${maxTokens} (includes reasoning tokens)`);
        } else {
            config.max_tokens = maxTokens;
            config.temperature = temperature;
        }

        return config;
    }
}