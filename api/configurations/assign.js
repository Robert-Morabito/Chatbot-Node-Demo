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
        console.log('📋 Loaded configuration data:', {
            totalConfigs: Object.keys(configData.configurations).length,
            sessions: Object.keys(configData.sessions).length
        });

        // Find the FIRST available configuration (lowest ID with available slots)
        let selectedConfig = null;
        const configIds = Object.keys(configData.configurations).sort((a, b) => parseInt(a) - parseInt(b));
        
        console.log('🔍 Checking configurations in order:', configIds);

        for (const configId of configIds) {
            const config = configData.configurations[configId];
            const availableSlots = config.targetSessions - (config.reservedSessions || 0);
            
            console.log(`📊 Config ${configId}:`, {
                displayedModel: config.displayedModel,
                actualModel: config.actualModel,
                reserved: config.reservedSessions || 0,
                completed: config.completedSessions,
                target: config.targetSessions,
                available: availableSlots,
                isActive: config.isActive
            });

            if (config.isActive && availableSlots > 0) {
                selectedConfig = config;
                console.log(`✅ Selected config ${configId} (${availableSlots} slots available)`);
                break; // Take the first available one
            }
        }

        if (!selectedConfig) {
            console.log('❌ No available configurations found');
            return res.status(503).json({
                error: 'Study complete',
                message: 'All configuration slots have been filled'
            });
        }

        // IMMEDIATELY reserve the slot
        selectedConfig.reservedSessions = (selectedConfig.reservedSessions || 0) + 1;
        
        // Deactivate if we've hit the target
        if (selectedConfig.reservedSessions >= selectedConfig.targetSessions) {
            selectedConfig.isActive = false;
            console.log(`🔒 Configuration ${selectedConfig.id} is now full and deactivated`);
        }

        // Generate session info BEFORE saving
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Add session to tracking
        configData.sessions[sessionId] = {
            sessionId,
            configurationId: selectedConfig.id,
            assignedAt: new Date().toISOString(),
            completed: false,
            completedAt: null,
            hasReservation: true
        };

        // Update metadata
        configData.metadata.lastUpdated = new Date().toISOString();

        // Save the updated state back immediately
        console.log('💾 Saving configuration state...');
        await githubStorage.saveConfigurationState(configData);

        console.log('✅ Configuration assigned and saved:', {
            sessionId,
            configId: selectedConfig.id,
            displayed: selectedConfig.displayedModel,
            actual: selectedConfig.actualModel,
            reserved: selectedConfig.reservedSessions,
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