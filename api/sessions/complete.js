/**
 * Session Completion API
 * 
 * Marks study sessions as completed and updates configuration state.
 * This endpoint handles the final step of a participant's session,
 * updating counters and releasing reserved slots.
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
            return res.status(400).json({ 
                error: 'Session ID and Participant ID are required' 
            });
        }

        const configData = await githubStorage.loadConfigurationState();
        const session = configData.sessions[sessionId];
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Only process if session isn't already completed
        let wasUpdated = false;
        if (!session.completed) {
            wasUpdated = completeSession(session, configData);
            await githubStorage.saveConfigurationState(configData);
        }

        res.json({
            success: true,
            message: 'Session marked as completed',
            session: session,
            configurationUpdated: wasUpdated
        });

    } catch (error) {
        console.error('Session completion failed:', error.message);
        res.status(500).json({
            error: 'Failed to mark session completed',
            details: error.message
        });
    }
}

/**
 * Completes a session and updates related configuration counters.
 * 
 * @param {Object} session - Session to complete
 * @param {Object} configData - Full configuration data
 * @returns {boolean} Whether configuration was updated
 */
function completeSession(session, configData) {
    const now = new Date().toISOString();
    
    // Mark session as completed and released
    session.completed = true;
    session.completedAt = now;
    session.released = true;
    session.releasedAt = now;
    session.releaseReason = 'completed';

    // Update configuration counters
    const config = configData.configurations[session.configurationId.toString()];
    if (config) {
        config.completedSessions += 1;
        config.reservedSessions = Math.max(0, config.reservedSessions - 1);
    }

    // Update metadata
    configData.metadata.lastUpdated = now;
    
    return true;
}