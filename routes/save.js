import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import GitHubStorage from '../utils/githubStorage.js';
import { markSessionCompleted } from '../utils/configurationUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const githubStorage = new GitHubStorage();

// Ensure local backup directory exists
const backupDir = path.join(__dirname, '..', 'data', 'participants');
await fs.ensureDir(backupDir);

router.post('/', async (req, res) => {
    try {
        const { participantId, sessionId, conversations, modelConfig } = req.body;
        
        if (!participantId || !sessionId) {
            return res.status(400).json({ error: 'Participant ID and Session ID required' });
        }
        
        // Prepare data for storage
        const chatData = {
            participantId,
            sessionId,
            timestamp: new Date().toISOString(),
            modelConfig,
            conversations,
            metadata: {
                totalConversations: Object.keys(conversations || {}).length,
                totalMessages: Object.values(conversations || {}).reduce((acc, conv) => 
                    acc + (conv.messages ? conv.messages.length : 0), 0),
                studyCompleted: true
            }
        };
        
        // Always save local backup first
        const backupFileName = `chatlog_${participantId}_${sessionId}.json`;
        const backupPath = path.join(backupDir, backupFileName);
        await fs.writeJson(backupPath, chatData, { spaces: 2 });
        console.log(`💾 Local backup saved: ${backupFileName}`);
        
        // Try to save to GitHub
        let githubResult = null;
        try {
            githubResult = await githubStorage.saveParticipantData(participantId, sessionId, chatData);
        } catch (error) {
            console.error('GitHub save failed, but local backup exists:', error);
        }
        
        // Mark session as completed
        await markSessionCompleted(sessionId);
        
        console.log(`✅ Participant ${participantId} study completed`);
        
        res.json({
            success: true,
            participantId,
            localBackup: backupFileName,
            githubStorage: githubResult,
            message: 'Study data saved successfully'
        });
        
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ 
            error: 'Failed to save study data',
            details: error.message 
        });
    }
});

export { router as saveRouter };