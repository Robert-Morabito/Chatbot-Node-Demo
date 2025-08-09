import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { configurationId } = req.body;
        
        if (!configurationId) {
            return res.status(400).json({ error: 'Configuration ID required' });
        }

        console.log('🔓 Releasing reservation for config:', configurationId);
        
        // Load, modify, save - same pattern as assignment
        const configData = await githubStorage.loadConfigurationState();
        
        const config = configData.configurations[configurationId.toString()];
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        // Simply decrement (same as we increment in assign)
        if (config.reservedSessions > 0) {
            config.reservedSessions -= 1;
            
            // Reactivate if needed
            if (config.reservedSessions < config.targetSessions) {
                config.isActive = true;
            }
            
            console.log('✅ Decremented config', configurationId, 'reserved:', config.reservedSessions);
        }

        // Save (same as assignment)
        configData.metadata.lastUpdated = new Date().toISOString();
        await githubStorage.saveConfigurationState(configData);

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Release error:', error);
        res.status(500).json({ error: error.message });
    }
}