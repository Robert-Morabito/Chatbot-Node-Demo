import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, participantId, configurationId } = req.body;
        
        if (!sessionId || !participantId || !configurationId) {
            return res.status(400).json({ 
                error: 'Session ID, Participant ID, and Configuration ID required' 
            });
        }

        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();

        // Validate configuration exists and is active
        const config = configData.configurations[configurationId];
        if (!config) {
            return res.status(400).json({ error: 'Invalid configuration ID' });
        }

        if (!config.isActive) {
            return res.status(400).json({ error: 'Configuration is no longer active' });
        }

        // Check if session already exists
        if (configData.sessions[sessionId]) {
            return res.status(409).json({ error: 'Session already registered' });
        }

        // Create session record
        const session = {
            sessionId,
            participantId,
            configurationId: parseInt(configurationId),
            displayedModel: config.displayedModel,
            actualModel: config.actualModel,
            assignedAt: new Date().toISOString(),
            completed: false,
            completedAt: null
        };

        // Add session to configuration data
        configData.sessions[sessionId] = session;
        configData.metadata.lastUpdated = new Date().toISOString();

        // Save updated state to GitHub
        await githubStorage.saveConfigurationState(configData);

        console.log(`📝 Registered session ${sessionId} for participant ${participantId} with config ${configurationId}`);

        res.json({
            success: true,
            message: 'Session registered successfully',
            session: session
        });

    } catch (error) {
        console.error('Session registration error:', error);
        res.status(500).json({
            error: 'Failed to register session',
            details: error.message
        });
    }
}
