import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Starting configuration assignment');
        
        const configData = await githubStorage.loadConfigurationState();
        const selectedConfig = findAvailableConfiguration(configData.configurations);

        if (!selectedConfig) {
            return res.status(503).json({
                error: 'Study complete',
                message: 'All configuration slots have been filled'
            });
        }

        const sessionId = generateSessionId();

        console.log(`Assigned configuration ${selectedConfig.id} to session ${sessionId}`);

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
        console.error('Configuration assignment error:', error.message);
        res.status(500).json({
            error: 'Failed to assign configuration',
            details: error.message
        });
    }
}