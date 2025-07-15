/**
 * GitHub Storage Utility
 * Handles secure storage of participant data and configuration state in GitHub repository
 * Critical component for study data persistence and integrity
 */

class GitHubStorage {
    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.owner = process.env.GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER;
        this.repo = process.env.GITHUB_REPO || process.env.VERCEL_GIT_REPO_SLUG;
        this.branch = 'main';

        console.log('GitHub Storage initialized:', {
            owner: this.owner,
            repo: this.repo,
            hasToken: !!this.token
        });
    }

    /**
     * Load configuration state from GitHub
     * @returns {Object} Configuration data with fallback to defaults
     */
    async loadConfigurationState() {
        try {
            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/data/model-configurations.json`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load configuration: ${response.status}`);
            }

            const data = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return JSON.parse(content);

        } catch (error) {
            console.error('Error loading configuration state:', error.message);
            return this.getDefaultConfiguration();
        }
    }

    /**
     * Save configuration state to GitHub
     * @param {Object} configData - Configuration data to save
     * @returns {boolean} Success status
     */
    async saveConfigurationState(configData) {
        try {
            const fileName = 'data/model-configurations.json';
            const content = JSON.stringify(configData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;

            // Get current file SHA for updates
            const sha = await this.getFileSHA(url);

            // Update the file
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
                throw new Error(`Failed to save configuration: ${response.status}`);
            }

            return true;

        } catch (error) {
            console.error('Error saving configuration state:', error.message);
            throw error;
        }
    }

    /**
     * Save participant data securely to GitHub
     * @param {string} participantId - Participant identifier
     * @param {string} sessionId - Session identifier
     * @param {Object} chatData - Complete chat and behavioral data
     * @returns {Object} Save result with success status
     */
    async saveParticipantData(participantId, sessionId, chatData) {
        try {
            // Test connection first
            const isConnected = await this.testConnection();
            if (!isConnected) {
                throw new Error('GitHub connection test failed');
            }

            const fileName = `participants/chatlog_${participantId}.json`;
            const content = JSON.stringify(chatData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            console.log('Saving participant data:', fileName);

            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;
            const sha = await this.getFileSHA(url);

            // Create or update the file
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

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            console.log('Successfully saved to GitHub:', {
                path: result.content.path,
                sha: result.content.sha.substring(0, 8) + '...'
            });

            return {
                success: true,
                fileName: fileName,
                githubUrl: result.content.html_url,
                sha: result.content.sha
            };

        } catch (error) {
            console.error('GitHub save error:', error.message);

            return {
                success: false,
                error: error.message,
                details: {
                    owner: this.owner,
                    repo: this.repo,
                    hasToken: !!this.token
                }
            };
        }
    }

    /**
     * Test GitHub API connection
     * @returns {boolean} Connection status
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
            console.log('GitHub connection test successful:', data.full_name);
            return true;
        } catch (error) {
            console.error('GitHub connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Get file SHA for updates (helper method)
     * @param {string} url - GitHub API URL for file
     * @returns {string|null} File SHA or null if file doesn't exist
     */
    async getFileSHA(url) {
        try {
            const checkResponse = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            });

            if (checkResponse.ok) {
                const existingFile = await checkResponse.json();
                return existingFile.sha;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get default configuration structure
     * @returns {Object} Default configuration data
     */
    getDefaultConfiguration() {
        return {
            configurations: {
                "1": { id: 1, displayedModel: "GPT-3.5", actualModel: "gpt-3.5-turbo-0125", completedSessions: 0, targetSessions: 12, isActive: true },
                "2": { id: 2, displayedModel: "GPT-3.5", actualModel: "gpt-4-turbo", completedSessions: 0, targetSessions: 12, isActive: true },
                "3": { id: 3, displayedModel: "GPT-3.5", actualModel: "o1-preview", completedSessions: 0, targetSessions: 12, isActive: true },
                "4": { id: 4, displayedModel: "GPT-4", actualModel: "gpt-3.5-turbo-0125", completedSessions: 0, targetSessions: 12, isActive: true },
                "5": { id: 5, displayedModel: "GPT-4", actualModel: "gpt-4-turbo", completedSessions: 0, targetSessions: 12, isActive: true },
                "6": { id: 6, displayedModel: "GPT-4", actualModel: "o1-preview", completedSessions: 0, targetSessions: 12, isActive: true },
                "7": { id: 7, displayedModel: "o1-Preview", actualModel: "gpt-3.5-turbo-0125", completedSessions: 0, targetSessions: 12, isActive: true },
                "8": { id: 8, displayedModel: "o1-Preview", actualModel: "gpt-4-turbo", completedSessions: 0, targetSessions: 12, isActive: true },
                "9": { id: 9, displayedModel: "o1-Preview", actualModel: "o1-preview", completedSessions: 0, targetSessions: 12, isActive: true }
            },
            sessions: {},
            metadata: {
                totalConfigurations: 9,
                totalTargetSessions: 108,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }
        };
    }
}

export default GitHubStorage;