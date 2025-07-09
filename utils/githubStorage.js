class GitHubStorage {
    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.owner = process.env.GITHUB_OWNER; 
        this.repo = process.env.GITHUB_REPO;   
        this.branch = 'main';
    }

    async saveParticipantData(participantId, sessionId, chatData) {
        try {
            const fileName = `data/participants/chatlog_${participantId}_${sessionId}.json`;
            const content = JSON.stringify(chatData, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');
            
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
                }
            } catch (e) {
                // File doesn't exist, which is fine for new files
            }
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Add participant data: ${participantId}`,
                    content: encodedContent,
                    branch: this.branch,
                    ...(sha && { sha }) // Include SHA if updating existing file
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API error: ${response.statusText} - ${errorText}`);
            }
            
            const result = await response.json();
            
            console.log(`📁 Saved to GitHub: ${fileName}`);
            
            return {
                success: true,
                fileName: fileName,
                githubUrl: result.content.html_url
            };
            
        } catch (error) {
            console.error('GitHub save error:', error);
            
            return {
                success: false,
                error: error.message,
                fallbackData: chatData
            };
        }
    }
}

export default GitHubStorage;