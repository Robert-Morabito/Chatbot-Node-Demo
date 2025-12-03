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
    /**
 * Extract all image URLs from conversation data
 * @private
 * @param {Object} chatData - Complete chat data
 * @returns {Array} Array of image info objects
 */
    _extractImageUrls(chatData) {
        const imageUrls = [];

        if (!chatData.conversations) return imageUrls;

        // Focus on image-generation task only since that's where images come from
        const imageGenerationConversations = chatData.conversations['image-generation'];
        if (!imageGenerationConversations) return imageUrls;

        // Handle both Map (from frontend) and Object (serialized) formats
        const conversationEntries = imageGenerationConversations instanceof Map
            ? Array.from(imageGenerationConversations.entries())
            : Object.entries(imageGenerationConversations);

        // Sort conversations by creation time to get consistent chat numbering
        const sortedConversations = conversationEntries.sort((a, b) => {
            const timeA = a[1].createdAt ? new Date(a[1].createdAt).getTime() : 0;
            const timeB = b[1].createdAt ? new Date(b[1].createdAt).getTime() : 0;
            return timeA - timeB;
        });

        sortedConversations.forEach(([conversationId, conversation], chatIndex) => {
            if (!conversation.messages) return;

            const chatNumber = chatIndex + 1; // Start from chat1, chat2, etc.

            conversation.messages.forEach((message, messageIndex) => {
                if (message.sender === 'Bot' && message.content) {
                    // Look for markdown image syntax: ![Generated Image](url) or ![...](url)
                    const imageRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/g;
                    let match;
                    let imageCounter = 0;

                    while ((match = imageRegex.exec(message.content)) !== null) {
                        const imageUrl = match[1];
                        imageCounter++;

                        // Simple, clear filename: chat1_msg3_img1.png
                        // Use message.msg_id if available, otherwise use index + 1
                        const messageNumber = message.msg_id || (messageIndex + 1);

                        let filename;
                        if (imageCounter === 1) {
                            // If only one image in the message, skip the img counter
                            filename = `chat${chatNumber}_msg${messageNumber}.png`;
                        } else {
                            // If multiple images in same message, add image counter
                            filename = `chat${chatNumber}_msg${messageNumber}_img${imageCounter}.png`;
                        }

                        imageUrls.push({
                            url: imageUrl,
                            filename: filename,
                            conversationId: conversationId,
                            messageId: message.msg_id || messageIndex,
                            messageNumber: messageNumber,
                            chatNumber: chatNumber,
                            imageCounter: imageCounter,
                            timestamp: message.timestamp
                        });
                    }
                }
            });
        });

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

    /**
     * Direct image upload (for testing and manual uploads)
     * @param {string} participantId - Participant identifier
     * @param {string} filename - Image filename
     * @param {string} base64 - Base64 image data (without data URL prefix)
     * @param {Object} metadata - Optional metadata
     * @returns {Promise<Object>} Upload result
     */
    async uploadImageDirect(participantId, filename, base64, metadata = null) {
        try {
            console.log('📤 Direct upload:', {
                participantId,
                filename,
                size: `${(base64.length / 1024).toFixed(2)} KB`
            });

            // Prepare GitHub path
            const imagePath = `images/${participantId}/${filename}`;

            // Check if file already exists
            const sha = await this._getFileSha(imagePath);

            // Upload to GitHub
            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${imagePath}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    message: `Upload image: ${participantId}/${filename}${metadata ? ' (test)' : ''}`,
                    content: base64,
                    branch: this.branch,
                    ...(sha && { sha })
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub upload failed: ${response.status} - ${errorText.substring(0, 200)}`);
            }

            const result = await response.json();

            console.log('✅ Direct upload successful:', imagePath);

            return {
                success: true,
                filename,
                githubPath: imagePath,
                sha: result.content.sha,
                size: base64.length
            };

        } catch (error) {
            console.error('❌ Direct upload failed:', error.message);
            throw error;
        }
    }

    // ===================================================================
    // PER-TASK DATA MANAGEMENT
    // ===================================================================
    /**
     * Save task-specific data to GitHub
     * @param {string} participantId - Participant identifier
     * @param {string} taskName - Task name (image-generation, outreach-msg, acro-build)
     * @param {Object} taskData - Task data to save
     * @returns {Promise<Object>} Save result
     */
    async saveTaskData(participantId, taskName, taskData) {
        try {
            console.log('💾 Saving task data to GitHub:', { participantId, taskName });

            const fileName = `${this.paths.participants}/${participantId}/task-${taskName}.json`;
            const content = JSON.stringify(taskData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            // Get existing file SHA if updating (for auto-save overwrites)
            const sha = await this._getFileSha(fileName);

            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;

            console.log('📤 GitHub API request:', {
                url,
                fileName,
                hasExistingSha: !!sha
            });

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    message: `${sha ? 'Update' : 'Create'} task data: ${participantId}/${taskName} - ${new Date().toISOString()}`,
                    content: encodedContent,
                    branch: this.branch,
                    ...(sha && { sha })
                })
            });

            console.log('📥 GitHub API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ GitHub API error response:', errorText);
                throw new Error(`GitHub API error: ${response.status} - ${errorText.substring(0, 200)}`);
            }

            const result = await response.json();
            console.log('✅ Task data saved to GitHub:', fileName);

            return {
                success: true,
                fileName,
                sha: result.content.sha
            };

        } catch (error) {
            console.error('❌ GitHub task data save failed:', error.message);
            throw error;
        }
    }

    /**
     * Get all task data for a participant
     * @param {string} participantId - Participant identifier
     * @returns {Promise<Object>} All task data
     */
    async getParticipantTaskData(participantId) {
        try {
            console.log('📋 Fetching all task data for:', participantId);

            const tasks = ['image-generation', 'outreach-msg', 'acro-build'];
            const taskData = {};

            for (const task of tasks) {
                const fileName = `${this.paths.participants}/${participantId}/task-${task}.json`;

                try {
                    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;
                    const response = await fetch(url, {
                        headers: {
                            'Authorization': `token ${this.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const content = Buffer.from(data.content, 'base64').toString('utf-8');
                        taskData[task] = JSON.parse(content);
                        console.log(`✅ Found task data: ${task}`);
                    } else {
                        console.log(`📭 No data found for task: ${task}`);
                        taskData[task] = null;
                    }
                } catch (error) {
                    console.log(`⚠️ Error fetching ${task}:`, error.message);
                    taskData[task] = null;
                }
            }

            return taskData;

        } catch (error) {
            console.error('❌ Failed to fetch participant task data:', error.message);
            throw error;
        }
    }

    /**
     * Save final compiled data to "finished" folder
     * @param {string} participantId - Participant identifier
     * @param {Object} compiledData - Complete study data
     * @returns {Promise<Object>} Save result
     */
    async saveFinishedStudyData(participantId, compiledData) {
        try {
            console.log('🏁 Saving finished study data:', participantId);

            const fileName = `finished/${participantId}/complete-study-data.json`;
            const content = JSON.stringify(compiledData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            const sha = await this._getFileSha(fileName);

            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    message: `Finished study: ${participantId} - ${new Date().toISOString()}`,
                    content: encodedContent,
                    branch: this.branch,
                    ...(sha && { sha })
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Finished study data saved:', fileName);

            // Also save images to finished folder
            await this.saveFinishedImages(participantId, compiledData);

            return {
                success: true,
                fileName,
                sha: result.content.sha
            };

        } catch (error) {
            console.error('❌ Finished study save failed:', error.message);
            throw error;
        }
    }

    /**
     * Save images to finished folder
     * @param {string} participantId - Participant identifier  
     * @param {Object} compiledData - Complete study data
     */
    async saveFinishedImages(participantId, compiledData) {
        try {
            // Extract and save images from image-generation task
            const imageGenData = compiledData.tasks?.['image-generation'];
            if (!imageGenData?.conversations) return;

            const imageUrls = this._extractImageUrls({ conversations: { 'image-generation': imageGenData.conversations } });

            for (const imageInfo of imageUrls) {
                try {
                    await this._saveImageToFinished(participantId, imageInfo);
                } catch (error) {
                    console.error(`⚠️ Failed to save finished image ${imageInfo.filename}:`, error.message);
                }
            }

            console.log(`✅ Saved ${imageUrls.length} images to finished folder`);

        } catch (error) {
            console.error('⚠️ Error saving finished images:', error.message);
        }
    }

    /**
     * Save a single image to finished folder
     * @private
     */
    async _saveImageToFinished(participantId, imageInfo) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const imageResponse = await fetch(imageInfo.url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'ChatBot-Study/1.0' }
        });

        clearTimeout(timeoutId);

        if (!imageResponse.ok) {
            throw new Error(`Failed to download: ${imageResponse.status}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        const imagePath = `finished/${participantId}/images/${imageInfo.filename}`;

        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${imagePath}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
                message: `Save finished image: ${participantId}/${imageInfo.filename}`,
                content: base64Image,
                branch: this.branch
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status}`);
        }
    }
}

export default GitHubStorage;