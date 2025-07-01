import fs from 'fs-extra';
import path from 'path';

const configFile = path.join('/tmp', 'model-configurations.json');

export async function markSessionCompleted(sessionId) {
    try {
        // Check if file exists, return null if not (don't error)
        if (!await fs.pathExists(configFile)) {
            console.log(`Configuration file not found for session ${sessionId}`);
            return null;
        }
        
        const data = await fs.readJson(configFile);
        
        const session = data.sessions[sessionId];
        if (!session) {
            console.log(`Session ${sessionId} not found`);
            return null;
        }
        
        if (!session.completed) {
            // Mark session complete
            session.completed = true;
            session.completedAt = new Date().toISOString();
            
            // Increment configuration completion count
            const configId = session.configurationId.toString();
            if (data.configurations[configId]) {
                data.configurations[configId].completedSessions += 1;
            }
            
            // Update metadata
            data.metadata.lastUpdated = new Date().toISOString();
            
            await fs.writeJson(configFile, data, { spaces: 2 });
            
            console.log(`✅ Completed session ${sessionId} for config ${session.configurationId}`);
        }
        
        return session;
    } catch (error) {
        console.error('Error marking session completed:', error);
        return null;
    }
}