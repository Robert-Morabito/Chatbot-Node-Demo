export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Simple status response for testing
        const status = {
            configurations: {
                "1": { id: 1, displayedModel: "GPT-4", actualModel: "gpt-4-turbo", completedSessions: 0, targetSessions: 12 }
            },
            totalSessions: 0,
            completedSessions: 0,
            activeSessions: 0,
            metadata: {
                totalConfigurations: 9,
                totalTargetSessions: 108
            }
        };

        res.json({
            success: true,
            status: status
        });
    } catch (error) {
        console.error('Status error:', error);
        res.status(500).json({ 
            error: 'Failed to get status',
            details: error.message 
        });
    }
}