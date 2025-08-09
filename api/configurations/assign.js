import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🎯 Starting configuration assignment...');
        
        // Load current configuration state
        const configData = await githubStorage.loadConfigurationState();
        
        // Find configuration with available slots, prioritizing those with most reservations
        // (to fill configurations sequentially rather than spreading out)
        let selectedConfig = null;
        let maxReservedWithSpace = -1;

        for (const config of Object.values(configData.configurations)) {
            const availableSlots = config.targetSessions - config.reservedSessions;
            
            if (config.isActive && availableSlots > 0) {
                // Prioritize configurations with more reserved sessions (fill them up first)
                if (config.reservedSessions > maxReservedWithSpace) {
                    maxReservedWithSpace = config.reservedSessions;
                    selectedConfig = config;
                }
            }
        }

        if (!selectedConfig) {
            return res.status(503).json({
                error: 'Study complete',
                message: 'All configuration slots have been filled'
            });
        }

        // IMMEDIATELY reserve the slot to prevent race condition
        selectedConfig.reservedSessions += 1;
        
        // Deactivate if we've hit the target
        if (selectedConfig.reservedSessions >= selectedConfig.targetSessions) {
            selectedConfig.isActive = false;
        }

        // Update metadata
        configData.metadata.lastUpdated = new Date().toISOString();

        // Generate session info
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Add session to track it (with released flag to prevent double-decrementing)
        configData.sessions[sessionId] = {
            sessionId,
            configurationId: selectedConfig.id,
            assignedAt: new Date().toISOString(),
            completed: false,
            completedAt: null,
            released: false  // NEW: Track if reserved slot has been released
        };

        // Save the updated state back immediately
        await githubStorage.saveConfigurationState(configData);

        console.log('✅ Configuration assigned and reserved:', {
            id: selectedConfig.id,
            displayed: selectedConfig.displayedModel,
            actual: selectedConfig.actualModel,
            reserved: selectedConfig.reservedSessions,
            completed: selectedConfig.completedSessions,
            target: selectedConfig.targetSessions,
            isActive: selectedConfig.isActive
        });

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
        console.error('❌ Configuration assignment error:', error);
        res.status(500).json({
            error: 'Failed to assign configuration',
            details: error.message
        });
    }
}