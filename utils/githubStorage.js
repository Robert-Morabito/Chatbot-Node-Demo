class GitHubStorage {
    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.owner = process.env.GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER;
        this.repo = process.env.GITHUB_REPO || process.env.VERCEL_GIT_REPO_SLUG;
        this.branch = 'main';

        console.log('🔧 GitHub Storage initialized:', {
            owner: this.owner,
            repo: this.repo,
            hasToken: !!this.token,
            tokenPreview: this.token ? `${this.token.substring(0, 8)}...` : 'undefined'
        });
    }

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

    async saveParticipantData(participantId, sessionId, chatData) {
        try {
            // Test connection first
            const isConnected = await this.testConnection();
            if (!isConnected) {
                throw new Error('GitHub connection test failed');
            }

            const fileName = `participants/chatlog_${participantId}_${Date.now()}.json`;
            const content = JSON.stringify(chatData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            console.log('📝 Attempting to save file:', fileName);

            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;

            // First, check if file already exists (to get SHA if updating)
            let sha = null;
            try {
                const checkResponse = await fetch(url, {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                    }
                });

                if (checkResponse.ok) {
                    const existingFile = await checkResponse.json();
                    sha = existingFile.sha;
                    console.log('📄 File exists, will update with SHA:', sha);
                }
            } catch (e) {
                console.log('📄 File does not exist, will create new');
            }

            // Create or update the file
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    message: `Add participant data: ${participantId} - ${new Date().toISOString()}`,
                    content: encodedContent,
                    branch: this.branch,
                    ...(sha && { sha })
                })
            });

            const responseText = await response.text();
            console.log('📡 GitHub API Response:', response.status, responseText.substring(0, 200));

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} - ${responseText}`);
            }

            const result = JSON.parse(responseText);

            console.log('✅ Successfully saved to GitHub:', {
                path: result.content.path,
                sha: result.content.sha,
                url: result.content.html_url
            });

            return {
                success: true,
                fileName: fileName,
                githubUrl: result.content.html_url,
                sha: result.content.sha
            };

        } catch (error) {
            console.error('❌ GitHub save error:', error);

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

    async loadConfigurationState() {
        try {
            const fileName = 'study-state/model-configurations.json';
            const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                const content = Buffer.from(data.content, 'base64').toString('utf8');
                return JSON.parse(content);
            } else {
                // Return initial configuration state if file doesn't exist
                return this.getInitialConfigurationState();
            }
        } catch (error) {
            console.error('Error loading configuration state:', error);
            return this.getInitialConfigurationState();
        }
    }

    async saveConfigurationState(configData) {
        try {
            const fileName = 'study-state/model-configurations.json';
            const content = JSON.stringify(configData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            // Get current file SHA if it exists
            let sha = null;
            const getUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;
            try {
                const getResponse = await fetch(getUrl, {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                    }
                });
                if (getResponse.ok) {
                    const existingFile = await getResponse.json();
                    sha = existingFile.sha;
                }
            } catch (e) {
                // File doesn't exist yet
            }

            // Save the file
            const putUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${fileName}`;
            const response = await fetch(putUrl, {
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
                throw new Error(`Failed to save configuration state: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Error saving configuration state:', error);
            throw error;
        }
    }

    getInitialConfigurationState() {
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