import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const configData = await githubStorage.loadConfigurationState();
        
        // Calculate statistics
        const stats = {
            configurations: {},
            totalSessions: Object.keys(configData.sessions).length,
            completedSessions: Object.values(configData.sessions).filter(s => s.completed).length,
            activeSessions: Object.values(configData.sessions).filter(s => !s.completed).length,
            remainingSlots: 0
        };
        
        // Configuration-specific stats
        for (const [id, config] of Object.entries(configData.configurations)) {
            stats.configurations[id] = {
                displayedModel: config.displayedModel,
                actualModel: config.actualModel,
                completedSessions: config.completedSessions,
                targetSessions: config.targetSessions,
                remainingSlots: config.targetSessions - config.completedSessions,
                isActive: config.isActive && config.completedSessions < config.targetSessions
            };
            stats.remainingSlots += Math.max(0, config.targetSessions - config.completedSessions);
        }
        
        res.json({
            success: true,
            stats,
            metadata: configData.metadata
        });
        
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ 
            error: 'Failed to get status',
            details: error.message 
        });
    }
}