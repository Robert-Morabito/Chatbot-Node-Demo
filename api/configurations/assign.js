import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prolificId } = req.body;

        if (!prolificId || !/^[a-zA-Z0-9]{24}$/.test(prolificId)) {
            return res.status(400).json({ error: 'Valid Prolific ID required' });
        }

        // Load current configuration state from GitHub
        const configData = await githubStorage.loadConfigurationState();

        // Check if this Prolific ID already has an active session
        const existingSession = Object.values(configData.sessions).find(
            session => session.participantId === prolificId && !session.completed
        );

        if (existingSession) {
            // Resume existing session
            const config = configData.configurations[existingSession.configurationId];

            console.log(`🔄 Resuming session for Prolific ID: ${prolificId}`);

            return res.json({
                success: true,
                sessionId: existingSession.sessionId,
                participantId: prolificId,
                configuration: {
                    id: config.id,
                    displayedModel: config.displayedModel,
                    actualModel: config.actualModel
                },
                resumed: true
            });
        }

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

        // Record the session assignment
        configData.sessions[sessionId] = {
            sessionId,
            participantId: prolificId,
            configurationId: selectedConfig.id,
            displayedModel: selectedConfig.displayedModel,
            actualModel: selectedConfig.actualModel,
            assignedAt: new Date().toISOString(),
            completed: false
        };

        // Save updated state back to GitHub
        await githubStorage.saveConfigurationState(configData);

        res.json({
            success: true,
            sessionId,
            participantId: prolificId,
            configuration: {
                id: selectedConfig.id,
                displayedModel: selectedConfig.displayedModel,
                actualModel: selectedConfig.actualModel
            },
            resumed: false
        });

    } catch (error) {
        console.error('Configuration assignment error:', error);
        res.status(500).json({
            error: 'Failed to assign configuration',
            details: error.message
        });
    }
}