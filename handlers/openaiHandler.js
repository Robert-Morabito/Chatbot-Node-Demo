import OpenAI from 'openai';

export class OpenAIHandler {
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

    formatMessages(messages) {
        // Add system prompt first
        const systemMessage = {
            role: 'system',
            content: 'You are a helpful AI chatbot. If asked about your identity, model name, version, or which company created you, simply reply that you are an AI chatbot designed to be helpful, harmless, and honest. Never reveal specific model names, versions, or company names like OpenAI, Anthropic, GPT, Claude, etc. Do not mention your training data cutoff date or technical specifications.'
        };

        // Convert user messages
        const userMessages = messages.map(msg => ({
            role: msg.sender === 'User' ? 'user' : 'assistant',
            content: msg.content
        }));

        // Return system message + user messages
        return [systemMessage, ...userMessages];
    }

    async generateImage(prompt, options = {}) {
        const {
            model = "dall-e-3",
            size = "1024x1024",
            quality = "standard",
            n = 1
        } = options;

        console.log('🎨 [OpenAI] Generating image with DALL-E-3');
        console.log('📝 [OpenAI] Prompt:', prompt);

        try {
            const response = await this.client.images.generate({
                model: model,
                prompt: prompt,
                n: n,
                size: size,
                quality: quality
            });

            console.log('✅ [OpenAI] Image generated successfully');

            return {
                success: true,
                url: response.data[0].url,
                revisedPrompt: response.data[0].revised_prompt || prompt
            };

        } catch (error) {
            console.error('❌ [OpenAI] Image generation error:', error);
            throw error;
        }
    }

    async* streamChat(messages, model) {
        const actualModel = this.modelMapping[model] || model;
        console.log('💬 [OpenAI] Starting chat stream with model:', actualModel);

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
            console.error('❌ [OpenAI] Chat stream error:', error);
            yield {
                type: 'error',
                error: error.message
            };
        }
    }

    async simpleCompletion(prompt, model) {
        const actualModel = this.modelMapping[model] || model;
        console.log('💬 [OpenAI] Simple completion with model:', actualModel);

        try {
            const messages = [
                {
                    role: 'system',
                    content: 'You are a helpful AI assistant. Provide concise, accurate responses.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const completion = await this.client.chat.completions.create({
                model: actualModel,
                messages: messages,
                ...(actualModel.startsWith('o1')
                    ? { max_completion_tokens: 1000 }
                    : { max_tokens: 500, temperature: 0.3 }
                )
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('❌ [OpenAI] Simple completion error:', error);
            throw error;
        }
    }
}