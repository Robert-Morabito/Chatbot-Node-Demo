/**
 * ===================================================================
 * SHARED CHAT MODULE
 * ===================================================================
 * 
 * Core chat functionality for all task pages:
 * - Message sending and receiving
 * - Streaming response handling
 * - UI updates and rendering
 * - Behavioral metrics tracking
 */

class TaskChat {
    constructor(studyCore, taskConfig) {
        this.core = studyCore;
        this.taskConfig = taskConfig;

        // Conversation state
        this.conversations = new Map();
        this.currentConversationId = null;
        this.currentChatlog = [];
        this.msgWidgets = {};
        this.messageIdCounter = 0;

        // Image context (for image-gen task)
        this.imageContext = {
            lastPrompt: null,
            conversationHasImage: false
        };

        // Session timing
        this.sessionStartTime = Date.now();
        this.timerInterval = null;

        // Behavioral metrics
        this.behaviorMetrics = {
            backspaceCount: 0,
            messageLengths: [],
            messageCount: 0,
            conversationCount: 0,
            editCount: 0,
            editDistances: [],
            idleStartTime: Date.now(),
            totalIdleTime: 0,
            messageTimes: [],
            conversationSwitches: 0,
            lastUserActivity: Date.now(),
            typingPatterns: {
                totalKeystrokes: 0,
                typingStartTime: null,
                typingDurations: []
            },
            messageTimes: [],
            timeBetweenMessages: [],     // NEW: Track deliberation time
            firstMessageLength: null,     // NEW: Track initial planning
            conversationDepths: [],       // NEW: Messages per conversation
        };

        console.log('💬 TaskChat initialized for:', taskConfig.name);
    }

    // ===================================================================
    // INITIALIZATION
    // ===================================================================

    /**
     * Initialize the chat interface
     */
    initialize() {
        this.setupEventListeners();
        this.startSessionTimer();
        this.initializeBehaviorTracking();
        this.createNewConversation();
        this.setupTextareaAutoResize();
        this.updateUI();

        // Start auto-save
        this.core.startAutoSave(() => this.getExportData(), 60000);

        // Setup page close handler
        this.setupPageCloseHandler();

        console.log('✅ Chat interface initialized');
    }

    /**
     * Update UI elements with config data
     */
    updateUI() {
        // Update model display if element exists
        const botNameEl = document.getElementById('bot-name');
        if (botNameEl) {
            botNameEl.textContent = `Chatting with ${this.core.config.displayName}`;
        }

        // Update participant ID display
        const pidEl = document.getElementById('header-participant-id');
        if (pidEl) {
            pidEl.textContent = this.core.participantId;
        }

        // Update page title
        document.title = `${this.taskConfig.name} - ${this.core.config.displayName}`;
    }

    // ===================================================================
    // CONVERSATION MANAGEMENT
    // ===================================================================

    /**
     * Create a new conversation
     */
    createNewConversation() {
        const conversationId = `${this.core.taskName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const conversation = {
            id: conversationId,
            task: this.core.taskName,
            title: 'New Chat',
            messages: [],
            createdAt: new Date(),
            lastMessageAt: new Date(),
            imageContext: {
                lastPrompt: null,
                conversationHasImage: false
            }
        };

        this.conversations.set(conversationId, conversation);
        this.switchToConversation(conversationId);
        this.updateConversationList();
        this.showWelcomeMessage();

        this.behaviorMetrics.conversationCount++;
        this.core.markUnsavedChanges();

        console.log('📝 New conversation created:', conversationId);
    }

    /**
     * Switch to a different conversation
     * @param {string} conversationId - Conversation to switch to
     */
    switchToConversation(conversationId) {
        if (this.currentConversationId && this.currentConversationId !== conversationId) {
            this.behaviorMetrics.conversationSwitches++;
        }

        this.saveCurrentConversationState();

        this.currentConversationId = conversationId;
        const conversation = this.conversations.get(conversationId);

        if (conversation) {
            this.currentChatlog = [...conversation.messages];
            this.imageContext = conversation.imageContext || {
                lastPrompt: null,
                conversationHasImage: false
            };
            this.renderConversation();
            this.updateConversationList();
        }
    }

    /**
     * Save current conversation state to the Map
     */
    saveCurrentConversationState() {
        if (!this.currentConversationId) return;

        const currentConv = this.conversations.get(this.currentConversationId);
        if (currentConv) {
            currentConv.messages = [...this.currentChatlog];
            currentConv.imageContext = { ...this.imageContext };
            currentConv.lastMessageAt = new Date();
            // NEW: Track conversation depth (strategy indicator)
            const userMessages = currentConv.messages.filter(m => m.sender === 'User').length;
            if (userMessages > 0) {
                this.behaviorMetrics.conversationDepths.push(userMessages);
            }
        }
    }

    /**
     * Render current conversation messages
     */
    renderConversation() {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        this.msgWidgets = {};

        if (this.currentChatlog.length === 0) {
            this.showWelcomeMessage();
        } else {
            this.currentChatlog.forEach(msg => this.renderMessage(msg, false));
            this.scrollToBottom();
        }
    }

    /**
     * Show task-specific welcome message
     */
    showWelcomeMessage() {
        const messagesContainer = document.getElementById('messages');

        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-content">
                    <h2>${this.taskConfig.icon} ${this.taskConfig.name}</h2>
                    <p>${this.taskConfig.description}</p>
                    <p>Start a conversation with <strong>${this.core.config.displayName}</strong></p>
                </div>
            </div>
        `;
    }

    /**
     * Update the conversation list in sidebar
     */
    updateConversationList() {
        const conversationList = document.getElementById('conversation-list');
        if (!conversationList) return;

        if (this.conversations.size === 0) {
            conversationList.innerHTML = `
                <div class="empty-task-state">
                    <div class="empty-icon">${this.taskConfig.icon}</div>
                    <p>No conversations yet</p>
                    <p>Click "New Chat" to get started</p>
                </div>
            `;
            return;
        }

        const sortedConversations = Array.from(this.conversations.values())
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        conversationList.innerHTML = '';
        sortedConversations.forEach((conversation, index) => {
            const item = this.createConversationItem(conversation, index);
            conversationList.appendChild(item);
        });
    }

    /**
     * Create a conversation list item element
     */
    createConversationItem(conversation, index) {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.conversationId = conversation.id;
        item.style.animationDelay = `${index * 0.1}s`;

        if (conversation.id === this.currentConversationId) {
            item.classList.add('active');
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
            item.style.animation = 'none';
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

        item.appendChild(title);
        item.appendChild(preview);
        item.onclick = () => this.switchToConversation(conversation.id);

        return item;
    }

    // ===================================================================
    // MESSAGE HANDLING
    // ===================================================================

    /**
     * Send a message
     */
    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) return;

        console.log('💬 Sending message:', message.substring(0, 50) + '...');

        if (!this.currentConversationId) {
            this.createNewConversation();
        }

        // Update metrics
        this.behaviorMetrics.messageLengths.push(message.length);
        this.behaviorMetrics.messageCount++;
        this.behaviorMetrics.messageTimes.push(new Date().toISOString());

        // NEW: Track time between messages (deliberation)
        const now = Date.now();
        if (this.behaviorMetrics.lastMessageTime) {
            const timeDiff = (now - this.behaviorMetrics.lastMessageTime) / 1000; // seconds
            this.behaviorMetrics.timeBetweenMessages.push(timeDiff);
        }
        this.behaviorMetrics.lastMessageTime = now;

        // NEW: Track first message length (initial planning)
        if (this.behaviorMetrics.firstMessageLength === null) {
            this.behaviorMetrics.firstMessageLength = message.length;
        }

        // Remove welcome message if present
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        // Create and render user message
        const userMsg = this.createMessage('User', message);
        this.currentChatlog.push(userMsg);
        this.renderMessage(userMsg);

        // ✅ CALCULATE AFTER user message is added (bot's image will be next)
        const chatNumber = Array.from(this.conversations.keys()).indexOf(this.currentConversationId) + 1;
        const messageNumber = this.currentChatlog.length + 1; // Bot's response will be next

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Update conversation title
        this.updateConversationTitle(message);

        // Mark unsaved and show typing
        this.core.markUnsavedChanges();
        this.showIndicator('typing');

        // Get LLM response with correct numbers
        setTimeout(() => this.getLLMResponse(chatNumber, messageNumber), 500);
    }

    /**
     * Create a message object
     */
    createMessage(sender, content) {
        return {
            msg_id: ++this.messageIdCounter,
            sender,
            content,
            timestamp: new Date(),
            task: this.core.taskName
        };
    }

    /**
     * Get response from LLM
     */
    async getLLMResponse(chatNumber = 1, messageNumber = 1) {
        try {
            const requestData = {
                messages: this.currentChatlog,
                model: this.core.config.trueModel,
                sessionId: this.core.allocation?.id,
                conversationId: this.currentConversationId,
                participantId: this.core.participantId,
                imageContext: this.taskConfig.enableImageGeneration ? {
                    ...this.imageContext,
                    chatNumber: chatNumber,        // ✅ Added
                    messageNumber: messageNumber    // ✅ Added
                } : null
            };

            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            await this.handleStreamResponse(response);

        } catch (error) {
            console.error('❌ LLM response failed:', error.message);
            this.hideAllIndicators();
            this.core.showError(error);
        }
    }

    /**
     * Handle streaming response from LLM
     */
    async handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let botMsg = null;
        let botMsgId = null;
        let fullResponse = '';
        let isImageGeneration = false;

        // Buffer for accumulating incomplete SSE events
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete SSE events (terminated by \n\n)
            const events = buffer.split('\n\n');

            // Keep the last incomplete event in buffer
            buffer = events.pop() || '';

            // Process each complete event
            for (const event of events) {
                if (!event.trim()) continue;

                const lines = event.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.slice(6));

                        switch (data.type) {
                            case 'error':
                                throw new Error(data.error || 'Stream error');

                            case 'image_request_detected':
                                isImageGeneration = true;
                                this.showIndicator('image');
                                break;

                            case 'content':
                                if (!botMsg && !isImageGeneration) {
                                    this.hideAllIndicators();
                                    botMsg = this.createMessage('Bot', '');
                                    botMsgId = botMsg.msg_id;
                                    this.currentChatlog.push(botMsg);
                                    this.renderMessage(botMsg);
                                }

                                if (botMsg && !isImageGeneration) {
                                    fullResponse = data.fullContent;
                                    botMsg.content = fullResponse;
                                    this.updateBotMessage(botMsgId, fullResponse);
                                } else if (isImageGeneration) {
                                    this.hideAllIndicators();
                                    botMsg = this.createMessage('Bot', data.fullContent);
                                    botMsgId = botMsg.msg_id;

                                    if (data.imageFilename) {
                                        botMsg.imageFilename = data.imageFilename;
                                    }

                                    this.currentChatlog.push(botMsg);
                                    this.renderMessage(botMsg);

                                    if (data.imageUrl) {
                                        this.updateImageContext(data);
                                    }
                                }
                                break;

                            case 'done':
                                this.hideAllIndicators();
                                this.core.markUnsavedChanges();
                                return;
                        }
                    } catch (parseError) {
                        // Skip parse errors for incomplete events
                        if (line.trim() && !line.includes('server_log')) {
                            console.warn('Parse error:', parseError.message);
                        }
                    }
                }
            }
        }
    }

    /**
     * Update a bot message in the UI
     */
    updateBotMessage(msgId, content) {
        const botElement = this.msgWidgets[msgId]?.element?.querySelector('.message-content');
        if (botElement) {
            botElement.innerHTML = marked.parse(content, { breaks: true, gfm: true });
            this.setupImageClickHandlers(botElement);
            this.scrollToBottom();
        }
    }

    /**
     * Update image context after generation
     */
    updateImageContext(data) {
        // Count messages in current conversation for next image
        const currentConv = this.conversations.get(this.currentConversationId);
        const messageCount = currentConv?.messages?.length || 0;

        // Count conversations for chat numbering
        const conversationCount = this.conversations.size;

        this.imageContext = {
            lastPrompt: data.imagePrompt,
            conversationHasImage: true,
            messageCount: messageCount + 1, // Next message
            conversationCount: conversationCount
        };
    }

    /**
     * Render a message in the UI
     */
    renderMessage(msgInfo, autoScroll = true) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msgInfo.sender.toLowerCase()}`;
        messageDiv.dataset.msgId = msgInfo.msg_id;

        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = msgInfo.sender;
        iconImg.src = msgInfo.sender === 'User' ? '/images/user.png' : this.core.getModelIcon();

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.position = 'relative';

        if (msgInfo.sender === 'Bot') {
            contentDiv.innerHTML = marked.parse(msgInfo.content, { breaks: true, gfm: true });
            this.setupImageClickHandlers(contentDiv);
        } else {
            contentDiv.textContent = msgInfo.content;

            // Add edit button for user messages
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = '✎';
            editBtn.title = 'Edit message';
            editBtn.onclick = () => this.editMessage(msgInfo.msg_id);
            contentDiv.appendChild(editBtn);
        }

        messageDiv.appendChild(iconImg);
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);

        this.msgWidgets[msgInfo.msg_id] = {
            element: messageDiv,
            info: msgInfo
        };

        if (autoScroll) this.scrollToBottom();
    }

    /**
     * Edit a user message
     */
    editMessage(msgId) {
        const widget = this.msgWidgets[msgId];
        if (!widget) return;

        this.behaviorMetrics.editCount++;

        const currentMessages = Array.from(document.querySelectorAll('.message.user'));
        const editMessageIndex = currentMessages.findIndex(msg =>
            parseInt(msg.dataset.msgId) === msgId
        );
        const messagesBack = currentMessages.length - editMessageIndex - 1;
        this.behaviorMetrics.editDistances.push(messagesBack);

        const contentDiv = widget.element.querySelector('.message-content');
        const originalText = widget.info.content;

        if (contentDiv.querySelector('.edit-mode')) return;

        const editContainer = this.createEditInterface(originalText, msgId);
        contentDiv.appendChild(editContainer);
    }

    /**
     * Create edit interface for a message
     */
    createEditInterface(originalText, msgId) {
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

        const handleConfirm = () => {
            const newText = editTextarea.value.trim();
            if (newText) {
                this.deleteMessagesFrom(msgId);
                document.getElementById('message-input').value = newText;
                this.sendMessage();
            }
        };

        const handleCancel = () => editContainer.remove();

        confirmBtn.onclick = handleConfirm;
        cancelBtn.onclick = handleCancel;
        editTextarea.onkeydown = (e) => {
            if (e.key === 'Enter' && e.ctrlKey) handleConfirm();
            if (e.key === 'Escape') handleCancel();
        };

        buttonsDiv.appendChild(confirmBtn);
        buttonsDiv.appendChild(cancelBtn);
        editContainer.appendChild(editTextarea);
        editContainer.appendChild(buttonsDiv);

        editTextarea.focus();
        editTextarea.select();

        return editContainer;
    }

    /**
     * Delete messages from a given ID onwards
     */
    deleteMessagesFrom(fromMsgId) {
        Object.keys(this.msgWidgets).forEach(msgId => {
            const id = parseInt(msgId);
            if (id >= fromMsgId) {
                this.msgWidgets[id].element.remove();
                delete this.msgWidgets[id];
            }
        });

        this.currentChatlog = this.currentChatlog.filter(msg => msg.msg_id < fromMsgId);
        this.core.markUnsavedChanges();
    }

    /**
     * Update conversation title based on first message
     */
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

    // ===================================================================
    // UI INDICATORS
    // ===================================================================

    /**
     * Show typing or image generation indicator
     */
    showIndicator(type) {
        this.hideAllIndicators();
        this.disableInput();

        const messagesContainer = document.getElementById('messages');
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'typing-message';
        indicatorDiv.id = `${type}-indicator`;

        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = 'Bot';
        iconImg.src = this.core.getModelIcon();

        const contentDiv = document.createElement('div');
        contentDiv.className = 'typing-content';

        if (type === 'typing') {
            contentDiv.innerHTML = '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
        } else if (type === 'image') {
            contentDiv.innerHTML = '<div class="image-generating-text"><em>Generating image...</em></div>';
        }

        indicatorDiv.appendChild(iconImg);
        indicatorDiv.appendChild(contentDiv);
        messagesContainer.appendChild(indicatorDiv);
        this.scrollToBottom();
    }

    /**
     * Hide all indicators
     */
    hideAllIndicators() {
        ['typing-indicator', 'image-indicator'].forEach(id => {
            const indicator = document.getElementById(id);
            if (indicator) indicator.remove();
        });
        this.enableInput();
    }

    /**
     * Disable input during processing
     */
    disableInput() {
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');
        const newChatBtn = document.getElementById('new-chat-btn');

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.5';
        }
        if (messageInput) {
            messageInput.disabled = true;
            messageInput.placeholder = 'Please wait...';
        }
        if (newChatBtn) {
            newChatBtn.disabled = true;
            newChatBtn.style.opacity = '0.5';
        }

        // Disable conversation switching
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.style.pointerEvents = 'none';
            item.style.opacity = '0.5';
        });
    }

    /**
     * Re-enable input
     */
    enableInput() {
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');
        const newChatBtn = document.getElementById('new-chat-btn');

        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
        }
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = 'Type your message...';
        }
        if (newChatBtn) {
            newChatBtn.disabled = false;
            newChatBtn.style.opacity = '1';
        }

        document.querySelectorAll('.conversation-item').forEach(item => {
            item.style.pointerEvents = 'auto';
            item.style.opacity = '1';
        });
    }

    // ===================================================================
    // SESSION TIMER
    // ===================================================================

    /**
     * Start session timer
     */
    startSessionTimer() {
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
    }

    /**
     * Stop session timer
     */
    stopSessionTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        const elapsed = Date.now() - this.sessionStartTime;
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = this.core.formatTime(elapsed);
        }
    }

    // ===================================================================
    // BEHAVIOR TRACKING
    // ===================================================================

    /**
     * Initialize behavior tracking
     */
    initializeBehaviorTracking() {
        const messageInput = document.getElementById('message-input');

        // Keyboard tracking
        document.addEventListener('keydown', (e) => {
            if (document.activeElement === messageInput) {
                this.behaviorMetrics.lastUserActivity = Date.now();

                if (e.key === 'Backspace') {
                    this.behaviorMetrics.backspaceCount++;
                }

                if (!this.behaviorMetrics.typingPatterns.typingStartTime) {
                    this.behaviorMetrics.typingPatterns.typingStartTime = Date.now();
                }
                this.behaviorMetrics.typingPatterns.totalKeystrokes++;
            }
        });

        // Copy/paste handling based on task config
        ['paste', 'copy'].forEach(event => {
            messageInput.addEventListener(event, (e) => {
                if (!this.taskConfig.enableCopy) {
                    e.preventDefault();
                    this.showNotification(`${event.charAt(0).toUpperCase() + event.slice(1)} is disabled for this task`, 'warning');
                }
            });
        });

        // Disable context menu if copy is disabled
        if (!this.taskConfig.enableCopy) {
            messageInput.addEventListener('contextmenu', (e) => e.preventDefault());
        }

        // Visibility tracking
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.behaviorMetrics.idleStartTime = Date.now();
            } else {
                const idleDuration = Date.now() - this.behaviorMetrics.idleStartTime;
                if (idleDuration > 5000) {
                    this.behaviorMetrics.totalIdleTime += idleDuration;
                }
            }
        });
    }

    /**
     * Calculate final metrics for export
     */
    calculateFinalMetrics() {
        const metrics = this.behaviorMetrics;

        return {
            backspaceCount: metrics.backspaceCount,
            averageMessageLength: metrics.messageLengths.length > 0
                ? metrics.messageLengths.reduce((a, b) => a + b, 0) / metrics.messageLengths.length
                : 0,
            totalMessages: metrics.messageCount,
            messagesPerConversation: metrics.conversationCount > 0
                ? metrics.messageCount / metrics.conversationCount
                : 0,
            conversationCount: metrics.conversationCount,
            editCount: metrics.editCount,
            averageEditDistance: metrics.editDistances.length > 0
                ? metrics.editDistances.reduce((a, b) => a + b, 0) / metrics.editDistances.length
                : 0,
            totalIdleTime: metrics.totalIdleTime,
            messageTimes: metrics.messageTimes,
            conversationSwitches: metrics.conversationSwitches,
            totalKeystrokes: metrics.typingPatterns.totalKeystrokes,
            conversationSwitches: metrics.conversationSwitches,
            totalKeystrokes: metrics.typingPatterns.totalKeystrokes,

            // NEW: High-value Pygmalion metrics
            averageTimeBetweenMessages: metrics.timeBetweenMessages.length > 0
                ? metrics.timeBetweenMessages.reduce((a, b) => a + b, 0) / metrics.timeBetweenMessages.length
                : 0,
            firstMessageLength: metrics.firstMessageLength,
            averageConversationDepth: metrics.conversationDepths.length > 0
                ? metrics.conversationDepths.reduce((a, b) => a + b, 0) / metrics.conversationDepths.length
                : 0,

            sessionDuration: Date.now() - this.sessionStartTime,
            sessionDuration: Date.now() - this.sessionStartTime,
            keystrokesPerMessage: metrics.messageCount > 0
                ? metrics.typingPatterns.totalKeystrokes / metrics.messageCount
                : 0
        };
    }

    // ===================================================================
    // DATA EXPORT
    // ===================================================================

    /**
     * Get data for export/save
     */
    getExportData() {
        // Save current conversation state first
        this.saveCurrentConversationState();

        // ✅ Strip data URLs from conversations before exporting
        const cleanedConversations = this.stripDataUrlsFromConversations();

        return {
            conversations: cleanedConversations,
            behaviorMetrics: this.calculateFinalMetrics(),
            sessionDuration: Date.now() - this.sessionStartTime,
            completedAt: new Date().toISOString()
        };
    }

    /**
     * Strip data URLs from conversations and replace with filenames
     * This prevents 413 errors from huge base64 strings
     */
    stripDataUrlsFromConversations() {
        const cleaned = {};

        for (const [convId, conversation] of this.conversations.entries()) {
            // Keep imageContext but remove any data URLs from it
            const cleanedImageContext = conversation.imageContext ? {
                lastPrompt: conversation.imageContext.lastPrompt,  // ✅ Keep text prompt
                conversationHasImage: conversation.imageContext.conversationHasImage
            } : null;

            cleaned[convId] = {
                ...conversation,
                imageContext: cleanedImageContext,
                messages: conversation.messages.map(msg => {
                    // Replace data URLs with filenames in message content
                    if (msg.content && msg.content.includes('data:image')) {
                        // ✅ Use the stored filename if available, otherwise calculate it
                        const filename = msg.imageFilename || (() => {
                            const pid = this.core.participantId;
                            const convIndex = Array.from(this.conversations.keys()).indexOf(convId) + 1;
                            const msgIndex = conversation.messages.indexOf(msg) + 1;
                            return `${pid}_chat${convIndex}_msg${msgIndex}.png`;
                        })();

                        return {
                            ...msg,
                            content: msg.content.replace(/!\[Generated Image\]\(data:image[^)]+\)/g, `![Generated Image](${filename})`)
                        };
                    }
                    return msg;
                })
            };
        }

        return cleaned;
    }

    // ===================================================================
    // TASK COMPLETION
    // ===================================================================

    /**
     * Handle task completion
     */
    async completeTask() {
        console.log('🏁 Completing task:', this.core.taskName);

        // Show confirmation
        const confirmed = await this.showCompletionConfirmation();
        if (!confirmed) return;

        // Save final data
        const result = await this.core.saveTaskData(this.getExportData(), true);

        if (!result.success) {
            this.showNotification('Failed to save data. Please try again.', 'error');
            return;
        }

        // Stop timers
        this.stopSessionTimer();
        this.core.stopAutoSave();

        // Show completion message
        this.showCompletionMessage();
    }

    /**
     * Show completion confirmation dialog
     */
    showCompletionConfirmation() {
        return new Promise((resolve) => {
            const modal = document.getElementById('finish-confirmation-modal');
            if (!modal) {
                resolve(true);
                return;
            }

            modal.style.display = 'flex';

            const cancelBtn = document.getElementById('finish-cancel-btn');
            const confirmBtn = document.getElementById('finish-confirm-btn');

            const cleanup = () => {
                modal.style.display = 'none';
                cancelBtn.onclick = null;
                confirmBtn.onclick = null;
            };

            cancelBtn.onclick = () => { cleanup(); resolve(false); };
            confirmBtn.onclick = () => { cleanup(); resolve(true); };
        });
    }

    /**
     * Show task completion message
     */
    showCompletionMessage() {
        document.body.innerHTML = `
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background: #212121;
                color: #f3f4f6;
                text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            ">
                <div>
                    <h1 style="color: #10b981; margin-bottom: 20px;">✅ Task Completed!</h1>
                    <p style="font-size: 18px; margin-bottom: 15px;">
                        Your ${this.taskConfig.name} data has been saved.
                    </p>
                    <p style="color: #9ca3af;">
                        Please return to the study instructions for your next task.
                    </p>
                    <p style="color: #6b7280; margin-top: 30px; font-size: 14px;">
                        You may close this window.
                    </p>
                </div>
            </div>
        `;
    }

    // ===================================================================
    // UTILITY METHODS
    // ===================================================================

    /**
     * Scroll chat to bottom
     */
    scrollToBottom() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    /**
     * Setup textarea auto-resize
     */
    setupTextareaAutoResize() {
        const textarea = document.getElementById('message-input');
        if (textarea) {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
            });
        }
    }

    /**
     * Setup image click handlers for full-size viewing
     */
    setupImageClickHandlers(contentDiv) {
        const images = contentDiv.querySelectorAll('img');
        images.forEach(img => {
            img.addEventListener('click', () => this.showImageModal(img.src, img.alt));
            img.style.cursor = 'pointer';
            img.title = 'Click to view full size';
        });
    }

    /**
 * Show image in modal with download button
 */
    showImageModal(imageSrc, altText) {
        const existingModal = document.querySelector('.image-modal-overlay');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'image-modal-overlay';
        modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        cursor: pointer;
        padding: 2rem;
        box-sizing: border-box;
    `;

        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
        max-width: 90%;
        max-height: 80%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    `;

        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = altText || 'Generated image';
        img.style.cssText = `
        max-width: 100%;
        max-height: 100%;
        border-radius: 8px;
        cursor: default;
    `;

        // Prevent closing modal when clicking image
        img.addEventListener('click', (e) => e.stopPropagation());

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'image-download-btn';
        downloadBtn.innerHTML = '💾 Save Image';
        downloadBtn.style.cssText = `
        padding: 0.75rem 1.5rem;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    `;

        downloadBtn.addEventListener('mouseenter', () => {
            downloadBtn.style.transform = 'translateY(-2px)';
            downloadBtn.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
        });

        downloadBtn.addEventListener('mouseleave', () => {
            downloadBtn.style.transform = 'translateY(0)';
            downloadBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
        });

        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // ✅ Find the actual filename from the message that contains this image
            this.downloadImage(imageSrc);
        });

        imageContainer.appendChild(img);
        imageContainer.appendChild(downloadBtn);
        modal.appendChild(imageContainer);
        document.body.appendChild(modal);

        modal.addEventListener('click', () => modal.remove());

        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handler);
            }
        });
    }

    /**
     * Download image with proper filename from chatlog
     */
    downloadImage(imageSrc) {
        try {
            // ✅ Find the message that contains this image to get the filename
            let filename = null;

            for (const msg of this.currentChatlog) {
                if (msg.content && msg.content.includes(imageSrc.substring(0, 100))) {
                    // Extract filename from markdown: ![Generated Image](filename.png)
                    const match = msg.content.match(/!\[Generated Image\]\(([^)]+)\)/);
                    if (match) {
                        filename = match[1];
                        // If it's still a data URL in memory (before save), generate the filename
                        if (filename.startsWith('data:image')) {
                            // Calculate the filename
                            const pid = this.core.participantId;
                            const convIndex = Array.from(this.conversations.keys()).indexOf(this.currentConversationId) + 1;
                            const msgIndex = this.currentChatlog.indexOf(msg) + 1;
                            filename = `${pid}_chat${convIndex}_msg${msgIndex}.png`;
                        }
                        break;
                    }
                }
            }

            // Fallback if we can't find it
            if (!filename) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                filename = `generated-image-${timestamp}.png`;
            }

            const link = document.createElement('a');
            link.href = imageSrc;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showNotification(`Image saved as ${filename}`, 'info');
        } catch (error) {
            console.error('Download failed:', error);
            this.showNotification('Download failed. Please try right-click > Save As', 'warning');
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'warning' || type === 'error' ? '#ef4444' : '#10b981'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 2000;
            animation: slideIn 0.3s ease-out;
            font-weight: 500;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        document.body.classList.toggle('light-theme');
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed');
    }

    // ===================================================================
    // EVENT LISTENERS
    // ===================================================================

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Send message
        document.getElementById('send-btn')?.addEventListener('click', () => this.sendMessage());

        document.getElementById('message-input')?.addEventListener('keydown', (e) => {
            const input = document.getElementById('message-input');
            if (e.key === 'Enter' && !e.shiftKey && !input.disabled) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // New chat
        document.getElementById('new-chat-btn')?.addEventListener('click', () => this.createNewConversation());

        // Complete task
        document.getElementById('finish-btn')?.addEventListener('click', () => this.completeTask());

        // Theme toggle
        document.getElementById('theme-switch')?.addEventListener('change', () => this.toggleTheme());

        // Sidebar toggle
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobile-sidebar-toggle')?.addEventListener('click', () => this.toggleSidebar());

        // Save button
        document.getElementById('save-chat-btn')?.addEventListener('click', async () => {
            await this.core.saveTaskData(this.getExportData(), true);
        });
    }

    /**
     * Setup page close handler
     */
    setupPageCloseHandler() {
        window.addEventListener('beforeunload', (e) => {
            // Save via beacon on close
            this.saveCurrentConversationState();
            this.core.saveTaskDataBeacon(this.getExportData());
        });
    }
}

// Export for use in other modules
window.TaskChat = TaskChat;