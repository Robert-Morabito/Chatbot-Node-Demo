import OpenAI from 'openai';

export class OpenAIHandler {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.client = new OpenAI({
            apiKey: this.apiKey,
        });
        
        // Model name mapping
        this.modelMapping = {
            'GPT-4': 'gpt-4-turbo',
            'GPT-4o': 'gpt-4o', 
            'GPT-3.5': 'gpt-3.5-turbo-0125',
            'o1-mini': 'o1-mini',
            'o1-preview': 'o1-preview'
        };
    }

    /**
     * Convert conversation history to OpenAI format
     */
    formatMessages(messages) {
        return messages.map(msg => ({
            role: msg.sender === 'User' ? 'user' : 'assistant',
            content: msg.content
        }));
    }

    /**
     * Handle streaming chat completion
     */
    async* chatStream(conversation, model) {
        try {
            const messages = this.formatMessages(conversation);
            const actualModel = this.modelMapping[model] || model;
            
            console.log(`🤖 Starting OpenAI stream for model: ${actualModel}`);
            
            const requestConfig = {
                model: actualModel,
                messages: messages,
                stream: true,
            };
            
            // Special handling for o1 models
            if (actualModel.startsWith('o1')) {
                requestConfig.max_completion_tokens = 5000;
            } else {
                requestConfig.max_tokens = 800;
                requestConfig.temperature = 0.7;
            }
            
            const stream = await this.client.chat.completions.create(requestConfig);
            
            let fullResponse = '';
            
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                
                if (delta?.content) {
                    const content = delta.content;
                    fullResponse += content;
                    
                    yield {
                        type: 'content',
                        content: content,
                        fullContent: fullResponse
                    };
                }
                
                if (chunk.choices[0]?.finish_reason) {
                    yield {
                        type: 'done',
                        content: '',
                        fullContent: fullResponse,
                        finishReason: chunk.choices[0].finish_reason
                    };
                    break;
                }
            }
            
        } catch (error) {
            console.error('OpenAI Stream Error:', error);
            yield {
                type: 'error',
                content: '',
                fullContent: '',
                error: error.message || 'An error occurred while processing your request.'
            };
        }
    }

    /**
     * Non-streaming chat completion (fallback)
     */
    async chat(conversation, model) {
        try {
            const messages = this.formatMessages(conversation);
            const actualModel = this.modelMapping[model] || model;
            
            const requestConfig = {
                model: actualModel,
                messages: messages,
            };
            
            if (actualModel.startsWith('o1')) {
                requestConfig.max_completion_tokens = 5000;
            } else {
                requestConfig.max_tokens = 800;
                requestConfig.temperature = 0.7;
            }
            
            const response = await this.client.chat.completions.create(requestConfig);
            return response.choices[0].message.content;
            
        } catch (error) {
            console.error('OpenAI Chat Error:', error);
            throw new Error(`OpenAI API Error: ${error.message}`);
        }
    }
}