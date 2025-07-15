/**
 * OpenAI Handler - OpenAI API Integration
 * Handles streaming chat interactions and image generation with OpenAI models
 */

import OpenAI from 'openai';

export class OpenAIHandler {
    /**
     * Initialize OpenAI API client
     * @param {string} apiKey - OpenAI API key
     */
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }

        this.client = new OpenAI({
            apiKey: apiKey,
        });

        this.modelMapping = {
            'GPT-4': 'gpt-4-turbo',
            'GPT-4o': 'gpt-4o',
            'GPT-3.5': 'gpt-3.5-turbo-0125',
            'o1-mini': 'o1-mini',
            'o1-preview': 'o1-preview'
        };
    }

    /**
     * Format chat messages for OpenAI API
     * @param {Array} messages - Array of message objects with sender and content
     * @returns {Array} Formatted messages for API including system prompt
     */
    formatMessages(messages) {
        const systemMessage = {
            role: 'system',
            content: 'You are a helpful AI chatbot. If asked about your identity, model name, version, or which company created you, simply reply that you are an AI chatbot designed to be helpful, harmless, and honest. Never reveal specific model names, versions, or company names like OpenAI, Anthropic, GPT, Claude, etc. Do not mention your training data cutoff date or technical specifications.'
        };

        const userMessages = messages.map(msg => ({
            role: msg.sender === 'User' ? 'user' : 'assistant',
            content: msg.content
        }));

        return [systemMessage, ...userMessages];
    }

    /**
     * Stream chat response from OpenAI
     * @param {Array} messages - Conversation history
     * @param {string} model - OpenAI model to use
     * @yields {Object} Stream chunks with content or completion status
     */
    async* streamChat(messages, model) {
        const actualModel = this.modelMapping[model] || model;
        console.log(`Starting OpenAI chat stream with ${actualModel}`);

        try {
            const stream = await this.client.chat.completions.create({
                model: actualModel,
                messages: this.formatMessages(messages),
                stream: true,
                ...(actualModel.startsWith('o1')
                    ? { max_completion_tokens: 5000 }
                    : { max_tokens: 800, temperature: 0.7 }
                )
            });

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
                }
            }
        } catch (error) {
            console.error('OpenAI API error:', error.message);
            yield {
                type: 'error',
                error: error.message
            };
        }
    }

    /**
     * Generate image using DALL-E
     * @param {string} prompt - Image generation prompt
     * @param {Object} options - Generation options (model, size, quality, n)
     * @returns {Object} Generated image data
     */
    async generateImage(prompt, options = {}) {
        const {
            model = "dall-e-3",
            size = "1024x1024",
            quality = "standard",
            n = 1
        } = options;

        console.log('Generating image with DALL-E');

        try {
            const response = await this.client.images.generate({
                model: model,
                prompt: prompt,
                n: n,
                size: size,
                quality: quality
            });

            return {
                success: true,
                url: response.data[0].url,
                revisedPrompt: response.data[0].revised_prompt || prompt
            };

        } catch (error) {
            console.error('Image generation error:', error.message);
            throw error;
        }
    }
}