export default async function handler(req, res) {
    if (req.method !== 'GET') {  // Changed from POST to GET
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // No need for prolificId from body since it's GET
        // Just assign the next available configuration
        
        // Load current configuration state from GitHub
        const configData = await githubStorage.loadConfigurationState();

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

        // Generate session info
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Don't save session assignment yet - let the client handle participant ID

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
        console.error('Configuration assignment error:', error);
        res.status(500).json({
            error: 'Failed to assign configuration',
            details: error.message
        });
    }
}