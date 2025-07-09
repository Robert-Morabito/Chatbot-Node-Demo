class ChatApp {
    constructor() {
        // Initialize properties
        this.conversations = new Map();
        this.currentConversationId = null;
        this.currentChatlog = [];
        this.msgWidgets = {};
        this.currentTheme = 'dark';
        this.autoSaveTimeout = null;
        this.messageIdCounter = 0;

        // Generate simple participant ID
        this.participantId = this.generateSimpleParticipantId();

        // Configuration (can be simplified since we're not doing complex experimental assignment)
        this.config = {
            givenModel: 'GPT-4',
            trueModel: 'gpt-4-turbo',
            displayName: 'GPT-4'
        };

        this.modelDescriptions = {
            'GPT-3.5': {
                year: '2022',
                generation: '3.5',
                description: [
                    '⚬ Generation 3.5 - Released March 2022',
                    '⚬ Fast & Cost-Effective - Quick responses, efficient processing',
                    '⚬ General Purpose - Good at most conversational tasks',
                    '⚬ Reliable Baseline - Solid performance across various topics',
                    '⚬ Best For - Everyday chat, basic writing, general questions',
                    '⚬ Limitations - May struggle with very complex reasoning or specialized tasks'
                ]
            },
            'GPT-4': {
                year: '2023',
                generation: '4.0',
                description: [
                    '⚬ Generation 4.0 - Released March 2023',
                    '⚬ Advanced Reasoning - Better at complex problem-solving',
                    '⚬ Improved Accuracy - More reliable and factual responses',
                    '⚬ Multimodal Capable - Can understand context better',
                    '⚬ Best For - Complex analysis, creative writing, detailed explanations',
                    '⚬ Trade-offs - Slower than GPT-3.5, more expensive to operate'
                ]
            },
            'o1-Preview': {
                year: '2024',
                generation: 'o1',
                description: [
                    '⚬ Generation o1 - Released September 2024',
                    '⚬ Reasoning Specialist - Designed for deep thinking and problem-solving',
                    '⚬ Deliberate Processing - Takes time to "think through" complex problems',
                    '⚬ STEM Excellence - Outstanding at math, science, coding, logic puzzles',
                    '⚬ Best For - Research, analysis, complex reasoning tasks',
                    '⚬ Trade-offs - Much slower responses, not ideal for casual conversation'
                ]
            }
        };

        this.behaviorMetrics = {
            totalKeystrokes: 0,
            backspaceCount: 0,
            messageEdits: 0,
            messagesDeleted: 0,
            typingDuration: 0,
            idleDuration: 0,
            sessionStartTime: Date.now(),
            messageTimings: [],
            typingPatterns: [],
            lastActivityTime: Date.now()
        };

        this.typingStartTime = null;
        this.idleTimer = null;

        // Session persistence
        this.sessionKey = null;

        // Initialize
        this.init();
    }

    async init() {
        // Check for existing session first
        const sessionRestored = await this.checkForExistingSession();

        if (!sessionRestored) {
            // Load new configuration assignment
            await this.loadConfiguration();
        }

        // Continue with initialization
        this.setupEventListeners();
        this.setupTextareaAutoResize();
        this.setupAdvancedAnimations();
        this.trackKeystrokes(); // Add behavioral tracking

        if (!sessionRestored) {
            this.showModelInfo();
        }

        // Load configuration assignment first
        await this.loadConfiguration();

        // Continue with normal initialization
        this.showModelInfo();
        this.setupEventListeners();
        this.updateBotName();
        this.createNewConversation();
        this.setupTextareaAutoResize();
        this.setupAdvancedAnimations();
    }

    showModelInfo() {
        const modal = document.getElementById('model-info-modal');
        const modelTitle = document.getElementById('model-title');
        const modelDescription = document.getElementById('model-description');
        const continueBtn = document.getElementById('continue-btn');
        const partid = document.getElementById('partid');

        // Get model info
        const modelInfo = this.modelDescriptions[this.config.displayName] || this.modelDescriptions['GPT-4'];
        partid.innerHTML =
            `<div style="background:rgb(207, 223, 233); padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 3px solid #2196f3;">
            <p style="margin: 0; color: #101010; font-size: 18px;"><strong>📋 Research Study:</strong> Your Participant ID is 
            <span style="font-weight: bold; color: #2196f3; font-family: monospace; font-size: 16px;">${this.participantId}</span></p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Please use this ID when prompted in the Google Forms survey found 
                <a href="https://docs.google.com/forms/d/e/1FAIpQLSeZ82HGcqRGW6aT1J-w2UvDgjShcvMHxeAGIn1S8XtTg2xZRQ/viewform?usp=dialog" target="_blank">here</a>.</p>
        </div>`;
        modelTitle.textContent = `Some info about ${this.config.displayName}`;
        modelDescription.innerHTML = `<h3>Today you will be using: ${this.config.displayName} (${modelInfo.year})</h3>
        
        <div style="background: var(--bg-scrollable-window-dark); color: var(--text-dark); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; text-align: left;">
            ${modelInfo.description.map(point => `<p style="margin: 8px 0; font-size: 15px;">${point}</p>`).join('')}
        </div>
        
        <p style="font-size: 16px; margin-top: 20px;"><strong>Complete the tasks as described in your research survey. Your conversations will be automatically saved.</strong></p>`;

        modal.style.display = 'flex';

        continueBtn.onclick = () => {
            modal.style.display = 'none';
            this.updateBotName();
            this.startTutorial();
        };
    }

    generateSimpleParticipantId() {
        // Generate a simple 6-character alphanumeric ID
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    saveSessionState() {
        if (!this.sessionKey) {
            this.sessionKey = `chatbot_session_${this.participantId}_${this.sessionId}`;
        }

        const sessionData = {
            participantId: this.participantId,
            sessionId: this.sessionId,
            configurationId: this.configurationId,
            config: this.config,
            conversations: Object.fromEntries(this.conversations),
            currentConversationId: this.currentConversationId,
            currentChatlog: this.currentChatlog,
            behaviorMetrics: this.behaviorMetrics,
            lastSaved: Date.now()
        };

        localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));

        // Also save a recovery key
        localStorage.setItem('chatbot_last_session', this.sessionKey);
    }

    async checkForExistingSession() {
        const lastSessionKey = localStorage.getItem('chatbot_last_session');

        if (lastSessionKey) {
            const sessionData = localStorage.getItem(lastSessionKey);
            if (sessionData) {
                try {
                    const parsed = JSON.parse(sessionData);

                    // Check if session is less than 24 hours old
                    if (Date.now() - parsed.lastSaved < 24 * 60 * 60 * 1000) {
                        return await this.promptSessionRecovery(parsed);
                    }
                } catch (e) {
                    console.error('Error parsing session data:', e);
                }
            }
        }
        return false;
    }

    async promptSessionRecovery(sessionData) {
        const modal = document.createElement('div');
        modal.className = 'recovery-modal';
        modal.innerHTML = `
        <div class="recovery-content">
            <h3>Resume Previous Session?</h3>
            <p>We found an incomplete session for Participant ID: <strong>${sessionData.participantId}</strong></p>
            <p>Would you like to continue where you left off?</p>
            <div class="recovery-buttons">
                <button id="resume-session" class="primary-btn">Resume Session</button>
                <button id="new-session" class="secondary-btn">Start New Session</button>
            </div>
        </div>
    `;

        document.body.appendChild(modal);

        return new Promise((resolve) => {
            document.getElementById('resume-session').onclick = () => {
                modal.remove();
                this.restoreSession(sessionData);
                resolve(true);
            };

            document.getElementById('new-session').onclick = () => {
                modal.remove();
                localStorage.removeItem(sessionData.sessionKey);
                localStorage.removeItem('chatbot_last_session');
                resolve(false);
            };
        });
    }

    restoreSession(sessionData) {
        // Restore all session data
        this.participantId = sessionData.participantId;
        this.sessionId = sessionData.sessionId;
        this.configurationId = sessionData.configurationId;
        this.config = sessionData.config;
        this.conversations = new Map(Object.entries(sessionData.conversations));
        this.currentConversationId = sessionData.currentConversationId;
        this.currentChatlog = sessionData.currentChatlog;
        this.behaviorMetrics = sessionData.behaviorMetrics;

        // Update UI
        this.updateBotName();
        this.updateConversationList();
        this.renderConversation();

        console.log('✅ Session restored successfully');
    }

    async onClose(event) {
        // Auto-save before closing
        if (this.currentConversationId && this.currentChatlog.length > 0) {
            const conversation = this.conversations.get(this.currentConversationId);
            if (conversation) {
                conversation.messages = [...this.currentChatlog];
            }

            // Save to server and mark session as completed
            try {
                await this.saveToServer();

                // Mark experimental session as completed
                if (this.sessionId) {
                    await fetch('/api/experimental/complete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: this.sessionId })
                    });
                }
            } catch (error) {
                console.error('Error saving on close:', error);
            }
        }
    }

    trackKeystrokes() {
        const messageInput = document.getElementById('message-input');

        messageInput.addEventListener('keydown', (e) => {
            this.behaviorMetrics.totalKeystrokes++;

            if (e.key === 'Backspace') {
                this.behaviorMetrics.backspaceCount++;
            }

            // Track typing start
            if (!this.typingStartTime) {
                this.typingStartTime = Date.now();
            }

            // Reset idle timer
            this.resetIdleTimer();

            // Save to localStorage periodically
            this.saveSessionState();
        });

        messageInput.addEventListener('input', (e) => {
            // Track typing patterns
            if (this.typingStartTime) {
                const pattern = {
                    duration: Date.now() - this.typingStartTime,
                    length: e.target.value.length,
                    timestamp: Date.now()
                };
                this.behaviorMetrics.typingPatterns.push(pattern);
            }
        });
    }

    resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);

        const idleStart = Date.now();
        this.idleTimer = setTimeout(() => {
            this.behaviorMetrics.idleDuration += Date.now() - idleStart;
        }, 5000); // Consider idle after 5 seconds
    }

    async loadExperimentalCondition() {
        try {
            const response = await fetch('/api/experimental/assign');
            const data = await response.json();

            if (data.success) {
                this.sessionId = data.sessionId;
                this.experimentalCondition = data.condition;

                // Update config with assigned condition
                this.config = {
                    givenModel: data.condition.displayedModel,
                    trueModel: data.condition.actualModel,
                    displayName: data.condition.displayName
                };

                console.log('🧪 Experimental condition assigned:', {
                    session: this.sessionId,
                    displayed: this.config.givenModel,
                    actual: this.config.trueModel
                });

                return true;
            } else {
                throw new Error('Failed to get experimental assignment');
            }
        } catch (error) {
            console.error('Error loading experimental condition:', error);
            // Fallback to default
            this.config = {
                givenModel: 'GPT-4',
                trueModel: 'gpt-4-turbo',
                displayName: 'GPT-4'
            };
            return false;
        }
    }

    setupEventListeners() {
        // Send button and Enter key
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Theme toggle
        document.getElementById('theme-switch').addEventListener('change', () => this.toggleTheme());

        // New chat button
        document.getElementById('new-chat-btn').addEventListener('click', () => this.createNewConversation());

        // Save chat button (manual save)
        document.getElementById('save-chat-btn').addEventListener('click', () => this.manualSave());

        // Sidebar toggles
        document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobile-sidebar-toggle').addEventListener('click', () => this.toggleMobileSidebar());

        // Window close event
        window.addEventListener('beforeunload', (e) => this.onClose(e));

        // Click outside sidebar on mobile
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    setupTextareaAutoResize() {
        const textarea = document.getElementById('message-input');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        });
    }

    updateBotName() {
        // Update main title (clean, no participant ID)
        document.getElementById('bot-name').textContent = `Connected to ${this.config.displayName}`;

        // Update participant ID in header
        document.getElementById('header-participant-id').textContent = this.participantId;

        // Update other elements
        document.getElementById('welcome-model-name').textContent = this.config.displayName;
        document.title = `${this.config.displayName} - Study ${this.participantId}`;
    }

    createNewConversation() {
        const conversationId = Date.now().toString();
        const conversation = {
            id: conversationId,
            title: 'New Chat',
            messages: [],
            createdAt: new Date(),
            lastMessageAt: new Date()
        };

        this.conversations.set(conversationId, conversation);
        this.switchToConversation(conversationId);
        this.updateConversationList();

        // Clear welcome message and show it for new conversation
        this.showWelcomeMessage();
    }

    switchToConversation(conversationId) {
        // Save current conversation state
        if (this.currentConversationId) {
            const currentConv = this.conversations.get(this.currentConversationId);
            if (currentConv) {
                currentConv.messages = [...this.currentChatlog];
            }
        }

        // Switch to new conversation
        this.currentConversationId = conversationId;
        const conversation = this.conversations.get(conversationId);

        if (conversation) {
            this.currentChatlog = [...conversation.messages];
            this.renderConversation();
            this.updateConversationList();
        }
    }

    renderConversation() {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        this.msgWidgets = {};

        if (this.currentChatlog.length === 0) {
            this.showWelcomeMessage();
        } else {
            this.currentChatlog.forEach(msg => {
                this.renderMessage(msg, false); // false = don't auto-scroll
            });
            this.scrollToBottom();
        }
    }

    showWelcomeMessage() {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-content">
                    <h2>Welcome to ChatBot</h2>
                    <p>Start a conversation with <strong>${this.config.givenModel}</strong></p>
                </div>
            </div>
        `;
    }

    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) return;

        // Remove welcome message if it exists
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        // Create message info object
        const msgId = ++this.messageIdCounter;
        const msgInfo = {
            msg_id: msgId,
            sender: 'User',
            content: message,
            timestamp: new Date()
        };

        // Update chatlog and clear input
        this.currentChatlog.push(msgInfo);
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Render message
        this.renderMessage(msgInfo);

        // Update conversation title if it's the first message
        this.updateConversationTitle(message);

        // Auto-save conversation
        this.autoSaveConversation();

        // Show typing indicator and get response
        this.showTypingIndicator();
        setTimeout(() => this.getLLMResponse(), 500);
    }

    renderMessage(msgInfo, autoScroll = true) {
        const messagesContainer = document.getElementById('messages');

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msgInfo.sender.toLowerCase()}`;
        messageDiv.dataset.msgId = msgInfo.msg_id;

        // Create icon
        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = msgInfo.sender;
        iconImg.src = msgInfo.sender === 'User' ? 'images/user.png' : 'images/gpt.png';

        // Create message content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Render content with markdown for bot messages, plain text for user messages
        if (msgInfo.sender === 'Bot') {
            // Use marked.js to parse markdown
            contentDiv.innerHTML = marked.parse(msgInfo.content, {
                breaks: true, // Convert line breaks to <br>
                gfm: true,    // GitHub Flavored Markdown
                sanitize: false // Allow HTML (be careful in production)
            });
        } else {
            // User messages stay as plain text
            contentDiv.textContent = msgInfo.content;
        }

        // Add edit button for user messages
        if (msgInfo.sender === 'User') {
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = '✎';
            editBtn.title = 'Edit message';
            editBtn.onclick = () => this.editMessage(msgInfo.msg_id);
            contentDiv.appendChild(editBtn);
        }

        // Assemble message
        messageDiv.appendChild(iconImg);
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);

        // Store reference
        this.msgWidgets[msgInfo.msg_id] = {
            element: messageDiv,
            info: msgInfo
        };

        if (autoScroll) {
            this.scrollToBottom();
        }
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('messages');

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-message';
        typingDiv.id = 'typing-indicator';

        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = 'Bot';
        iconImg.src = 'images/gpt.png';

        const typingContent = document.createElement('div');
        typingContent.className = 'typing-content';

        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'typing-dots';

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            dotsContainer.appendChild(dot);
        }

        typingContent.appendChild(dotsContainer);
        typingDiv.appendChild(iconImg);
        typingDiv.appendChild(typingContent);
        messagesContainer.appendChild(typingDiv);

        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async getLLMResponse() {
        try {
            // Prepare the message data
            const requestData = {
                messages: this.currentChatlog,
                model: this.config.trueModel,   // NEW: actual model
                sessionId: this.sessionId,      // Add session tracking
                conversationId: this.currentConversationId
            };


            console.log('🚀 Starting LLM request:', requestData);

            // Use fetch for streaming
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let botMsgId = ++this.messageIdCounter;
            let fullResponse = '';
            let botMessageElement = null;

            // Remove typing indicator
            this.hideTypingIndicator();

            // Create initial bot message element
            const botMsgInfo = {
                msg_id: botMsgId,
                sender: 'Bot',
                content: '',
                timestamp: new Date()
            };

            this.renderMessage(botMsgInfo);
            botMessageElement = this.msgWidgets[botMsgId].element.querySelector('.message-content');

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    // Decode the chunk
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));

                                if (data.type === 'content') {
                                    // Update the message content in real-time
                                    fullResponse = data.fullContent;
                                    if (botMessageElement) {
                                        // Render markdown in real-time
                                        const tempDiv = document.createElement('div');
                                        tempDiv.innerHTML = marked.parse(fullResponse, {
                                            breaks: true,
                                            gfm: true,
                                            sanitize: false
                                        });

                                        // Preserve the edit button if it exists
                                        const editBtn = botMessageElement.querySelector('.edit-btn');
                                        botMessageElement.innerHTML = tempDiv.innerHTML;
                                        if (editBtn) {
                                            botMessageElement.appendChild(editBtn);
                                        }
                                    }

                                    // Auto-scroll to bottom
                                    this.scrollToBottom();

                                } else if (data.type === 'done') {
                                    // Stream completed successfully
                                    console.log('✅ Stream completed:', data.finishReason);

                                    // Update final message in chatlog
                                    const msgIndex = this.currentChatlog.findIndex(msg => msg.msg_id === botMsgId);
                                    if (msgIndex !== -1) {
                                        this.currentChatlog[msgIndex].content = fullResponse;
                                    } else {
                                        this.currentChatlog.push({
                                            msg_id: botMsgId,
                                            sender: 'Bot',
                                            content: fullResponse,
                                            timestamp: new Date()
                                        });
                                    }

                                    // Auto-save the conversation
                                    this.autoSaveConversation();
                                    break;

                                } else if (data.type === 'error') {
                                    // Handle error
                                    console.error('❌ Stream error:', data.error);
                                    if (botMessageElement) {
                                        botMessageElement.textContent = `Error: ${data.error}`;
                                        botMessageElement.style.color = '#ef4444';
                                    }
                                    break;

                                } else if (data.type === 'connected') {
                                    console.log('🔌 Stream connected for conversation:', data.conversationId);
                                }

                            } catch (parseError) {
                                console.error('JSON parse error:', parseError, 'Line:', line);
                            }
                        }
                    }
                }
            } catch (streamError) {
                console.error('Stream reading error:', streamError);
                if (botMessageElement) {
                    botMessageElement.textContent = 'Error: Failed to receive response';
                    botMessageElement.style.color = '#ef4444';
                }
            }

        } catch (error) {
            console.error('LLM Request error:', error);
            this.hideTypingIndicator();

            // Show error message
            const errorMsgId = ++this.messageIdCounter;
            const errorMsgInfo = {
                msg_id: errorMsgId,
                sender: 'Bot',
                content: `Sorry, I encountered an error: ${error.message}`,
                timestamp: new Date()
            };

            this.currentChatlog.push(errorMsgInfo);
            this.renderMessage(errorMsgInfo);
        }
    }

    editMessage(msgId) {
        this.behaviorMetrics.messageEdits++;
        const widget = this.msgWidgets[msgId];
        if (!widget) return;

        const contentDiv = widget.element.querySelector('.message-content');
        const originalText = widget.info.content;

        // Check if edit mode is already active - prevents multiple edit boxes
        if (contentDiv.querySelector('.edit-mode')) {
            return; // Exit if already in edit mode
        }

        // Create edit interface
        const editContainer = document.createElement('div');
        editContainer.className = 'edit-mode';

        const editTextarea = document.createElement('textarea');
        editTextarea.className = 'edit-input';
        editTextarea.value = originalText;
        editTextarea.rows = Math.min(Math.ceil(originalText.length / 50), 10);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'edit-buttons';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'edit-confirm';
        confirmBtn.textContent = 'Send';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'edit-cancel';
        cancelBtn.textContent = 'Cancel';

        const onConfirm = () => {
            const newText = editTextarea.value.trim();
            if (newText) {
                this.deleteMessages(msgId);
                document.getElementById('message-input').value = newText;
                this.sendMessage();
            }
        };

        const onCancel = () => {
            editContainer.remove();
        };

        confirmBtn.onclick = onConfirm;
        cancelBtn.onclick = onCancel;
        editTextarea.onkeydown = (e) => {
            if (e.key === 'Enter' && e.ctrlKey) onConfirm();
            if (e.key === 'Escape') onCancel();
        };

        buttonsDiv.appendChild(confirmBtn);
        buttonsDiv.appendChild(cancelBtn);
        editContainer.appendChild(editTextarea);
        editContainer.appendChild(buttonsDiv);
        contentDiv.appendChild(editContainer);

        editTextarea.focus();
        editTextarea.select();
    }

    deleteMessages(fromMsgId) {
        const deletedCount = this.currentChatlog.filter(msg => msg.msg_id >= fromMsgId).length;
        this.behaviorMetrics.messagesDeleted += deletedCount;

        // Remove from UI
        Object.keys(this.msgWidgets).forEach(msgId => {
            const id = parseInt(msgId);
            if (id >= fromMsgId) {
                this.msgWidgets[id].element.remove();
                delete this.msgWidgets[id];
            }
        });

        // Remove from chatlog
        this.currentChatlog = this.currentChatlog.filter(msg => msg.msg_id < fromMsgId);

        // Auto-save after deletion
        this.autoSaveConversation();
    }

    updateConversationTitle(firstMessage) {
        if (!this.currentConversationId) return;

        const conversation = this.conversations.get(this.currentConversationId);
        if (conversation && conversation.title === 'New Chat') {
            conversation.title = firstMessage.length > 50
                ? firstMessage.substring(0, 50) + '...'
                : firstMessage;
            this.updateConversationList();
        }
    }

    autoSaveConversation() {
        if (!this.currentConversationId) return;

        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Set new timeout for auto-save
        this.autoSaveTimeout = setTimeout(() => {
            const conversation = this.conversations.get(this.currentConversationId);
            if (conversation) {
                conversation.messages = [...this.currentChatlog];
                conversation.lastMessageAt = new Date();
                this.updateConversationList();
                this.showAutoSaveIndicator();
            }
        }, 1000);
    }

    showAutoSaveIndicator() {
        let indicator = document.getElementById('auto-save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'auto-save-indicator';
            indicator.className = 'auto-save-indicator';
            document.body.appendChild(indicator);
        }

        indicator.innerHTML = '<span>💾</span> Auto-saved';
        indicator.classList.add('show');

        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    updateConversationList() {
        const conversationList = document.getElementById('conversation-list');

        // Get currently existing conversation elements to avoid re-animating them
        const existingItems = new Set();
        conversationList.querySelectorAll('.conversation-item').forEach(item => {
            const convId = item.dataset.conversationId;
            if (convId) existingItems.add(convId);
        });

        // Sort conversations by last message time
        const sortedConversations = Array.from(this.conversations.values())
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        // Clear and rebuild, but preserve animation state
        conversationList.innerHTML = '';

        sortedConversations.forEach((conversation, index) => {
            const conversationItem = document.createElement('div');
            conversationItem.className = 'conversation-item';
            conversationItem.dataset.conversationId = conversation.id; // Add data attribute for tracking

            // Only animate NEW conversation items, not existing ones
            const isExisting = existingItems.has(conversation.id);
            if (!isExisting) {
                // Apply animation delays only to new items
                conversationItem.style.animationDelay = `${index * 0.1}s`;
            } else {
                // For existing items, skip animation
                conversationItem.style.opacity = '1';
                conversationItem.style.transform = 'translateX(0)';
                conversationItem.style.animation = 'none';
            }

            // Set active state immediately
            if (conversation.id === this.currentConversationId) {
                conversationItem.classList.add('active');
                conversationItem.style.opacity = '1';
                conversationItem.style.transform = 'translateX(0)';
                conversationItem.style.animation = 'none';
            }

            const title = document.createElement('div');
            title.className = 'conversation-title';
            title.textContent = conversation.title;

            const preview = document.createElement('div');
            preview.className = 'conversation-preview';
            const lastMessage = conversation.messages[conversation.messages.length - 1];
            preview.textContent = lastMessage
                ? `${lastMessage.sender}: ${lastMessage.content.substring(0, 50)}${lastMessage.content.length > 50 ? '...' : ''}`
                : 'No messages yet';

            conversationItem.appendChild(title);
            conversationItem.appendChild(preview);

            conversationItem.onclick = () => this.switchToConversation(conversation.id);

            conversationList.appendChild(conversationItem);
        });
    }

    async saveToServer() {
        try {
            console.log('🔵 Starting save to server...');

            const saveData = {
                participantId: this.participantId,
                conversations: Object.fromEntries(this.conversations),
                sessionId: `chatbot_${this.participantId}_${Date.now()}`,
                completedAt: new Date().toISOString(),
                modelConfig: {
                    displayedModel: this.config.givenModel,
                    actualModel: this.config.trueModel
                }
            };

            console.log('📦 Save data prepared:', {
                participantId: saveData.participantId,
                conversationCount: Object.keys(saveData.conversations).length,
                sessionId: saveData.sessionId
            });

            const response = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });

            const result = await response.json();

            if (response.ok) {
                console.log('✅ Save successful:', result);
                return result;
            } else {
                console.error('❌ Save failed:', result);
                throw new Error(result.error || 'Save failed');
            }
        } catch (error) {
            console.error('❌ Error saving to server:', error);
            throw error;
        }
    }

    manualSave() {
        if (this.currentChatlog.length === 0) {
            alert('No messages to save!');
            return;
        }

        // Force save current conversation
        this.autoSaveConversation();

        // Save to server
        this.saveToServer().then(result => {
            // Show confirmation with participant ID
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                z-index: 1000;
                font-weight: 500;
                max-width: 300px;
            `;
            indicator.innerHTML = `
                💾 Chat saved!<br>
                <small>Participant ID: ${this.participantId}</small>
            `;
            document.body.appendChild(indicator);

            setTimeout(() => {
                indicator.remove();
            }, 4000);
        }).catch(error => {
            alert('Error saving chat. Please try again.');
        });
    }

    toggleTheme() {
        document.body.classList.toggle('light-theme');
        this.currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = this.getOrCreateBackdrop();

        if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            backdrop.classList.remove('show');
        } else {
            sidebar.classList.add('open');
            backdrop.classList.add('show');
        }
    }

    getOrCreateBackdrop() {
        let backdrop = document.querySelector('.sidebar-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'sidebar-backdrop';
            backdrop.onclick = () => this.toggleMobileSidebar();
            document.body.appendChild(backdrop);
        }
        return backdrop;
    }

    handleOutsideClick(e) {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('mobile-sidebar-toggle');

        if (window.innerWidth <= 768 &&
            sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !toggle.contains(e.target)) {
            this.toggleMobileSidebar();
        }
    }

    scrollToBottom() {
        const chatContainer = document.getElementById('chat-container');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async onClose(event) {
        // Auto-save before closing
        if (this.currentConversationId && this.currentChatlog.length > 0) {
            const conversation = this.conversations.get(this.currentConversationId);
            if (conversation) {
                conversation.messages = [...this.currentChatlog];
            }

            // Try to save with beacon API (works better for page unload)
            try {
                const saveData = {
                    participantId: this.participantId,
                    sessionId: this.sessionId,
                    conversations: Object.fromEntries(this.conversations),
                    modelConfig: {
                        displayedModel: this.config.givenModel,
                        actualModel: this.config.trueModel,
                        configurationId: this.configurationId
                    }
                };

                // Use sendBeacon for reliable unload saves
                const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
                navigator.sendBeacon('/api/save', blob);

                console.log('📤 Beacon save sent');
            } catch (error) {
                console.error('Error saving on close:', error);
                // Show warning if save might have failed
                event.preventDefault();
                event.returnValue = 'Your data may not be saved. Are you sure you want to leave?';
                return event.returnValue;
            }
        }
    }

    setupAdvancedAnimations() {
        // Add ripple effect to buttons
        document.querySelectorAll('.new-chat-btn, .save-btn, .send-btn').forEach(button => {
            button.addEventListener('click', function (e) {
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255,255,255,0.4);
                transform: scale(0);
                animation: ripple 0.6s linear;
                left: ${x}px;
                top: ${y}px;
                width: ${size}px;
                height: ${size}px;
                pointer-events: none;
            `;

                this.appendChild(ripple);

                setTimeout(() => ripple.remove(), 600);
            });
        });

        // Add CSS for ripple animation
        const style = document.createElement('style');
        style.textContent = `
        @keyframes ripple {
            to { transform: scale(2); opacity: 0; }
        }
    `;
        document.head.appendChild(style);
    }

    async loadConfiguration() {
        try {
            const response = await fetch('/api/configurations/assign');
            const data = await response.json();

            if (data.success) {
                this.sessionId = data.sessionId;
                this.participantId = data.participantId;
                this.configurationId = data.configuration.id;

                // Set up models
                this.config = {
                    givenModel: data.configuration.displayedModel,
                    trueModel: data.configuration.actualModel,
                    displayName: data.configuration.displayedModel
                };

                console.log(`🎯 Configuration assigned:`, {
                    participant: this.participantId,
                    displayed: this.config.givenModel,
                    actual: this.config.trueModel,
                    configId: this.configurationId
                });

                return true;
            } else {
                throw new Error('Failed to get configuration assignment');
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            // Fallback to default
            this.config = {
                givenModel: 'GPT-4',
                trueModel: 'gpt-4-turbo',
                displayName: 'GPT-4'
            };
            return false;
        }
    }
    checkStudyCompletion() {
        // Define completion criteria
        const criteria = {
            minMessages: 10, // Minimum messages sent by user
            minConversations: 1, // Minimum conversations
            minDuration: 5 * 60 * 1000, // 5 minutes minimum
            requiredTasks: true // You can add specific task tracking
        };

        const userMessages = this.currentChatlog.filter(msg => msg.sender === 'User').length;
        const sessionDuration = Date.now() - this.behaviorMetrics.sessionStartTime;

        const isComplete =
            userMessages >= criteria.minMessages &&
            this.conversations.size >= criteria.minConversations &&
            sessionDuration >= criteria.minDuration;

        return {
            isComplete,
            details: {
                userMessages,
                totalConversations: this.conversations.size,
                sessionDuration: Math.floor(sessionDuration / 1000), // in seconds
                criteria
            }
        };
    }

    showCompletionInterface() {
        const completion = this.checkStudyCompletion();

        if (!completion.isComplete) {
            alert(`Please complete all required tasks:\n- Send at least ${completion.details.criteria.minMessages} messages (you have ${completion.details.userMessages})\n- Spend at least 5 minutes in the study`);
            return;
        }

        // Generate completion code
        const completionCode = this.generateCompletionCode();

        const modal = document.createElement('div');
        modal.className = 'completion-modal';
        modal.innerHTML = `
        <div class="completion-content">
            <h2>🎉 Study Completed!</h2>
            <p>Thank you for participating. Your completion code is:</p>
            <div class="completion-code">${completionCode}</div>
            <p>Please download your session data and submit it with your Tally survey.</p>
            <button id="download-data" class="download-btn">📥 Download Session Data</button>
            <p class="completion-note">After downloading, you may close this window.</p>
        </div>
    `;

        document.body.appendChild(modal);

        document.getElementById('download-data').onclick = () => {
            this.downloadSessionData(completionCode);
        };
    }

    generateCompletionCode() {
        // Generate a unique completion code
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${this.participantId}-${timestamp}-${random}`.toUpperCase();
    }

    async downloadSessionData(completionCode) {
        // Prepare complete session data
        const sessionData = {
            participantId: this.participantId,
            sessionId: this.sessionId,
            completionCode: completionCode,
            completedAt: new Date().toISOString(),
            modelConfiguration: {
                displayed: this.config.displayName,
                actual: this.config.trueModel,
                configurationId: this.configurationId
            },
            conversations: Object.fromEntries(this.conversations),
            behaviorMetrics: this.behaviorMetrics,
            sessionMetrics: {
                totalMessages: this.currentChatlog.length,
                userMessages: this.currentChatlog.filter(msg => msg.sender === 'User').length,
                botMessages: this.currentChatlog.filter(msg => msg.sender === 'Bot').length,
                sessionDuration: Date.now() - this.behaviorMetrics.sessionStartTime,
                backspaceRate: this.behaviorMetrics.backspaceCount / this.behaviorMetrics.totalKeystrokes
            }
        };

        // Create blob and download
        const dataStr = JSON.stringify(sessionData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `chatbot_session_${this.participantId}_${completionCode}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Mark as completed and save to server
        await this.finalizeSession(completionCode);

        // Show success message
        setTimeout(() => {
            alert('Download complete! Please submit this file with your Tally survey.\n\nYour completion code: ' + completionCode);
        }, 500);
    }

    async finalizeSession(completionCode) {
        try {
            // Add completion code to behavior metrics
            this.behaviorMetrics.completionCode = completionCode;
            this.behaviorMetrics.completedAt = new Date().toISOString();

            // Save to server with completion flag
            const saveData = {
                participantId: this.participantId,
                sessionId: this.sessionId,
                conversations: Object.fromEntries(this.conversations),
                modelConfig: this.config,
                behaviorMetrics: this.behaviorMetrics,
                completionCode: completionCode,
                studyCompleted: true // This flag indicates actual completion
            };

            const response = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });

            if (response.ok) {
                // Clear local storage
                localStorage.removeItem(this.sessionKey);
                localStorage.removeItem('chatbot_last_session');
                console.log('✅ Session finalized successfully');
            }
        } catch (error) {
            console.error('Error finalizing session:', error);
        }
    }

    // Add a complete button to the UI
    setupCompletionButton() {
        const completeBtn = document.createElement('button');
        completeBtn.id = 'complete-study-btn';
        completeBtn.className = 'complete-btn';
        completeBtn.innerHTML = '✓ Complete Study';
        completeBtn.onclick = () => this.showCompletionInterface();

        document.querySelector('.header-actions').appendChild(completeBtn);
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});