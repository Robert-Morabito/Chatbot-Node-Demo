/**
 * Session Completion Handler
 * Marks study sessions as completed and updates configuration state
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, participantId } = req.body;
        
        if (!sessionId || !participantId) {
            return res.status(400).json({ error: 'Session ID and Participant ID required' });
        }

        console.log('Processing session completion:', { sessionId, participantId });
        
        // Load from GitHub Storage repo
        const configData = await githubStorage.loadConfigurationState();
        const session = configData.sessions[sessionId];
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        let configurationUpdated = false;

        // Only mark as completed if not already done
        if (!session.completed) {
            session.completed = true;
            session.completedAt = new Date().toISOString();
            configurationUpdated = true;

            // Increment the configuration's completed sessions count
            const configId = session.configurationId.toString();
            
            if (configData.configurations[configId]) {
                const config = configData.configurations[configId];
                const oldCount = config.completedSessions;
                config.completedSessions += 1;
                
                console.log(`Updated completion count for config ${configId}: ${oldCount} → ${config.completedSessions}/${config.targetSessions}`);
                
                // Check if configuration has reached its target and deactivate it
                if (config.completedSessions >= config.targetSessions) {
                    config.isActive = false;
                    console.log(`Configuration ${configId} has reached target and is now inactive`);
                }
            }

            // Update metadata
            configData.metadata.lastUpdated = new Date().toISOString();
            
            // Save back to GitHub Storage repo
            await githubStorage.saveConfigurationState(configData);
            console.log('Session completion processed successfully');
        } else {
            console.log('Session was already completed');
        }

        res.json({
            success: true,
            message: 'Session marked as completed',
            session: session,
            configurationUpdated: configurationUpdated
        });

    } catch (error) {
        console.error('Session completion error:', error.message);
        res.status(500).json({
            error: 'Failed to mark session completed',
            details: error.message
        });
    }
}