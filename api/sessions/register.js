/**
 * Session Registration Handler
 * Registers new study sessions and updates configuration state
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, participantId, configurationId } = req.body;
        
        if (!sessionId || !participantId || !configurationId) {
            return res.status(400).json({ 
                error: 'Session ID, Participant ID, and Configuration ID required' 
            });
        }

        console.log('Registering session:', { sessionId, participantId, configurationId });

        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();

        // Add session to the state
        configData.sessions[sessionId] = {
            sessionId,
            participantId,
            configurationId,
            assignedAt: new Date().toISOString(),
            completed: false,
            completedAt: null
        };

        // Update metadata
        configData.metadata.lastUpdated = new Date().toISOString();

        // Save back to GitHub
        await githubStorage.saveConfigurationState(configData);

        console.log('Session registered successfully');

        res.json({
            success: true,
            message: 'Session registered successfully'
        });

    } catch (error) {
        console.error('Session registration error:', error.message);
        res.status(500).json({
            error: 'Failed to register session',
            details: error.message
        });
    }
}