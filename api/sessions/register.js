import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, participantId, configurationId } = req.body;
        
        if (!sessionId || !participantId) {
            return res.status(400).json({ error: 'Session ID and Participant ID required' });
        }

        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();

        // Update session with participant ID
        if (configData.sessions[sessionId]) {
            configData.sessions[sessionId].participantId = participantId;
            configData.sessions[sessionId].registeredAt = new Date().toISOString();
            
            // Update metadata
            configData.metadata.lastUpdated = new Date().toISOString();

            // Save updated state
            await githubStorage.saveConfigurationState(configData);

            console.log(`✅ Session ${sessionId} registered for participant ${participantId}`);

            res.json({
                success: true,
                message: 'Session registered successfully'
            });
        } else {
            res.status(404).json({ error: 'Session not found' });
        }

    } catch (error) {
        console.error('Session registration error:', error);
        res.status(500).json({
            error: 'Failed to register session',
            details: error.message
        });
    }
}
