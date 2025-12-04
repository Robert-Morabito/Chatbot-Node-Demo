/**
 * Per-Task Data Save API
 * 
 * Saves task-specific data for a participant.
 * Supports auto-save (overwrites) and beacon requests.
 */

import GitHubStorage from '../../utils/githubStorage.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Handle both JSON and beacon (text) requests
        let body = req.body;
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }

        const { participantId, taskName, sessionId, modelConfig, taskData, savedAt, savedVia } = body;

        // Validate required fields
        if (!participantId || !taskName || !taskData) {
            return res.status(400).json({
                error: 'Missing required fields: participantId, taskName, taskData'
            });
        }

        console.log('💾 Saving task data:', {
            participantId,
            taskName,
            savedVia: savedVia || 'api',
            timestamp: savedAt
        });

        // Prepare complete task dataset
        const completeTaskData = {
            participantId,
            taskName,
            sessionId,
            ...taskData,
            savedAt: savedAt || new Date().toISOString(),
            savedVia: savedVia || 'api'
        };

        // Save to GitHub
        const githubStorage = new GitHubStorage();
        await githubStorage.saveTaskData(participantId, taskName, completeTaskData);

        res.json({
            success: true,
            participantId,
            taskName,
            message: 'Task data saved successfully'
        });

    } catch (error) {
        console.error('Task data save failed:', error.message);
        res.status(500).json({
            error: 'Failed to save task data',
            details: error.message
        });
    }
}

// Allow larger payloads for conversation data
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};