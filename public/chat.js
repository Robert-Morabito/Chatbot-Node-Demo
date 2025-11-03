/**
 * ===================================================================
 * CHATBOT INTERFACE - MAIN APPLICATION
 * ===================================================================
 * 
 * Comprehensive chatbot interface for research studies featuring:
 * - Multi-task conversation management with session tracking
 * - Sophisticated welcome experience with model comparison
 * - Real-time behavioral metrics collection
 * - Data persistence and session management
 * - Responsive design with error handling
 * 
 * Architecture:
 * - Core App Management
 * - Configuration & Session Management  
 * - Welcome Experience Controller
 * - Task & Conversation Management
 * - Message & Chat Handling
 * - UI & Behavior Tracking
 * - Data Persistence & Error Handling
 */

class ChatApp {
    // ===================================================================
    // CORE APPLICATION SETUP
    // ===================================================================

    constructor() {
        // Core identifiers
        this.participantId = null;
        this.sessionId = null;
        this.configurationId = null;

        // Task management
        this.taskSequence = ['image-generation', 'social-media', 'acronym-building'];
        this.currentTaskIndex = 0;
        this.completedTasks = [];
        this.taskConversations = {
            'image-generation': new Map(),
            'social-media': new Map(),
            'acronym-building': new Map()
        };

        // Conversation state
        this.currentConversationId = null;
        this.currentChatlog = [];
        this.msgWidgets = {};
        this.messageIdCounter = 0;

        // UI state
        this.currentTheme = 'dark';
        this.isFinishing = false;

        // Possible errors
        this.errorTypes = {
            NETWORK_TIMEOUT: 'network_timeout',
            NETWORK_OFFLINE: 'network_offline',
            INVALID_USER_ID: 'invalid_user_id',
            STUDY_FULL: 'study_full',
            SERVER_ERROR: 'server_error',
            API_KEY_ERROR: 'api_key_error',
            RATE_LIMIT: 'rate_limit',
            PARSE_ERROR: 'parse_error',
            SAVE_ERROR: 'save_error',
            UNKNOWN: 'unknown'
        };

        // Welcome experience state
        this.welcomeState = {
            currentStep: 0,
            maxSteps: 3,
            isAnimating: false,
            isTransitioning: false,
            transitionTimeout: null,
            countdownInterval: null
        };

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
            },
            taskMetrics: {
                'image-generation': { conversations: 0, messages: 0, timeSpent: 0 },
                'social-media': { conversations: 0, messages: 0, timeSpent: 0 },
                'acronym-building': { conversations: 0, messages: 0, timeSpent: 0 }
            }
        };

        // Task configurations
        this.taskConfig = {
            'image-generation': {
                name: 'Image Generation',
                icon: '🎨',
                description: 'Use this chat to generate images! Try typing "Make me an image of..."'
            },
            'social-media': {
                name: 'Social Media Posts',
                icon: '📱',
                description: 'Use this chat to write a convincing outreach message!'
            },
            'acronym-building': {
                name: 'Acronym Building',
                icon: '🔤',
                description: 'Use this chat to create some funny acronyms!'
            }
        };

        this.setupManualCompletionMethods();

        // Initialize application
        this.initializeApp();
    }

    // ===================================================================
    // CONFIGURATION & SESSION MANAGEMENT
    // ===================================================================

    async initializeApp() {
        this.showWelcomeExperience();

        try {
            // Note: loadConfiguration now happens during welcome screen
            this.setupReleaseHandler();
        } catch (error) {
            console.error('App initialization failed:', error.message);
            this.setupReleaseHandler();
        }
    }

    async loadConfiguration(userId) {
        try {
            console.log('🎯 Loading configuration for user:', userId);

            const response = await fetch('/api/allocation/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                // Create enhanced error object
                const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.details = errorData;

                // Log detailed error info for debugging
                console.error('❌ Configuration loading failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData: errorData,
                    userId: userId,
                    url: '/api/allocation/claim',
                    timestamp: new Date().toISOString()
                });

                // Handle specific error cases with better messages
                if (response.status === 409) {
                    throw new Error('STUDY_FULL: No more participants needed for this study.');
                }

                throw error;
            }

            const allocation = await response.json();

            console.log('✅ Configuration loaded successfully:', allocation);

            // Map to existing variable names (no other code changes needed!)
            this.sessionId = allocation.id;
            this.configurationId = allocation.id;
            this.participantId = userId;

            this.config = {
                givenModel: allocation.shown_model,
                trueModel: allocation.source_model,
                displayName: allocation.shown_model
            };

            console.log('✅ Configuration mapped to existing variables:', {
                sessionId: this.sessionId,
                configId: this.configurationId,
                displayedModel: this.config.givenModel,
                actualModel: this.config.trueModel
            });

            return true;

        } catch (error) {
            const errorType = this.classifyError(error, 'configuration');
            console.error('❌ Configuration error classified as:', errorType);
            throw error;
        }
    }

    setupReleaseHandler() {
        window.addEventListener('beforeunload', (e) => this.handlePageClose(e));
    }

    // ===================================================================
    // WELCOME EXPERIENCE CONTROLLER
    // ===================================================================

    showWelcomeExperience() {
        const experience = document.getElementById('welcome-experience');
        experience.style.display = 'block';
        requestAnimationFrame(() => {
            experience.classList.add('active');
            this.renderWelcomeStep(0);
        });
    }

    renderWelcomeStep(stepIndex) {
        this.clearWelcomeTransitions();
        this.welcomeState.currentStep = stepIndex;
        this.updateWelcomeProgress();

        // Show appropriate panel
        const panels = document.querySelectorAll('.content-panel');
        panels.forEach((panel, index) => {
            panel.classList.toggle('active', index === stepIndex);

            // Handle special step logic
            if (index === stepIndex) {
                if (stepIndex === 1) this.startModelComparison();
            }
        });

        this.updateWelcomeNavigation();
    }

    startModelComparison() {
        this.welcomeState.isAnimating = true;
        const comparisonData = this.getModelComparisonData();

        this.populateModelComparison(comparisonData);
        this.runComparisonAnimation(comparisonData);
    }

    getModelComparisonData() {
        const modelFamilies = {
            'openai': [
                {
                    name: 'GPT-3.5',
                    year: '2022',
                    capabilities: { reasoning: 1, speed: 2, creativity: 2, knowledge: 'Sept 2021' },
                    strengths: "Quick responses and good general knowledge for everyday tasks.",
                    weaknesses: "Limited creativity and may struggle with complex reasoning tasks.",
                    bestFor: "Quick questions, basic writing, and simple problem-solving tasks."
                },
                {
                    name: 'GPT-4',
                    year: '2023',
                    capabilities: { reasoning: 2, speed: 3, creativity: 3, knowledge: 'Dec 2023' },
                    strengths: "Good balance of creativity, accuracy, and professional communication.",
                    weaknesses: "Slower response times compared to simpler models.",
                    bestFor: "Professional writing, basic creative projects, and moderate reasoning tasks."
                },
                {
                    name: 'GPT-5',
                    year: '2025',
                    capabilities: { reasoning: 4, speed: 3, creativity: 4, knowledge: 'Sept 2024' },
                    strengths: "State of the art, exceptional reasoning abilities and highly creative problem-solving.",
                    weaknesses: "May take more time to process requests to ensure the best accuracy.",
                    bestFor: "Complex creative challenges, advanced reasoning, and innovative solutions."
                }
            ],
            'claude': [
                {
                    name: 'Claude 3',
                    year: '2024',
                    capabilities: { reasoning: 1, speed: 3, creativity: 2, knowledge: 'Aug 2023' },
                    strengths: "Fast responses with decent accuracy for routine tasks.",
                    weaknesses: "Limited depth in creative and complex analytical tasks.",
                    bestFor: "Quick tasks, basic writing assistance, and straightforward questions."
                },
                {
                    name: 'Claude 3.5',
                    year: '2024',
                    capabilities: { reasoning: 2, speed: 3, creativity: 3, knowledge: 'July 2024' },
                    strengths: "Good professional communication and analytical capabilities.",
                    weaknesses: "Slower response times compared to simpler models.",
                    bestFor: "Professional writing, basic creative projects, and moderate reasoning tasks."
                },
                {
                    name: 'Claude 4',
                    year: '2025',
                    capabilities: { reasoning: 4, speed: 2, creativity: 4, knowledge: 'Mar 2025' },
                    strengths: "Cutting-edge reasoning with exceptional creativity.",
                    weaknesses: "May process requests slower for best accuracy.",
                    bestFor: "Advanced creative projects, complex reasoning, and detailed writing."
                }
            ]
        };

        const assignedModel = this.config?.trueModel;
        const family = assignedModel.includes('claude') ? 'claude' : 'openai';

        return {
            family,
            models: modelFamilies[family],
            assignedIndex: this.getAssignedModelIndex(modelFamilies[family])
        };
    }

    getAssignedModelIndex(models) {
        const assignedName = this.config?.displayName;
        const foundIndex = models.findIndex(m => m.name === assignedName);

        return foundIndex;
    }

    populateModelComparison(comparisonData) {
        const { models, assignedIndex } = comparisonData;

        // Populate model cards
        models.forEach((model, index) => {
            this.populateModelCard(model, index);
            this.populateCapabilityIcons(model, index);
        });

        // Update capability details for assigned model
        const assignedModel = models[assignedIndex];
        this.updateCapabilityDetails(assignedModel);
        this.initializeModelComparisonHeader(comparisonData);
    }

    populateModelCard(model, index) {
        const nameEl = document.getElementById(`model-name-card-${index}`);
        const yearEl = document.getElementById(`model-year-card-${index}`);

        if (nameEl) nameEl.textContent = model.name;
        if (yearEl) yearEl.textContent = model.year;
    }

    populateCapabilityIcons(model, cardIndex) {
        const card = document.querySelector(`.model-card[data-model="${cardIndex}"]`);
        if (!card) return;

        const capabilityTypes = ['reasoning', 'speed', 'creativity'];
        const iconTypes = ['bulb', 'bolt', 'brush'];

        capabilityTypes.forEach((capability, typeIndex) => {
            const container = card.querySelector(`[data-capability="${capability}"] .capability-icons-inline`);
            if (!container) return;

            container.innerHTML = '';
            const iconType = iconTypes[typeIndex];
            const iconEmoji = { bulb: '💡', bolt: '⚡', brush: '🎨' }[iconType];

            for (let i = 0; i < 4; i++) {
                const icon = document.createElement('span');
                icon.className = `capability-icon-item-inline ${iconType}`;
                if (i < model.capabilities[capability]) icon.classList.add('lit');
                icon.textContent = iconEmoji;
                icon.style.animationDelay = `${i * 100}ms`;
                container.appendChild(icon);
            }
        });

        // Update knowledge date
        const knowledgeEl = card.querySelector('.knowledge-date-inline');
        if (knowledgeEl) knowledgeEl.textContent = model.capabilities.knowledge;
    }

    updateCapabilityDetails(model) {
        const elements = {
            'strength-text': model.strengths || "Excellent capabilities for various tasks.",
            'weakness-text': model.weaknesses || "May have slower response times for complex requests.",
            'usecase-text': model.bestFor || "General purpose conversations and task completion.",
            'capability-model-name': model.name
        };

        Object.entries(elements).forEach(([id, text]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        });
    }

    runComparisonAnimation(comparisonData) {
        const { assignedIndex } = comparisonData;
        const timeline = [
            () => this.animateModelCards(),
            () => this.animateCardCapabilities(),
            () => this.highlightAssignedModel(assignedIndex),
            () => this.showAssignmentPopup(assignedIndex)
        ];

        const delays = [0, 1000, 4500, 5000];
        timeline.forEach((action, i) => setTimeout(action, delays[i]));
    }

    animateModelCards() {
        const container = document.getElementById('model-comparison-container');
        if (container) container.style.animation = 'fadeInUp 2s ease-out forwards';
    }

    animateCardCapabilities() {
        document.querySelectorAll('.model-card').forEach((card, cardIndex) => {
            const baseDelay = cardIndex * 200;

            card.querySelectorAll('.capability-item').forEach((item, itemIndex) => {
                setTimeout(() => {
                    item.classList.add('show');

                    const litIcons = item.querySelectorAll('.capability-icon-item-inline.lit');
                    litIcons.forEach((icon, iconIndex) => {
                        setTimeout(() => icon.classList.add('animate-in'), iconIndex * 150);
                    });
                }, baseDelay + (itemIndex * 300));
            });
        });
    }

    highlightAssignedModel(assignedIndex) {
        const modelCard = document.querySelector(`.model-card[data-model="${assignedIndex}"]`);
        if (modelCard) modelCard.classList.add('highlighted');
    }

    showAssignmentPopup(assignedIndex) {
        const popup = document.getElementById('assignment-popup');
        const assignedCard = document.querySelector(`.model-card[data-model="${assignedIndex}"]`);

        if (popup && assignedCard) {
            const rect = assignedCard.getBoundingClientRect();
            const containerRect = document.querySelector('.comparison-container').getBoundingClientRect();
            popup.style.left = `${rect.left - containerRect.left + (rect.width / 2)}px`;
            popup.classList.add('show', 'persistent');
        }

        this.welcomeState.isAnimating = false;
        this.updateWelcomeNavigation();
    }

    showCapabilityCardsSequence() {
        if (this.welcomeState.isTransitioning) return;

        this.welcomeState.isTransitioning = true;
        this.clearWelcomeTransitions();

        const elements = {
            container: document.querySelector('.comparison-container'),
            modelContainer: document.getElementById('model-comparison-container'),
            cardsWrapper: document.getElementById('capability-cards-wrapper')
        };

        // Shrink models and show cards
        elements.container.classList.add('showing-cards');
        elements.modelContainer.classList.add('compact');

        setTimeout(() => {
            if (elements.cardsWrapper) {
                this.positionCapabilityCards(elements.cardsWrapper);
                elements.cardsWrapper.classList.add('show');
            }
            this.startReadingCountdown();
        }, 500);
    }

    positionCapabilityCards(cardsWrapper) {
        const comparisonData = this.getModelComparisonData();
        const modelCards = document.querySelectorAll('.model-card');
        const modelContainer = document.getElementById('model-comparison-container');

        if (!modelCards[comparisonData.assignedIndex] || !modelContainer) return;

        const assignedCard = modelCards[comparisonData.assignedIndex];
        const containerRect = modelContainer.getBoundingClientRect();
        const cardRect = assignedCard.getBoundingClientRect();

        const cardCenterX = cardRect.left - containerRect.left + (cardRect.width / 2);
        const containerCenterX = containerRect.width / 2;
        const offsetX = cardCenterX - containerCenterX;

        cardsWrapper.style.transform = `translateX(${offsetX}px)`;
    }

    startReadingCountdown() {
        const continueBtn = document.getElementById('nav-continue');
        let timeLeft = 10; // 10 second delay

        const updateButton = () => {
            if (timeLeft > 0) {
                continueBtn.innerHTML = `Please read... (${timeLeft}s)`;
                continueBtn.disabled = true;
                continueBtn.style.opacity = '0.6';
            } else {
                continueBtn.innerHTML = `
                Start Study
                <svg class="nav-icon" viewBox="0 0 24 24">
                    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                </svg>
            `;
                continueBtn.onclick = () => this.renderWelcomeStep(2);
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';

                this.clearWelcomeTransitions();
            }
        };

        updateButton();
        this.welcomeState.countdownInterval = setInterval(() => {
            timeLeft--;
            updateButton();
            if (timeLeft <= 0) {
                clearInterval(this.welcomeState.countdownInterval);
                this.welcomeState.countdownInterval = null;
            }
        }, 1000);
    }

    setupProlificValidation() {
        const input = document.getElementById('prolific-input');
        const continueBtn = document.getElementById('nav-continue');
        const errorDiv = document.getElementById('input-error');

        if (!input) {
            console.error('❌ Input field not found');
            return;
        }

        console.log('✅ Setting up validation, input found:', input);

        // Test if input is clickable
        input.onclick = () => console.log('✅ Input clicked!');
        input.onfocus = () => console.log('✅ Input focused!');

        const validateInput = () => {
            const value = input.value.trim();
            const isValid = /^[a-zA-Z0-9]{24}$/.test(value);

            if (continueBtn) {
                continueBtn.disabled = !isValid;
            }

            if (errorDiv) {
                if (value.length > 0 && !isValid) {
                    errorDiv.textContent = 'Please enter a valid 24-character Prolific ID';
                    errorDiv.classList.add('show');
                } else {
                    errorDiv.classList.remove('show');
                }
            }
        };

        // Simple event binding
        input.addEventListener('input', validateInput);
        validateInput();

        // Force focus
        setTimeout(() => {
            input.focus();
            console.log('✅ Input should be focused now');
        }, 100);
    }

    async handleProlificSubmission() {
        const input = document.getElementById('prolific-input');
        const prolificId = input.value.trim();

        if (!/^[a-zA-Z0-9]{24}$/.test(prolificId)) return;

        const continueBtn = document.getElementById('nav-continue');
        const originalContent = continueBtn.innerHTML;
        continueBtn.innerHTML = 'Loading configuration...';
        continueBtn.disabled = true;

        try {
            // Load configuration (which now claims allocation)
            await this.loadConfiguration(prolificId);

            // Move to model comparison screen  
            this.renderWelcomeStep(1);

        } catch (error) {
            console.error('Configuration loading failed:', error);
            this.showConfigurationError(error);
            continueBtn.innerHTML = originalContent;
            continueBtn.disabled = false;
        }
    }

    updateWelcomeProgress() {
        const progress = ((this.welcomeState.currentStep + 1) / this.welcomeState.maxSteps) * 100;
        const indicator = document.getElementById('progress-indicator');
        const currentStep = document.getElementById('current-step');

        if (indicator) indicator.style.width = `${progress}%`;
        if (currentStep) currentStep.textContent = this.welcomeState.currentStep + 1;
    }

    updateWelcomeNavigation() {
        const continueBtn = document.getElementById('nav-continue');
        const backBtn = document.getElementById('nav-back');

        // Handle back button
        backBtn.style.display = this.welcomeState.currentStep > 0 ? 'flex' : 'none';
        if (this.welcomeState.currentStep > 0) {
            backBtn.onclick = () => this.renderWelcomeStep(this.welcomeState.currentStep - 1);
        }

        // Clear any existing styles
        continueBtn.style.opacity = '1';
        continueBtn.disabled = false;

        // Step 0: Prolific ID entry
        if (this.welcomeState.currentStep === 0) {
            continueBtn.innerHTML = 'Continue <svg class="nav-icon" viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
            continueBtn.disabled = true; // DISABLED BY DEFAULT
            continueBtn.onclick = () => this.handleProlificSubmission();

            // Set up real-time validation
            setTimeout(() => this.setupProlificValidation(), 100);
        }
        // Step 1: Model comparison
        else if (this.welcomeState.currentStep === 1) {
            // Check if animation is still running
            if (this.welcomeState.isAnimating) {
                continueBtn.innerHTML = 'Loading...';
                continueBtn.style.opacity = '0.6';
                continueBtn.disabled = true;
                return;
            }

            // Show "See Details" button
            continueBtn.innerHTML = 'See Details <svg class="nav-icon" viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
            continueBtn.disabled = false;
            continueBtn.onclick = () => this.showCapabilityCardsSequence();
        }
        // Step 2: Survey redirect + password entry
        else if (this.welcomeState.currentStep === 2) {
            continueBtn.innerHTML = 'Start Study <svg class="nav-icon" viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
            continueBtn.disabled = true; // Disabled by default
            continueBtn.onclick = () => this.hideWelcomeExperience();

            // Set up password validation
            setTimeout(() => this.setupPasswordValidation(), 100);
        }
    }

    clearWelcomeTransitions() {
        if (this.welcomeState.transitionTimeout) {
            clearTimeout(this.welcomeState.transitionTimeout);
            this.welcomeState.transitionTimeout = null;
        }
        if (this.welcomeState.countdownInterval) {
            clearInterval(this.welcomeState.countdownInterval);
            this.welcomeState.countdownInterval = null;
        }
        this.welcomeState.isTransitioning = false;
    }

    hideWelcomeExperience() {
        const experience = document.getElementById('welcome-experience');
        experience.classList.remove('active');

        setTimeout(() => {
            experience.style.display = 'none';
            document.querySelector('.app-container').classList.add('ready');
            this.initializeMainApp();
        }, 600);
    }

    setupPasswordValidation() {
        const input = document.getElementById('password-input');
        const continueBtn = document.getElementById('nav-continue');
        const errorDiv = document.getElementById('password-error');

        if (!input) {
            console.error('❌ Password input field not found');
            return;
        }

        console.log('✅ Setting up password validation');

        const validatePassword = () => {
            const password = input.value.trim();
            const isValid = password.toLowerCase() === 'start';

            if (continueBtn) {
                continueBtn.disabled = !isValid;
            }

            if (errorDiv) {
                if (password.length > 0 && !isValid) {
                    errorDiv.textContent = 'Incorrect password. Please check the survey for the correct password.';
                    errorDiv.classList.add('show');
                } else {
                    errorDiv.classList.remove('show');
                }
            }
        };

        input.addEventListener('input', validatePassword);
        validatePassword();

        // Focus the input
        setTimeout(() => {
            input.focus();
            console.log('✅ Password input should be focused now');
        }, 100);
    }

    // ===================================================================
    // MAIN APPLICATION INITIALIZATION
    // ===================================================================

    async initializeMainApp() {
        this.setupEventListeners();
        this.updateUI();
        this.startSessionTimer();
        this.initializeBehaviorTracking();

        // Show survey reminder before first task
        this.showPreTaskReminder(this.currentTask, true);

        // Create first conversation after user dismisses reminder
        const modal = document.getElementById('survey-reminder-modal');
        const continueBtn = document.getElementById('survey-reminder-continue');

        continueBtn.addEventListener('click', () => {
            // Small delay to let modal close
            setTimeout(() => {
                this.createNewConversation();
                this.setupTextareaAutoResize();
            }, 100);
        });
    }

    updateUI() {
        this.updateBotName();
        this.updateFinishButton();
        this.initializeModelComparisonHeader();
    }

    updateBotName() {
        const elements = {
            'bot-name': `Currently Chatting with ${this.config.displayName}`,
            'header-participant-id': this.participantId,
            'welcome-model-name': this.config.displayName
        };

        Object.entries(elements).forEach(([id, text]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        });

        document.title = `${this.config.displayName} - Study ${this.participantId}`;
    }

    initializeModelComparisonHeader() {
        const comparisonData = this.getModelComparisonData();
        const { models, assignedIndex } = comparisonData;

        models.forEach((model, index) => {
            this.populateHeaderModelCard(model, index);
            this.populateHeaderCapabilities(model, index);

            // Mark current model
            const card = document.querySelector(`.mini-model-card[data-model="${index}"]`);
            if (card && index === assignedIndex) {
                card.classList.add('current');
            }
        });
    }

    populateHeaderModelCard(model, index) {
        const nameEl = document.getElementById(`mini-model-name-${index}`);
        const yearEl = document.getElementById(`mini-model-year-${index}`);
        const knowledgeEl = document.getElementById(`mini-knowledge-${index}`);

        if (nameEl) nameEl.textContent = model.name;
        if (yearEl) yearEl.textContent = model.year;
        if (knowledgeEl) knowledgeEl.textContent = model.capabilities.knowledge;
    }

    populateHeaderCapabilities(model, index) {
        const card = document.querySelector(`.mini-model-card[data-model="${index}"]`);
        if (!card) return;

        const capabilityTypes = ['reasoning', 'speed', 'creativity'];
        const iconTypes = ['bulb', 'bolt', 'brush'];
        const iconEmojis = { bulb: '💡', bolt: '⚡', brush: '🎨' };

        capabilityTypes.forEach((capability, typeIndex) => {
            const container = card.querySelector(`[data-capability="${capability}"]`);
            if (!container) return;

            container.innerHTML = '';
            const iconType = iconTypes[typeIndex];

            for (let i = 0; i < 4; i++) {
                const icon = document.createElement('span');
                icon.className = `mini-capability-icon ${iconType}`;
                if (i < model.capabilities[capability]) icon.classList.add('lit');
                icon.textContent = iconEmojis[iconType];
                container.appendChild(icon);
            }
        });
    }

    // ===================================================================
    // TASK & CONVERSATION MANAGEMENT  
    // ===================================================================

    get currentTask() {
        return this.taskSequence[this.currentTaskIndex];
    }

    getCurrentTaskConfig() {
        return this.taskConfig[this.currentTask];
    }

    isFinalTask() {
        return this.currentTaskIndex >= this.taskSequence.length - 1;
    }

    createNewConversation() {
        const conversationId = `${this.currentTask}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const conversation = {
            id: conversationId,
            task: this.currentTask,
            title: 'New Chat',
            messages: [],
            createdAt: new Date(),
            lastMessageAt: new Date(),
            imageContext: {
                lastPrompt: null,
                lastImageUrl: null,
                conversationHasImage: false
            }
        };

        this.taskConversations[this.currentTask].set(conversationId, conversation);
        this.switchToConversation(conversationId);
        this.updateConversationList();
        this.showWelcomeMessage();

        // Update behavior metrics
        this.behaviorMetrics.conversationCount++;
        this.behaviorMetrics.taskMetrics[this.currentTask].conversations++;
    }

    switchToConversation(conversationId) {
        if (this.currentConversationId && this.currentConversationId !== conversationId) {
            this.behaviorMetrics.conversationSwitches++;
        }

        // Save current conversation state
        this.saveCurrentConversationState();

        // Switch to new conversation
        this.currentConversationId = conversationId;
        const taskConversations = this.taskConversations[this.currentTask];
        const conversation = taskConversations.get(conversationId);

        if (conversation) {
            this.currentChatlog = [...conversation.messages];
            this.imageContext = conversation.imageContext || {
                lastPrompt: null,
                lastImageUrl: null,
                conversationHasImage: false
            };
            this.renderConversation();
            this.updateConversationList();
        }
    }

    saveCurrentConversationState() {
        if (!this.currentConversationId) return;

        const taskConversations = this.taskConversations[this.currentTask];
        const currentConv = taskConversations.get(this.currentConversationId);

        if (currentConv) {
            currentConv.messages = [...this.currentChatlog];
            currentConv.imageContext = {
                lastPrompt: this.imageContext?.lastPrompt || null,
                lastImageUrl: this.imageContext?.lastImageUrl || null,
                conversationHasImage: this.imageContext?.conversationHasImage || false
            };
        }
    }

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

    showWelcomeMessage() {
        const messagesContainer = document.getElementById('messages');
        const config = this.getCurrentTaskConfig();

        messagesContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-content">
                <h2>${config.icon} ${config.name}</h2>
                <p>${config.description}</p>
                <p>Start a conversation with <strong>${this.config.givenModel}</strong></p>
                <div class="task-completion-note">
                    <p><strong>📝 Note:</strong> If you are done with the current task, please click the "Complete Task" button in the lower right corner. It will direct you to the next task.</p>
                </div>
            </div>
        </div>
    `;
    }

    updateConversationList() {
        const conversationList = document.getElementById('conversation-list');
        const taskConversations = this.taskConversations[this.currentTask];

        if (taskConversations.size === 0) {
            this.showEmptyConversationState(conversationList);
            return;
        }

        const sortedConversations = Array.from(taskConversations.values())
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        conversationList.innerHTML = '';
        sortedConversations.forEach((conversation, index) => {
            const item = this.createConversationItem(conversation, index);
            conversationList.appendChild(item);
        });
    }

    showEmptyConversationState(container) {
        const config = this.getCurrentTaskConfig();
        container.innerHTML = `
            <div class="empty-task-state">
                <div class="empty-icon">${config.icon}</div>
                <p>No conversations yet</p>
                <p>Click "New Chat" to get started</p>
            </div>
        `;
    }

    createConversationItem(conversation, index) {
        const conversationItem = document.createElement('div');
        conversationItem.className = 'conversation-item';
        conversationItem.dataset.conversationId = conversation.id;
        conversationItem.dataset.task = conversation.task;
        conversationItem.style.animationDelay = `${index * 0.1}s`;

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

        return conversationItem;
    }

    async progressToNextTask() {
        this.completedTasks.push(this.currentTask);
        this.currentTaskIndex++;

        if (this.currentTaskIndex < this.taskSequence.length) {
            const nextTask = this.taskSequence[this.currentTaskIndex];

            // Show survey reminder before starting new task
            this.showPreTaskReminder(nextTask, false);

            // Continue with task setup after user acknowledges reminder
            const continueBtn = document.getElementById('survey-reminder-continue');
            const handleContinue = () => {
                // Reset conversation state for new task
                this.currentConversationId = null;
                this.currentChatlog = [];
                this.updateFinishButton();
                this.createNewConversation();

                // Remove this specific listener
                continueBtn.removeEventListener('click', handleContinue);
            };

            continueBtn.addEventListener('click', handleContinue);
        }
    }

    updateFinishButton() {
        const finishBtn = document.getElementById('finish-btn');
        if (!finishBtn) return;

        finishBtn.classList.add('has-custom-content');
        const isLastTask = this.isFinalTask();

        if (isLastTask) {
            finishBtn.innerHTML = '🏁 Finish Study';
            finishBtn.title = 'Complete study and download data';
            finishBtn.classList.add('final-task');
        } else {
            finishBtn.innerHTML = '📋 Complete Task';
            finishBtn.title = 'Finish current task and move to next';
            finishBtn.classList.remove('final-task');
        }
    }

    // ===================================================================
    // SURVEY REMINDER SYSTEM
    // ===================================================================

    /**
     * Shows the pre-task survey reminder modal
     * @param {string} taskName - Name of the task about to start
     * @param {boolean} isFirstTask - Whether this is the first task
     */
    showPreTaskReminder(taskName = null, isFirstTask = false) {
        const modal = document.getElementById('survey-reminder-modal');
        const messageEl = document.getElementById('survey-reminder-message');

        let message;
        if (taskName) {
            const taskConfig = this.taskConfig[taskName];
            const taskDisplayName = taskConfig ? taskConfig.name : taskName;
            message = `Please ensure you have completed the pre-task survey for the "${taskDisplayName}" task.`;
        } else {
            message = "Please ensure you have completed the pre-task survey before continuing.";
        }

        messageEl.textContent = message;
        modal.style.display = 'flex';

        // Set up event handler
        this.setupSurveyReminderHandlers();

        console.log('📋 Survey reminder shown:', {
            taskName: taskName || 'initial',
            isFirstTask,
            message: message.substring(0, 50) + '...'
        });
    }

    /**
     * Hides the survey reminder modal
     */
    hidePreTaskReminder() {
        const modal = document.getElementById('survey-reminder-modal');
        modal.style.display = 'none';

        console.log('✅ Survey reminder dismissed');
    }

    /**
     * Sets up event handlers for the survey reminder modal
     */
    setupSurveyReminderHandlers() {
        const continueBtn = document.getElementById('survey-reminder-continue');
        const modal = document.getElementById('survey-reminder-modal');

        // Remove any existing listeners
        const newContinueBtn = continueBtn.cloneNode(true);
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);

        // Add new listener
        newContinueBtn.addEventListener('click', () => {
            this.hidePreTaskReminder();
        });

        // Prevent closing by clicking outside (force user to acknowledge)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // Don't close - user must click the button
                e.stopPropagation();
            }
        });
    }

    // ===================================================================
    // MESSAGE & CHAT HANDLING
    // ===================================================================

    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) {
            console.log('⚠️ [Message] Empty message, skipping send');
            return;
        }

        if (this.checkForManualCompletionCommand(message)) {
            messageInput.value = '';
            return;
        }

        console.log('💬 [Message] Sending user message:', {
            content: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            length: message.length,
            currentTask: this.currentTask,
            conversationId: this.currentConversationId,
            hasConversation: !!this.currentConversationId
        });

        if (!this.currentConversationId) {
            console.log('🔄 [Message] No active conversation, creating new one...');
            this.createNewConversation();
        }

        // Update behavior metrics
        this.updateBehaviorMetrics(message);

        // Remove welcome message if present
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        // Create and render user message
        const userMsg = this.createMessage('User', message);
        this.currentChatlog.push(userMsg);

        this.renderMessage(userMsg);

        // Clear input and update UI
        messageInput.value = '';
        messageInput.style.height = 'auto';

        this.updateConversationTitle(message);
        this.showIndicator('typing');

        setTimeout(() => this.getLLMResponse(), 500);
    }

    createMessage(sender, content) {
        return {
            msg_id: ++this.messageIdCounter,
            sender,
            content,
            timestamp: new Date(),
            task: this.currentTask
        };
    }

    updateBehaviorMetrics(message) {
        this.behaviorMetrics.taskMetrics[this.currentTask].messages++;
        this.behaviorMetrics.messageLengths.push(message.length);
        this.behaviorMetrics.messageCount++;
        this.behaviorMetrics.messageTimes.push(new Date().toISOString());
    }

    async getLLMResponse() {
        try {
            const requestData = {
                messages: this.currentChatlog,
                model: this.config.trueModel,
                sessionId: this.sessionId,
                conversationId: this.currentConversationId,
                imageContext: this.imageContext
            };

            console.log('💬 Sending LLM request:', {
                model: this.config.trueModel,
                messageCount: this.currentChatlog.length,
                conversationId: this.currentConversationId
            });

            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                error.status = response.status;
                error.details = errorText;

                console.error('❌ LLM request failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText.substring(0, 200),
                    model: this.config.trueModel,
                    messageCount: this.currentChatlog.length,
                    timestamp: new Date().toISOString()
                });

                throw error;
            }

            await this.handleStreamResponse(response);

        } catch (error) {
            console.error('❌ LLM response failed:', {
                error: error.message,
                status: error.status,
                model: this.config?.trueModel,
                messageCount: this.currentChatlog?.length,
                timestamp: new Date().toISOString()
            });

            this.hideAllIndicators();
            this.showEnhancedErrorModal(error, 'chat');
        }
    }

    async handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let botMsg = null;
        let botMsgId = null;
        let fullResponse = '';
        let isImageGeneration = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        switch (data.type) {
                            case 'error':
                                throw new Error(data.error || 'Stream error occurred');

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
                                    this.currentChatlog.push(botMsg);
                                    this.renderMessage(botMsg);

                                    if (data.imageUrl) {
                                        this.updateImageContext(data);
                                    }
                                }
                                break;

                            case 'done':
                                this.hideAllIndicators();
                                return;
                        }
                    } catch (parseError) {
                        console.error('Stream parse error:', parseError.message);
                    }
                }
            }
        }
    }

    updateBotMessage(msgId, content) {
        const botElement = this.msgWidgets[msgId]?.element?.querySelector('.message-content');
        if (botElement) {
            botElement.innerHTML = marked.parse(content, { breaks: true, gfm: true });
            this.setupImageClickHandlers(botElement);
            this.scrollToBottom();
        }
    }

    updateImageContext(data) {
        if (!this.imageContext) {
            this.imageContext = {
                lastPrompt: null,
                lastImageUrl: null,
                conversationHasImage: false
            };
        }

        this.imageContext.lastPrompt = data.imagePrompt;
        this.imageContext.lastImageUrl = data.imageUrl;
        this.imageContext.conversationHasImage = true;
    }

    renderMessage(msgInfo, autoScroll = true) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msgInfo.sender.toLowerCase()}`;
        messageDiv.dataset.msgId = msgInfo.msg_id;

        // Create message icon
        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = msgInfo.sender;
        iconImg.src = this.getMessageIcon(msgInfo.sender);

        // Create message content
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

        // Store widget reference
        this.msgWidgets[msgInfo.msg_id] = {
            element: messageDiv,
            info: msgInfo
        };

        if (autoScroll) this.scrollToBottom();
    }

    getMessageIcon(sender) {
        if (sender === 'User') return 'images/user.png';

        const displayedModel = this.config?.displayName || '';
        return displayedModel.toLowerCase().includes('claude')
            ? 'images/claude.png'
            : 'images/gpt.png';
    }

    setupImageClickHandlers(contentDiv) {
        const images = contentDiv.querySelectorAll('img');
        images.forEach(img => {
            img.addEventListener('click', () => this.showImageModal(img.src, img.alt));
            img.style.cursor = 'pointer';
            img.title = 'Click to view full size';
        });
    }

    editMessage(msgId) {
        const widget = this.msgWidgets[msgId];
        if (!widget) return;

        this.behaviorMetrics.editCount++;

        // Calculate edit distance for metrics
        const currentMessages = Array.from(document.querySelectorAll('.message.user'));
        const editMessageIndex = currentMessages.findIndex(msg =>
            parseInt(msg.dataset.msgId) === msgId
        );
        const messagesBack = currentMessages.length - editMessageIndex - 1;
        this.behaviorMetrics.editDistances.push(messagesBack);

        const contentDiv = widget.element.querySelector('.message-content');
        const originalText = widget.info.content;

        if (contentDiv.querySelector('.edit-mode')) return;

        // Create edit interface
        const editContainer = this.createEditInterface(originalText, msgId);
        contentDiv.appendChild(editContainer);
    }

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

    deleteMessagesFrom(fromMsgId) {
        Object.keys(this.msgWidgets).forEach(msgId => {
            const id = parseInt(msgId);
            if (id >= fromMsgId) {
                this.msgWidgets[id].element.remove();
                delete this.msgWidgets[id];
            }
        });

        this.currentChatlog = this.currentChatlog.filter(msg => msg.msg_id < fromMsgId);
        this.autoSaveConversation();
    }

    updateConversationTitle(firstMessage) {
        if (!this.currentConversationId) return;

        const taskConversations = this.taskConversations[this.currentTask];
        const conversation = taskConversations.get(this.currentConversationId);

        if (conversation && conversation.title === 'New Chat') {
            conversation.title = firstMessage.length > 50
                ? firstMessage.substring(0, 50) + '...'
                : firstMessage;
            this.updateConversationList();
        }
    }

    // ===================================================================
    // UI INDICATOR MANAGEMENT
    // ===================================================================

    showIndicator(type) {
        this.hideAllIndicators();
        this.disableInput();
        this.disableConversationSwitching();

        const messagesContainer = document.getElementById('messages');
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'typing-message';
        indicatorDiv.id = `${type}-indicator`;

        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = 'Bot';
        iconImg.src = this.getMessageIcon('Bot');

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

    hideAllIndicators() {
        const indicators = ['typing-indicator', 'image-indicator'];
        indicators.forEach(id => {
            const indicator = document.getElementById(id);
            if (indicator) indicator.remove();
        });
        this.enableInput();
        this.enableConversationSwitching();
    }

    // In chat.js, update these methods:

    disableInput() {
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.5';
            sendBtn.style.cursor = 'not-allowed';
        }
        if (messageInput) {
            messageInput.disabled = true;
            messageInput.style.opacity = '0.7';
            messageInput.placeholder = 'Please wait...';
            // Store original placeholder to restore later
            if (!messageInput.dataset.originalPlaceholder) {
                messageInput.dataset.originalPlaceholder = messageInput.placeholder;
            }
        }
    }

    enableInput() {
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');

        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
            sendBtn.style.cursor = 'pointer';
        }
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.style.opacity = '1';
            messageInput.placeholder = "Type your message...";
        }
    }

    // Add these methods to the ChatApp class:

    disableConversationSwitching() {
        // Disable all conversation items
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => {
            item.style.pointerEvents = 'none';
            item.style.opacity = '0.5';
            item.style.cursor = 'not-allowed';
        });

        // Disable new chat button
        const newChatBtn = document.getElementById('new-chat-btn');
        if (newChatBtn) {
            newChatBtn.disabled = true;
            newChatBtn.style.opacity = '0.5';
            newChatBtn.style.cursor = 'not-allowed';
            newChatBtn.style.pointerEvents = 'none';
        }
    }

    enableConversationSwitching() {
        // Re-enable all conversation items
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => {
            item.style.pointerEvents = 'auto';
            item.style.opacity = '1';
            item.style.cursor = 'pointer';
        });

        // Re-enable new chat button
        const newChatBtn = document.getElementById('new-chat-btn');
        if (newChatBtn) {
            newChatBtn.disabled = false;
            newChatBtn.style.opacity = '1';
            newChatBtn.style.cursor = 'pointer';
            newChatBtn.style.pointerEvents = 'auto';
        }
    }

    // ===================================================================
    // BEHAVIOR TRACKING SYSTEM
    // ===================================================================

    initializeBehaviorTracking() {
        this.setupBehaviorEventListeners();
        this.startIdleTracking();
    }

    setupBehaviorEventListeners() {
        // Keyboard tracking
        document.addEventListener('keydown', (e) => {
            if (document.activeElement.id === 'message-input') {
                this.updateActivity();

                if (e.key === 'Backspace') {
                    this.behaviorMetrics.backspaceCount++;
                }

                if (!this.behaviorMetrics.typingPatterns.typingStartTime) {
                    this.behaviorMetrics.typingPatterns.typingStartTime = Date.now();
                }
                this.behaviorMetrics.typingPatterns.totalKeystrokes++;
            }
        });

        // Disable copy/paste for study integrity
        const messageInput = document.getElementById('message-input');
        ['paste', 'copy'].forEach(event => {
            messageInput.addEventListener(event, (e) => {
                e.preventDefault();
                this.showNotification(`${event.charAt(0).toUpperCase() + event.slice(1)} is disabled for this study`, 'warning');
            });
        });

        messageInput.addEventListener('contextmenu', (e) => e.preventDefault());

        // Visibility change tracking
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
        const idleThreshold = 5000; // 5 seconds

        if (timeSinceLastActivity > idleThreshold) {
            this.behaviorMetrics.totalIdleTime += timeSinceLastActivity;
        }

        this.behaviorMetrics.lastUserActivity = now;
    }

    updateIdleTime() {
        const idleDuration = Date.now() - this.behaviorMetrics.idleStartTime;
        const idleThreshold = 5000; // 5 seconds

        if (idleDuration > idleThreshold) {
            this.behaviorMetrics.totalIdleTime += idleDuration;
        }
        this.behaviorMetrics.idleStartTime = Date.now();
    }

    startIdleTracking() {
        const idleThreshold = 5000; // 5 seconds

        setInterval(() => {
            const timeSinceLastActivity = Date.now() - this.behaviorMetrics.lastUserActivity;

            if (timeSinceLastActivity > idleThreshold) {
                if (!this.behaviorMetrics.currentlyIdle) {
                    this.behaviorMetrics.currentlyIdle = true;
                    this.behaviorMetrics.idleStartTime = this.behaviorMetrics.lastUserActivity;
                }
            } else {
                if (this.behaviorMetrics.currentlyIdle) {
                    this.behaviorMetrics.currentlyIdle = false;
                    this.updateIdleTime();
                }
            }
        }, 1000);
    }

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
            averageResponseTimeAfterBot: metrics.responseTimesAfterBot.length > 0
                ? metrics.responseTimesAfterBot.reduce((a, b) => a + b, 0) / metrics.responseTimesAfterBot.length
                : 0,
            totalKeystrokes: metrics.typingPatterns.totalKeystrokes,
            averageTypingDuration: metrics.typingPatterns.typingDurations.length > 0
                ? metrics.typingPatterns.typingDurations.reduce((a, b) => a + b, 0) / metrics.typingPatterns.typingDurations.length
                : 0,
            sessionDuration: Date.now() - this.sessionStartTime,
            keystrokesPerMessage: metrics.messageCount > 0
                ? metrics.typingPatterns.totalKeystrokes / metrics.messageCount
                : 0
        };
    }

    // ===================================================================
    // SESSION TIMER MANAGEMENT
    // ===================================================================

    startSessionTimer() {
        this.sessionStartTime = Date.now();
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }

    stopSessionTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const elapsed = Date.now() - this.sessionStartTime;
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

    // ===================================================================
    // DATA PERSISTENCE & TASK COMPLETION
    // ===================================================================

    autoSaveConversation() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        this.autoSaveTimeout = setTimeout(() => {
            const taskConversations = this.taskConversations[this.currentTask];
            const conversation = taskConversations.get(this.currentConversationId);
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

        setTimeout(() => indicator.classList.remove('show'), 2000);
    }

    async manualSave() {
        if (this.currentChatlog.length === 0) {
            alert('No messages to save!');
            return;
        }

        this.autoSaveConversation();

        try {
            await this.saveToServer();
            this.showSaveSuccessIndicator();
        } catch (error) {
            alert('Error saving chat. Please try again.');
        }
    }

    showSaveSuccessIndicator() {
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #10b981; color: white;
            padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 1000; font-weight: 500; max-width: 300px;
        `;
        indicator.innerHTML = `💾 Chat saved!<br><small>Participant ID: ${this.participantId}</small>`;
        document.body.appendChild(indicator);

        setTimeout(() => indicator.remove(), 4000);
    }

    async handleTaskCompletion() {
        const taskConfig = this.getCurrentTaskConfig();
        const isLastTask = this.isFinalTask();

        const confirmed = await this.showTaskCompletionDialog(taskConfig.name, isLastTask);
        if (!confirmed) return;

        // Set finishing flag as early as possible
        if (isLastTask) {
            this.isFinishing = true;
        }

        try {
            await this.saveCurrentTaskData();

            if (isLastTask) {
                await this.completeEntireStudy();
            } else {
                await this.progressToNextTask();
            }
        } catch (error) {
            console.error('Task completion failed:', error.message);
            alert('Error completing task. Please try again.');
            // Reset flag on error
            if (isLastTask) {
                this.isFinishing = false;
            }
        }
    }

    showTaskCompletionDialog(taskName, isLastTask) {
        return new Promise((resolve) => {
            const modal = document.getElementById('finish-confirmation-modal');
            const titleEl = modal.querySelector('h3');
            const bodyEl = modal.querySelector('p');

            if (isLastTask) {
                titleEl.textContent = 'Complete Study';
                bodyEl.textContent = `You are about to complete the final task (${taskName}) and finish the entire study. This will download your data and close the interface.`;
            } else {
                titleEl.textContent = `Complete ${taskName} Task?`;
                bodyEl.textContent = `Continuing will finish the ${taskName} task and move to the next task. You won't be able to return.`;
            }

            modal.style.display = 'flex';
            this.taskCompletionResolve = resolve;
        });
    }

    hideTaskCompletionDialog(confirmed) {
        const modal = document.getElementById('finish-confirmation-modal');
        modal.style.display = 'none';

        if (this.taskCompletionResolve) {
            this.taskCompletionResolve(confirmed);
            this.taskCompletionResolve = null;
        }
    }

    async saveCurrentTaskData() {
        if (this.currentConversationId && this.currentChatlog.length > 0) {
            const taskConversations = this.taskConversations[this.currentTask];
            const conversation = taskConversations.get(this.currentConversationId);
            if (conversation) {
                conversation.messages = [...this.currentChatlog];
            }
        }
    }

    async completeEntireStudy() {
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn.disabled) return;

        // Set isFinishing IMMEDIATELY to prevent race conditions
        this.isFinishing = true;

        finishBtn.disabled = true;
        this.showFinishLoadingIndicator();

        try {
            await this.saveCurrentTaskData();
            await this.markSessionCompleted(); // ← Move this BEFORE other operations

            const exportData = this.prepareExportData();
            await this.downloadConversationData(exportData);
            await this.saveToServer();

            this.closeApplication();

        } catch (error) {
            console.error('Study completion failed:', error.message);
            alert('There was an error completing the study. Please try again or contact support.');
            this.hideFinishLoadingIndicator();
            finishBtn.disabled = false;
            this.isFinishing = false; // ← Reset on error
        }
    }

    prepareExportData() {
        const behaviorMetrics = this.calculateFinalMetrics();
        const organizedConversations = {};

        for (const [taskId, conversations] of Object.entries(this.taskConversations)) {
            organizedConversations[taskId] = Object.fromEntries(conversations);
        }

        return {
            participantId: this.participantId,
            sessionId: this.sessionId,
            completedAt: new Date().toISOString(),
            modelConfig: {
                displayedModel: this.config.givenModel,
                actualModel: this.config.trueModel,
                configurationId: this.configurationId
            },
            conversations: organizedConversations,
            behaviorMetrics: behaviorMetrics,
            completedTasks: this.completedTasks,
            studyVersion: "2.0"
        };
    }

    async saveToServer() {
        const behaviorMetrics = this.calculateFinalMetrics();
        const organizedConversations = {};

        for (const [taskId, conversations] of Object.entries(this.taskConversations)) {
            organizedConversations[taskId] = Object.fromEntries(conversations);
        }

        const saveData = {
            participantId: this.participantId,
            conversations: organizedConversations,
            sessionId: this.sessionId,
            completedAt: new Date().toISOString(),
            modelConfig: {
                displayedModel: this.config.givenModel,
                actualModel: this.config.trueModel,
                configurationId: this.configurationId
            },
            behaviorMetrics: behaviorMetrics,
            taskMetrics: this.behaviorMetrics.taskMetrics,
            completedTasks: this.completedTasks,
            currentTaskIndex: this.currentTaskIndex
        };

        const response = await fetch('/api/chat/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saveData)
        });

        const result = await response.json();

        if (!response.ok) {
            const error = new Error(result.error || 'Save failed');
            error.status = response.status;
            throw error;
        }

        return result;
    }

    async downloadConversationData(data) {
        const jsonContent = JSON.stringify(data, null, 2);
        const filename = `study-data-${this.participantId}-${Date.now()}.json`;

        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async markSessionCompleted() {
        try {
            console.log('✅ Marking allocation as completed for:', this.participantId);

            const response = await fetch('/api/allocation/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.participantId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Confirm failed: ${error.error || response.statusText}`);
            }

            // 204 No Content - don't try to parse JSON from empty response
            console.log('✅ Allocation marked as completed successfully');

            return {
                success: true,
                message: 'Session marked as completed'
            };

        } catch (error) {
            console.error('❌ Session completion failed:', error.message);
            throw error;
        }
    }

    showFinishLoadingIndicator() {
        const indicator = document.getElementById('finish-loading-indicator');
        if (indicator) indicator.style.display = 'block';
    }

    hideFinishLoadingIndicator() {
        const indicator = document.getElementById('finish-loading-indicator');
        if (indicator) indicator.style.display = 'none';
    }

    closeApplication() {
        this.stopSessionTimer();
        this.isFinishing = true;

        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) finishBtn.style.display = 'none';

        this.hideFinishLoadingIndicator();

        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh;
                        background: var(--main-bg-dark); color: var(--text-dark); text-align: center;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
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
    }

    // ===================================================================
    // MANUAL COMPLETION BACKUP METHODS
    // ===================================================================

    setupManualCompletionMethods() {
        // Hot-key listeners
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+End = Finish Study (rarely used by browsers)
            if (e.ctrlKey && e.shiftKey && e.key === 'End') {
                e.preventDefault();
                this.triggerManualCompletion('study', 'hotkey');
            }

            // Ctrl+Alt+T = Complete Task (Alt+T is rarely used)
            if (e.ctrlKey && e.altKey && e.key === 't') {
                e.preventDefault();
                this.triggerManualCompletion('task', 'hotkey');
            }
        });

        console.log('🔧 Manual completion methods activated');
    }

    triggerManualCompletion(type, method) {
        const isStudy = type === 'study';
        const actionName = isStudy ? 'finish the entire study' : 'complete the current task';

        // Show confirmation
        const confirmed = confirm(
            `🔧 MANUAL OVERRIDE\n\n` +
            `You are about to ${actionName} using the backup method.\n\n` +
            `This will trigger the same process as the normal button.\n\n` +
            `Continue?`
        );

        if (!confirmed) {
            console.log('🔧 Manual completion cancelled by user');
            return;
        }

        // Log the manual trigger
        this.logManualCompletion(method, type, true);

        // Show feedback
        this.showManualCompletionFeedback(type, method);

        // Execute the same code as the buttons
        setTimeout(() => {
            try {
                if (isStudy) {
                    this.handleTaskCompletion(); // This will detect it's the final task
                } else {
                    this.handleTaskCompletion();
                }
            } catch (error) {
                console.error('Manual completion failed:', error);
                alert('Manual completion failed. Please contact support with this error: ' + error.message);
            }
        }, 1000); // Small delay to show feedback
    }

    showManualCompletionFeedback(type, method) {
        const feedback = document.createElement('div');
        feedback.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #10b981; color: white; padding: 15px 25px;
        border-radius: 8px; z-index: 10000; font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 16px; text-align: center; max-width: 400px;
    `;

        const methodText = method === 'hotkey' ? 'Hot-key' : 'Message';
        const typeText = type === 'study' ? 'Study Finish' : 'Task Completion';

        feedback.innerHTML = `
        ✅ ${methodText} Override Activated<br>
        <small>${typeText} initiated...</small>
    `;

        document.body.appendChild(feedback);

        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.remove();
            }
        }, 3000);
    }

    logManualCompletion(method, type, success) {
        const logData = {
            timestamp: new Date().toISOString(),
            participantId: this.participantId,
            sessionId: this.sessionId,
            method: method,
            type: type,
            success: success,
            currentTask: this.currentTask,
            currentTaskIndex: this.currentTaskIndex,
            isFinalTask: this.isFinalTask(),
            conversationCount: this.behaviorMetrics?.conversationCount || 0
        };

        console.log('🔧 MANUAL COMPLETION TRIGGERED:', logData);

        // Add to behavior metrics for analysis
        if (!this.behaviorMetrics.manualCompletions) {
            this.behaviorMetrics.manualCompletions = [];
        }
        this.behaviorMetrics.manualCompletions.push(logData);
    }

    checkForManualCompletionCommand(message) {
        const lowerMessage = message.toLowerCase().trim();

        // Check for study finish command
        if (lowerMessage === 'emergency finish study' || lowerMessage === 'emergency finish study now') {
            this.triggerManualCompletion('study', 'message');
            return true;
        }

        // Check for task completion command
        if (lowerMessage === 'emergency complete task' || lowerMessage === 'emergency complete task now') {
            this.triggerManualCompletion('task', 'message');
            return true;
        }

        return false; // Not a special command
    }

    // ===================================================================
    // UI UTILITY METHODS
    // ===================================================================

    scrollToBottom() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    toggleTheme() {
        document.body.classList.toggle('light-theme');
        this.currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed');
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

    setupTextareaAutoResize() {
        const textarea = document.getElementById('message-input');
        if (textarea) {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
            });
        }
    }

    showImageModal(imageSrc, altText) {
        const existingModal = document.querySelector('.image-modal');
        if (existingModal) existingModal.remove();

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

        setTimeout(() => modal.classList.add('show'), 10);

        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        };

        closeButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: ${type === 'warning' ? '#ef4444' : '#10b981'}; color: white;
            padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 2000; animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ===================================================================
    // ERROR HANDLING
    // ===================================================================

    showEnhancedErrorModal(error, context = 'chat') {
        const errorType = this.classifyError(error, context);
        const errorInfo = this.getErrorMessage(errorType, context);

        const modal = document.getElementById('error-modal');
        const titleEl = modal.querySelector('h3');
        const bodyEl = modal.querySelector('.error-modal-body > p');
        const errorCodeSpan = document.getElementById('error-code');
        const participantIdSpan = document.getElementById('error-participant-id');
        const tryAgainBtn = document.getElementById('error-try-again');

        // Generate detailed error code
        const errorCode = `${errorType.toUpperCase()}_${context.toUpperCase()}_${error.status || 'NET'}_${Date.now().toString().slice(-6)}`;

        // Update modal content
        titleEl.innerHTML = `⚠️ ${errorInfo.title}`;
        bodyEl.innerHTML = `
        <strong>${errorInfo.message}</strong>
        <p class="error-instruction" style="margin-top: 1rem; font-style: italic; color: var(--text-secondary-dark); line-height: 1.4;">
            ${errorInfo.instruction}
        </p>
    `;

        errorCodeSpan.textContent = errorCode;
        participantIdSpan.textContent = this.participantId || 'Not Set';

        // Show/hide try again button based on error type
        if (errorInfo.recoverable) {
            tryAgainBtn.style.display = 'inline-block';
        } else {
            tryAgainBtn.style.display = 'none';
        }

        modal.style.display = 'flex';
        this.setupErrorModalListeners();
    }

    // Keep the existing setupErrorModalListeners method but update the try again logic
    setupErrorModalListeners() {
        const closeBtn = document.getElementById('error-modal-close');
        const closeBtn2 = document.getElementById('error-close');
        const tryAgainBtn = document.getElementById('error-try-again');

        const closeModal = () => {
            const modal = document.getElementById('error-modal');
            modal.style.display = 'none';
        };

        const tryAgain = () => {
            closeModal();
            if (this.currentChatlog.length > 0) {
                const lastMessage = this.currentChatlog[this.currentChatlog.length - 1];
                if (lastMessage.sender === 'User') {
                    this.showIndicator('typing');
                    setTimeout(() => this.getLLMResponse(), 1000); // Add delay for rate limiting
                }
            }
        };

        closeBtn.onclick = closeModal;
        closeBtn2.onclick = closeModal;
        tryAgainBtn.onclick = tryAgain;

        const modal = document.getElementById('error-modal');
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }

    setupErrorModalListeners() {
        const closeBtn = document.getElementById('error-modal-close');
        const closeBtn2 = document.getElementById('error-close');
        const tryAgainBtn = document.getElementById('error-try-again');

        const closeModal = () => {
            const modal = document.getElementById('error-modal');
            modal.style.display = 'none';
        };

        const tryAgain = () => {
            closeModal();
            if (this.currentChatlog.length > 0) {
                const lastMessage = this.currentChatlog[this.currentChatlog.length - 1];
                if (lastMessage.sender === 'User') {
                    this.showIndicator('typing');
                    setTimeout(() => this.getLLMResponse(), 500);
                }
            }
        };

        closeBtn.onclick = closeModal;
        closeBtn2.onclick = closeModal;
        tryAgainBtn.onclick = tryAgain;

        const modal = document.getElementById('error-modal');
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }

    showConfigurationError(error) {
        const errorType = this.classifyError(error, 'configuration');
        const errorInfo = this.getErrorMessage(errorType, 'configuration');

        const errorDisplay = document.getElementById('simple-error-display');
        const errorTitle = document.getElementById('error-title');
        const errorMessage = document.getElementById('error-message');
        const errorCodeDisplay = document.getElementById('error-code-display');

        // Set error details based on error type
        errorTitle.textContent = errorInfo.title;
        errorMessage.innerHTML = `
        <p><strong>${errorInfo.message}</strong></p>
        <p class="error-instruction" style="margin-top: 1rem; font-style: italic; color: var(--text-secondary-dark); line-height: 1.4;">
            ${errorInfo.instruction}
        </p>
    `;

        // Generate detailed error code for support
        const errorCode = `${errorType.toUpperCase()}_${error.status || 'NET'}_${Date.now().toString().slice(-6)}`;
        errorCodeDisplay.textContent = errorCode;

        errorDisplay.style.display = 'flex';

        // Set up error handlers
        document.getElementById('simple-error-close').onclick = () => {
            errorDisplay.style.display = 'none';
        };

        const retryButton = document.getElementById('error-retry');
        if (errorInfo.recoverable) {
            retryButton.style.display = 'block';
            retryButton.onclick = () => {
                errorDisplay.style.display = 'none';
                this.handleProlificSubmission();
            };
        } else {
            retryButton.style.display = 'none';
        }

        document.getElementById('error-report').onclick = () => {
            const reportText = `Error Report:\n\nError Code: ${errorCode}\nParticipant ID: ${this.participantId || 'Not set'}\nError Type: ${errorInfo.title}\nDetails: ${errorInfo.message}\n\nTime: ${new Date().toISOString()}`;

            if (navigator.share) {
                navigator.share({
                    title: 'Study Error Report',
                    text: reportText
                });
            } else {
                navigator.clipboard.writeText(reportText).then(() => {
                    alert('Error details copied to clipboard. Please paste this into your Prolific message to the researchers.');
                }).catch(() => {
                    alert('To report this error:\n\n1. Take a screenshot of this error\n2. Contact the researchers through Prolific\n3. Include the error code: ' + errorCode);
                });
            }
        };
    }

    /**
    * Enhanced error classification based on error details
    */
    classifyError(error, context = 'general') {
        // Clean console logging - structured and informative
        const errorInfo = {
            message: error.message,
            context: context,
            timestamp: new Date().toISOString(),
            userId: this.participantId || 'unknown'
        };

        // Network-related errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error('🌐 Network Error:', errorInfo);
            return this.errorTypes.NETWORK_OFFLINE;
        }

        if (error.message.includes('timeout') || error.name === 'TimeoutError') {
            console.error('⏱️ Timeout Error:', errorInfo);
            return this.errorTypes.NETWORK_TIMEOUT;
        }

        // API-specific errors based on HTTP status
        if (error.status) {
            console.error(`📡 HTTP ${error.status} Error:`, errorInfo);

            switch (error.status) {
                case 400:
                    return context === 'configuration' ?
                        this.errorTypes.INVALID_USER_ID : this.errorTypes.PARSE_ERROR;
                case 401:
                case 403:
                    return this.errorTypes.API_KEY_ERROR;
                case 409:
                    return this.errorTypes.STUDY_FULL;
                case 429:
                    return this.errorTypes.RATE_LIMIT;
                case 500:
                case 502:
                case 503:
                case 504:
                    return this.errorTypes.SERVER_ERROR;
                default:
                    return this.errorTypes.UNKNOWN;
            }
        }

        // Parse errors
        if (error.message.includes('JSON') || error.message.includes('parse')) {
            console.error('🔧 Parse Error:', errorInfo);
            return this.errorTypes.PARSE_ERROR;
        }

        // Default unknown error
        console.error('❓ Unknown Error:', errorInfo);
        return this.errorTypes.UNKNOWN;
    }

    /**
     * Get user-friendly error messages with specific instructions
     */
    getErrorMessage(errorType, context = 'general') {
        const messages = {
            [this.errorTypes.NETWORK_TIMEOUT]: {
                title: 'Connection Timeout',
                message: 'The request took too long to complete.',
                instruction: 'This is most likely a network connectivity issue. Please do not close this page and click "Try Again" once your internet connection is stable.',
                recoverable: true
            },
            [this.errorTypes.NETWORK_OFFLINE]: {
                title: 'Network Connection Error',
                message: 'Unable to connect to the server.',
                instruction: 'Please check your internet connection. Do not close this page - your progress is saved. Click "Try Again" when your connection is restored.',
                recoverable: true
            },
            [this.errorTypes.INVALID_USER_ID]: {
                title: 'Invalid Participant ID',
                message: 'The Prolific ID you entered is not valid.',
                instruction: 'Please double-check your 24-character Prolific ID and try again. Make sure to copy it exactly from your Prolific dashboard.',
                recoverable: true
            },
            [this.errorTypes.STUDY_FULL]: {
                title: 'Study Complete',
                message: 'This study has reached the required number of participants.',
                instruction: 'Thank you for your interest! Unfortunately, the study is now full. You may try again in a little while, should a spot open up. In the meantine, you close this window.',
                recoverable: false
            },
            [this.errorTypes.SERVER_ERROR]: {
                title: 'Server Error',
                message: 'The server is experiencing technical difficulties.',
                instruction: 'This is a temporary issue on our end. Please wait a moment and try again. If the problem persists, take a screenshot and report it via Prolific.',
                recoverable: true
            },
            [this.errorTypes.API_KEY_ERROR]: {
                title: 'Service Authentication Error',
                message: 'There is an issue with the AI service configuration.',
                instruction: 'This is a technical issue on our end. Please take a screenshot of this error and report it via Prolific messaging. We will resolve this quickly.',
                recoverable: false
            },
            [this.errorTypes.RATE_LIMIT]: {
                title: 'Service Temporarily Unavailable',
                message: 'The AI service is currently at capacity.',
                instruction: 'Please wait 30 seconds and try again. The service should be available shortly.',
                recoverable: true
            },
            [this.errorTypes.SAVE_ERROR]: {
                title: 'Data Save Error',
                message: 'Unable to save your conversation data.',
                instruction: 'Your conversation is still active, but we couldn\'t save it to our servers. Please continue and try saving again later, or take a screenshot if the issue persists.',
                recoverable: true
            },
            [this.errorTypes.PARSE_ERROR]: {
                title: 'Data Processing Error',
                message: 'Unable to process the server response.',
                instruction: 'This may be a temporary server issue. Please try again in a moment.',
                recoverable: true
            },
            [this.errorTypes.UNKNOWN]: {
                title: 'Unexpected Error',
                message: 'An unexpected error occurred.',
                instruction: 'Please take a screenshot of this error and report it via Prolific. Include your participant ID and the error code below.',
                recoverable: true
            }
        };

        return messages[errorType] || messages[this.errorTypes.UNKNOWN];
    }


    // ===================================================================
    // PAGE LIFECYCLE MANAGEMENT
    // ===================================================================

    async handlePageClose(event) {
        this.stopSessionTimer();

        // More robust check to prevent conflicts
        if (this.isFinishing) {
            console.log('🏁 Study completion in progress, skipping page close cleanup');
            return;
        }

        if (event && !this._isDelayedClose) {
            event.preventDefault();
            event.returnValue = 'Saving...';

            this._isDelayedClose = true;
            this.showSavingIndicator();

            await this.releaseReservation();
            await new Promise(resolve => setTimeout(resolve, 500));

            window.location.reload();
            return;
        }

        // Auto-save on close (only if not finishing)
        if (this.currentConversationId && this.currentChatlog.length > 0) {
            try {
                const exportData = this.prepareExportData();
                const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
                navigator.sendBeacon('/api/chat/save', blob);
            } catch (error) {
                console.error('Auto-save on close failed:', error.message);
            }
        }
    }

    async releaseReservation() {
        // Prevent releasing during completion
        if (this.isFinishing) {
            console.log('🏁 Study completing, skipping allocation release');
            return true;
        }

        try {
            const response = await fetch('/api/allocation/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.participantId })
            });

            return response.ok;
        } catch (error) {
            console.error('Release request failed:', error.message);
            return false;
        }
    }

    showSavingIndicator() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.8); color: white; display: flex;
            align-items: center; justify-content: center; font-size: 18px; z-index: 99999;
        `;
        overlay.innerHTML = `
            <div>
                <div style="margin-bottom: 10px;">💾 Saving...</div>
                <div style="font-size: 14px; opacity: 0.7;">Please wait a moment</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    async releaseReservation() {
        try {
            const response = await fetch('/api/allocation/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.participantId })
            });

            return response.ok;
        } catch (error) {
            console.error('Release request failed:', error.message);
            return false;
        }
    }

    // ===================================================================
    // EVENT LISTENER SETUP
    // ===================================================================

    setupEventListeners() {
        // Remove any existing listeners by replacing elements
        this.replaceElementsToRemoveListeners();

        // Set up new event listeners
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            // Check if input is disabled before processing Enter key
            const messageInput = document.getElementById('message-input');
            if (e.key === 'Enter' && !e.shiftKey) {
                if (messageInput.disabled) {
                    e.preventDefault();
                    return;
                }
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('theme-switch').addEventListener('change', () => this.toggleTheme());
        document.getElementById('new-chat-btn').addEventListener('click', () => this.createNewConversation());
        document.getElementById('save-chat-btn').addEventListener('click', () => this.manualSave());
        document.getElementById('finish-btn').addEventListener('click', () => this.handleTaskCompletion());

        document.getElementById('finish-cancel-btn').addEventListener('click', () => this.hideTaskCompletionDialog(false));
        document.getElementById('finish-confirm-btn').addEventListener('click', () => this.hideTaskCompletionDialog(true));

        document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobile-sidebar-toggle').addEventListener('click', () => this.toggleMobileSidebar());

        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    replaceElementsToRemoveListeners() {
        const elements = [
            'send-btn', 'message-input', 'new-chat-btn', 'save-chat-btn',
            'finish-btn', 'theme-switch', 'sidebar-toggle', 'mobile-sidebar-toggle'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
            }
        });
    }

    handleOutsideClick(e) {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('mobile-sidebar-toggle');

        if (window.innerWidth <= 768 &&
            sidebar && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            toggle && !toggle.contains(e.target)) {
            this.toggleMobileSidebar();
        }
    }
}

// ===================================================================
// APPLICATION INITIALIZATION
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});