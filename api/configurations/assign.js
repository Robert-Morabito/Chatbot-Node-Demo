/**
 * Configuration Assignment Handler
 * Assigns study configurations to chat sessions based on completion counts
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Starting configuration assignment');
        
        const configData = await githubStorage.loadConfigurationState();
        const selectedConfig = findAvailableConfiguration(configData.configurations);

        if (!selectedConfig) {
            return res.status(503).json({
                error: 'Study complete',
                message: 'All configuration slots have been filled'
            });
        }

        const sessionId = generateSessionId();

        console.log(`Assigned configuration ${selectedConfig.id} to session ${sessionId}`);

        res.json({
            success: true,
            sessionId,
            configuration: {
                id: selectedConfig.id,
                displayedModel: selectedConfig.displayedModel,
                actualModel: selectedConfig.actualModel
            }
        });

    } catch (error) {
        console.error('Configuration assignment error:', error.message);
        res.status(500).json({
            error: 'Failed to assign configuration',
            details: error.message
        });
    }
}

/**
 * Find configuration with lowest completion count that hasn't reached target
 * @param {Object} configurations - Available configurations
 * @returns {Object|null} Selected configuration or null if none available
 */
function findAvailableConfiguration(configurations) {
    let selectedConfig = null;
    let minCompletions = Infinity;

    for (const config of Object.values(configurations)) {
        if (config.isActive && 
            config.completedSessions < config.targetSessions &&
            config.completedSessions < minCompletions) {
            minCompletions = config.completedSessions;
            selectedConfig = config;
        }
    }

    return selectedConfig;
}

/**
 * Generate unique session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}