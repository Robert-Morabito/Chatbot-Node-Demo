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
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Add participant data: ${participantId}`,
                    content: encodedContent,
                    branch: this.branch
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
            
            // Fallback: save locally and log the data
            console.log('PARTICIPANT DATA (save this manually):', JSON.stringify(chatData, null, 2));
            
            return {
                success: false,
                error: error.message,
                fallbackData: chatData
            };
        }
    }
}

export default GitHubStorage;