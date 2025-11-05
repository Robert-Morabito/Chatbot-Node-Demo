/**
 * Data Persistence API
 * 
 * Saves complete participant study data including conversations, 
 * behavioral metrics, and session information to GitHub storage.
 * This is the primary endpoint for data collection.
 */

import GitHubStorage from '../../utils/githubStorage.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { participantId, sessionId, conversations, behaviorMetrics, modelConfig } = req.body;

        // Validate required fields
        if (!participantId || !sessionId || !conversations || !modelConfig) {
            return res.status(400).json({
                error: 'Missing required fields: participantId, sessionId, conversations, modelConfig'
            });
        }

        // Prepare complete dataset
        let studyData = {
            participantId,
            sessionId,
            conversations,
            modelConfig,
            behaviorMetrics: behaviorMetrics || {},
            savedAt: new Date().toISOString()
        };

        // Process and replace image URLs with permanent ones
        const githubStorage = new GitHubStorage();
        studyData = await processImageUrls(studyData, participantId, githubStorage);

        // Save to GitHub storage (now with permanent image URLs)
        await githubStorage.saveParticipantData(participantId, sessionId, studyData);

        res.json({
            success: true,
            participantId,
            message: 'Data saved successfully with permanent image URLs',
            includedMetrics: !!behaviorMetrics
        });

    } catch (error) {
        console.error('Data save failed:', error.message);
        res.status(500).json({
            error: 'Failed to save data',
            details: error.message
        });
    }
}


/**
* Process and replace DALL-E blob URLs with permanent GitHub URLs
* @param {Object} studyData - The complete study data
* @param {string} participantId - Participant ID for filename generation
* @param {GitHubStorage} githubStorage - GitHub storage instance
* @returns {Promise<Object>} Study data with permanent image URLs
*/
async function processImageUrls(studyData, participantId, githubStorage) {
    console.log('🖼️ Processing image URLs for permanent storage...');

    const blobUrlPattern = /https:\/\/[^\/]*\.blob\.core\.windows\.net\/[^)\s]*/g;
    const urlReplacements = new Map();
    let imageCounter = 0;

    // Function to download image and get permanent URL
    async function replaceUrl(blobUrl) {
        if (urlReplacements.has(blobUrl)) {
            return urlReplacements.get(blobUrl);
        }

        try {
            console.log('📥 Downloading image from blob URL...');
            const response = await fetch(blobUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }

            const imageBuffer = Buffer.from(await response.arrayBuffer());
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${participantId}_${imageCounter++}_${timestamp}.jpg`;

            const permanentUrl = await githubStorage.saveImage(imageBuffer, filename);
            urlReplacements.set(blobUrl, permanentUrl);

            return permanentUrl;
        } catch (error) {
            console.error('❌ Failed to process image URL:', blobUrl, error);
            return blobUrl; // Keep original URL if processing fails
        }
    }

    // Process all conversations
    for (const [taskId, conversations] of Object.entries(studyData.conversations)) {
        for (const [convId, conversation] of Object.entries(conversations)) {
            // Process message content
            if (conversation.messages) {
                for (const message of conversation.messages) {
                    if (message.content && typeof message.content === 'string') {
                        const blobUrls = message.content.match(blobUrlPattern);
                        if (blobUrls) {
                            for (const blobUrl of blobUrls) {
                                const permanentUrl = await replaceUrl(blobUrl);
                                message.content = message.content.replace(blobUrl, permanentUrl);
                            }
                        }
                    }
                }
            }

            // Process imageContext
            if (conversation.imageContext && conversation.imageContext.lastImageUrl) {
                const blobUrl = conversation.imageContext.lastImageUrl;
                if (blobUrlPattern.test(blobUrl)) {
                    conversation.imageContext.lastImageUrl = await replaceUrl(blobUrl);
                }
            }
        }
    }

    console.log(`✅ Processed ${urlReplacements.size} images for permanent storage`);
    return studyData;
}