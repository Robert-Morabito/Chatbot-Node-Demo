/**
 * Session Registration API
 * 
 * Registers participant information with an existing session that was
 * created during configuration assignment. This endpoint updates the
 * session record with participant details without overwriting existing data.
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, participantId, configurationId } = req.body;
        
        // Validate required parameters
        if (!sessionId || !participantId || !configurationId) {
            return res.status(400).json({ 
                error: 'Session ID, Participant ID, and Configuration ID are required' 
            });
        }

        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();
        const existingSession = configData.sessions[sessionId];
        
        if (!existingSession) {
            return res.status(404).json({ 
                error: 'Session not found - assignment may have failed' 
            });
        }

        // Update session with participant information (preserve existing data)
        configData.sessions[sessionId] = {
            ...existingSession,
            participantId,
            registeredAt: new Date().toISOString()
        };

        // Update metadata timestamp
        configData.metadata.lastUpdated = new Date().toISOString();

        // Save updated configuration state
        await githubStorage.saveConfigurationState(configData);

        res.json({
            success: true,
            message: 'Session registered successfully'
        });

    } catch (error) {
        console.error('Session registration failed:', error.message);
        res.status(500).json({
            error: 'Failed to register session',
            details: error.message
        });
    }
}