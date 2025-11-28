/**
 * Finished Study Data Save API
 * 
 * Saves complete compiled study data to the "finished" folder.
 * Called only from the final task (acro-build).
 */

import GitHubStorage from '../../utils/githubStorage.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const completeData = req.body;

        // Validate required fields
        if (!completeData.participantId || !completeData.tasks) {
            return res.status(400).json({
                error: 'Missing required fields: participantId, tasks'
            });
        }

        console.log('🏁 Saving finished study data:', {
            participantId: completeData.participantId,
            sessionId: completeData.sessionId,
            tasksCount: Object.keys(completeData.tasks).length
        });

        // Save to GitHub finished folder
        const githubStorage = new GitHubStorage();
        const result = await githubStorage.saveFinishedStudyData(
            completeData.participantId,
            completeData
        );

        res.json({
            success: true,
            participantId: completeData.participantId,
            message: 'Finished study data saved successfully',
            ...result
        });

    } catch (error) {
        console.error('Finished study data save failed:', error.message);
        res.status(500).json({
            error: 'Failed to save finished study data',
            details: error.message
        });
    }
}

// Allow larger payloads for complete study data
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '15mb',
        },
    },
};