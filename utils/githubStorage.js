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
    async saveParticipantData(participantId, allocationId, chatData) {
        try {
            console.log('💾 Starting participant data save:', {
                participantId,
                allocationId: allocationId || 'none',
                dataSize: JSON.stringify(chatData).length
            });

            // Test connection first
            const isConnected = await this.testConnection();
            if (!isConnected) {
                throw new Error('GitHub connection test failed - cannot save data');
            }

            // Prepare file path and content
            const fileName = `${this.paths.participants}/chatlog_${participantId}.json`;
            const content = JSON.stringify(chatData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            console.log('📝 Preparing to save file:', fileName);

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
                size: content.length + ' bytes'
            });

            return {
                success: true,
                fileName: fileName,
                githubUrl: result.content.html_url,
                sha: result.content.sha,
                participantId: participantId,
                allocationId: allocationId
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
                allocationId: allocationId,
                details: {
                    owner: this.owner,
                    repo: this.repo,
                    hasToken: !!this.token,
                    tokenValid: this.token && this.token.length > 10
                }
            };
        }
    }
}

export default GitHubStorage;