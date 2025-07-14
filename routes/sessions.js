import express from 'express';
import GitHubStorage from '../utils/githubStorage.js';

const router = express.Router();
const githubStorage = new GitHubStorage();

/**
 * POST /api/sessions/register
 * Register a new session with participant ID
 */
router.post('/register', async (req, res) => {
    try {
        const { sessionId, participantId, configurationId } = req.body;
        
        if (!sessionId || !participantId || !configurationId) {
            return res.status(400).json({ 
                error: 'Session ID, Participant ID, and Configuration ID required' 
            });
        }

        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();

        // Validate configuration exists and is active
        const config = configData.configurations[configurationId];
        if (!config) {
            return res.status(400).json({ error: 'Invalid configuration ID' });
        }

        if (!config.isActive) {
            return res.status(400).json({ error: 'Configuration is no longer active' });
        }

        // Check if session already exists
        if (configData.sessions[sessionId]) {
            return res.status(409).json({ error: 'Session already registered' });
        }

        // Create session record
        const session = {
            sessionId,
            participantId,
            configurationId: parseInt(configurationId),
            displayedModel: config.displayedModel,
            actualModel: config.actualModel,
            assignedAt: new Date().toISOString(),
            completed: false,
            completedAt: null
        };

        // Add session to configuration data
        configData.sessions[sessionId] = session;
        configData.metadata.lastUpdated = new Date().toISOString();

        // Save updated state to GitHub
        await githubStorage.saveConfigurationState(configData);

        console.log(`📝 Registered session ${sessionId} for participant ${participantId} with config ${configurationId}`);

        res.json({
            success: true,
            message: 'Session registered successfully',
            session: session
        });

    } catch (error) {
        console.error('Session registration error:', error);
        res.status(500).json({
            error: 'Failed to register session',
            details: error.message
        });
    }
});

/**
 * POST /api/sessions/complete
 * Mark session as completed
 */
router.post('/complete', async (req, res) => {
    try {
        const { sessionId, participantId } = req.body;
        
        if (!sessionId || !participantId) {
            return res.status(400).json({ error: 'Session ID and Participant ID required' });
        }

        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();

        // Find the session
        let session = configData.sessions[sessionId];
        if (!session) {
            // Session not found - this means the session wasn't properly registered
            console.error(`Session ${sessionId} not found in configuration data`);
            return res.status(400).json({ 
                error: 'Session not found',
                message: 'Session was not properly registered. Please contact support.'
            });
        }

        // Only mark as completed if not already done
        if (!session.completed) {
            session.completed = true;
            session.completedAt = new Date().toISOString();

            // Increment the configuration's completed sessions count
            const configId = session.configurationId;
            if (configData.configurations[configId]) {
                configData.configurations[configId].completedSessions += 1;
                
                // Check if configuration has reached target sessions and deactivate it
                if (configData.configurations[configId].completedSessions >= configData.configurations[configId].targetSessions) {
                    configData.configurations[configId].isActive = false;
                    console.log(`🔒 Configuration ${configId} deactivated (reached target sessions)`);
                }
                
                console.log(`✅ Incremented completion count for config ${configId}: ${configData.configurations[configId].completedSessions}/${configData.configurations[configId].targetSessions}`);
            }

            // Update metadata
            configData.metadata.lastUpdated = new Date().toISOString();

            // Save updated state back to GitHub
            await githubStorage.saveConfigurationState(configData);

            console.log(`✅ Session ${sessionId} marked as completed`);
        }

        res.json({
            success: true,
            message: 'Session marked as completed',
            session: session
        });

    } catch (error) {
        console.error('Session completion error:', error);
        res.status(500).json({
            error: 'Failed to mark session completed',
            details: error.message
        });
    }
});

export { router as sessionsRouter };
