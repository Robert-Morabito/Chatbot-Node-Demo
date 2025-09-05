/**
 * Configuration Assignment API
 * 
 * Assigns study participants to specific model configurations and manages
 * session allocation.
 * 
 * This endpoint:
 * - Finds an available configuration slot
 * - Reserves the slot to prevent race conditions  
 * - Creates a session record for tracking
 * - Returns the assigned configuration to the client
 */

import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    // Only accept GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Load current configuration state from storage
        const configData = await githubStorage.loadConfigurationState();
        
        // Validate configuration data structure
        if (!configData?.configurations || !configData?.sessions) {
            throw new Error('Invalid configuration data structure');
        }

        // Find the next available configuration using sequential filling strategy
        const selectedConfig = findNextAvailableConfig(configData.configurations);
        
        if (!selectedConfig) {
            return res.status(503).json({
                error: 'Study complete',
                message: 'All configuration slots have been filled'
            });
        }

        // Reserve the slot and update configuration state
        const sessionInfo = reserveConfigurationSlot(selectedConfig, configData);
        
        // Save updated state back to storage
        await githubStorage.saveConfigurationState(configData);

        // Return success response
        res.json({
            success: true,
            sessionId: sessionInfo.sessionId,
            configuration: {
                id: selectedConfig.id,
                displayedModel: selectedConfig.displayedModel,
                actualModel: selectedConfig.actualModel
            }
        });

    } catch (error) {
        console.error('Configuration assignment failed:', error.message);
        res.status(500).json({
            error: 'Failed to assign configuration',
            details: error.message
        });
    }
}

/**
 * Finds the first available configuration.
 * 
 * @param {Object} configurations - Available configurations
 * @returns {Object|null} First available configuration or null if none available
 */
function findNextAvailableConfig(configurations) {
    for (const config of Object.values(configurations)) {
        const availableSlots = config.targetSessions - config.reservedSessions;
        
        // Return first active configuration with available slots
        if (config.isActive && availableSlots > 0) {
            return config;
        }
    }

    return null;
}

/**
 * Reserves a slot in the selected configuration and creates session tracking record.
 * 
 * @param {Object} selectedConfig - The configuration to reserve
 * @param {Object} configData - Full configuration data object
 * @returns {Object} Session information
 */
function reserveConfigurationSlot(selectedConfig, configData) {
    // Immediately reserve the slot to prevent race conditions
    selectedConfig.reservedSessions += 1;

    // Deactivate configuration if target reached
    if (selectedConfig.reservedSessions >= selectedConfig.targetSessions) {
        selectedConfig.isActive = false;
    }

    // Update metadata timestamp
    configData.metadata.lastUpdated = new Date().toISOString();

    // Generate unique session identifier
    const sessionId = generateSessionId();

    // Create session tracking record
    configData.sessions[sessionId] = {
        sessionId,
        configurationId: selectedConfig.id,
        assignedAt: new Date().toISOString(),
        completed: false,
        completedAt: null,
        released: false
    };

    return { sessionId };
}

/**
 * Generates a unique session identifier.
 * 
 * @returns {string} Unique session ID
 */
function generateSessionId() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 11);
    return `session_${timestamp}_${randomSuffix}`;
}