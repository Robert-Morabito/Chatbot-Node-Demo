/**
 * Data Persistence API
 * 
 * Saves complete participant study data including conversations, 
 * behavioral metrics, and session information to GitHub storage.
 * This is the primary endpoint for data collection.
 */

import GitHubStorage from '../../utils/githubStorage.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { participantId, sessionId, conversations, behaviorMetrics, modelConfig } = req.body;
        
        // Validate required fields
        if (!participantId || !sessionId || !conversations || !modelConfig) {
            return res.status(400).json({ 
                error: 'Missing required fields: participantId, sessionId, conversations, modelConfig' 
            });
        }

        // Prepare complete dataset
        const studyData = {
            participantId,
            sessionId,
            conversations,
            modelConfig,
            behaviorMetrics: behaviorMetrics || {},
            savedAt: new Date().toISOString()
        };

        // Save to GitHub storage
        const githubStorage = new GitHubStorage();
        await githubStorage.saveParticipantData(participantId, sessionId, studyData);

        res.json({
            success: true,
            participantId,
            message: 'Data saved successfully',
            includedMetrics: !!behaviorMetrics
        });

    } catch (error) {
        console.error('Data save failed:', error.message);
        res.status(500).json({ 
            error: 'Failed to save data',
            details: error.message 
        });
    }
}