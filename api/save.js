export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { participantId, sessionId, conversations, behaviorMetrics, modelConfig } = req.body;
        
        console.log('Save request received:', { 
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
            behaviorMetrics,  // Include behavioral metrics
            savedAt: new Date().toISOString()
        };
        
        // For now, just log the data
        console.log('Complete conversation data with metrics:', JSON.stringify(completeData, null, 2));

        res.json({
            success: true,
            participantId,
            message: 'Data logged successfully',
            includedMetrics: !!behaviorMetrics
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ 
            error: 'Failed to save data',
            details: error.message 
        });
    }
}