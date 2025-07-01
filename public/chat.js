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

        // Initialize the app
        this.init();
    }

    async init() {
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
            const saveData = {
                participantId: this.participantId, // Add participant ID
                conversations: Object.fromEntries(this.conversations),
                sessionId: `chatbot_${this.participantId}_${Date.now()}`,
                completedAt: new Date().toISOString(),
                modelConfig: {
                    displayedModel: this.config.givenModel,
                    actualModel: this.config.trueModel
                }
            };

            const response = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('💾 Data saved successfully:', result.filename);
                return result;
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            console.error('Error saving to server:', error);
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
        if (this.currentConversationId && this.currentChatlog.length > 0) {
            const conversation = this.conversations.get(this.currentConversationId);
            if (conversation) {
                conversation.messages = [...this.currentChatlog];
            }

            try {
                // Save to cloud storage with all required info
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

                const response = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(saveData)
                });

                if (response.ok) {
                    console.log(`✅ Study completed for participant ${this.participantId}`);
                    return; // Allow normal close
                } else {
                    throw new Error('Save failed');
                }
            } catch (error) {
                console.error('Error saving on close:', error);
                const message = `Your study data may not have been saved. Please contact the research team with ID: ${this.participantId}`;
                event.returnValue = message;
                return message;
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
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});