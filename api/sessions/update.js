/**
 * Session Update API
 * 
 * Handles session state changes including completion and slot release.
 * Consolidates session management into a single endpoint to reduce complexity.
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, sessionId, participantId, configurationId } = req.body;
        
        if (!action) {
            return res.status(400).json({ error: 'Action is required' });
        }

        const configData = await githubStorage.loadConfigurationState();
        
        let result;
        switch (action) {
            case 'complete':
                result = await handleSessionCompletion(sessionId, participantId, configData);
                break;
            case 'release':
                result = await handleSlotRelease(configurationId, configData);
                break;
            default:
                return res.status(400).json({ error: 'Invalid action. Use "complete" or "release"' });
        }

        await githubStorage.saveConfigurationState(configData);
        res.json(result);

    } catch (error) {
        console.error('Session update failed:', error.message);
        res.status(500).json({
            error: 'Failed to update session',
            details: error.message
        });
    }
}

/**
 * Handles session completion
 */
async function handleSessionCompletion(sessionId, participantId, configData) {
    if (!sessionId || !participantId) {
        throw new Error('Session ID and Participant ID are required for completion');
    }

    const session = configData.sessions[sessionId];
    if (!session) {
        throw new Error('Session not found');
    }

    if (session.completed) {
        return {
            success: true,
            message: 'Session was already completed',
            session: session,
            configurationUpdated: false
        };
    }

    // Mark session as completed
    const now = new Date().toISOString();
    session.completed = true;
    session.completedAt = now;
    session.released = true;
    session.releasedAt = now;
    session.releaseReason = 'completed';

    // Update configuration counters
    updateConfigurationCounters(session.configurationId, configData, 'complete');
    configData.metadata.lastUpdated = now;

    return {
        success: true,
        message: 'Session marked as completed',
        session: session,
        configurationUpdated: true
    };
}

/**
 * Handles slot release (for abandoned sessions)
 */
async function handleSlotRelease(configurationId, configData) {
    if (!configurationId) {
        throw new Error('Configuration ID is required for release');
    }

    updateConfigurationCounters(configurationId, configData, 'release');
    configData.metadata.lastUpdated = new Date().toISOString();

    return {
        success: true,
        message: 'Slot released successfully'
    };
}

/**
 * Updates configuration counters for completion or release
 */
function updateConfigurationCounters(configurationId, configData, action) {
    const config = configData.configurations[configurationId.toString()];
    if (!config) {
        throw new Error('Configuration not found');
    }

    if (action === 'complete') {
        config.completedSessions += 1;
    }

    // Both actions decrement reserved sessions
    if (config.reservedSessions > 0) {
        config.reservedSessions -= 1;
    }

    // Reactivate configuration if slots available
    if (config.reservedSessions < config.targetSessions) {
        config.isActive = true;
    }
}