import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Environment Check:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Found' : '❌ Missing');
console.log('PORT:', process.env.PORT || '3000 (default)');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

// Test the OpenAI connection
import { OpenAIHandler } from './handlers/openaiHandler.js';

async function test() {
    try {
        const handler = new OpenAIHandler(process.env.OPENAI_API_KEY);
        console.log('✅ OpenAI handler created successfully');
        
        // Test image generation
        console.log('\n🧪 Testing image generation...');
        const result = await handler.generateImage('a cute cat');
        console.log('✅ Image URL:', result.url);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

test();