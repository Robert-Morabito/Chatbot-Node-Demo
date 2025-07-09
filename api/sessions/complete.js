import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, participantId } = req.body;
        
        if (!sessionId || !participantId) {
            return res.status(400).json({ error: 'Session ID and Participant ID required' });
        }

        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();

        // Find the session
        const session = configData.sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Only mark as completed if not already done
        if (!session.completed) {
            session.completed = true;
            session.completedAt = new Date().toISOString();

            // Increment the configuration's completed sessions count
            const configId = session.configurationId;
            if (configData.configurations[configId]) {
                configData.configurations[configId].completedSessions += 1;
                console.log(`✅ Incremented completion count for config ${configId}: ${configData.configurations[configId].completedSessions}`);
            }

            // Update metadata
            configData.metadata.lastUpdated = new Date().toISOString();

            // Save updated state back to GitHub
            await githubStorage.saveConfigurationState(configData);

            console.log(`✅ Session ${sessionId} marked as completed`);
        }

        res.json({
            success: true,
            message: 'Session marked as completed',
            session: session
        });

    } catch (error) {
        console.error('Session completion error:', error);
        res.status(500).json({
            error: 'Failed to mark session completed',
            details: error.message
        });
    }
}