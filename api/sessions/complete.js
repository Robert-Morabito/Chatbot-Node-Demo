import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, participantId } = req.body;
        
        console.log('🏁 Session completion request received:', { sessionId, participantId });
        
        if (!sessionId || !participantId) {
            console.error('❌ Missing required fields:', { sessionId: !!sessionId, participantId: !!participantId });
            return res.status(400).json({ error: 'Session ID and Participant ID required' });
        }

        console.log('📋 Loading configuration state...');
        const configData = await githubStorage.loadConfigurationState();
        
        console.log('🔍 Current configuration state:', {
            totalSessions: Object.keys(configData.sessions).length,
            sessionExists: !!configData.sessions[sessionId]
        });

        // Find the session
        const session = configData.sessions[sessionId];
        if (!session) {
            console.error('❌ Session not found:', sessionId);
            console.log('📋 Available sessions:', Object.keys(configData.sessions));
            return res.status(404).json({ error: 'Session not found' });
        }

        console.log('✅ Session found:', session);

        // Only mark as completed if not already done
        if (!session.completed) {
            console.log('📝 Marking session as completed...');
            session.completed = true;
            session.completedAt = new Date().toISOString();

            // Increment the configuration's completed sessions count
            const configId = session.configurationId.toString();
            console.log('🔄 Updating configuration:', configId);
            
            if (configData.configurations[configId]) {
                const oldCount = configData.configurations[configId].completedSessions;
                configData.configurations[configId].completedSessions += 1;
                const newCount = configData.configurations[configId].completedSessions;
                
                console.log(`📊 Updated completion count for config ${configId}: ${oldCount} → ${newCount}/${configData.configurations[configId].targetSessions}`);
                
                // Check if configuration has reached its target and deactivate it
                if (configData.configurations[configId].completedSessions >= configData.configurations[configId].targetSessions) {
                    configData.configurations[configId].isActive = false;
                    console.log(`🎯 Configuration ${configId} has reached target and is now inactive`);
                }
            } else {
                console.error('❌ Configuration not found:', configId);
            }

            // Update metadata
            configData.metadata.lastUpdated = new Date().toISOString();

            console.log('💾 Saving updated configuration state...');
            await githubStorage.saveConfigurationState(configData);

            console.log('✅ Session completion processed successfully');
        } else {
            console.log('ℹ️ Session was already completed');
        }

        res.json({
            success: true,
            message: 'Session marked as completed',
            session: session,
            configurationUpdated: !session.completed
        });

    } catch (error) {
        console.error('❌ Session completion error:', error);
        res.status(500).json({
            error: 'Failed to mark session completed',
            details: error.message
        });
    }
}