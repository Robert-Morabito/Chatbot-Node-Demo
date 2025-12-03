/**
 * Test endpoint for uploading images to GitHub
 * Simulates the same upload that happens during task completion
 */

import GitHubStorage from '../../utils/githubStorage.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { participantId, filename, base64, metadata } = req.body;
        
        if (!participantId || !filename || !base64) {
            return res.status(400).json({ 
                error: 'Missing required fields: participantId, filename, base64' 
            });
        }

        console.log('🧪 Test upload:', {
            participantId,
            filename,
            size: `${(base64.length / 1024).toFixed(2)} KB`,
            metadata: metadata ? 'included' : 'none'
        });

        // Upload to GitHub
        const githubStorage = new GitHubStorage();
        const result = await githubStorage.uploadImageDirect(participantId, filename, base64, metadata);

        console.log('✅ Test upload successful:', result.githubPath);

        res.json({
            success: true,
            filename,
            githubPath: result.githubPath,
            sha: result.sha,
            size: result.size
        });

    } catch (error) {
        console.error('❌ Test upload failed:', error.message);
        res.status(500).json({ 
            error: 'Upload failed',
            details: error.message 
        });
    }
}