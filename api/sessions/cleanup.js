/**
 * Session Cleanup Handler
 * Decrements reserved sessions when participants quit without finishing
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, configurationId, action } = req.body;
        
        if (!sessionId || !configurationId || action !== 'cleanup_reservation') {
            return res.status(400).json({ error: 'Invalid cleanup request' });
        }

        console.log('🧹 Processing session cleanup:', { sessionId, configurationId });
        
        // Load configuration state
        const configData = await githubStorage.loadConfigurationState();
        
        // Check if session exists and is not completed
        const session = configData.sessions[sessionId];
        
        if (!session) {
            console.log('ℹ️ Session not found, may have been cleaned up already');
            return res.json({ success: true, message: 'Session not found' });
        }

        if (session.completed) {
            console.log('ℹ️ Session already completed, no cleanup needed');
            return res.json({ success: true, message: 'Session already completed' });
        }

        // Find the configuration and decrement reserved sessions
        const configId = configurationId.toString();
        const config = configData.configurations[configId];
        
        if (!config) {
            console.error('❌ Configuration not found:', configId);
            return res.status(404).json({ error: 'Configuration not found' });
        }

        // Decrement reserved sessions (but don't go below completed sessions)
        if (config.reservedSessions > config.completedSessions) {
            const oldReserved = config.reservedSessions;
            config.reservedSessions -= 1;
            
            console.log(`🧹 Cleaned up reservation for config ${configId}: ${oldReserved} → ${config.reservedSessions} reserved`);
            
            // Reactivate configuration if it was deactivated due to full reservations
            if (config.reservedSessions < config.targetSessions && !config.isActive) {
                config.isActive = true;
                console.log(`✅ Reactivated configuration ${configId} (${config.reservedSessions}/${config.targetSessions})`);
            }
        }

        // Remove the session record
        delete configData.sessions[sessionId];
        
        // Update metadata
        configData.metadata.lastUpdated = new Date().toISOString();
        
        // Save back to GitHub
        await githubStorage.saveConfigurationState(configData);
        console.log('✅ Session cleanup completed and saved');

        res.json({
            success: true,
            message: 'Session reservation cleaned up',
            configurationId: configId,
            newReservedCount: config.reservedSessions,
            reactivated: config.isActive
        });

    } catch (error) {
        console.error('❌ Session cleanup error:', error.message);
        res.status(500).json({
            error: 'Failed to cleanup session',
            details: error.message
        });
    }
}