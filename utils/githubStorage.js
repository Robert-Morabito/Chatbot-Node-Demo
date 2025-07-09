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
}

export default GitHubStorage;