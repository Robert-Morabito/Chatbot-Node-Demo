/**
 * Participant Data Retrieval API
 * 
 * Fetches all saved task data for a participant.
 * Used on final task for compilation and download.
 */

import GitHubStorage from '../../utils/githubStorage.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { pid } = req.query;

        if (!pid) {
            return res.status(400).json({ error: 'Participant ID (pid) is required' });
        }

        console.log('📋 Fetching all task data for participant:', pid);

        const githubStorage = new GitHubStorage();
        const allTaskData = await githubStorage.getParticipantTaskData(pid);

        res.json({
            success: true,
            participantId: pid,
            tasks: allTaskData
        });

    } catch (error) {
        console.error('Participant data fetch failed:', error.message);
        res.status(500).json({
            error: 'Failed to fetch participant data',
            details: error.message
        });
    }
}