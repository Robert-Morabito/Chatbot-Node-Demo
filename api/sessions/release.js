/**
 * Session Release Handler
 * Releases reserved slots when participants leave without completing
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, participantId, reason = 'unknown' } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        console.log('🔓 Processing session release:', { sessionId, participantId, reason });
        
        const configData = await githubStorage.loadConfigurationState();
        const session = configData.sessions[sessionId];
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Only release if not already completed or released
        if (!session.completed && !session.released) {
            session.released = true;
            session.releasedAt = new Date().toISOString();
            session.releaseReason = reason;

            // Decrement the reserved sessions for this configuration
            const configId = session.configurationId.toString();
            
            if (configData.configurations[configId]) {
                const config = configData.configurations[configId];
                const oldReserved = config.reservedSessions;
                config.reservedSessions = Math.max(0, config.reservedSessions - 1);
                
                // Reactivate configuration if it now has available slots
                const availableSlots = config.targetSessions - config.reservedSessions;
                if (availableSlots > 0 && !config.isActive) {
                    config.isActive = true;
                    console.log(`🔄 Reactivated configuration ${configId} - now has available slots`);
                }
                
                console.log(`🔓 Released reservation for config ${configId}: ${oldReserved} → ${config.reservedSessions}/${config.targetSessions}`);
            }

            // Update metadata
            configData.metadata.lastUpdated = new Date().toISOString();
            
            // Save back to GitHub
            await githubStorage.saveConfigurationState(configData);
            console.log('💾 Session release processed and saved');

            res.json({
                success: true,
                message: 'Session reservation released',
                sessionId: sessionId,
                reason: reason
            });
        } else {
            console.log('ℹ️ Session already completed or released');
            res.json({
                success: true,
                message: 'Session already processed',
                sessionId: sessionId
            });
        }

    } catch (error) {
        console.error('❌ Session release error:', error.message);
        res.status(500).json({
            error: 'Failed to release session',
            details: error.message
        });
    }
}