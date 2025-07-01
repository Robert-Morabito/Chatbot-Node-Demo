export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { participantId, sessionId, conversations } = req.body;
        
        console.log('Save request received:', { participantId, sessionId });
        
        // For now, just log the data (we'll implement proper saving later)
        console.log('Conversation data:', JSON.stringify(conversations, null, 2));

        res.json({
            success: true,
            participantId,
            message: 'Data logged successfully'
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ 
            error: 'Failed to save data',
            details: error.message 
        });
    }
}