/**
 * ===================================================================
 * CHATBOT INTERFACE - MAIN APPLICATION
 * ===================================================================
 * 
 * Comprehensive chatbot interface for research studies featuring:
 * - Multi-task conversation management with session tracking
 * - Sophisticated welcome experience with database-driven model assignment
 * - Real-time behavioral metrics collection
 * - Data persistence and session management
 * - Responsive design with error handling
 * 
 * Architecture:
 * - Core App Management
 * - Database Configuration Management  
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

        // Welcome experience state with database integration
        this.welcomeState = {
            currentStep: 0,
            maxSteps: 3,
            isAnimating: false,
            isTransitioning: false,
            transitionTimeout: null,
            countdownInterval: null,
            configAssigned: false,
            configAssignmentLoading: false
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

        // Initialize application
        this.initializeApp();
    }

    // ===================================================================
    // DATABASE CONFIGURATION MANAGEMENT
    // ===================================================================

    async initializeApp() {
        this.showWelcomeExperience();
        this.setupReleaseHandler();
        // Configuration loading now happens during welcome flow after ID entry
    }

    /**
     * Handle configuration assignment after Prolific ID entry
     */
    async handleProlificSubmission() {
        const input = document.getElementById('prolific-input');
        const prolificId = input.value.trim();

        if (!/^[a-zA-Z0-9]{24}$/.test(prolificId)) {
            this.showInputError('Please enter a valid 24-character Prolific ID');
            return;
        }

        const continueBtn = document.getElementById('nav-continue');
        const originalContent = continueBtn.innerHTML;
        
        try {
            // Show loading state
            continueBtn.innerHTML = '⏳ Assigning Configuration...';
            continueBtn.disabled = true;
            this.welcomeState.configAssignmentLoading = true;

            // Store participant ID
            this.participantId = prolificId;

            // Claim configuration from database
            console.log('🎯 [Database] Claiming configuration for user:', prolificId);
            const response = await fetch('/api/database/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: prolificId })
            });

            const data = await response.json();

            if (response.ok) {
                // Configuration assigned successfully
                this.handleConfigAssignmentSuccess(data);
                
                // Move to next step to show assigned model
                setTimeout(() => {
                    this.welcomeState.configAssignmentLoading = false;
                    this.renderWelcomeStep(2);
                }, 800);

            } else {
                this.handleConfigAssignmentError(data);
            }

        } catch (error) {
            console.error('❌ [Database] Configuration assignment failed:', error);
            this.handleConfigAssignmentError({
                error: 'Connection failed',
                code: 'NETWORK_ERROR',
                userMessage: 'Unable to connect to the study system. Please check your connection and try again.'
            });
        } finally {
            if (!this.welcomeState.configAssigned) {
                continueBtn.innerHTML = originalContent;
                continueBtn.disabled = false;
                this.welcomeState.configAssignmentLoading = false;
            }
        }
    }

    /**
     * Handle successful configuration assignment
     */
    handleConfigAssignmentSuccess(data) {
        console.log('✅ [Database] Assignment successful:', data);

        // Store configuration
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.configurationId = data.configuration.id;
        this.config = {
            givenModel: data.configuration.displayedModel,
            trueModel: data.configuration.actualModel,
            displayName: data.configuration.displayedModel
        };

        this.welcomeState.configAssigned = true;

        console.log('✅ [Database] Configuration stored:', {
            sessionId: this.sessionId,
            configId: this.configurationId,
            displayedModel: this.config.givenModel,
            actualModel: this.config.trueModel,
            wasExisting: data.isExisting
        });
    }

    /**
     * Handle configuration assignment errors
     */
    handleConfigAssignmentError(errorData) {
        console.error('❌ [Database] Assignment failed:', errorData);

        if (errorData.code === 'STUDY_EXHAUSTED') {
            this.showStudyExhaustedModal(errorData);
        } else {
            this.showDatabaseError(errorData);
        }
    }

    /**
     * Release configuration back to database (for page exits)
     */
    async releaseDatabaseConfiguration() {
        if (!this.participantId) return false;

        try {
            console.log('🔄 [Database] Releasing configuration for user:', this.participantId);
            
            const response = await fetch('/api/database/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.participantId })
            });

            if (response.ok) {
                console.log('✅ [Database] Configuration released successfully');
                return true;
            } else {
                console.warn('⚠️ [Database] Release failed, but continuing...');
                return false;
            }
        } catch (error) {
            console.error('❌ [Database] Release error:', error);
            return false;
        }
    }

    /**
     * Confirm study completion in database
     */
    async confirmStudyCompletion() {
        if (!this.participantId) {
            throw new Error('No participant ID available for confirmation');
        }

        try {
            console.log('✅ [Database] Confirming study completion for user:', this.participantId);
            
            const response = await fetch('/api/database/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.participantId })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ [Database] Study completion confirmed');
                return data;
            } else {
                throw new Error(data.error || 'Failed to confirm study completion');
            }
        } catch (error) {
            console.error('❌ [Database] Confirmation failed:', error);
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
        });

        // Handle special step logic
        switch(stepIndex) {
            case 0: // Intro
                // No special setup needed
                break;
            case 1: // ID Entry
                setTimeout(() => this.setupProlificValidation(), 100);
                break;
            case 2: // Model Display
                if (this.welcomeState.configAssigned) {
                    this.showAssignedModelDisplay();
                }
                break;
        }

        this.updateWelcomeNavigation();
    }

    /**
     * Show assigned model in step 3 (replace model comparison)
     */
    showAssignedModelDisplay() {
        if (!this.config) return;

        const comparisonData = this.getModelComparisonData();
        const assignedIndex = comparisonData.assignedIndex;

        // Show the model comparison with assigned model highlighted
        this.populateModelComparison(comparisonData);
        this.animateModelCards();
        
        setTimeout(() => {
            this.highlightAssignedModel(assignedIndex);
            this.showAssignmentPopup(assignedIndex);
            this.showCapabilityCardsSequence();
        }, 1000);
    }

    startModelComparison() {
        // This method is called in the old flow, but now we only show it in step 2
        // after configuration assignment
        if (this.welcomeState.configAssigned) {
            this.showAssignedModelDisplay();
        }
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
        const family = assignedModel && assignedModel.includes('claude') ? 'claude' : 'openai';

        return {
            family,
            models: modelFamilies[family],
            assignedIndex: this.getAssignedModelIndex(modelFamilies[family])
        };
    }

    getAssignedModelIndex(models) {
        const assignedName = this.config?.displayName;
        const foundIndex = models.findIndex(m => m.name === assignedName);
        return foundIndex >= 0 ? foundIndex : 0;
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
                continueBtn.innerHTML = 'Please read...';
                continueBtn.disabled = true;
                continueBtn.style.opacity = '0.6';
            } else {
                continueBtn.innerHTML = `
                    Start Study
                    <svg class="nav-icon" viewBox="0 0 24 24">
                        <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                    </svg>
                `;
                continueBtn.onclick = () => this.hideWelcomeExperience();
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

        const validateInput = () => {
            const value = input.value.trim();
            const isValid = /^[a-zA-Z0-9]{24}$/.test(value);

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

        validateInput();
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

        // Handle continue button based on loading states
        if (this.welcomeState.configAssignmentLoading) {
            return; // Button state managed by assignment process
        }

        if (this.welcomeState.isTransitioning ||
            (this.welcomeState.currentStep === 2 && this.welcomeState.isAnimating)) {
            continueBtn.style.opacity = '0.6';
            continueBtn.disabled = true;
            return;
        }

        continueBtn.style.opacity = '1';
        continueBtn.disabled = false;

        // Set button content and action based on step
        if (this.welcomeState.currentStep === 0) {
            continueBtn.innerHTML = 'Continue <svg class="nav-icon" viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
            continueBtn.onclick = () => this.renderWelcomeStep(1);
        } else if (this.welcomeState.currentStep === 1) {
            continueBtn.innerHTML = 'Get Configuration <svg class="nav-icon" viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
            continueBtn.onclick = () => this.handleProlificSubmission();
        }
        // Step 2 button is handled by the countdown system
    }

    /**
     * Show input validation error
     */
    showInputError(message) {
        const errorDiv = document.getElementById('input-error');
        const input = document.getElementById('prolific-input');
        
        input.classList.add('error');
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        
        // Clear error after a few seconds
        setTimeout(() => {
            input.classList.remove('error');
            errorDiv.classList.remove('show');
        }, 5000);
    }

    /**
     * Show study exhausted modal
     */
    showStudyExhaustedModal(errorData) {
        const modal = document.getElementById('error-modal');
        const titleEl = modal.querySelector('.error-modal-header h3');
        const bodyEl = modal.querySelector('.error-modal-body > p');
        const errorCodeSpan = document.getElementById('error-code');
        
        titleEl.textContent = '📋 Study Complete';
        bodyEl.innerHTML = `
            This study has reached capacity and is no longer accepting new participants.<br><br>
            <strong>Thank you for your interest!</strong> Please return this study on Prolific so others can participate.
        `;
        
        errorCodeSpan.textContent = `${errorData.code}_${Date.now()}`;
        
        // Hide try again button for this error type
        const tryAgainBtn = document.getElementById('error-try-again');
        if (tryAgainBtn) tryAgainBtn.style.display = 'none';
        
        modal.style.display = 'flex';
    }

    /**
     * Show database error modal
     */
    showDatabaseError(errorData) {
        const modal = document.getElementById('error-modal');
        const titleEl = modal.querySelector('.error-modal-header h3');
        const bodyEl = modal.querySelector('.error-modal-body > p');
        const errorCodeSpan = document.getElementById('error-code');
        const participantIdSpan = document.getElementById('error-participant-id');
        
        titleEl.textContent = '⚠️ Technical Issue';
        bodyEl.textContent = errorData.userMessage || 'We\'re experiencing technical difficulties. Please report this error.';
        
        errorCodeSpan.textContent = `${errorData.code}_${Date.now()}`;
        participantIdSpan.textContent = this.participantId || 'Not Set';
        
        // Show try again button for retryable errors
        const tryAgainBtn = document.getElementById('error-try-again');
        if (tryAgainBtn) {
            tryAgainBtn.style.display = errorData.code === 'NETWORK_ERROR' ? 'block' : 'none';
        }
        
        modal.style.display = 'flex';
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

    // ===================================================================
    // MAIN APPLICATION INITIALIZATION
    // ===================================================================

    async initializeMainApp() {
        this.setupEventListeners();
        this.updateUI();
        this.createNewConversation();
        this.setupTextareaAutoResize();
        this.startSessionTimer();
        this.initializeBehaviorTracking();
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
            // Reset conversation state for new task
            this.currentConversationId = null;
            this.currentChatlog = [];
            this.updateFinishButton();
            this.createNewConversation();
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
    // MESSAGE & CHAT HANDLING
    // ===================================================================

    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) {
            console.log('⚠️ [Message] Empty message, skipping send');
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

            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            await this.handleStreamResponse(response);

        } catch (error) {
            console.error('LLM response failed:', error.message);
            this.hideAllIndicators();
            this.showErrorModal(error, 'chat');
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
        const indicators = ['typing-indicator', 'image-generation-indicator'];
        indicators.forEach(id => {
            const indicator = document.getElementById(id);
            if (indicator) indicator.remove();
        });
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

        finishBtn.disabled = true;
        this.showFinishLoadingIndicator();

        try {
            await this.saveCurrentTaskData();

            const exportData = this.prepareExportData();
            await this.downloadConversationData(exportData);
            
            // Save to GitHub (keeping existing functionality)
            await this.saveToServer();
            
            // NEW: Confirm completion in database
            await this.confirmStudyCompletion();

            this.closeApplication();

        } catch (error) {
            console.error('❌ [Study] Completion failed:', error.message);
            alert('There was an error completing the study. Please try again or contact support.');
            this.hideFinishLoadingIndicator();
            finishBtn.disabled = false;
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
            studyVersion: "3.0"
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

    showErrorModal(error, context = 'chat') {
        const modal = document.getElementById('error-modal');
        const errorCodeSpan = document.getElementById('error-code');
        const participantIdSpan = document.getElementById('error-participant-id');

        // Generate error code
        let errorCode = 'UNKNOWN';
        if (error.status) {
            errorCode = `HTTP_${error.status}`;
        } else if (error.message) {
            if (error.message.includes('fetch')) errorCode = 'NETWORK_ERROR';
            else if (error.message.includes('JSON')) errorCode = 'PARSE_ERROR';
            else if (error.message.includes('timeout')) errorCode = 'TIMEOUT_ERROR';
            else errorCode = 'API_ERROR';
        }

        const timestamp = new Date().toISOString().substring(0, 19).replace('T', '_');
        errorCode += `_${context.toUpperCase()}_${timestamp}`;

        errorCodeSpan.textContent = errorCode;
        participantIdSpan.textContent = this.participantId || 'Not Set';

        modal.style.display = 'flex';
        this.setupErrorModalListeners();
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

    // ===================================================================
    // PAGE LIFECYCLE MANAGEMENT
    // ===================================================================

    async handlePageClose(event) {
        this.stopSessionTimer();

        if (this.isFinishing) return;

        if (event && !this._isDelayedClose) {
            event.preventDefault();
            event.returnValue = 'Saving...';

            this._isDelayedClose = true;
            this.showSavingIndicator();

            // NEW: Release database configuration instead of old session system
            await this.releaseDatabaseConfiguration();
            await new Promise(resolve => setTimeout(resolve, 500));

            window.location.reload();
            return;
        }

        // Auto-save on close (still save to GitHub)
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

    // ===================================================================
    // EVENT LISTENER SETUP
    // ===================================================================

    setupEventListeners() {
        // Remove any existing listeners by replacing elements
        this.replaceElementsToRemoveListeners();

        // Set up new event listeners
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
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