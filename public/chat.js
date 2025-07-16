class ChatApp {
    constructor() {
        this.participantId = null; // Will be set from Prolific ID
        this.sessionId = null;

        // Initialize properties
        this.conversations = new Map();
        this.currentConversationId = null;
        this.currentChatlog = [];
        this.msgWidgets = {};
        this.currentTheme = 'dark';
        this.autoSaveTimeout = null;
        this.messageIdCounter = 0;
        this.sessionStartTime = Date.now();
        this.isFinishing = false;

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
            responseTimesAfterBot: [],
            lastBotMessageTime: null,
            lastUserActivity: Date.now(),
            typingPatterns: {
                totalKeystrokes: 0,
                typingStartTime: null,
                typingDurations: []
            }
        };

        this.imageContext = {
            lastPrompt: null,
            lastImageUrl: null,
            conversationHasImage: false
        };

        this.welcomeState = {
            currentStep: 0,
            timer: null,
            timerSeconds: 5,
            steps: []
        };

        // Track idle time
        this.idleThreshold = 5000;
        this.idleCheckInterval = null;

        // Default configuration (will be overridden)
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
                    '⚬ Generation 3.5 - Released March 2022'
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
            },
            'Claude 3.5 Haiku': {
                year: '2024',
                generation: '3.5',
                description: [
                    '⚬ Generation 3.5 - Released October 2024',
                    '⚬ Fast & Efficient - Optimized for speed and responsiveness',
                    '⚬ Lightweight Model - Quick processing with solid performance',
                    '⚬ Cost-Effective - Designed for high-volume, everyday tasks',
                    '⚬ Best For - Simple conversations, basic analysis, quick responses',
                    '⚬ Trade-offs - Less sophisticated than Sonnet or Opus variants'
                ]
            },
            'Claude 3.5 Sonnet': {
                year: '2024',
                generation: '3.5',
                description: [
                    '⚬ Generation 3.5 - Released October 2024',
                    '⚬ Balanced Performance - Optimal mix of speed and capability',
                    '⚬ Strong Reasoning - Advanced problem-solving and analysis',
                    '⚬ Versatile Applications - Excellent for diverse tasks',
                    '⚬ Best For - Complex writing, coding, research, detailed analysis',
                    '⚬ Current Flagship - Anthropic\'s most advanced widely-available model'
                ]
            },
            'Claude 3 Opus': {
                year: '2024',
                generation: '3.0',
                description: [
                    '⚬ Generation 3.0 - Released February 2024',
                    '⚬ Maximum Capability - Anthropic\'s most powerful model',
                    '⚬ Superior Reasoning - Exceptional at complex, nuanced tasks',
                    '⚬ Careful & Thoughtful - Takes time for thorough analysis',
                    '⚬ Best For - Research, complex writing, sophisticated analysis',
                    '⚬ Trade-offs - Slower responses, higher computational cost'
                ]
            }
        };

        // Initialize the app - load configuration first, then show welcome
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Load configuration first
            await this.loadConfiguration();
            console.log('✅ Configuration loaded:', this.config);

            // Now show welcome flow with correct model info
            this.showWelcomeFlow();
        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
            // Show welcome flow with default config
            this.showWelcomeFlow();
        }
    }

    showWelcomeFlow() {
        // Start with welcome, then load config and show model info, then Prolific ID last
        this.welcomeState.steps = [
            {
                type: 'welcome',
                title: 'Welcome to the Study',
                content: `
                <div class="welcome-instructions">
                    <h3>Research Study Instructions</h3>
                    <p><strong>Important:</strong> You must complete the tasks found in the provided 
                    <a href="#" class="survey-link">Tally survey</a> (update when survey link is made).</p>
                    <p>The following pages contain important information about the AI model you will be using.</p>
                    <p><strong>Please read each point carefully</strong>
                    <p><strong>When you complete all study tasks:</strong> Click the "Finish" button in the chat interface to download your conversation logs and complete the study. You will then upload these logs to the Tally survey.</p>
                </div>
            `,
                showTimer: false,
                showBack: false
            }
        ];

        // We'll add the model-specific steps after configuration is loaded
        this.buildModelSteps();

        // Show modal and setup
        const modal = document.getElementById('welcome-modal');
        modal.style.display = 'flex';

        this.setupWelcomeNavigation();
        this.updateWelcomeContent();
        this.createProgressDots();
    }

    buildModelSteps() {
        // Use the loaded configuration or default to GPT-4
        const displayName = this.config?.displayName || 'GPT-4';
        const modelInfo = this.modelDescriptions[displayName] || this.modelDescriptions['GPT-4'];

        // Add model intro step
        this.welcomeState.steps.push({
            type: 'model-intro',
            title: 'Welcome to the Study',
            content: `
        <div class="model-info-point">
            <div class="model-header-persistent">
                Today you will be using: ${displayName} (${modelInfo.year})
            </div>
            <p>Please read through the following information about this model:</p>
        </div>
    `,
            showTimer: true,
            showBack: true
        });

        // Add model description points
        modelInfo.description.forEach((point, index) => {
            this.welcomeState.steps.push({
                type: 'model-point',
                title: 'Welcome to the Study',
                content: `
            <div class="model-info-point">
                <div class="point-content">
                    <p>${point}</p>
                </div>
                <div class="point-counter">
                    Point ${index + 1} of ${modelInfo.description.length}
                </div>
            </div>
        `,
                showTimer: true,
                showBack: true
            });
        });

        // Add Prolific ID step LAST
        this.welcomeState.steps.push({
            type: 'prolific-id',
            title: 'Welcome to the Study',
            content: `
        <div class="prolific-id-section">
            <h3>Enter Your Prolific ID</h3>
            <p>Please enter your Prolific ID to begin the study:</p>
            <input type="text" 
                   id="prolific-id-input" 
                   class="prolific-id-input" 
                   placeholder="Enter your 24-character Prolific ID" 
                   maxlength="24"
                   autocomplete="off">
            <div id="prolific-id-error" class="error-message"></div>
            <p class="prolific-note">Your Prolific ID should be 24 characters long and contain only letters and numbers.</p>
        </div>
    `,
            showTimer: false,
            showBack: true
        });
    }

    handleWelcomeBack() {
        if (this.welcomeState.currentStep > 0) {
            // Clear any existing timer
            this.hideWelcomeTimer();

            this.welcomeState.currentStep--;
            this.updateWelcomeContent();
            this.updateProgressDots();
        }
    }

    setupWelcomeNavigation() {
        const continueBtn = document.getElementById('welcome-continue-btn');
        const backBtn = document.getElementById('welcome-back-btn');

        continueBtn.onclick = () => this.handleWelcomeContinue();
        backBtn.onclick = () => this.handleWelcomeBack();
    }

    handleWelcomeContinue() {
        const currentStep = this.welcomeState.steps[this.welcomeState.currentStep];

        if (currentStep.type === 'prolific-id') {
            this.handleProlificIdSubmit();
            return;
        }

        if (this.welcomeState.currentStep < this.welcomeState.steps.length - 1) {
            this.welcomeState.currentStep++;
            this.updateWelcomeContent();
            this.updateProgressDots();
        } else {
            // We're at the last step, close modal and start app
            document.getElementById('welcome-modal').style.display = 'none';
            this.init();
        }
    }

    async handleProlificIdSubmit() {
        const input = document.getElementById('prolific-id-input');
        const prolificId = input.value.trim();

        if (!/^[a-zA-Z0-9]{24}$/.test(prolificId)) {
            return;
        }

        this.participantId = prolificId;

        // Register the session with the participant ID
        await this.registerSession();

        // Close modal and start app
        document.getElementById('welcome-modal').style.display = 'none';
        this.init();
    }

    updateWelcomeContent() {
        const currentStep = this.welcomeState.steps[this.welcomeState.currentStep];
        const contentEl = document.getElementById('welcome-content');
        const titleEl = document.getElementById('welcome-title');
        const continueBtn = document.getElementById('welcome-continue-btn');
        const backBtn = document.getElementById('welcome-back-btn');

        // Update title
        titleEl.textContent = currentStep.title;

        // Slide out current content
        contentEl.classList.remove('active');
        contentEl.classList.add('slide-out-left');

        setTimeout(() => {
            // Update content
            let content = currentStep.content;
            if (currentStep.type === 'model-intro' || currentStep.type === 'model-point') {
                const modelInfo = this.modelDescriptions[this.config.displayName] || this.modelDescriptions['GPT-4'];
                content = content.replace(/\[MODEL_NAME\]/g, this.config.displayName);
                content = content.replace(/\[MODEL_YEAR\]/g, modelInfo.year);
            }
            contentEl.innerHTML = content;

            // Slide in new content
            contentEl.classList.remove('slide-out-left');
            contentEl.classList.add('slide-in-right');

            setTimeout(() => {
                contentEl.classList.remove('slide-in-right');
                contentEl.classList.add('active');
            }, 50);

            // Update navigation
            backBtn.style.display = currentStep.showBack ? 'block' : 'none';

            // Reset continue button
            continueBtn.disabled = false;
            continueBtn.textContent = 'Continue';
            continueBtn.style.display = 'block';

            // Handle timer and continue button
            if (currentStep.showTimer) {
                this.startWelcomeTimer();
            } else {
                this.hideWelcomeTimer();
                if (currentStep.type === 'prolific-id') {
                    this.setupProlificIdValidation();
                }
            }

        }, 250);
    }

    startWelcomeTimer() {
        const continueBtn = document.getElementById('welcome-continue-btn');
        const timerContainer = document.querySelector('.welcome-timer-container');

        // Hide continue button and show timer
        continueBtn.style.display = 'none';

        // Create circular progress if it doesn't exist
        let circularProgress = timerContainer.querySelector('.circular-progress');
        if (!circularProgress) {
            circularProgress = document.createElement('div');
            circularProgress.className = 'circular-progress';
            circularProgress.innerHTML = `
            <svg>
                <circle class="progress-circle-bg" cx="15" cy="15" r="12"></circle>
                <circle class="progress-circle" cx="15" cy="15" r="12"></circle>
            </svg>
        `;
            timerContainer.appendChild(circularProgress);
        }

        const progressCircle = circularProgress.querySelector('.progress-circle');

        // Reset timer
        this.welcomeState.timerSeconds = 0;
        progressCircle.style.strokeDashoffset = '75';

        // Start countdown
        this.welcomeState.timer = setInterval(() => {
            this.welcomeState.timerSeconds--;

            const progress = ((5 - this.welcomeState.timerSeconds) / 5) * 75;
            progressCircle.style.strokeDashoffset = 75 - progress;

            if (this.welcomeState.timerSeconds <= 0) {
                clearInterval(this.welcomeState.timer);
                this.hideWelcomeTimer();
                continueBtn.style.display = 'block';
            }
        }, 1000);
    }

    hideWelcomeTimer() {
        const timerDisplay = document.getElementById('welcome-timer-display');
        const timerContainer = document.querySelector('.welcome-timer-container');
        const circularProgress = timerContainer?.querySelector('.circular-progress');

        if (this.welcomeState.timer) {
            clearInterval(this.welcomeState.timer);
            this.welcomeState.timer = null;
        }

        if (timerDisplay) {
            timerDisplay.style.display = 'none';
        }

        if (circularProgress) {
            circularProgress.remove();
        }
    }

    createProgressDots() {
        const container = document.querySelector('.welcome-progress-dots');
        container.innerHTML = '';

        this.welcomeState.steps.forEach((step, index) => {
            const dot = document.createElement('div');
            dot.className = 'progress-dot';
            if (index === this.welcomeState.currentStep) {
                dot.classList.add('active');
            }
            if (index < this.welcomeState.currentStep) {
                dot.classList.add('completed');
            }

            // Add click navigation
            dot.onclick = () => {
                if (index <= this.welcomeState.currentStep || index < this.welcomeState.currentStep) {
                    this.hideWelcomeTimer();
                    this.welcomeState.currentStep = index;
                    this.updateWelcomeContent();
                    this.updateProgressDots();
                }
            };

            container.appendChild(dot);
        });
    }

    updateProgressDots() {
        const dots = document.querySelectorAll('.progress-dot');
        dots.forEach((dot, index) => {
            dot.classList.remove('active', 'completed');
            if (index === this.welcomeState.currentStep) {
                dot.classList.add('active');
            } else if (index < this.welcomeState.currentStep) {
                dot.classList.add('completed');
            }
        });
    }

    async init() {
        // Setup event listeners and UI
        this.setupEventListeners();
        this.updateBotName();
        this.createNewConversation();
        this.setupTextareaAutoResize();
        this.setupAdvancedAnimations();
        this.initializeBehaviorTracking();
        this.setupFinishButton();
    }

    setupFinishButton() {
        // The button already exists in HTML, just make sure it's visible and functional
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.style.display = 'flex'; // Ensure it's visible
        }
    }

    createNewConversation() {
        this.behaviorMetrics.conversationCount++;
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
        // Only count as switch if actually changing conversations
        if (this.currentConversationId && this.currentConversationId !== conversationId) {
            this.behaviorMetrics.conversationSwitches++;
        }
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

    /*sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) return;

        // Track typing duration
        if (this.behaviorMetrics.typingPatterns.typingStartTime) {
            const typingDuration = Date.now() - this.behaviorMetrics.typingPatterns.typingStartTime;
            this.behaviorMetrics.typingPatterns.typingDurations.push(typingDuration);
            this.behaviorMetrics.typingPatterns.typingStartTime = null;
        }

        // Track response time after bot
        if (this.behaviorMetrics.lastBotMessageTime) {
            const responseTime = Date.now() - this.behaviorMetrics.lastBotMessageTime;
            this.behaviorMetrics.responseTimesAfterBot.push(responseTime);
            this.behaviorMetrics.lastBotMessageTime = null;
        }

        // Track message metrics
        this.behaviorMetrics.messageLengths.push(message.length);
        this.behaviorMetrics.messageCount++;
        this.behaviorMetrics.messageTimes.push(new Date().toISOString());

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
    }*/

    sendMessage() {
        console.log('📤 [NEW] sendMessage() called');

        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) {
            console.log('❌ [NEW] Empty message, returning');
            return;
        }

        console.log('💬 [NEW] Sending message:', message);

        // Track basic metrics (keep this from original)
        this.behaviorMetrics.messageLengths.push(message.length);
        this.behaviorMetrics.messageCount++;
        this.behaviorMetrics.messageTimes.push(new Date().toISOString());

        // Remove welcome message if it exists
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        // Create user message
        const msgId = ++this.messageIdCounter;
        const userMsg = {
            msg_id: msgId,
            sender: 'User',
            content: message,
            timestamp: new Date()
        };

        // Add to chatlog and render
        this.currentChatlog.push(userMsg);
        this.renderMessage(userMsg);

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Update conversation title if needed
        this.updateConversationTitle(message);

        // Show typing and get response
        this.showTypingIndicator();
        setTimeout(() => this.getLLMResponse(), 500);
    }

    /*
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
    }*/
    showTypingIndicator() {
        console.log('⏳ [NEW] Showing typing indicator');

        const messagesContainer = document.getElementById('messages');

        // Remove existing typing indicator
        const existing = document.getElementById('typing-indicator');
        if (existing) existing.remove();

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-message';
        typingDiv.id = 'typing-indicator';

        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = 'Bot';

        // Use dynamic icon
        const displayedModel = this.config?.displayName || '';
        console.log(`⏳ [NEW] Setting typing icon for displayed model: "${displayedModel}"`);

        if (displayedModel.toLowerCase().includes('claude')) {
            iconImg.src = 'images/claude.png';
            console.log('⏳ [NEW] Using Claude typing icon');
        } else {
            iconImg.src = 'images/gpt.png';
            console.log('⏳ [NEW] Using GPT typing icon');
        }

        const typingContent = document.createElement('div');
        typingContent.className = 'typing-content';
        typingContent.innerHTML = '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

        typingDiv.appendChild(iconImg);
        typingDiv.appendChild(typingContent);
        messagesContainer.appendChild(typingDiv);

        this.scrollToBottom();
    }

    hideTypingIndicator() {
        console.log('⏳ [NEW] Hiding typing indicator');
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    /*
    renderMessage(msgInfo, autoScroll = true) {
        const messagesContainer = document.getElementById('messages');

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msgInfo.sender.toLowerCase()}`;
        messageDiv.dataset.msgId = msgInfo.msg_id;

        // Create icon - use dynamic icon based on model
        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = msgInfo.sender;

        if (msgInfo.sender === 'User') {
            iconImg.src = 'images/user.png';
        } else {
            // Use the icon from the current configuration
            const displayedModel = this.config?.displayName || '';
            if (displayedModel.toLowerCase().includes('claude')) {
                iconImg.src = 'images/claude.png';
            } else {
                iconImg.src = 'images/gpt.png';
            }
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
        */
    renderMessage(msgInfo, autoScroll = true) {
        console.log('🎨 [NEW] renderMessage() called for:', msgInfo.sender, msgInfo.content);

        const messagesContainer = document.getElementById('messages');

        // Create message wrapper
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msgInfo.sender.toLowerCase()}`;
        messageDiv.dataset.msgId = msgInfo.msg_id;

        // Create icon
        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = msgInfo.sender;

        if (msgInfo.sender === 'User') {
            iconImg.src = 'images/user.png';
        } else {
            // Use dynamic icon based on displayed model
            const displayedModel = this.config?.displayName || '';
            console.log(`🎨 [NEW] Setting icon for displayed model: "${displayedModel}"`);

            if (displayedModel.toLowerCase().includes('claude')) {
                iconImg.src = 'images/claude.png';
                console.log('🎨 [NEW] Using Claude icon');
            } else {
                iconImg.src = 'images/gpt.png';
                console.log('🎨 [NEW] Using GPT icon');
            }
        }

        // Create content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // For bot messages, parse markdown
        if (msgInfo.sender === 'Bot') {
            contentDiv.innerHTML = marked.parse(msgInfo.content, {
                breaks: true,
                gfm: true,
                sanitize: false
            });

            // Setup image click handlers for enlargement
            this.setupImageClickHandlers(contentDiv);
        } else {
            contentDiv.textContent = msgInfo.content;
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

        // Auto-scroll if requested
        if (autoScroll) {
            this.scrollToBottom();
        }

        console.log('✅ [NEW] Message rendered successfully');
    }

    setupImageClickHandlers(contentDiv) {
        const images = contentDiv.querySelectorAll('img');
        images.forEach(img => {
            img.addEventListener('click', () => this.showImageModal(img.src, img.alt));
            img.style.cursor = 'pointer';
            img.title = 'Click to view full size';
        });
    }

    showImageModal(imageSrc, altText) {
        // Remove existing modal if present
        const existingModal = document.querySelector('.image-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'image-modal';

        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = altText || 'Generated image';

        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '×';
        closeButton.title = 'Close (Esc)';

        // Create save button
        const saveButton = document.createElement('button');
        saveButton.className = 'save-button';
        saveButton.title = 'Save image';
        saveButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
    `;

        modal.appendChild(img);
        modal.appendChild(closeButton);
        modal.appendChild(saveButton);
        document.body.appendChild(modal);

        // Show modal with animation
        setTimeout(() => modal.classList.add('show'), 10);

        // Close handlers
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        };

        closeButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Save handler
        saveButton.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent modal from closing
            await this.downloadImage(imageSrc, altText);
        });

        // Keyboard handler
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    async downloadImage(imageUrl, filename) {
        const saveButton = document.querySelector('.image-modal .save-button');
        const originalHTML = saveButton.innerHTML;

        // Show loading
        saveButton.innerHTML = '⏳';
        saveButton.disabled = true;

        try {
            // Get the image that's already loaded in the modal
            const img = document.querySelector('.image-modal img');

            // Create canvas and draw the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            // Convert to blob and download
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `generated_image_${Date.now()}.png`;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);

                // Show success
                saveButton.innerHTML = '✅';
                setTimeout(() => {
                    saveButton.innerHTML = originalHTML;
                    saveButton.disabled = false;
                }, 1500);

            }, 'image/png');

        } catch (error) {
            console.error('Download failed:', error);
            saveButton.innerHTML = '❌';
            setTimeout(() => {
                saveButton.innerHTML = originalHTML;
                saveButton.disabled = false;
            }, 2000);
        }
    }

    async loadConfiguration() {
        try {
            console.log('🔄 Loading configuration...');

            // Get configuration assignment (no participant ID needed yet)
            const response = await fetch('/api/configurations/assign', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.sessionId = data.sessionId;
                this.configurationId = data.configuration.id;

                // Set up models
                this.config = {
                    givenModel: data.configuration.displayedModel,
                    trueModel: data.configuration.actualModel,
                    displayName: data.configuration.displayedModel
                };

                console.log('🎯 Configuration loaded:', {
                    displayed: this.config.givenModel,
                    actual: this.config.trueModel,
                    configId: this.configurationId
                });

                return true;
            } else {
                throw new Error('Failed to get configuration assignment');
            }
        } catch (error) {
            console.error('❌ Error loading configuration:', error);
            // Keep default configuration
            this.sessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.configurationId = 1;
            return false;
        }
    }

    // Add this new method to register the session with participant ID
    async registerSession() {
        try {
            const response = await fetch('/api/sessions/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    participantId: this.participantId,
                    configurationId: this.configurationId
                })
            });

            if (!response.ok) {
                console.warn('Failed to register session');
            }
        } catch (error) {
            console.warn('Session registration error:', error);
        }
    }

    async registerSession() {
        try {
            console.log('📝 Registering session with participant ID...');

            const response = await fetch('/api/sessions/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    participantId: this.participantId,
                    configurationId: this.configurationId
                })
            });

            if (response.ok) {
                console.log('✅ Session registered successfully');
            } else {
                console.warn('⚠️ Failed to register session');
            }
        } catch (error) {
            console.warn('⚠️ Session registration error:', error);
        }
    }

    /*
    async getLLMResponse() {
        try {
            // Prepare the message data
            const requestData = {
                messages: this.currentChatlog,
                model: this.config.trueModel,
                sessionId: this.sessionId,
                conversationId: this.currentConversationId,
                // Include image context
                imageContext: this.imageContext
            };

            console.log('🚀 Starting LLM request:', requestData);

            // FRONTEND CHECK - Log what we're sending
            const lastMessage = this.currentChatlog[this.currentChatlog.length - 1];
            if (lastMessage && lastMessage.sender === 'User') {
                const content = lastMessage.content.toLowerCase();
                const imageKeywords = [
                    'generate an image', 'create an image', 'draw', 'make a picture',
                    'generate a picture', 'create a picture', 'image of', 'picture of',
                    'draw me', 'show me a picture', 'visualize', 'illustrate'
                ];

                const isImageRequest = imageKeywords.some(keyword => content.includes(keyword));
                console.log('🎨 Frontend detects image request:', isImageRequest);
                console.log('📝 Message content:', content);

                // Add the logging here, after lastMessage is defined
                console.log('🚀 Sending to backend:', {
                    endpoint: '/api/chat/stream',
                    lastMessage: lastMessage?.content,
                    isImageRequest: isImageRequest
                });
            }

            // Use fetch for streaming
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            console.log('📥 Response status:', response.status);
            console.log('📥 Response ok:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ HTTP Error:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let botMsgId = ++this.messageIdCounter;
            let fullResponse = '';
            let botMessageElement = null;
            let isImageGeneration = false;

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

            this.behaviorMetrics.lastBotMessageTime = Date.now();

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
                                console.log('📦 Stream data:', data.type, data);

                                if (data.type === 'content') {
                                    // Update the message content in real-time
                                    fullResponse = data.fullContent;
                                    if (botMessageElement) {
                                        // Check for image content
                                        if (fullResponse.includes('![Generated Image]')) {
                                            console.log('🖼️ Image content detected in response');
                                            isImageGeneration = true;
                                        }

                                        if (data.imageUrl) {
                                            this.imageContext.lastPrompt = data.imagePrompt || data.revisedPrompt;
                                            this.imageContext.lastImageUrl = data.imageUrl;
                                            this.imageContext.conversationHasImage = true;
                                            console.log('🖼️ Updated image context:', this.imageContext);
                                            console.log('📤 This context will be sent with next request');
                                        }

                                        // Render markdown in real-time
                                        botMessageElement.innerHTML = marked.parse(fullResponse, {
                                            breaks: true,
                                            gfm: true,
                                            sanitize: false
                                        });

                                        // Setup image click handlers for new images
                                        this.setupImageClickHandlers(botMessageElement);
                                    }

                                    // Auto-scroll to bottom
                                    this.scrollToBottom();

                                } else if (data.type === 'image_request_detected') {
                                    console.log('🎨 Server confirmed image request - showing loading');
                                    isImageGeneration = true;

                                    // Show loading indicator
                                    if (botMessageElement) {
                                        botMessageElement.innerHTML = `
                                            <div class="image-generating">
                                                <div class="spinner"></div>
                                                <div class="text">Generating image with DALL-E 3...</div>
                                            </div>
                                        `;
                                    }

                                } else if (data.type === 'done') {
                                    console.log('✅ Stream completed:', data.finishReason);

                                    if (isImageGeneration) {
                                        console.log('🖼️ Image generation flow completed');
                                    }

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
                                    console.error('❌ Stream error:', data.error);
                                    if (botMessageElement) {
                                        botMessageElement.innerHTML = `<span style="color: #ef4444;">Error: ${data.error}</span>`;
                                    }
                                    break;

                                } else if (data.type === 'connected') {
                                    console.log('🔌 Stream connected:', data.conversationId);
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
                    botMessageElement.innerHTML = '<span style="color: #ef4444;">Error: Failed to receive response</span>';
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
        */
    async getLLMResponse() {
        console.log('🤖 [NEW] getLLMResponse() called');

        try {
            // Hide typing indicator
            this.hideTypingIndicator();

            // Prepare request data
            const requestData = {
                messages: this.currentChatlog,
                model: this.config.trueModel,
                sessionId: this.sessionId,
                conversationId: this.currentConversationId,
                imageContext: this.imageContext
            };

            console.log('📡 [NEW] Making API request to /api/chat/stream');
            console.log('📡 [NEW] Request data:', requestData);

            // Make the API call
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            console.log('📡 [NEW] Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Process the stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // Create bot message
            const botMsgId = ++this.messageIdCounter;
            const botMsg = {
                msg_id: botMsgId,
                sender: 'Bot',
                content: '',
                timestamp: new Date()
            };

            // Add to chatlog and render
            this.currentChatlog.push(botMsg);
            this.renderMessage(botMsg);

            let fullResponse = '';

            // Read the stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log('📦 [NEW] Stream data:', data.type);

                            if (data.type === 'content') {
                                // Update the message content
                                fullResponse = data.fullContent;

                                // Update the message content
                                botMsg.content = fullResponse;
                                const botElement = this.msgWidgets[botMsgId].element.querySelector('.message-content');
                                if (botElement) {
                                    botElement.innerHTML = marked.parse(fullResponse, {
                                        breaks: true,
                                        gfm: true,
                                        sanitize: false
                                    });

                                    // Setup image click handlers for new images
                                    this.setupImageClickHandlers(botElement);
                                }

                                this.scrollToBottom();

                            } else if (data.type === 'image_request_detected') {
                                console.log('🎨 [NEW] Image request detected - showing generation indicator');

                                // Replace typing indicator with image generation indicator
                                this.hideTypingIndicator();
                                this.showImageGenerationIndicator();

                            } else if (data.type === 'done') {
                                console.log('✅ [NEW] Stream completed');

                                // Hide any indicators
                                this.hideImageGenerationIndicator();
                                break;
                            }
                        } catch (parseError) {
                            console.error('❌ [NEW] JSON parse error:', parseError);
                        }
                    }
                }
            }

            console.log('✅ [NEW] Full response received:', fullResponse);

        } catch (error) {
            console.error('❌ [NEW] getLLMResponse error:', error);
            this.hideTypingIndicator();

            // Show error message
            const errorMsgId = ++this.messageIdCounter;
            const errorMsg = {
                msg_id: errorMsgId,
                sender: 'Bot',
                content: `Sorry, I encountered an error: ${error.message}`,
                timestamp: new Date()
            };

            this.currentChatlog.push(errorMsg);
            this.renderMessage(errorMsg);
        }
    }

    editMessage(msgId) {
        const widget = this.msgWidgets[msgId];
        if (!widget) return;

        // Track edit metrics
        this.behaviorMetrics.editCount++;

        // Calculate how many messages back this edit is
        const currentMessages = Array.from(document.querySelectorAll('.message.user'));
        const editMessageIndex = currentMessages.findIndex(msg =>
            parseInt(msg.dataset.msgId) === msgId
        );
        const messagesBack = currentMessages.length - editMessageIndex - 1;
        this.behaviorMetrics.editDistances.push(messagesBack);

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
            console.log('🔵 Starting save to server...');

            // Calculate final metrics
            const behaviorMetrics = this.calculateFinalMetrics();

            const saveData = {
                participantId: this.participantId,
                conversations: Object.fromEntries(this.conversations),
                sessionId: this.sessionId,
                completedAt: new Date().toISOString(),
                modelConfig: {
                    displayedModel: this.config.givenModel,
                    actualModel: this.config.trueModel,
                    configurationId: this.configurationId
                },
                behaviorMetrics: behaviorMetrics  // Add behavioral metrics here
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
        // Only auto-save if not already finishing
        if (this.isFinishing) return;

        // Auto-save before closing
        if (this.currentConversationId && this.currentChatlog.length > 0) {
            const conversation = this.conversations.get(this.currentConversationId);
            if (conversation) {
                conversation.messages = [...this.currentChatlog];
            }

            // Try to save with beacon API (works better for page unload)
            try {
                const behaviorMetrics = this.calculateFinalMetrics();
                const saveData = {
                    participantId: this.participantId,
                    sessionId: this.sessionId,
                    conversations: Object.fromEntries(this.conversations),
                    modelConfig: {
                        displayedModel: this.config.givenModel,
                        actualModel: this.config.trueModel,
                        configurationId: this.configurationId
                    },
                    behaviorMetrics: behaviorMetrics
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

    calculateFinalMetrics() {
        const metrics = {
            backspaceCount: this.behaviorMetrics.backspaceCount,
            averageMessageLength: this.behaviorMetrics.messageLengths.length > 0
                ? this.behaviorMetrics.messageLengths.reduce((a, b) => a + b, 0) / this.behaviorMetrics.messageLengths.length
                : 0,
            totalMessages: this.behaviorMetrics.messageCount,
            messagesPerConversation: this.behaviorMetrics.conversationCount > 0
                ? this.behaviorMetrics.messageCount / this.behaviorMetrics.conversationCount
                : 0,
            conversationCount: this.behaviorMetrics.conversationCount,
            editCount: this.behaviorMetrics.editCount,
            averageEditDistance: this.behaviorMetrics.editDistances.length > 0
                ? this.behaviorMetrics.editDistances.reduce((a, b) => a + b, 0) / this.behaviorMetrics.editDistances.length
                : 0,
            totalIdleTime: this.behaviorMetrics.totalIdleTime,
            messageTimes: this.behaviorMetrics.messageTimes,
            conversationSwitches: this.behaviorMetrics.conversationSwitches,
            averageResponseTimeAfterBot: this.behaviorMetrics.responseTimesAfterBot.length > 0
                ? this.behaviorMetrics.responseTimesAfterBot.reduce((a, b) => a + b, 0) / this.behaviorMetrics.responseTimesAfterBot.length
                : 0,
            totalKeystrokes: this.behaviorMetrics.typingPatterns.totalKeystrokes,
            averageTypingDuration: this.behaviorMetrics.typingPatterns.typingDurations.length > 0
                ? this.behaviorMetrics.typingPatterns.typingDurations.reduce((a, b) => a + b, 0) / this.behaviorMetrics.typingPatterns.typingDurations.length
                : 0,
            sessionDuration: Date.now() - this.sessionStartTime,
            keystrokesPerMessage: this.behaviorMetrics.messageCount > 0
                ? this.behaviorMetrics.typingPatterns.totalKeystrokes / this.behaviorMetrics.messageCount
                : 0
        };

        return metrics;
    }

    setupProlificIdValidation() {
        const input = document.getElementById('prolific-id-input');
        const continueBtn = document.getElementById('welcome-continue-btn');
        const errorDiv = document.getElementById('prolific-id-error');

        if (!input || !continueBtn || !errorDiv) return;

        const validateInput = () => {
            const value = input.value.trim();
            const isValid = /^[a-zA-Z0-9]{24}$/.test(value);

            if (value.length === 0) {
                // Empty input - neutral state
                input.classList.remove('error');
                errorDiv.classList.remove('show');
                continueBtn.disabled = true;
                continueBtn.textContent = 'Continue';
            } else if (isValid) {
                // Valid input
                input.classList.remove('error');
                errorDiv.classList.remove('show');
                continueBtn.disabled = false;
                continueBtn.textContent = 'Start Study';
            } else {
                // Invalid input
                input.classList.add('error');
                errorDiv.textContent = 'Please enter a valid 24-character Prolific ID';
                errorDiv.classList.add('show');
                continueBtn.disabled = true;
                continueBtn.textContent = 'Continue';
            }
        };

        input.addEventListener('input', validateInput);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !continueBtn.disabled) {
                this.handleProlificIdSubmit();
            }
        });

        // Initial validation
        validateInput();
    }

    async handleFinishStudy() {
        console.log('🏁 Finish button clicked');

        // Prevent multiple clicks
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn.disabled) return;
        finishBtn.disabled = true;

        // Show confirmation dialog
        const confirmed = await this.showFinishConfirmationDialog();
        if (!confirmed) {
            finishBtn.disabled = false;
            return;
        }

        try {
            // Show loading indicator
            this.showFinishLoadingIndicator();

            // First, ensure all conversations are saved locally
            if (this.currentConversationId && this.currentChatlog.length > 0) {
                const conversation = this.conversations.get(this.currentConversationId);
                if (conversation) {
                    conversation.messages = [...this.currentChatlog];
                }
            }

            // Calculate final metrics
            const behaviorMetrics = this.calculateFinalMetrics();

            // Prepare data for download
            const exportData = {
                participantId: this.participantId,
                sessionId: this.sessionId,
                completedAt: new Date().toISOString(),
                modelConfig: {
                    displayedModel: this.config.givenModel,
                    actualModel: this.config.trueModel,
                    configurationId: this.configurationId
                },
                conversations: Object.fromEntries(this.conversations),
                behaviorMetrics: behaviorMetrics,
                studyVersion: "1.0"
            };

            console.log('📦 Export data prepared:', exportData);

            // Download the data as a JSON file
            await this.downloadConversationData(exportData);

            // Save to server
            await this.saveToServer();

            // IMPORTANT: Mark session as completed on server
            await this.markSessionCompleted();

            // Close the application
            this.closeApplication();

        } catch (error) {
            console.error('Error finishing study:', error);
            alert('There was an error completing the study. Please try again or contact support.');
            this.hideFinishLoadingIndicator();
            finishBtn.disabled = false;
        }
    }

    showFinishConfirmationDialog() {
        return new Promise((resolve) => {
            const modal = document.getElementById('finish-confirmation-modal');
            modal.style.display = 'flex';

            // Store the resolve function so we can call it from button handlers
            this.finishDialogResolve = resolve;
        });
    }

    hideFinishConfirmationDialog(confirmed) {
        const modal = document.getElementById('finish-confirmation-modal');
        modal.style.display = 'none';

        if (this.finishDialogResolve) {
            this.finishDialogResolve(confirmed);
            this.finishDialogResolve = null;
        }
    }

    showFinishLoadingIndicator() {
        const indicator = document.getElementById('finish-loading-indicator');
        indicator.style.display = 'block';
    }

    hideFinishLoadingIndicator() {
        const indicator = document.getElementById('finish-loading-indicator');
        indicator.style.display = 'none';
    }

    async downloadConversationData(data) {
        try {
            // Create a simple text file with the data
            const jsonContent = JSON.stringify(data, null, 2);
            const filename = `study-data-${this.participantId}-${Date.now()}.json`;

            console.log('💾 Creating download:', filename);

            // Create a blob and download link
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            console.log('✅ Study data downloaded:', filename);

        } catch (error) {
            console.error('Error creating download:', error);
            throw error;
        }
    }

    async markSessionCompleted() {
        try {
            console.log('🏁 Marking session as completed...', {
                sessionId: this.sessionId,
                participantId: this.participantId,
                configurationId: this.configurationId
            });

            const response = await fetch('/api/sessions/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    participantId: this.participantId
                })
            });

            const responseText = await response.text();
            console.log('📡 Session completion response:', response.status, responseText);

            if (!response.ok) {
                console.error('❌ Failed to mark session as completed:', response.status, responseText);
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

            const result = JSON.parse(responseText);
            console.log('✅ Session marked as completed:', result);

            return result;
        } catch (error) {
            console.error('❌ Error marking session complete:', error);
            throw error; // Re-throw so handleFinishStudy can catch it
        }
    }

    closeApplication() {
        // Set flag to prevent duplicate saves
        this.isFinishing = true;

        // Hide finish button to prevent double-clicking
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) finishBtn.style.display = 'none';

        // Hide loading indicator
        this.hideFinishLoadingIndicator();

        // Show completion message
        document.body.innerHTML = `
        <div style="
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: var(--main-bg-dark);
            color: var(--text-dark);
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        ">
            <div>
                <h1 style="color: #10b981; margin-bottom: 20px;">✅ Study Completed!</h1>
                <p style="font-size: 18px; margin-bottom: 15px;">
                    Thank you for participating. Your data has been downloaded.
                </p>
                <p style="color: #9ca3af;">
                    Please upload the downloaded file to the Tally survey to complete your submission.
                </p>
                <p style="color: #9ca3af; margin-top: 30px; font-size: 14px;">
                    This window will remain open. You may close it when you're ready.
                </p>
            </div>
        </div>
        `;

        console.log('Study completed. Window will remain open.');
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

    initializeBehaviorTracking() {
        // Track backspaces and keystrokes
        document.addEventListener('keydown', (e) => {
            if (document.activeElement.id === 'message-input') {
                this.updateActivity();

                if (e.key === 'Backspace') {
                    this.behaviorMetrics.backspaceCount++;
                }

                // Track typing patterns
                if (!this.behaviorMetrics.typingPatterns.typingStartTime) {
                    this.behaviorMetrics.typingPatterns.typingStartTime = Date.now();
                }
                this.behaviorMetrics.typingPatterns.totalKeystrokes++;
            }
        });

        // Disable copy/paste
        document.addEventListener('paste', (e) => {
            if (document.activeElement.id === 'message-input') {
                e.preventDefault();
                this.showNotification('Paste is disabled for this study', 'warning');
                return false;
            }
        });

        document.addEventListener('copy', (e) => {
            if (document.activeElement.id === 'message-input' &&
                window.getSelection().toString().length > 0) {
                e.preventDefault();
                this.showNotification('Copy is disabled for this study', 'warning');
                return false;
            }
        });

        // Also disable context menu on input
        document.getElementById('message-input').addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Track idle time
        this.startIdleTracking();

        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.behaviorMetrics.idleStartTime = Date.now();
            } else {
                this.updateIdleTime();
            }
        });
    }

    updateActivity() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.behaviorMetrics.lastUserActivity;

        if (timeSinceLastActivity > this.idleThreshold) {
            this.behaviorMetrics.totalIdleTime += timeSinceLastActivity;
        }

        this.behaviorMetrics.lastUserActivity = now;
    }

    updateIdleTime() {
        const idleDuration = Date.now() - this.behaviorMetrics.idleStartTime;
        if (idleDuration > this.idleThreshold) {
            this.behaviorMetrics.totalIdleTime += idleDuration;
        }
        this.behaviorMetrics.idleStartTime = Date.now();
    }

    startIdleTracking() {
        // Check for idle every second
        this.idleCheckInterval = setInterval(() => {
            const timeSinceLastActivity = Date.now() - this.behaviorMetrics.lastUserActivity;
            if (timeSinceLastActivity > this.idleThreshold) {
                // User is idle
                if (!this.behaviorMetrics.currentlyIdle) {
                    this.behaviorMetrics.currentlyIdle = true;
                    this.behaviorMetrics.idleStartTime = this.behaviorMetrics.lastUserActivity;
                }
            } else {
                // User is active
                if (this.behaviorMetrics.currentlyIdle) {
                    this.behaviorMetrics.currentlyIdle = false;
                    this.updateIdleTime();
                }
            }
        }, 1000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'warning' ? '#ef4444' : '#10b981'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 2000;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    setupTextareaAutoResize() {
        const textarea = document.getElementById('message-input');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        });
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

        // Finish button - now references existing HTML element
        document.getElementById('finish-btn').addEventListener('click', () => this.handleFinishStudy());

        // Finish modal buttons
        document.getElementById('finish-cancel-btn').addEventListener('click', () => this.hideFinishConfirmationDialog(false));
        document.getElementById('finish-confirm-btn').addEventListener('click', () => this.hideFinishConfirmationDialog(true));

        // Sidebar toggles
        document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobile-sidebar-toggle').addEventListener('click', () => this.toggleMobileSidebar());

        // Window close event
        window.addEventListener('beforeunload', (e) => this.onClose(e));

        // Click outside sidebar on mobile
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    async loadConfiguration() {
        try {
            // Pass Prolific ID to get or resume configuration
            const response = await fetch('/api/configurations/assign', {
                method: 'GET', // Change to GET since the route expects GET
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.sessionId = data.sessionId;
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

            // Generate a fallback session ID
            this.sessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.configurationId = 1;

            return false;
        }
    }

    showImageGenerationIndicator() {
        console.log('🎨 [NEW] Showing image generation indicator');

        const messagesContainer = document.getElementById('messages');

        // Remove existing indicators
        const existingTyping = document.getElementById('typing-indicator');
        const existingImageGen = document.getElementById('image-generation-indicator');
        if (existingTyping) existingTyping.remove();
        if (existingImageGen) existingImageGen.remove();

        const imageGenDiv = document.createElement('div');
        imageGenDiv.className = 'typing-message';
        imageGenDiv.id = 'image-generation-indicator';

        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = 'Bot';

        // Use dynamic icon
        const displayedModel = this.config?.displayName || '';
        if (displayedModel.toLowerCase().includes('claude')) {
            iconImg.src = 'images/claude.png';
        } else {
            iconImg.src = 'images/gpt.png';
        }

        const generatingContent = document.createElement('div');
        generatingContent.className = 'typing-content';
        generatingContent.innerHTML = '<div class="image-generating-text"><em>Generating image...</em></div>';

        imageGenDiv.appendChild(iconImg);
        imageGenDiv.appendChild(generatingContent);
        messagesContainer.appendChild(imageGenDiv);

        this.scrollToBottom();
    }

    hideImageGenerationIndicator() {
        console.log('🎨 [NEW] Hiding image generation indicator');
        const imageGenIndicator = document.getElementById('image-generation-indicator');
        if (imageGenIndicator) {
            imageGenIndicator.remove();
        }
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});