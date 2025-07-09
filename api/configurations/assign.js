import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
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
            // All configurations have reached their target
            return res.status(503).json({ 
                error: 'Study complete',
                message: 'All configuration slots have been filled' 
            });
        }
        
        // Generate session info
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const participantId = generateParticipantId();
        
        // Record the session assignment
        configData.sessions[sessionId] = {
            sessionId,
            participantId,
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
            participantId,
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

function generateParticipantId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}