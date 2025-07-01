import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configFile = path.join(__dirname, '..', 'data', 'model-configurations.json');

export async function markSessionCompleted(sessionId) {
    try {
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