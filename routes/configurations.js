import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /tmp for Vercel serverless
const configFile = path.join('/tmp', 'model-configurations.json');

// Initialize configurations file
async function initializeConfigurations() {
    try {
        if (!await fs.pathExists(configFile)) {
            const initialData = {
                configurations: {
                    "1": { id: 1, displayedModel: "GPT-3.5", actualModel: "gpt-3.5-turbo-0125", completedSessions: 0, targetSessions: 12, isActive: true },
                    "2": { id: 2, displayedModel: "GPT-3.5", actualModel: "gpt-4-turbo", completedSessions: 0, targetSessions: 12, isActive: true },
                    "3": { id: 3, displayedModel: "GPT-3.5", actualModel: "o1-preview", completedSessions: 0, targetSessions: 12, isActive: true },
                    "4": { id: 4, displayedModel: "GPT-4", actualModel: "gpt-3.5-turbo-0125", completedSessions: 0, targetSessions: 12, isActive: true },
                    "5": { id: 5, displayedModel: "GPT-4", actualModel: "gpt-4-turbo", completedSessions: 0, targetSessions: 12, isActive: true },
                    "6": { id: 6, displayedModel: "GPT-4", actualModel: "o1-preview", completedSessions: 0, targetSessions: 12, isActive: true },
                    "7": { id: 7, displayedModel: "o1-Preview", actualModel: "gpt-3.5-turbo-0125", completedSessions: 0, targetSessions: 12, isActive: true },
                    "8": { id: 8, displayedModel: "o1-Preview", actualModel: "gpt-4-turbo", completedSessions: 0, targetSessions: 12, isActive: true },
                    "9": { id: 9, displayedModel: "o1-Preview", actualModel: "o1-preview", completedSessions: 0, targetSessions: 12, isActive: true }
                },
                sessions: {},
                metadata: {
                    totalConfigurations: 9,
                    totalTargetSessions: 108,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                }
            };

            await fs.writeJson(configFile, initialData, { spaces: 2 });
            console.log('🔧 Initialized model configurations');
        }
    } catch (error) {
        console.error('Error initializing configurations:', error);
        // Don't throw error in serverless environment
    }
}

// Get next available configuration (with fallback)
async function getNextConfiguration() {
    try {
        // Initialize if file doesn't exist
        await initializeConfigurations();

        const data = await fs.readJson(configFile);

        // Find configuration with lowest completion count
        let nextConfig = null;
        let minCompletions = Infinity;

        for (const config of Object.values(data.configurations)) {
            if (config.isActive && config.completedSessions < minCompletions) {
                minCompletions = config.completedSessions;
                nextConfig = config;
            }
        }

        return nextConfig || data.configurations["1"]; // Fallback
    } catch (error) {
        console.error('Error getting next configuration:', error);
        // Return default configuration
        return { id: 1, displayedModel: "GPT-4", actualModel: "gpt-4-turbo", completedSessions: 0, targetSessions: 12, isActive: true };
    }
}

// Assign configuration to new session
async function assignConfiguration() {
    try {
        const data = await fs.readJson(configFile);
        const config = await getNextConfiguration();

        if (!config) {
            throw new Error('No available configurations');
        }

        // Generate session info
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const participantId = generateParticipantId();

        // Record session
        data.sessions[sessionId] = {
            sessionId,
            participantId,
            configurationId: config.id,
            displayedModel: config.displayedModel,
            actualModel: config.actualModel,
            assignedAt: new Date().toISOString(),
            completed: false,
            completedAt: null
        };

        // Update metadata
        data.metadata.lastUpdated = new Date().toISOString();

        await fs.writeJson(configFile, data, { spaces: 2 });

        console.log(`🎯 Assigned config ${config.id} to participant ${participantId}`);

        return {
            sessionId,
            participantId,
            configuration: config
        };

    } catch (error) {
        console.error('Error assigning configuration:', error);
        throw error;
    }
}

// Mark session as completed
async function markSessionCompleted(sessionId) {
    try {
        const data = await fs.readJson(configFile);

        const session = data.sessions[sessionId];
        if (!session) {
            throw new Error('Session not found');
        }

        if (!session.completed) {
            // Mark session complete
            session.completed = true;
            session.completedAt = new Date().toISOString();

            // Increment configuration completion count
            const configId = session.configurationId.toString();
            if (data.configurations[configId]) {
                data.configurations[configId].completedSessions += 1;
            }

            // Update metadata
            data.metadata.lastUpdated = new Date().toISOString();

            await fs.writeJson(configFile, data, { spaces: 2 });

            console.log(`✅ Completed session ${sessionId} for config ${session.configurationId}`);
        }

        return session;
    } catch (error) {
        console.error('Error marking session completed:', error);
        throw error;
    }
}

// Generate simple participant ID
function generateParticipantId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * GET /api/configurations/assign
 * Assign next configuration to new session
 */
router.get('/assign', async (req, res) => {
    try {
        const assignment = await assignConfiguration();

        res.json({
            success: true,
            sessionId: assignment.sessionId,
            participantId: assignment.participantId,
            configuration: {
                id: assignment.configuration.id,
                displayedModel: assignment.configuration.displayedModel,
                actualModel: assignment.configuration.actualModel
            }
        });
    } catch (error) {
        console.error('Configuration assignment error:', error);
        res.status(500).json({
            error: 'Failed to assign configuration',
            details: error.message
        });
    }
});

/**
 * POST /api/configurations/complete
 * Mark session as completed
 */
router.post('/complete', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        const session = await markSessionCompleted(sessionId);

        res.json({
            success: true,
            session: session
        });
    } catch (error) {
        console.error('Configuration completion error:', error);
        res.status(500).json({
            error: 'Failed to mark session completed',
            details: error.message
        });
    }
});

/**
 * GET /api/configurations/status
 * Get current status of all configurations
 */
router.get('/status', async (req, res) => {
    try {
        const data = await fs.readJson(configFile);

        const status = {
            configurations: data.configurations,
            totalSessions: Object.keys(data.sessions).length,
            completedSessions: Object.values(data.sessions).filter(s => s.completed).length,
            activeSessions: Object.values(data.sessions).filter(s => !s.completed).length,
            metadata: data.metadata
        };

        res.json({
            success: true,
            status: status
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({
            error: 'Failed to get status',
            details: error.message
        });
    }
});

// Initialize on startup
await initializeConfigurations();

export { router as configurationsRouter };