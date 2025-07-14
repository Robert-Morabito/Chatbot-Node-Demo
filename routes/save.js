import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import GitHubStorage from '../utils/githubStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const githubStorage = new GitHubStorage();

// Use /tmp for Vercel serverless
const backupDir = '/tmp/participants';

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
        
        // Always try to save local backup first
        let backupResult = null;
        try {
            await fs.ensureDir(backupDir);
            const backupFileName = `chatlog_${participantId}_${sessionId}.json`;
            const backupPath = path.join(backupDir, backupFileName);
            await fs.writeJson(backupPath, chatData, { spaces: 2 });
            console.log(`💾 Local backup saved: ${backupFileName}`);
            backupResult = backupFileName;
        } catch (error) {
            console.error('Local backup failed:', error);
        }
        
        // Try to save to GitHub
        let githubResult = null;
        try {
            githubResult = await githubStorage.saveParticipantData(participantId, sessionId, chatData);
        } catch (error) {
            console.error('GitHub save failed:', error);
        }
        
        // Mark session as completed using GitHub storage
        try {
            const response = await fetch('/api/sessions/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    participantId: participantId
                })
            });
            
            if (response.ok) {
                console.log(`✅ Session ${sessionId} marked as completed via API`);
            } else {
                console.warn('Failed to mark session as completed via API');
            }
        } catch (error) {
            console.error('Mark session completed failed:', error);
        }
        
        console.log(`✅ Participant ${participantId} study data processed`);
        
        res.json({
            success: true,
            participantId,
            localBackup: backupResult,
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