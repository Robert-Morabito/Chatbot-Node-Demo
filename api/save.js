export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { participantId, sessionId, conversations, behaviorMetrics, modelConfig } = req.body;
        
        console.log('💾 Save request received:', { 
            participantId, 
            sessionId,
            hasBehaviorMetrics: !!behaviorMetrics 
        });
        
        // Create a complete data object including behavioral metrics
        const completeData = {
            participantId,
            sessionId,
            conversations,
            modelConfig,
            behaviorMetrics,
            savedAt: new Date().toISOString()
        };
        
        // Save participant data to GitHub
        const githubStorage = new (await import('../utils/githubStorage.js')).default();
        await githubStorage.saveParticipantData(participantId, sessionId, completeData);
        
        console.log('✅ Participant data saved to GitHub');

        res.json({
            success: true,
            participantId,
            message: 'Data saved successfully',
            includedMetrics: !!behaviorMetrics
        });
    } catch (error) {
        console.error('❌ Save error:', error);
        res.status(500).json({ 
            error: 'Failed to save data',
            details: error.message 
        });
    }
}