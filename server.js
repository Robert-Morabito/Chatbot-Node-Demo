// LOAD ENVIRONMENT VARIABLES FIRST
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import remaining routes (removed configurationsRouter)
import { chatRouter } from './routes/chat.js';
import { saveRouter } from './routes/save.js';
import { modelsRouter } from './routes/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/save', saveRouter);
app.use('/api/models', modelsRouter);

// Add configurations API routes (using API folder structure)
app.use('/api/configurations', async (req, res, next) => {
    try {
        if (req.path === '/assign' && req.method === 'GET') {
            const handler = (await import('./api/configurations/assign.js')).default;
            return handler(req, res);
        } else if (req.path === '/status' && req.method === 'GET') {
            const handler = (await import('./api/configurations/status.js')).default;
            return handler(req, res);
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Add sessions API routes
app.use('/api/sessions', async (req, res, next) => {
    try {
        if (req.path === '/register' && req.method === 'POST') {
            const handler = (await import('./api/sessions/register.js')).default;
            return handler(req, res);
        } else if (req.path === '/complete' && req.method === 'POST') {
            const handler = (await import('./api/sessions/complete.js')).default;
            return handler(req, res);
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Health check with API key validation
app.get('/api/health', (req, res) => {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const keyPrefix = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'not set';

    console.log('🔍 Health check - OpenAI API Key:', hasOpenAIKey ? 'present' : 'missing');
    console.log('🔑 Key prefix:', keyPrefix);

    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        imageGeneration: hasOpenAIKey,
        apiKeyStatus: hasOpenAIKey ? 'configured' : 'missing'
    });
});

// Test GitHub connection
app.get('/api/test-github', async (req, res) => {
    try {
        const GitHubStorage = (await import('./utils/githubStorage.js')).default;
        const storage = new GitHubStorage();

        const testResult = await storage.testConnection();

        res.json({
            success: testResult,
            config: {
                owner: process.env.GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER,
                repo: process.env.GITHUB_REPO || process.env.VERCEL_GIT_REPO_SLUG,
                hasToken: !!process.env.GITHUB_TOKEN
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});