import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🎯 Starting configuration assignment...');
        
        // Load current configuration state from GitHub Storage repo
        const configData = await githubStorage.loadConfigurationState();
        console.log('📋 Loaded configuration data:', {
            totalConfigs: Object.keys(configData.configurations).length,
            sessions: Object.keys(configData.sessions).length
        });

        // Find configuration with lowest completion count that hasn't reached target
        let selectedConfig = null;
        let minCompletions = Infinity;

        for (const config of Object.values(configData.configurations)) {
            if (config.isActive && 
                config.completedSessions < config.targetSessions &&
                config.completedSessions < minCompletions) {
                minCompletions = config.completedSessions;
                selectedConfig = config;
            }
        }

        if (!selectedConfig) {
            return res.status(503).json({
                error: 'Study complete',
                message: 'All configuration slots have been filled'
            });
        }

        console.log('✅ Selected configuration:', {
            id: selectedConfig.id,
            displayed: selectedConfig.displayedModel,
            actual: selectedConfig.actualModel,
            completed: selectedConfig.completedSessions,
            target: selectedConfig.targetSessions
        });

        // Generate session info
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        res.json({
            success: true,
            sessionId,
            configuration: {
                id: selectedConfig.id,
                displayedModel: selectedConfig.displayedModel,
                actualModel: selectedConfig.actualModel
            }
        });

    } catch (error) {
        console.error('❌ Configuration assignment error:', error);
        res.status(500).json({
            error: 'Failed to assign configuration',
            details: error.message
        });
    }
}