/**
 * GitHub Storage Handler
 * 
 * Manages data persistence to GitHub repository for the chatbot study.
 * Handles both configuration state management and participant data storage.
 * 
 * Features:
 * - Configuration state loading/saving
 * - Participant data persistence
 * - Automatic file creation and updates
 * - Connection testing and error handling
 */

class GitHubStorage {
    constructor() {
        // Initialize GitHub API configuration
        this.token = process.env.GITHUB_TOKEN;
        this.owner = process.env.GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER;
        this.repo = 'Chatbot-Node-Storage';
        this.branch = 'main';

        // Configuration paths
        this.paths = {
            configurations: 'data/model-configurations.json',
            participants: 'participants'
        };

        this._logInitialization();
    }

    // ===================================================================
    // INITIALIZATION & UTILITIES
    // ===================================================================

    /**
     * Log initialization status for debugging
     * @private
     */
    _logInitialization() {
        console.log('🔧 GitHub Storage initialized:', {
            owner: this.owner,
            repo: this.repo,
            hasToken: !!this.token,
            tokenPreview: this.token ? `${this.token.substring(0, 8)}...` : 'undefined'
        });
    }

    /**
     * Test GitHub API connection
     * @returns {Promise<boolean>} Connection success status
     */
    async testConnection() {
        try {
            const url = `https://api.github.com/repos/${this.owner}/${this.repo}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API test failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ GitHub connection test successful:', data.full_name);
            return true;

        } catch (error) {
            console.error('❌ GitHub connection test failed:', error);
            return false;
        }
    }

    /**
     * Get file SHA if it exists (required for updates)
     * @private
     * @param {string} filePath - Path to the file in the repository
     * @returns {Promise<string|null>} File SHA or null if not found
     */
    async _getFileSha(filePath) {
        try {
            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${filePath}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            });

            if (response.ok) {
                const existingFile = await response.json();
                console.log('📄 File exists, obtained SHA for update');
                return existingFile.sha;
            }

            console.log('📄 File does not exist, will create new');
            return null;

        } catch (error) {
            console.log('📄 Could not check file existence, assuming new file');
            return null;
        }
    }

    // ===================================================================
    // CONFIGURATION STATE MANAGEMENT
    // ===================================================================

    /**
     * Load configuration state from GitHub repository
     * @returns {Promise<Object>} Configuration data object
     * @throws {Error} If loading fails and no fallback is possible
     */
    async loadConfigurationState() {
        try {
            console.log('📋 Loading configuration state from GitHub...');

            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.paths.configurations}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            const configData = JSON.parse(content);

            console.log('✅ Configuration state loaded successfully:', {
                totalConfigs: Object.keys(configData.configurations || {}).length,
                totalSessions: Object.keys(configData.sessions || {}).length
            });

            return configData;

        } catch (error) {
            console.error('❌ Error loading configuration state:', error);
            throw new Error(`Configuration loading failed: ${error.message}`);
        }
    }

    /**
     * Save configuration state to GitHub repository
     * @param {Object} configData - Configuration data to save
     * @returns {Promise<boolean>} Success status
     * @throws {Error} If saving fails
     */
    async saveConfigurationState(configData) {
        try {
            console.log('💾 Saving configuration state to GitHub...');

            // Prepare file content
            const content = JSON.stringify(configData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            // Get existing file SHA for update
            const sha = await this._getFileSha(this.paths.configurations);

            // Update the file
            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.paths.configurations}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    message: `Update configuration state - ${new Date().toISOString()}`,
                    content: encodedContent,
                    branch: this.branch,
                    ...(sha && { sha })
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
            }

            console.log('✅ Configuration state saved successfully');
            return true;

        } catch (error) {
            console.error('❌ Error saving configuration state:', error);
            throw new Error(`Configuration saving failed: ${error.message}`);
        }
    }

    // ===================================================================
    // PARTICIPANT DATA MANAGEMENT
    // ===================================================================

    /**
     * Save participant data to GitHub repository
     * @param {string} participantId - Unique participant identifier
     * @param {string} sessionId - Session identifier
     * @param {Object} chatData - Complete chat data including conversations and metrics
     * @returns {Promise<Object>} Save result with success status and details
     */
    /**
 * Save participant data to GitHub repository
 * @param {string} participantId - Unique participant identifier
 * @param {string} sessionId - Session identifier
 * @param {Object} chatData - Complete chat data including conversations and metrics
 * @returns {Promise<Object>} Save result with success status and details
 */
    async saveParticipantData(participantId, sessionId, chatData) {
        try {
            console.log('💾 Starting participant data save:', {
                participantId,
                sessionId,
                dataSize: JSON.stringify(chatData).length
            });

            // Test connection first
            const isConnected = await this.testConnection();
            if (!isConnected) {
                throw new Error('GitHub connection test failed - cannot save data');
            }

            // Save images first (before main data save)
            console.log('🖼️ Processing images...');
            const imageResults = await this.saveParticipantImages(participantId, chatData);

            // Prepare file path and content for main data
            const fileName = `${this.paths.participants}/chatlog_${participantId}.json`;
            const content = JSON.stringify(chatData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            console.log('📝 Preparing to save main data file:', fileName);

            // Get existing file SHA if updating
            const sha = await this._getFileSha(fileName);

            // Create or update the file
            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    message: `Update participant data: ${participantId} - ${new Date().toISOString()}`,
                    content: encodedContent,
                    branch: this.branch,
                    ...(sha && { sha })
                })
            });

            // Handle response
            const responseText = await response.text();

            if (!response.ok) {
                console.error('📡 GitHub API Error Response:', response.status, responseText.substring(0, 300));
                throw new Error(`GitHub API error: ${response.status} - ${responseText}`);
            }

            const result = JSON.parse(responseText);

            console.log('✅ Participant data saved successfully:', {
                participantId,
                path: result.content.path,
                sha: result.content.sha.substring(0, 8) + '...',
                size: content.length + ' bytes',
                imagesProcessed: imageResults.imagesProcessed,
                imagesSaved: imageResults.successfulSaves
            });

            return {
                success: true,
                fileName: fileName,
                githubUrl: result.content.html_url,
                sha: result.content.sha,
                participantId: participantId,
                sessionId: sessionId,
                imageResults: imageResults
            };

        } catch (error) {
            console.error('❌ Participant data save failed:', {
                participantId,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return {
                success: false,
                error: error.message,
                participantId: participantId,
                sessionId: sessionId,
                details: {
                    owner: this.owner,
                    repo: this.repo,
                    hasToken: !!this.token,
                    tokenValid: this.token && this.token.length > 10
                }
            };
        }
    }
    // Add this after the existing saveParticipantData method

    /**
     * Extract and save all images from participant conversations
     * @param {string} participantId - Participant identifier
     * @param {Object} chatData - Complete chat data
     * @returns {Promise<Object>} Save results
     */
    async saveParticipantImages(participantId, chatData) {
        try {
            console.log('🖼️ Starting image extraction and save for participant:', participantId);

            const imageUrls = this._extractImageUrls(chatData);

            if (imageUrls.length === 0) {
                console.log('📸 No images found in conversations');
                return { success: true, imagesProcessed: 0 };
            }

            console.log(`📸 Found ${imageUrls.length} images to save`);

            const results = [];

            for (const imageInfo of imageUrls) {
                try {
                    const result = await this._saveImage(participantId, imageInfo);
                    results.push(result);
                } catch (error) {
                    console.error(`❌ Failed to save image ${imageInfo.filename}:`, error.message);
                    results.push({
                        success: false,
                        filename: imageInfo.filename,
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;

            console.log(`✅ Image save completed: ${successCount}/${imageUrls.length} successful`);

            return {
                success: true,
                imagesProcessed: imageUrls.length,
                successfulSaves: successCount,
                results: results
            };

        } catch (error) {
            console.error('❌ Image saving failed:', error.message);
            return {
                success: false,
                error: error.message,
                imagesProcessed: 0
            };
        }
    }

    /**
     * Extract all image URLs from conversation data
     * @private
     * @param {Object} chatData - Complete chat data
     * @returns {Array} Array of image info objects
     */
    _extractImageUrls(chatData) {
        const imageUrls = [];

        if (!chatData.conversations) return imageUrls;

        for (const [taskId, conversations] of Object.entries(chatData.conversations)) {
            // Handle both Map (from frontend) and Object (serialized) formats
            const conversationEntries = conversations instanceof Map
                ? Array.from(conversations.entries())
                : Object.entries(conversations);

            for (const [conversationId, conversation] of conversationEntries) {
                if (!conversation.messages) continue;

                conversation.messages.forEach((message, messageIndex) => {
                    if (message.sender === 'Bot' && message.content) {
                        // Look for markdown image syntax: ![Generated Image](url) or ![...](url)
                        const imageRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/g;
                        let match;
                        let imageCounter = 0;

                        while ((match = imageRegex.exec(message.content)) !== null) {
                            const imageUrl = match[1];

                            // Create a clean timestamp for filename
                            const timestamp = message.timestamp
                                ? new Date(message.timestamp).toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + new Date(message.timestamp).toISOString().replace(/[:.]/g, '-').split('T')[1].split('Z')[0]
                                : new Date().toISOString().replace(/[:.]/g, '-');

                            // Create descriptive filename
                            const taskName = taskId.replace(/-/g, '_');
                            const convId = conversationId.split('_')[1] || 'conv'; // Get timestamp part of conversation ID
                            const msgId = message.msg_id || messageIndex;

                            imageCounter++;
                            const filename = `${taskName}_${convId}_msg${msgId}_img${imageCounter}_${timestamp}.png`;

                            imageUrls.push({
                                url: imageUrl,
                                filename: filename,
                                conversationId: conversationId,
                                messageId: message.msg_id || messageIndex,
                                taskId: taskId,
                                timestamp: message.timestamp,
                                imageCounter: imageCounter
                            });
                        }
                    }
                });
            }
        }

        return imageUrls;
    }

    /**
     * Download and save a single image to GitHub
     * @private
     * @param {string} participantId - Participant identifier
     * @param {Object} imageInfo - Image information object
     * @returns {Promise<Object>} Save result
     */
    async _saveImage(participantId, imageInfo) {
        try {
            console.log('📸 Downloading image:', imageInfo.filename);

            // Download the image with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const imageResponse = await fetch(imageInfo.url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'ChatBot-Study/1.0'
                }
            });

            clearTimeout(timeoutId);

            if (!imageResponse.ok) {
                throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
            }

            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');

            console.log(`📸 Downloaded ${imageBuffer.byteLength} bytes for ${imageInfo.filename}`);

            // Prepare GitHub path: images/participantId/filename
            const imagePath = `images/${participantId}/${imageInfo.filename}`;

            // Save to GitHub
            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${imagePath}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    message: `Save participant image: ${participantId}/${imageInfo.filename}`,
                    content: base64Image,
                    branch: this.branch
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub upload failed: ${response.status} - ${errorText.substring(0, 200)}`);
            }

            const result = await response.json();

            console.log('✅ Image saved successfully:', imageInfo.filename);

            return {
                success: true,
                filename: imageInfo.filename,
                githubPath: imagePath,
                githubUrl: result.content.html_url,
                sha: result.content.sha,
                size: imageBuffer.byteLength,
                originalUrl: imageInfo.url
            };

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Image download timeout for ${imageInfo.filename}`);
            }
            throw new Error(`Image save failed for ${imageInfo.filename}: ${error.message}`);
        }
    }
}

export default GitHubStorage;