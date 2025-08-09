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

        console.log('🏁 Processing session completion:', { sessionId, participantId });
        
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
            
            // Also mark as released (since completion releases the reservation)
            if (!session.released) {
                session.released = true;
                session.releasedAt = session.completedAt;
                session.releaseReason = 'completed';
            }
            
            configurationUpdated = true;

            // Update the configuration
            const configId = session.configurationId.toString();
            
            if (configData.configurations[configId]) {
                const config = configData.configurations[configId];
                
                // Increment completed sessions
                const oldCompleted = config.completedSessions;
                config.completedSessions += 1;
                
                // Decrement reserved sessions (since this slot is now "used up")
                const oldReserved = config.reservedSessions;
                config.reservedSessions = Math.max(0, config.reservedSessions - 1);
                
                console.log(`✅ Updated config ${configId}: completed ${oldCompleted} → ${config.completedSessions}, reserved ${oldReserved} → ${config.reservedSessions}`);
            }

            // Update metadata
            configData.metadata.lastUpdated = new Date().toISOString();
            
            // Save back to GitHub
            await githubStorage.saveConfigurationState(configData);
            console.log('💾 Session completion processed and saved');
        } else {
            console.log('ℹ️ Session was already completed');
        }

        res.json({
            success: true,
            message: 'Session marked as completed',
            session: session,
            configurationUpdated: configurationUpdated
        });

    } catch (error) {
        console.error('❌ Session completion error:', error.message);
        res.status(500).json({
            error: 'Failed to mark session completed',
            details: error.message
        });
    }
}