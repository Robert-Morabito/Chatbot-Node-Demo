import GitHubStorage from '../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            participantId,
            sessionId,
            conversations,
            modelConfig,
            behaviorMetrics,
            completionCode,
            studyCompleted
        } = req.body;

        // Only mark configuration as complete if study was actually completed
        if (studyCompleted && completionCode) {
            // Save the complete data
            const chatData = {
                participantId,
                sessionId,
                completionCode,
                timestamp: new Date().toISOString(),
                modelConfig,
                conversations,
                behaviorMetrics,
                studyCompleted: true
            };

            // Save to GitHub
            await githubStorage.saveParticipantData(participantId, sessionId, chatData);

            // Update configuration completion count
            const configData = await githubStorage.loadConfigurationState();
            const session = configData.sessions[sessionId];

            if (session && !session.completed) {
                session.completed = true;
                session.completedAt = new Date().toISOString();
                session.completionCode = completionCode;

                // Increment configuration completion count
                const configId = session.configurationId.toString();
                if (configData.configurations[configId]) {
                    configData.configurations[configId].completedSessions += 1;
                }

                await githubStorage.saveConfigurationState(configData);
            }
        } else {
            // Just save progress without marking as complete
            console.log('💾 Saving progress (not completed)');
        }

        res.json({
            success: true,
            participantId,
            message: studyCompleted ? 'Study completed successfully' : 'Progress saved'
        });

    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({
            error: 'Failed to save data',
            details: error.message
        });
    }
}