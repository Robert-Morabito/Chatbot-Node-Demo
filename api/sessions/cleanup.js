/**
 * Session Cleanup Handler
 * Decrements reserved sessions when participants quit without finishing
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    // Handle both POST and GET for sendBeacon compatibility
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, configurationId, action } = req.body;
        
        console.log('🧹 Cleanup request received:', { sessionId, configurationId, action });
        
        if (!sessionId || !configurationId || action !== 'cleanup_reservation') {
            console.log('❌ Invalid cleanup request');
            return res.status(400).json({ error: 'Invalid cleanup request' });
        }
        
        // Load configuration state
        const configData = await githubStorage.loadConfigurationState();
        
        // Check if session exists
        const session = configData.sessions[sessionId];
        
        if (!session) {
            console.log('ℹ️ Session not found, may have been cleaned up already');
            return res.json({ success: true, message: 'Session not found' });
        }

        if (session.completed) {
            console.log('ℹ️ Session already completed, no cleanup needed');
            return res.json({ success: true, message: 'Session already completed' });
        }

        // Find and update the configuration
        const configId = configurationId.toString();
        const config = configData.configurations[configId];
        
        if (!config) {
            console.error('❌ Configuration not found:', configId);
            return res.status(404).json({ error: 'Configuration not found' });
        }

        // Decrement reserved sessions if there are any to decrement
        const currentReserved = config.reservedSessions || 0;
        if (currentReserved > config.completedSessions) {
            config.reservedSessions = currentReserved - 1;
            
            console.log(`🧹 Decremented reservation for config ${configId}: ${currentReserved} → ${config.reservedSessions}`);
            
            // Reactivate configuration if it was deactivated due to full reservations
            if (config.reservedSessions < config.targetSessions) {
                config.isActive = true;
                console.log(`✅ Reactivated configuration ${configId}`);
            }
        } else {
            console.log('ℹ️ No reservations to clean up for config', configId);
        }

        // Remove the session record
        delete configData.sessions[sessionId];
        
        // Update metadata
        configData.metadata.lastUpdated = new Date().toISOString();
        
        // Save back to GitHub
        await githubStorage.saveConfigurationState(configData);
        console.log('✅ Cleanup completed and saved');

        res.json({
            success: true,
            message: 'Session reservation cleaned up',
            configurationId: configId,
            newReservedCount: config.reservedSessions || 0
        });

    } catch (error) {
        console.error('❌ Session cleanup error:', error);
        res.status(500).json({
            error: 'Failed to cleanup session',
            details: error.message
        });
    }
}