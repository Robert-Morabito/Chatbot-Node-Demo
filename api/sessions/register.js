/**
 * Session Registration Handler
 * Updates existing sessions with participant info (doesn't overwrite)
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

        console.log('📝 Registering participant for existing session:', { sessionId, participantId, configurationId });

        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();

        // Find existing session (should exist from assignment)
        const existingSession = configData.sessions[sessionId];
        
        if (!existingSession) {
            return res.status(404).json({ error: 'Session not found - assignment may have failed' });
        }

        // UPDATE existing session instead of overwriting
        configData.sessions[sessionId] = {
            ...existingSession,  // Keep all existing data
            participantId,       // Add participant info
            registeredAt: new Date().toISOString()  // Add registration timestamp
        };

        // Update metadata
        configData.metadata.lastUpdated = new Date().toISOString();

        // Save back to GitHub
        await githubStorage.saveConfigurationState(configData);

        console.log('✅ Session registration completed - participant added to existing session');

        res.json({
            success: true,
            message: 'Session registered successfully'
        });

    } catch (error) {
        console.error('❌ Session registration error:', error.message);
        res.status(500).json({
            error: 'Failed to register session',
            details: error.message
        });
    }
}