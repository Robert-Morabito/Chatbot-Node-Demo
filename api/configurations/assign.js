import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('🎯 Starting configuration assignment...');
        
        const configData = await githubStorage.loadConfigurationState();
        
        // STEP 1: Find ALL available configurations
        const availableConfigs = Object.values(configData.configurations)
            .filter(config => {
                const availableSlots = config.targetSessions - (config.reservedSessions || 0);
                return config.isActive && availableSlots > 0;
            });

        console.log('📋 Available configurations:', availableConfigs.map(c => ({
            id: c.id,
            model: c.displayedModel,
            reserved: c.reservedSessions || 0,
            target: c.targetSessions,
            available: c.targetSessions - (c.reservedSessions || 0)
        })));

        if (availableConfigs.length === 0) {
            return res.status(503).json({
                error: 'Study complete',
                message: 'All configuration slots have been filled'
            });
        }

        // STEP 2: Sort by reserved sessions (fill evenly)
        availableConfigs.sort((a, b) => {
            const aReserved = a.reservedSessions || 0;
            const bReserved = b.reservedSessions || 0;
            return aReserved - bReserved;
        });

        // STEP 3: Pick the first one (least reserved)
        const selectedConfig = availableConfigs[0];
        
        // STEP 4: Reserve the slot
        selectedConfig.reservedSessions = (selectedConfig.reservedSessions || 0) + 1;
        
        // STEP 5: Deactivate if full
        if (selectedConfig.reservedSessions >= selectedConfig.targetSessions) {
            selectedConfig.isActive = false;
        }

        // STEP 6: Create session record
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        configData.sessions[sessionId] = {
            sessionId,
            configurationId: selectedConfig.id,
            assignedAt: new Date().toISOString(),
            completed: false
        };

        // STEP 7: Update metadata
        configData.metadata.lastUpdated = new Date().toISOString();

        // STEP 8: Save back to GitHub
        await githubStorage.saveConfigurationState(configData);

        console.log('✅ Configuration assigned:', {
            id: selectedConfig.id,
            displayedModel: selectedConfig.displayedModel,
            actualModel: selectedConfig.actualModel,
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