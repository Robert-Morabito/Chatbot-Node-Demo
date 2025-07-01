import fs from 'fs-extra';
import path from 'path';

// Since we can't use __dirname in Vercel, we'll use a different approach
const DATA_DIR = '/tmp'; // Vercel's temporary directory

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // For now, let's return a simple response to test
        const assignment = {
            sessionId: `session_${Date.now()}`,
            participantId: generateParticipantId(),
            configuration: {
                id: 1,
                displayedModel: "GPT-4",
                actualModel: "gpt-4-turbo"
            }
        };

        res.json({
            success: true,
            sessionId: assignment.sessionId,
            participantId: assignment.participantId,
            configuration: assignment.configuration
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