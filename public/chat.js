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

        this.sessionTimer = {
            startTime: null,
            intervalId: null,
            isRunning: false
        };

        this.modelDescriptions = {
            'GPT-3.5': {
                year: '2022',
                generation: '3.5',
                slides: [
                    {
                        title: 'Background',
                        points: [
                            'Released November 30, 2022, as the model that powered the original ChatGPT',
                            'This is an earlier generation model that has been succeeded by GPT-4 and other newer models',
                            'Designed for general conversation and text generation tasks'
                        ]
                    },
                    {
                        title: 'Performance Compared to Other Models',
                        points: [
                            'GPT-4 shows 40% higher accuracy on factual questions and handles complex tasks better',
                            'Processes requests quickly but with less sophisticated reasoning than newer models',
                            'Can work with about 16,000 words of conversation history'
                        ]
                    },
                    {
                        title: 'Capabilities and Limitations',
                        points: [
                            'Fast responses, free access, handles basic writing and conversation well',
                            'Training data ends in September 2021, so lacks recent information',
                            'More prone to factual errors compared to GPT-4 and other current models'
                        ]
                    }
                ]
            },
            'GPT-4': {
                year: '2023',
                generation: '4.0',
                slides: [
                    {
                        title: 'Background and Capabilities',
                        points: [
                            'Released March 14, 2023, succeeding GPT-3.5 with multimodal capabilities',
                            'Can process both text and images, unlike GPT-3.5 which only handled text',
                            'Demonstrates human-level performance on various professional and academic tests'
                        ]
                    },
                    {
                        title: 'Comparative Performance',
                        points: [
                            'Shows 40% higher accuracy on factual questions and better complex reasoning versus GPT-3.5',
                            'GPT-4 responds faster but o1-preview performs better on mathematical and scientific problems',
                            'Functions in 24 languages with better non-English performance than GPT-3.5'
                        ]
                    },
                    {
                        title: 'Access and Limitations',
                        points: [
                            'Requires ChatGPT Plus subscription or API access',
                            'Still produces factual errors, though less frequently than GPT-3.5',
                            'Primary use cases: Complex analysis, image understanding, and professional-level writing tasks'
                        ]
                    }
                ]
            },
            'o1-Preview': {
                year: '2024',
                generation: 'o1',
                slides: [
                    {
                        title: 'Background and Approach',
                        points: [
                            'Released September 12, 2024, representing OpenAI\'s new reasoning-focused approach',
                            'Takes additional time to process problems before responding, unlike faster models',
                            'Designed specifically for complex reasoning tasks in math, science, and coding'
                        ]
                    },
                    {
                        title: 'Comparative Performance',
                        points: [
                            'Performs significantly better on mathematical problems (83% vs 13% success rate versus GPT-4)',
                            'Ranks in 89th percentile of coding competitions',
                            'Higher accuracy on complex problems but slower response times and usage restrictions'
                        ]
                    },
                    {
                        title: 'Access and Constraints',
                        points: [
                            'Limited to 30 messages per week for ChatGPT Plus subscribers',
                            'More expensive per use than GPT-4 for API access',
                            'Optimal use cases: Complex mathematical, scientific, and coding problems requiring deep analysis'
                        ]
                    }
                ]
            },
            'Claude 3.5 Haiku': {
                year: '2024',
                generation: '3.5',
                slides: [
                    {
                        title: 'Background and Position',
                        points: [
                            'Released November 4, 2024, as the newest version of Anthropic\'s fastest model',
                            'Newest small model in the Claude family, designed for speed and efficiency',
                            'Training data through July 2024, more recent than other Claude models'
                        ]
                    },
                    {
                        title: 'Performance Compared to Other Models',
                        points: [
                            'Matches Claude 3 Opus performance on many benchmarks despite being smaller',
                            'Faster responses but less capable on complex reasoning tasks versus Claude 3.5 Sonnet',
                            'Scores 40.6% on SWE-bench coding test, competitive with larger models'
                        ]
                    },
                    {
                        title: 'Capabilities and Limitations',
                        points: [
                            'Strengths: Fast response times, efficient performance, good for high-volume applications',
                            'Budget-friendly option in the Claude family while maintaining good performance',
                            'Best use cases: Customer service, simple coding tasks, rapid data processing'
                        ]
                    }
                ]
            },
            'Claude 3.5 Sonnet': {
                year: '2024',
                generation: '3.5',
                slides: [
                    {
                        title: 'Background and Position',
                        points: [
                            'Released June 20, 2024, as the mid-tier model in Anthropic\'s Claude 3.5 family',
                            'Currently Anthropic\'s most widely used model, balancing capability and cost',
                            'Updated version released October 22, 2024, with improved performance'
                        ]
                    },
                    {
                        title: 'Performance Compared to Other Models',
                        points: [
                            'Operates at twice the speed with competitive performance levels versus Claude 3 Opus',
                            'More capable on complex tasks but slower response times versus Claude 3.5 Haiku',
                            'Improved from 33.4% to 49.0% on SWE-bench coding benchmark'
                        ]
                    },
                    {
                        title: 'Capabilities and Limitations',
                        points: [
                            'Good balance of speed and capability, can process text and images',
                            '200,000 token context window for processing long documents',
                            'Mid-tier model offering balanced performance across different task types'
                        ]
                    }
                ]
            },
            'Claude 3 Opus': {
                year: '2024',
                generation: '3.0',
                slides: [
                    {
                        title: 'Background and Position',
                        points: [
                            'Released March 4, 2024, as the largest model in Anthropic\'s Claude 3 family',
                            'This is an earlier generation model that has been succeeded by Claude 3.5 models',
                            'Built for complex reasoning tasks but with slower response times'
                        ]
                    },
                    {
                        title: 'Performance Compared to Other Models',
                        points: [
                            'Claude 3.5 Sonnet operates at twice the speed with similar capabilities',
                            'Newer Haiku model matches Opus performance on many tasks at much lower cost',
                            'Can work with about 200,000 tokens (roughly 150,000 words) of conversation'
                        ]
                    },
                    {
                        title: 'Capabilities and Limitations',
                        points: [
                            'Handles complex reasoning tasks and can process both text and images',
                            'Slower than newer Claude models despite similar performance levels',
                            'Higher-tier model but has been superseded by more efficient options'
                        ]
                    }
                ]
            }
        };

        // Initialize the app - load configuration first, then show welcome
        this.initializeApp();
    }

    // Enhanced Welcome Experience Class Integration
    initializeWelcomeExperience() {
        this.welcomeSteps = [];
        this.currentStepIndex = 0;
        this.isTransitioning = false;

        this.buildWelcomeSteps();
        this.setupWelcomeEventListeners();
    }

    renderWelcomeStep(stepIndex) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const stage = document.getElementById('content-stage');
        const currentPanel = stage.querySelector('.content-panel.active');
        const step = this.welcomeSteps[stepIndex];

        // Update progress
        this.updateWelcomeProgress(stepIndex);

        // Create new panel
        const newPanel = document.createElement('div');
        newPanel.className = 'content-panel';
        newPanel.innerHTML = step.content;
        stage.appendChild(newPanel);

        // Animate transition
        if (currentPanel) {
            currentPanel.classList.add('exit-left');
            setTimeout(() => {
                currentPanel.remove();
            }, 600);
        }

        // Show new panel
        requestAnimationFrame(() => {
            newPanel.classList.add('active');
            this.isTransitioning = false;

            // Setup step-specific functionality
            if (step.id === 'prolific-id') {
                this.setupProlificValidation();
            } else {
                // Start timer for other steps
                this.startStepTimer();
            }
        });

        // Update navigation
        this.updateWelcomeNavigation(stepIndex);
    }

    startStepTimer() {
        const navigation = document.querySelector('.navigation-system');
        const timerOverlay = document.createElement('div');
        timerOverlay.className = 'timer-overlay';
        timerOverlay.innerHTML = `
        <div class="timer-icon"></div>
        <span>Reading...</span>
    `;

        // Hide navigation and show timer
        navigation.classList.remove('visible');
        document.querySelector('.welcome-container').appendChild(timerOverlay);

        // Show navigation after 4 seconds
        setTimeout(() => {
            timerOverlay.remove();
            navigation.classList.add('visible');
        }, 4000);
    }

    buildWelcomeSteps() {
        const displayName = this.config?.displayName || 'GPT-4';
        const modelInfo = this.modelDescriptions[displayName] || this.modelDescriptions['GPT-4'];

        this.welcomeSteps = [
            // Step 1: Welcome
            {
                id: 'welcome',
                title: 'Welcome to Our Study',
                content: `
                <div class="content-card">
                    <h1 class="content-title">Research Study</h1>
                    <p class="content-subtitle">Thank you for participating in this important research</p>
                    <div class="content-body">
                        <div class="info-grid">
                            <div class="info-item floating-element" style="animation-delay: 0.1s">
                                <h4>Study Requirements</h4>
                                <p>Complete all tasks in the provided Tally survey alongside this conversation interface.</p>
                            </div>
                            <div class="info-item floating-element" style="animation-delay: 0.2s">
                                <h4>Important Information</h4>
                                <p>The following screens contain essential details about your AI conversation partner.</p>
                            </div>
                            <div class="info-item floating-element" style="animation-delay: 0.3s">
                                <h4>Study Completion</h4>
                                <p>Click "Finish" when done to download your data and complete the study.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `
            },

            // Step 2: Model Introduction
            {
                id: 'model-intro',
                title: 'Meet Your AI Partner',
                content: `
                <div class="content-card">
                    <h1 class="content-title">Meet ${displayName}</h1>
                    <p class="content-subtitle">Your conversation partner for this study</p>
                    <div class="model-hero">
                        <div class="model-avatar floating-element">${displayName.charAt(0)}</div>
                        <div class="model-info">
                            <h3>${displayName}</h3>
                            <p>Released ${modelInfo.year} • Advanced AI Language Model</p>
                        </div>
                    </div>
                    <div class="content-body">
                        <p>Understanding your AI partner's capabilities and characteristics will help you have more effective conversations during this study.</p>
                    </div>
                </div>
            `
            },

            // Step 3: Background
            {
                id: 'background',
                title: 'Background & Development',
                content: `
                <div class="content-card">
                    <h1 class="content-title">Development Story</h1>
                    <p class="content-subtitle">The journey behind ${displayName}</p>
                    <div class="info-grid">
                        ${modelInfo.slides[0].points.map((point, index) => `
                            <div class="info-item" style="animation: fadeInUp 0.6s ease-out ${index * 0.1}s both">
                                <h4>Development Insight ${index + 1}</h4>
                                <p>${point}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `
            },

            // Step 4: Comparison
            {
                id: 'comparison',
                title: 'Performance Landscape',
                content: `
                <div class="content-card">
                    <h1 class="content-title">How ${displayName} Compares</h1>
                    <p class="content-subtitle">Understanding its position in the AI landscape</p>
                    <div class="info-grid">
                        ${modelInfo.slides[1].points.map((point, index) => `
                            <div class="info-item" style="animation: slideInRight 0.6s ease-out ${index * 0.15}s both">
                                <h4>Performance Factor ${index + 1}</h4>
                                <p>${point}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `
            },

            // Step 5: Capabilities - Updated with color coding
            {
                id: 'capabilities',
                title: 'What to Expect',
                content: `
                <div class="content-card">
                    <h1 class="content-title">Capabilities Overview</h1>
                    <p class="content-subtitle">Strengths, considerations, and optimal use cases</p>
                    <div class="feature-grid">
                        ${modelInfo.slides[2].points.map((point, index) => {
                    const types = ['strength', 'consideration', 'use-case'];
                    const titles = ['Strengths', 'Considerations', 'Best Applications'];
                    return `
                                <div class="feature-card ${types[index]}" style="animation: scaleIn 0.6s ease-out ${index * 0.2}s both">
                                    <div class="feature-indicator"></div>
                                    <h4>${titles[index]}</h4>
                                    <p>${point}</p>
                                </div>
                            `;
                }).join('')}
                    </div>
                </div>
            `
            },

            // Step 6: Prolific ID
            {
                id: 'prolific-id',
                title: 'Study Registration',
                content: `
                <div class="content-card">
                    <h1 class="content-title">Enter Your ID</h1>
                    <p class="content-subtitle">We'll use this to connect your responses with the study</p>
                    <div class="id-input-system">
                        <div class="input-group">
                            <input 
                                type="text" 
                                id="prolific-input" 
                                class="input-field"
                                placeholder="24-character Prolific ID"
                                maxlength="24"
                                autocomplete="off"
                            >
                            <div id="input-error" class="input-error"></div>
                            <div class="input-hint">Your ID should contain exactly 24 letters and numbers</div>
                        </div>
                    </div>
                </div>
            `
            }
        ];
    }

    showWelcomeExperience() {
        const experience = document.getElementById('welcome-experience');
        experience.style.display = 'block';

        // Update total steps
        document.getElementById('total-steps').textContent = this.welcomeSteps.length;

        // Force reflow and show
        requestAnimationFrame(() => {
            experience.classList.add('active');
            this.renderWelcomeStep(0);
        });
    }

    renderWelcomeStep(stepIndex) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const stage = document.getElementById('content-stage');
        const currentPanel = stage.querySelector('.content-panel.active');
        const step = this.welcomeSteps[stepIndex];

        // Update progress
        this.updateWelcomeProgress(stepIndex);

        // Create new panel
        const newPanel = document.createElement('div');
        newPanel.className = 'content-panel';
        newPanel.innerHTML = step.content;
        stage.appendChild(newPanel);

        // Animate transition
        if (currentPanel) {
            currentPanel.classList.add('exit-left');
            setTimeout(() => {
                currentPanel.remove();
            }, 600);
        }

        // Show new panel
        requestAnimationFrame(() => {
            newPanel.classList.add('active');
            this.isTransitioning = false;

            // Setup step-specific functionality
            if (step.id === 'prolific-id') {
                this.setupProlificValidation();
            }
        });

        // Update navigation
        this.updateWelcomeNavigation(stepIndex);
    }

    updateWelcomeProgress(stepIndex) {
        const progress = ((stepIndex + 1) / this.welcomeSteps.length) * 100;
        const indicator = document.getElementById('progress-indicator');
        const currentStep = document.getElementById('current-step');

        indicator.style.width = `${progress}%`;
        currentStep.textContent = stepIndex + 1;
    }

    updateWelcomeNavigation(stepIndex) {
        const backBtn = document.getElementById('nav-back');
        const continueBtn = document.getElementById('nav-continue');

        // Back button
        backBtn.disabled = stepIndex === 0;

        // Continue button
        if (stepIndex === this.welcomeSteps.length - 1) {
            continueBtn.textContent = 'Start Study';
            continueBtn.innerHTML = `
            Start Study
            <svg class="nav-icon" viewBox="0 0 24 24">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
            </svg>
        `;
        } else {
            continueBtn.textContent = 'Continue';
            continueBtn.innerHTML = `
            Continue
            <svg class="nav-icon" viewBox="0 0 24 24">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
            </svg>
        `;
        }

        // Disable continue button for prolific ID step until valid
        if (this.welcomeSteps[stepIndex].id === 'prolific-id') {
            continueBtn.disabled = true;
        } else {
            continueBtn.disabled = false;
        }
    }

    setupWelcomeEventListeners() {
        // Navigation buttons
        document.getElementById('nav-back').addEventListener('click', () => {
            if (this.currentStepIndex > 0 && !this.isTransitioning) {
                this.currentStepIndex--;
                this.renderWelcomeStep(this.currentStepIndex);
            }
        });

        document.getElementById('nav-continue').addEventListener('click', () => {
            if (this.isTransitioning) return;

            const currentStep = this.welcomeSteps[this.currentStepIndex];

            if (currentStep.id === 'prolific-id') {
                this.handleProlificSubmission();
                return;
            }

            if (this.currentStepIndex < this.welcomeSteps.length - 1) {
                this.currentStepIndex++;
                this.renderWelcomeStep(this.currentStepIndex);
            }
        });
    }

    setupProlificValidation() {
        const input = document.getElementById('prolific-input');
        const continueBtn = document.getElementById('nav-continue');
        const errorDiv = document.getElementById('input-error');

        const validateInput = () => {
            const value = input.value.trim();
            const isValid = /^[a-zA-Z0-9]{24}$/.test(value);

            // Reset states
            input.classList.remove('error', 'success');
            errorDiv.classList.remove('show');

            if (value.length === 0) {
                continueBtn.disabled = true;
                return;
            }

            if (isValid) {
                input.classList.add('success');
                continueBtn.disabled = false;
            } else {
                input.classList.add('error');
                errorDiv.textContent = 'Please enter a valid 24-character Prolific ID';
                errorDiv.classList.add('show');
                continueBtn.disabled = true;
            }
        };

        input.addEventListener('input', validateInput);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !continueBtn.disabled) {
                this.handleProlificSubmission();
            }
        });

        // Initial validation
        validateInput();
    }

    async handleProlificSubmission() {
        const input = document.getElementById('prolific-input');
        const prolificId = input.value.trim();

        if (!/^[a-zA-Z0-9]{24}$/.test(prolificId)) return;

        // Show loading state
        const continueBtn = document.getElementById('nav-continue');
        const originalContent = continueBtn.innerHTML;
        continueBtn.innerHTML = `
        <div class="loading-dots">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
        Starting...
    `;
        continueBtn.disabled = true;

        // Set participant ID and register session
        this.participantId = prolificId;

        try {
            await this.registerSession();

            // Hide welcome experience
            setTimeout(() => {
                this.hideWelcomeExperience();
            }, 800);

        } catch (error) {
            console.error('Session registration failed:', error);
            continueBtn.innerHTML = originalContent;
            continueBtn.disabled = false;
        }
    }

    hideWelcomeExperience() {
        const experience = document.getElementById('welcome-experience');
        experience.classList.remove('active');

        setTimeout(() => {
            experience.style.display = 'none';
            this.init(); // Start the main app
        }, 600);
    }

    // Update the main initialization
    async initializeApp() {
        try {
            await this.loadConfiguration();
            console.log('✅ Configuration loaded:', this.config);

            // Initialize and show welcome experience
            this.initializeWelcomeExperience();
            this.showWelcomeExperience();

        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
            this.initializeWelcomeExperience();
            this.showWelcomeExperience();
        }
    }

    async init() {
        // Setup event listeners and UI
        this.setupEventListeners();
        this.updateBotName();
        this.createNewConversation();
        this.setupTextareaAutoResize();
        this.setupAdvancedAnimations();
        this.startSessionTimer();
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

        // Make content div relatively positioned for edit button
        contentDiv.style.position = 'relative';

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

            // Add edit button for user messages
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

        modal.appendChild(img);
        modal.appendChild(closeButton);
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

        // Keyboard handler
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
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
        this.stopSessionTimer();

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
        this.stopSessionTimer();

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
        // Remove any existing listeners to prevent duplicates
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');
        const newChatBtn = document.getElementById('new-chat-btn');
        const saveChatBtn = document.getElementById('save-chat-btn');
        const finishBtn = document.getElementById('finish-btn');
        const themeSwitch = document.getElementById('theme-switch');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');

        // Clone nodes to remove all event listeners
        const newSendBtn = sendBtn.cloneNode(true);
        const newMessageInput = messageInput.cloneNode(true);
        const newNewChatBtn = newChatBtn.cloneNode(true);
        const newSaveChatBtn = saveChatBtn.cloneNode(true);
        const newFinishBtn = finishBtn.cloneNode(true);
        const newThemeSwitch = themeSwitch.cloneNode(true);
        const newSidebarToggle = sidebarToggle.cloneNode(true);
        const newMobileSidebarToggle = mobileSidebarToggle.cloneNode(true);

        // Replace the elements
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        messageInput.parentNode.replaceChild(newMessageInput, messageInput);
        newChatBtn.parentNode.replaceChild(newNewChatBtn, newChatBtn);
        saveChatBtn.parentNode.replaceChild(newSaveChatBtn, saveChatBtn);
        finishBtn.parentNode.replaceChild(newFinishBtn, finishBtn);
        themeSwitch.parentNode.replaceChild(newThemeSwitch, themeSwitch);
        sidebarToggle.parentNode.replaceChild(newSidebarToggle, sidebarToggle);
        mobileSidebarToggle.parentNode.replaceChild(newMobileSidebarToggle, mobileSidebarToggle);

        // Now add the event listeners to the new elements
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

        // Finish button
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

    startSessionTimer() {
        console.log('⏱️ Starting session timer');

        if (this.sessionTimer.isRunning) {
            console.log('⏱️ Timer already running');
            return;
        }

        this.sessionTimer.startTime = Date.now();
        this.sessionTimer.isRunning = true;

        // Update timer immediately
        this.updateTimerDisplay();

        // Update every second
        this.sessionTimer.intervalId = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);

        console.log('⏱️ Session timer started');
    }

    stopSessionTimer() {
        console.log('⏱️ Stopping session timer');

        if (this.sessionTimer.intervalId) {
            clearInterval(this.sessionTimer.intervalId);
            this.sessionTimer.intervalId = null;
        }

        this.sessionTimer.isRunning = false;
    }

    updateTimerDisplay() {
        if (!this.sessionTimer.startTime) return;

        const elapsed = Date.now() - this.sessionTimer.startTime;
        const formattedTime = this.formatElapsedTime(elapsed);

        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = formattedTime;
        }
    }

    formatElapsedTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    getElapsedTime() {
        if (!this.sessionTimer.startTime) return 0;
        return Date.now() - this.sessionTimer.startTime;
    }

}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});