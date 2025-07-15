/*import GitHubStorage from '../../utils/githubStorage.js';

const githubStorage = new GitHubStorage();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Getting configuration status');
        
        const configData = await githubStorage.loadConfigurationState();
        
        const status = {
            configurations: configData.configurations,
            totalSessions: Object.keys(configData.sessions).length,
            completedSessions: Object.values(configData.sessions).filter(s => s.completed).length,
            activeSessions: Object.values(configData.sessions).filter(s => !s.completed).length,
            metadata: configData.metadata
        };

        res.json({
            success: true,
            status: status
        });
    } catch (error) {
        console.error('Status error:', error.message);
        res.status(500).json({ 
            error: 'Failed to get status',
            details: error.message 
        });
    }
}*/