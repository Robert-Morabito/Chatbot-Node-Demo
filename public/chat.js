/**
 * ===================================================================
 * CHATBOT INTERFACE - MAIN APPLICATION CLASS
 * ===================================================================
 * 
 * Main class that handles all chat functionality including:
 * - Welcome experience and onboarding
 * - Task-based conversation management
 * - API communication with different LLM providers
 * - Behavior tracking and analytics
 * - Data persistence and session management
 * 
 * @author Research Team
 * @version 2.0
 */

class ChatApp {
    /**
     * ===================================================================
     * CONSTRUCTOR & INITIALIZATION
     * ===================================================================
     */
    
    constructor() {
        // Core identifiers
        this.participantId = null;
        this.sessionId = null;
        this.configurationId = null;
        this.isFinishing = false;

        // Task-based conversation storage
        this.taskConversations = {
            'image-generation': new Map(),
            'social-media': new Map(),
            'acronym-building': new Map()
        };

        // Current state
        this.currentTask = 'image-generation';
        this.currentConversationId = null;
        this.currentChatlog = [];
        this.msgWidgets = {};
        this.messageIdCounter = 0;

        // UI state
        this.currentTheme = 'dark';
        this.autoSaveTimeout = null;
        
        // Welcome system
        this.welcomeSteps = [];
        this.currentStepIndex = 0;
        this.isTransitioning = false;

        // Timing and session tracking
        this.sessionStartTime = Date.now();
        this.sessionTimer = {
            startTime: null,
            intervalId: null,
            isRunning: false
        };

        // Image generation context
        this.imageContext = {
            lastPrompt: null,
            lastImageUrl: null,
            conversationHasImage: false
        };

        // Behavior tracking
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
                shortName: 'Images',
                description: 'Use this chat to generate some detailed images!'
            },
            'social-media': {
                name: 'Social Media Posts',
                icon: '📱',
                shortName: 'Social',
                description: 'Use this chat to write a convincing outreach message!'
            },
            'acronym-building': {
                name: 'Acronym Building',
                icon: '🔤',
                shortName: 'Acronyms',
                description: 'Use this chat to create some funny acronyms!'
            }
        };

        // Model families for comparison
        this.modelFamilies = {
            'GPT-3.5': {
                models: [
                    {
                        name: 'GPT-3.5',
                        displayName: 'GPT-3.5',
                        capabilities: { creativity: 2, professionalWriting: 3, speed: 5 },
                        lmArena: { instructionFollowing: 1245, creativeWriting: 1189, hardPrompts: 1156 }
                    },
                    {
                        name: 'GPT-4',
                        displayName: 'GPT-4',
                        capabilities: { creativity: 4, professionalWriting: 5, speed: 3 },
                        lmArena: { instructionFollowing: 1348, creativeWriting: 1304, hardPrompts: 1289 }
                    },
                    {
                        name: 'o1-Preview',
                        displayName: 'o1-Preview',
                        capabilities: { creativity: 5, professionalWriting: 4, speed: 1 },
                        lmArena: { instructionFollowing: 1405, creativeWriting: 1367, hardPrompts: 1398 }
                    }
                ]
            },
            'Claude 3 Haiku': {
                models: [
                    {
                        name: 'Claude 3 Haiku',
                        displayName: 'Claude 3 Haiku',
                        capabilities: { creativity: 2, professionalWriting: 3, speed: 5 },
                        lmArena: { instructionFollowing: 1234, creativeWriting: 1178, hardPrompts: 1145 }
                    },
                    {
                        name: 'Claude 3.5 Sonnet',
                        displayName: 'Claude 3.5 Sonnet',
                        capabilities: { creativity: 4, professionalWriting: 4, speed: 4 },
                        lmArena: { instructionFollowing: 1356, creativeWriting: 1312, hardPrompts: 1298 }
                    },
                    {
                        name: 'Claude 3.7 Sonnet',
                        displayName: 'Claude 3.7 Sonnet',
                        capabilities: { creativity: 5, professionalWriting: 5, speed: 2 },
                        lmArena: { instructionFollowing: 1412, creativeWriting: 1389, hardPrompts: 1405 }
                    }
                ]
            }
        };

        // Default configuration (will be overridden)
        this.config = {
            givenModel: 'GPT-4',
            trueModel: 'gpt-4-turbo',
            displayName: 'GPT-4'
        };

        // Idle tracking
        this.idleThreshold = 5000;
        this.idleCheckInterval = null;

        // Initialize the application
        this.initializeApp();
    }

    /**
     * ===================================================================
     * APPLICATION INITIALIZATION
     * ===================================================================
     */

    /**
     * Initialize the complete application
     * Shows welcome experience first, then loads config in background
     */
    async initializeApp() {
        try {
            // Initialize and show welcome experience immediately
            this.initializeWelcomeExperience();
            this.showWelcomeExperience();

            // Load configuration in the background
            await this.loadConfiguration();
            this.setupReleaseHandler();

            // Update welcome steps with loaded configuration
            this.buildWelcomeSteps();

            // Refresh current step if needed
            if (this.currentStepIndex >= 1) {
                this.renderWelcomeStep(this.currentStepIndex, true);
            }

        } catch (error) {
            console.error('App initialization failed:', error);
            this.setupReleaseHandler(); // Still set up release handler
        }
    }

    /**
     * Initialize the main chat application after welcome completion
     */
    async init() {
        // Setup all core functionality
        this.setupEventListeners();
        this.updateBotName();
        this.updateTaskHeader();
        this.createNewConversation();
        this.setupTextareaAutoResize();
        this.startSessionTimer();
        this.initializeBehaviorTracking();
        this.setupFinishButton();
    }

    /**
     * ===================================================================
     * CONFIGURATION MANAGEMENT
     * ===================================================================
     */

    /**
     * Load model configuration from server
     * @returns {Promise<boolean>} Success status
     */
    async loadConfiguration() {
        try {
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
                this.config = {
                    givenModel: data.configuration.displayedModel,
                    trueModel: data.configuration.actualModel,
                    displayName: data.configuration.displayedModel
                };
                return true;
            } else {
                throw new Error('Failed to get configuration assignment');
            }
        } catch (error) {
            console.error('Configuration loading failed:', error);
            // Use fallback configuration
            this.sessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.configurationId = 1;
            return false;
        }
    }

    /**
     * Register session with participant ID
     * @returns {Promise<void>}
     */
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
                console.warn('Session registration failed');
            }
        } catch (error) {
            console.warn('Session registration error:', error);
        }
    }

    /**
     * ===================================================================
     * WELCOME EXPERIENCE SYSTEM
     * ===================================================================
     */

    /**
     * Initialize the welcome experience components
     */
    initializeWelcomeExperience() {
        this.welcomeSteps = [];
        this.currentStepIndex = 0;
        this.isTransitioning = false;
        this.buildWelcomeSteps();
        this.setupWelcomeEventListeners();
    }

    /**
     * Build the welcome steps based on current configuration
     */
    buildWelcomeSteps() {
        const displayName = this.config?.displayName || 'GPT-4';

        this.welcomeSteps = [
            // Step 1: Welcome/Intro
            {
                id: 'welcome',
                title: 'Welcome to Our Study',
                content: `
                    <div class="content-card">
                        <h1 class="content-title">Research Study</h1>
                        <p class="content-subtitle">Thank you for participating in this important research</p>
                        <div class="content-body">
                            <div class="welcome-instructions">
                                <h3>Study Instructions</h3>
                                <p>Complete all tasks in the provided <a href="https://tally.so/r/wz8yra">Tally Survey</a> alongside this conversation interface. The following screen will show you details about your AI conversation partner. Click "Finish" when done to download your data and complete the study.</p>
                            </div>
                        </div>
                    </div>
                `
            },

            // Step 2: Animated Model Comparison
            {
                id: 'model-comparison',
                title: 'Meet Your AI Partner',
                content: `
                    <div class="content-card comparison-card">
                        <h1 class="content-title">AI Model Comparison</h1>
                        <p class="content-subtitle">See how different models compare for your tasks</p>
                        <div id="comparison-container" class="comparison-container">
                            <!-- Dynamic comparison table will be inserted here -->
                        </div>
                        <div id="capability-cards" class="capability-cards-container">
                            <!-- Capability cards will be inserted here -->
                        </div>
                    </div>
                `
            },

            // Step 3: Prolific ID
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

    /**
     * Show the welcome experience overlay
     */
    showWelcomeExperience() {
        const experience = document.getElementById('welcome-experience');
        const appContainer = document.querySelector('.app-container');
        
        // Hide main app and show welcome
        appContainer.style.display = 'none';
        experience.style.display = 'block';

        // Update total steps
        document.getElementById('total-steps').textContent = this.welcomeSteps.length;

        // Force reflow and show
        requestAnimationFrame(() => {
            experience.classList.add('active');
            this.renderWelcomeStep(0);
        });
    }

    /**
     * Hide the welcome experience and show main app
     */
    hideWelcomeExperience() {
        const experience = document.getElementById('welcome-experience');
        const appContainer = document.querySelector('.app-container');
        
        experience.classList.remove('active');

        setTimeout(() => {
            experience.style.display = 'none';
            appContainer.style.display = 'grid';
            appContainer.classList.add('ready');
            this.init(); // Start the main app
        }, 600);
    }

    /**
     * Render a specific welcome step
     * @param {number} stepIndex - Step index to render
     * @param {boolean} skipTimer - Skip timer functionality
     */
    renderWelcomeStep(stepIndex, skipTimer = false) {
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
                const navigation = document.querySelector('.navigation-system');
                navigation.classList.add('visible');
            } else if (step.id === 'model-comparison') {
                const navigation = document.querySelector('.navigation-system');
                navigation.classList.add('visible');
                const continueBtn = document.getElementById('nav-continue');
                continueBtn.disabled = true;
                
                setTimeout(() => {
                    this.startComparisonAnimation();
                }, 500);
            } else {
                const navigation = document.querySelector('.navigation-system');
                navigation.classList.add('visible');
            }
        });

        this.updateWelcomeNavigation(stepIndex);
    }

    /**
     * Update welcome progress indicator
     * @param {number} stepIndex - Current step index
     */
    updateWelcomeProgress(stepIndex) {
        const progress = ((stepIndex + 1) / this.welcomeSteps.length) * 100;
        const indicator = document.getElementById('progress-indicator');
        const currentStep = document.getElementById('current-step');

        indicator.style.width = `${progress}%`;
        currentStep.textContent = stepIndex + 1;
    }

    /**
     * Update welcome navigation buttons
     * @param {number} stepIndex - Current step index
     */
    updateWelcomeNavigation(stepIndex) {
        const backBtn = document.getElementById('nav-back');
        const continueBtn = document.getElementById('nav-continue');

        backBtn.disabled = stepIndex === 0;

        if (stepIndex === this.welcomeSteps.length - 1) {
            continueBtn.innerHTML = `
                Start Study
                <svg class="nav-icon" viewBox="0 0 24 24">
                    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                </svg>
            `;
        } else {
            continueBtn.innerHTML = `
                Continue
                <svg class="nav-icon" viewBox="0 0 24 24">
                    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                </svg>
            `;
        }

        if (this.welcomeSteps[stepIndex].id === 'prolific-id') {
            continueBtn.disabled = true;
        } else {
            continueBtn.disabled = false;
        }
    }

    /**
     * Setup event listeners for welcome navigation
     */
    setupWelcomeEventListeners() {
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

    /**
     * ===================================================================
     * MODEL COMPARISON SYSTEM
     * ===================================================================
     */

    /**
     * Start the animated model comparison sequence
     */
    async startComparisonAnimation() {
        const container = document.getElementById('comparison-container');
        const cardsContainer = document.getElementById('capability-cards');

        if (!container) return;

        // Get the model family for the user's assigned model
        const userModel = this.config?.displayName || 'GPT-4';
        const family = this.getModelFamily(userModel);
        const models = this.modelFamilies[family]?.models || this.modelFamilies['GPT-3.5'].models;

        // Create the comparison table
        this.createComparisonTable(container, models, userModel);

        // Create capability cards
        this.createCapabilityCards(cardsContainer, userModel);

        // Start the animation sequence
        await this.animateComparison(models, userModel);
    }

    /**
     * Get model family for a given model name
     * @param {string} modelName - Model display name
     * @returns {string} Model family key
     */
    getModelFamily(modelName) {
        for (const [family, data] of Object.entries(this.modelFamilies)) {
            if (data.models.some(model => model.displayName === modelName)) {
                return family;
            }
        }
        return 'GPT-3.5'; // fallback
    }

    /**
     * Create the comparison table HTML
     * @param {HTMLElement} container - Container element
     * @param {Array} models - Model data array
     * @param {string} userModel - User's assigned model
     */
    createComparisonTable(container, models, userModel) {
        const metrics = [
            { key: 'creativity', label: 'Creativity', type: 'bubble' },
            { key: 'professionalWriting', label: 'Professional Writing', type: 'bubble' },
            { key: 'speed', label: 'Speed', type: 'bubble' },
            { key: 'instructionFollowing', label: 'Instruction Following', type: 'score', category: 'lmArena' },
            { key: 'creativeWriting', label: 'Creative Writing', type: 'score', category: 'lmArena' },
            { key: 'hardPrompts', label: 'Hard Prompts', type: 'score', category: 'lmArena' }
        ];

        let html = '<div class="comparison-table">';

        // Empty top-left cell
        html += '<div></div>';

        // Model headers
        models.forEach((model, index) => {
            const isUserModel = model.displayName === userModel;
            html += `
                <div class="model-header${isUserModel ? ' highlight' : ''}" data-model="${model.displayName}" style="animation-delay: ${index * 0.3}s">
                    <div class="model-name">${model.displayName}</div>
                    <div class="model-subtitle">${this.getModelSubtitle(model.displayName)}</div>
                    ${isUserModel ? '<div class="model-popup">This is your model today!</div>' : ''}
                </div>
            `;
        });

        // Metric rows
        metrics.forEach((metric, rowIndex) => {
            html += `<div class="metric-label">${metric.label}</div>`;

            models.forEach((model, colIndex) => {
                const isUserModel = model.displayName === userModel;
                const value = metric.category ? model[metric.category][metric.key] : model.capabilities[metric.key];

                html += `
                    <div class="metric-cell${isUserModel ? ' highlight' : ''}" data-metric="${metric.key}" data-model="${model.displayName}">
                        ${metric.type === 'bubble' ? this.createBubbleRating(value) : this.createScoreDisplay(value)}
                    </div>
                `;
            });
        });

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Create bubble rating HTML
     * @param {number} rating - Rating value (1-5)
     * @returns {string} HTML string
     */
    createBubbleRating(rating) {
        let html = '<div class="bubble-rating">';
        for (let i = 1; i <= 5; i++) {
            html += `<div class="rating-bubble${i <= rating ? ' filled' : ''}" data-bubble="${i}"></div>`;
        }
        html += '</div>';
        return html;
    }

    /**
     * Create score display HTML
     * @param {number} score - Score value
     * @returns {string} HTML string
     */
    createScoreDisplay(score) {
        return `<div class="lmarena-score"><span class="score-counter" data-target="${score}">0</span></div>`;
    }

    /**
     * Get model subtitle description
     * @param {string} modelName - Model name
     * @returns {string} Subtitle text
     */
    getModelSubtitle(modelName) {
        const subtitles = {
            'GPT-3.5': 'Legacy model, optimized for speed',
            'GPT-4': 'Balanced performance and capability',
            'o1-Preview': 'Advanced reasoning and creativity',
            'Claude 3 Haiku': 'Fast responses, basic capabilities',
            'Claude 3.5 Sonnet': 'Well-rounded performance',
            'Claude 3.7 Sonnet': 'Cutting-edge reasoning'
        };
        return subtitles[modelName] || 'Advanced AI model';
    }

    /**
     * Orchestrate the comparison animation sequence
     * @param {Array} models - Model data array
     * @param {string} userModel - User's assigned model
     */
    async animateComparison(models, userModel) {
        // 1. Fade in table
        await this.delay(300);
        document.getElementById('comparison-container').classList.add('animate-in');

        // 2. Animate model headers
        await this.delay(800);
        const headers = document.querySelectorAll('.model-header');
        for (let i = 0; i < headers.length; i++) {
            await this.delay(300);
            headers[i].classList.add('animate-in');
        }

        // 3. Animate capability bubbles
        await this.delay(500);
        await this.animateBubbles();

        // 4. Animate LMArena scores
        await this.delay(300);
        await this.animateScores();

        // 5. Show user model popup
        await this.delay(500);
        const popup = document.querySelector('.model-popup');
        if (popup) {
            popup.classList.add('show');
            await this.delay(2000);
            popup.classList.remove('show');
            await this.delay(500);
        }

        // 6. Scale down table and show capability cards
        document.getElementById('comparison-container').classList.add('scale-down');
        await this.delay(800);

        document.getElementById('capability-cards').classList.add('show');
        await this.animateCapabilityCards();

        // 7. Enable continue button
        await this.delay(300);
        const continueBtn = document.getElementById('nav-continue');
        continueBtn.disabled = false;
        continueBtn.classList.add('pulse');
    }

    /**
     * Animate capability bubbles filling
     */
    async animateBubbles() {
        const metrics = ['creativity', 'professionalWriting', 'speed'];

        for (const metric of metrics) {
            const cells = document.querySelectorAll(`[data-metric="${metric}"]`);
            for (const cell of cells) {
                const bubbles = cell.querySelectorAll('.rating-bubble.filled');
                for (let i = 0; i < bubbles.length; i++) {
                    await this.delay(100);
                    bubbles[i].classList.add('animate-fill');
                }
            }
            await this.delay(200);
        }
    }

    /**
     * Animate LMArena score counters
     */
    async animateScores() {
        const scoreElements = document.querySelectorAll('.score-counter');
        const promises = Array.from(scoreElements).map(el => this.animateCounter(el));
        await Promise.all(promises);
    }

    /**
     * Animate individual counter element
     * @param {HTMLElement} element - Counter element
     * @returns {Promise} Animation promise
     */
    animateCounter(element) {
        return new Promise(resolve => {
            const target = parseInt(element.dataset.target);
            const duration = 1000;
            const start = performance.now();

            const animate = (current) => {
                const elapsed = current - start;
                const progress = Math.min(elapsed / duration, 1);

                // Ease out cubic
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const value = Math.round(easeOut * target);

                element.textContent = value.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    /**
     * Animate capability cards entrance
     */
    async animateCapabilityCards() {
        const cards = document.querySelectorAll('.capability-card');
        for (let i = 0; i < cards.length; i++) {
            await this.delay(200);
            cards[i].classList.add('animate-in');
        }
    }

    /**
     * Create capability cards HTML
     * @param {HTMLElement} container - Container element
     * @param {string} userModel - User's assigned model
     */
    createCapabilityCards(container, userModel) {
        const capabilities = this.getModelCapabilities(userModel);

        const html = `
            <div class="capability-cards">
                <div class="capability-card strength">
                    <h4>Strengths</h4>
                    <p>${capabilities.strengths}</p>
                </div>
                <div class="capability-card weakness">
                    <h4>Areas for Improvement</h4>
                    <p>${capabilities.weaknesses}</p>
                </div>
                <div class="capability-card use-case">
                    <h4>Best Applications</h4>
                    <p>${capabilities.useCases}</p>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Get model capabilities description
     * @param {string} modelName - Model name
     * @returns {Object} Capabilities object
     */
    getModelCapabilities(modelName) {
        const capabilities = {
            'GPT-3.5': {
                strengths: 'Quick responses and efficient processing for straightforward tasks',
                weaknesses: 'Limited creativity and may struggle with complex reasoning',
                useCases: 'Simple questions, basic writing tasks, and quick information retrieval'
            },
            'GPT-4': {
                strengths: 'Strong balance of creativity, reasoning, and professional writing capabilities',
                weaknesses: 'Moderate speed, occasionally verbose responses',
                useCases: 'Professional communication, creative projects, and analytical tasks'
            },
            'o1-Preview': {
                strengths: 'Exceptional creativity and advanced reasoning for complex problems',
                weaknesses: 'Slower processing time due to thorough analysis',
                useCases: 'Creative challenges, complex problem-solving, and innovative thinking'
            },
            'Claude 3 Haiku': {
                strengths: 'Extremely fast responses for basic queries and simple tasks',
                weaknesses: 'Limited depth in creative and complex reasoning tasks',
                useCases: 'Quick answers, simple writing, and basic information processing'
            },
            'Claude 3.5 Sonnet': {
                strengths: 'Well-rounded performance across writing, analysis, and creative tasks',
                weaknesses: 'May lack the originality of more advanced models',
                useCases: 'Balanced professional and creative projects, comprehensive analysis'
            },
            'Claude 3.7 Sonnet': {
                strengths: 'Outstanding creativity, insight, and professional writing quality',
                weaknesses: 'Slower when engaging deep-thinking mode for maximum accuracy',
                useCases: 'High-level creative work, complex analysis, and innovative solutions'
            }
        };

        return capabilities[modelName] || capabilities['GPT-4'];
    }

    /**
     * ===================================================================
     * PROLIFIC ID VALIDATION
     * ===================================================================
     */

    /**
     * Setup Prolific ID input validation
     */
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

        validateInput();
    }

    /**
     * Handle Prolific ID submission
     */
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
            setTimeout(() => {
                this.hideWelcomeExperience();
            }, 800);
        } catch (error) {
            console.error('Session registration failed:', error);
            continueBtn.innerHTML = originalContent;
            continueBtn.disabled = false;
        }
    }

    /**
     * ===================================================================
     * TASK MANAGEMENT SYSTEM
     * ===================================================================
     */

    /**
     * Switch to a different task
     * @param {string} taskId - Task identifier
     */
    switchToTask(taskId) {
        // Track task switch timing
        const oldTask = this.currentTask;
        if (oldTask !== taskId) {
            const now = Date.now();
            this.behaviorMetrics.taskMetrics[oldTask].timeSpent += now - this.sessionStartTime;
        }

        // Save current conversation if any
        if (this.currentConversationId) {
            const currentTaskConversations = this.taskConversations[this.currentTask];
            const currentConv = currentTaskConversations.get(this.currentConversationId);
            if (currentConv) {
                currentConv.messages = [...this.currentChatlog];
                currentConv.lastMessageAt = new Date();
            }
        }

        // Switch task
        this.currentTask = taskId;

        // Update UI
        this.updateTaskTabs();
        this.updateTaskHeader();

        // Check if task has conversations, if not create default
        const taskConversations = this.taskConversations[this.currentTask];
        if (taskConversations.size === 0) {
            this.createNewConversation();
        } else {
            // Switch to most recent conversation
            const sortedConversations = Array.from(taskConversations.values())
                .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

            if (sortedConversations.length > 0) {
                this.switchToConversation(sortedConversations[0].id);
            } else {
                this.currentConversationId = null;
                this.currentChatlog = [];
                this.showWelcomeMessage();
            }
        }

        this.updateConversationList();
    }

    /**
     * Update task tab visual states
     */
    updateTaskTabs() {
        const tabs = document.querySelectorAll('.task-tab');
        tabs.forEach(tab => {
            const taskId = tab.dataset.task;
            if (taskId === this.currentTask) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    /**
     * Update task header display
     */
    updateTaskHeader() {
        const taskHeader = document.getElementById('task-header');
        const taskTitle = taskHeader.querySelector('.task-title');
        const config = this.taskConfig[this.currentTask];
        taskTitle.textContent = config.name;
    }

    /**
     * ===================================================================
     * CONVERSATION MANAGEMENT
     * ===================================================================
     */

    /**
     * Create a new conversation for current task
     */
    createNewConversation() {
        // Increment conversation count for current task
        this.behaviorMetrics.conversationCount++;
        this.behaviorMetrics.taskMetrics[this.currentTask].conversations++;

        const conversationId = `${this.currentTask}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const conversation = {
            id: conversationId,
            task: this.currentTask,
            title: 'New Chat',
            messages: [],
            createdAt: new Date(),
            lastMessageAt: new Date()
        };

        // Add to appropriate task conversation map
        this.taskConversations[this.currentTask].set(conversationId, conversation);

        // Switch to new conversation
        this.switchToConversation(conversationId);

        // Update UI
        this.updateConversationList();
        this.updateTaskHeader();

        // Show welcome message
        this.showWelcomeMessage();
    }

    /**
     * Switch to a specific conversation
     * @param {string} conversationId - Conversation identifier
     */
    switchToConversation(conversationId) {
        // Only count as switch if actually changing conversations
        if (this.currentConversationId && this.currentConversationId !== conversationId) {
            this.behaviorMetrics.conversationSwitches++;
        }

        // Save current conversation state
        if (this.currentConversationId) {
            const currentTaskConversations = this.taskConversations[this.currentTask];
            const currentConv = currentTaskConversations.get(this.currentConversationId);
            if (currentConv) {
                currentConv.messages = [...this.currentChatlog];
            }
        }

        // Switch to new conversation
        this.currentConversationId = conversationId;
        const taskConversations = this.taskConversations[this.currentTask];
        const conversation = taskConversations.get(conversationId);

        if (conversation) {
            this.currentChatlog = [...conversation.messages];
            this.renderConversation();
            this.updateConversationList();
        }
    }

    /**
     * Render the current conversation messages
     */
    renderConversation() {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        this.msgWidgets = {};

        if (this.currentChatlog.length === 0) {
            this.showWelcomeMessage();
        } else {
            this.currentChatlog.forEach(msg => {
                this.renderMessage(msg, false);
            });
            this.scrollToBottom();
        }
    }

    /**
     * Show welcome message for current task
     */
    showWelcomeMessage() {
        const messagesContainer = document.getElementById('messages');
        const config = this.taskConfig[this.currentTask];

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

    /**
     * Update conversation list display
     */
    updateConversationList() {
        const conversationList = document.getElementById('conversation-list');
        const taskConversations = this.taskConversations[this.currentTask];

        // Get existing conversation elements
        const existingItems = new Set();
        conversationList.querySelectorAll('.conversation-item').forEach(item => {
            const convId = item.dataset.conversationId;
            if (convId) existingItems.add(convId);
        });

        // Sort conversations by last message time
        const sortedConversations = Array.from(taskConversations.values())
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        // Clear and rebuild
        conversationList.innerHTML = '';

        if (sortedConversations.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-task-state';
            emptyState.innerHTML = `
                <div class="empty-icon">${this.taskConfig[this.currentTask].icon}</div>
                <p>No conversations yet</p>
                <p>Click "New Chat" to get started</p>
            `;
            conversationList.appendChild(emptyState);
            return;
        }

        sortedConversations.forEach((conversation, index) => {
            const conversationItem = document.createElement('div');
            conversationItem.className = 'conversation-item';
            conversationItem.dataset.conversationId = conversation.id;
            conversationItem.dataset.task = conversation.task;

            // Only animate NEW conversation items
            const isExisting = existingItems.has(conversation.id);
            if (!isExisting) {
                conversationItem.style.animationDelay = `${index * 0.1}s`;
            } else {
                conversationItem.style.opacity = '1';
                conversationItem.style.transform = 'translateX(0)';
                conversationItem.style.animation = 'none';
            }

            // Set active state
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

    /**
     * Update conversation title based on first message
     * @param {string} firstMessage - First message content
     */
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

    /**
     * Auto-save current conversation
     */
    autoSaveConversation() {
        if (!this.currentConversationId) return;

        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Set new timeout for auto-save
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

    /**
     * Show auto-save indicator
     */
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

    /**
     * ===================================================================
     * MESSAGE HANDLING SYSTEM
     * ===================================================================
     */

    /**
     * Send a new message
     */
    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) return;

        // If no current conversation, create one
        if (!this.currentConversationId) {
            this.createNewConversation();
        }

        // Track metrics
        this.behaviorMetrics.taskMetrics[this.currentTask].messages++;
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
            timestamp: new Date(),
            task: this.currentTask
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

    /**
     * Render a message in the chat
     * @param {Object} msgInfo - Message information object
     * @param {boolean} autoScroll - Whether to auto-scroll after rendering
     */
    renderMessage(msgInfo, autoScroll = true) {
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
            if (displayedModel.toLowerCase().includes('claude')) {
                iconImg.src = 'images/claude.png';
            } else {
                iconImg.src = 'images/gpt.png';
            }
        }

        // Create content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.position = 'relative';

        // For bot messages, parse markdown
        if (msgInfo.sender === 'Bot') {
            contentDiv.innerHTML = marked.parse(msgInfo.content, {
                breaks: true,
                gfm: true,
                sanitize: false
            });
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
    }

    /**
     * Setup click handlers for images in messages
     * @param {HTMLElement} contentDiv - Content container
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
     * Show image in modal overlay
     * @param {string} imageSrc - Image source URL
     * @param {string} altText - Alt text for image
     */
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

    /**
     * Edit a message
     * @param {number} msgId - Message ID to edit
     */
    editMessage(msgId) {
        const widget = this.msgWidgets[msgId];
        if (!widget) return;

        // Track edit metrics
        this.behaviorMetrics.editCount++;

        // Calculate edit distance
        const currentMessages = Array.from(document.querySelectorAll('.message.user'));
        const editMessageIndex = currentMessages.findIndex(msg =>
            parseInt(msg.dataset.msgId) === msgId
        );
        const messagesBack = currentMessages.length - editMessageIndex - 1;
        this.behaviorMetrics.editDistances.push(messagesBack);

        const contentDiv = widget.element.querySelector('.message-content');
        const originalText = widget.info.content;

        // Check if edit mode is already active
        if (contentDiv.querySelector('.edit-mode')) {
            return;
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

    /**
     * Delete messages from a specific point
     * @param {number} fromMsgId - Starting message ID
     */
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

    /**
     * Show typing indicator
     */
    showTypingIndicator() {
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
        if (displayedModel.toLowerCase().includes('claude')) {
            iconImg.src = 'images/claude.png';
        } else {
            iconImg.src = 'images/gpt.png';
        }

        const typingContent = document.createElement('div');
        typingContent.className = 'typing-content';
        typingContent.innerHTML = '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

        typingDiv.appendChild(iconImg);
        typingDiv.appendChild(typingContent);
        messagesContainer.appendChild(typingDiv);

        this.scrollToBottom();
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    /**
     * Show image generation indicator
     */
    showImageGenerationIndicator() {
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

    /**
     * Hide image generation indicator
     */
    hideImageGenerationIndicator() {
        const imageGenIndicator = document.getElementById('image-generation-indicator');
        if (imageGenIndicator) {
            imageGenIndicator.remove();
        }
    }

    /**
     * ===================================================================
     * API COMMUNICATION
     * ===================================================================
     */

    /**
     * Get LLM response from API
     */
    async getLLMResponse() {
        try {
            // Prepare request data
            const requestData = {
                messages: this.currentChatlog,
                model: this.config.trueModel,
                sessionId: this.sessionId,
                conversationId: this.currentConversationId,
                imageContext: this.imageContext
            };

            // Make the API call
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.responseText = errorText;
                throw error;
            }

            // Process the stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let botMsg = null;
            let botMsgId = null;
            let fullResponse = '';
            let isImageGeneration = false;

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

                            if (data.type === 'error') {
                                const error = new Error(data.error || 'Stream error occurred');
                                error.context = 'stream';
                                throw error;
                            }

                            if (data.type === 'image_request_detected') {
                                isImageGeneration = true;
                                this.hideTypingIndicator();
                                this.showImageGenerationIndicator();

                            } else if (data.type === 'typing_start') {
                                // Keep the typing indicator visible for regular chat

                            } else if (data.type === 'content') {
                                if (!botMsg && !isImageGeneration) {
                                    // Hide typing indicator when first content arrives
                                    this.hideTypingIndicator();

                                    botMsgId = ++this.messageIdCounter;
                                    botMsg = {
                                        msg_id: botMsgId,
                                        sender: 'Bot',
                                        content: '',
                                        timestamp: new Date()
                                    };
                                    this.currentChatlog.push(botMsg);
                                    this.renderMessage(botMsg);
                                }

                                if (botMsg && !isImageGeneration) {
                                    fullResponse = data.fullContent;
                                    botMsg.content = fullResponse;

                                    const botElement = this.msgWidgets[botMsgId].element.querySelector('.message-content');
                                    if (botElement) {
                                        botElement.innerHTML = marked.parse(fullResponse, {
                                            breaks: true,
                                            gfm: true,
                                            sanitize: false
                                        });
                                        this.setupImageClickHandlers(botElement);
                                    }
                                    this.scrollToBottom();
                                } else if (isImageGeneration) {
                                    this.hideImageGenerationIndicator();

                                    botMsgId = ++this.messageIdCounter;
                                    botMsg = {
                                        msg_id: botMsgId,
                                        sender: 'Bot',
                                        content: data.fullContent,
                                        timestamp: new Date()
                                    };
                                    this.currentChatlog.push(botMsg);
                                    this.renderMessage(botMsg);

                                    if (data.imageUrl) {
                                        this.imageContext.lastPrompt = data.imagePrompt;
                                        this.imageContext.lastImageUrl = data.imageUrl;
                                        this.imageContext.conversationHasImage = true;
                                    }
                                }

                            } else if (data.type === 'done') {
                                this.hideImageGenerationIndicator();
                                this.hideTypingIndicator();
                                break;
                            }
                        } catch (parseError) {
                            console.error('JSON parse error:', parseError);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('API communication failed:', error);
            this.hideTypingIndicator();
            this.hideImageGenerationIndicator();
            this.showErrorModal(error, 'chat');
        }
    }

    /**
     * ===================================================================
     * DATA PERSISTENCE
     * ===================================================================
     */

    /**
     * Save data to server
     * @returns {Promise<Object>} Save result
     */
    async saveToServer() {
        try {
            const behaviorMetrics = this.calculateFinalMetrics();

            // Organize conversations by task
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
                taskMetrics: this.behaviorMetrics.taskMetrics
            };

            const response = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });

            const result = await response.json();

            if (response.ok) {
                return result;
            } else {
                const error = new Error(result.error || 'Save failed');
                error.status = response.status;
                throw error;
            }
        } catch (error) {
            console.error('Server save failed:', error);
            this.showErrorModal(error, 'save');
            throw error;
        }
    }

    /**
     * Manual save current conversation
     */
    manualSave() {
        if (this.currentChatlog.length === 0) {
            alert('No messages to save!');
            return;
        }

        // Force save current conversation
        this.autoSaveConversation();

        // Save to server
        this.saveToServer().then(result => {
            // Show confirmation
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

    /**
     * ===================================================================
     * SESSION MANAGEMENT
     * ===================================================================
     */

    /**
     * Mark session as completed on server
     * @returns {Promise<Object>} Completion result
     */
    async markSessionCompleted() {
        try {
            const response = await fetch('/api/sessions/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    participantId: this.participantId
                })
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

            return JSON.parse(responseText);
        } catch (error) {
            console.error('Session completion failed:', error);
            throw error;
        }
    }

    /**
     * Setup session release handler for page unload
     */
    setupReleaseHandler() {
        window.addEventListener('beforeunload', (e) => this.onClose(e));
    }

    /**
     * Handle page close/unload
     * @param {Event} event - Beforeunload event
     */
    async onClose(event) {
        this.stopSessionTimer();

        if (this.isFinishing) return;

        // Prevent immediate close and show brief message
        if (event && !this._isDelayedClose) {
            event.preventDefault();
            event.returnValue = 'Saving...';

            // Mark as delayed close
            this._isDelayedClose = true;

            // Show saving indicator
            this.showSavingIndicator();

            // Release reservation
            await this.releaseReservation();

            // Brief delay for GitHub commit
            await new Promise(resolve => setTimeout(resolve, 500));

            // Force close
            window.location.reload();
            return;
        }

        // Auto-save before closing
        if (this.currentConversationId && this.currentChatlog.length > 0) {
            const conversation = this.conversations?.get(this.currentConversationId);
            if (conversation) {
                conversation.messages = [...this.currentChatlog];
            }

            try {
                const behaviorMetrics = this.calculateFinalMetrics();
                const organizedConversations = {};
                for (const [taskId, conversations] of Object.entries(this.taskConversations)) {
                    organizedConversations[taskId] = Object.fromEntries(conversations);
                }

                const saveData = {
                    participantId: this.participantId,
                    sessionId: this.sessionId,
                    conversations: organizedConversations,
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

            } catch (error) {
                console.error('Error saving on close:', error);
                event.preventDefault();
                event.returnValue = 'Your data may not be saved. Are you sure you want to leave?';
                return event.returnValue;
            }
        }
    }

    /**
     * Show saving indicator overlay
     */
    showSavingIndicator() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.8);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            z-index: 99999;
        `;
        overlay.innerHTML = `
            <div>
                <div style="margin-bottom: 10px;">💾 Saving...</div>
                <div style="font-size: 14px; opacity: 0.7;">Please wait a moment</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    /**
     * Release configuration reservation
     * @returns {Promise<boolean>} Success status
     */
    async releaseReservation() {
        try {
            const response = await fetch('/api/sessions/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configurationId: this.configurationId })
            });

            return response.ok;
        } catch (error) {
            console.error('Release request failed:', error);
            return false;
        }
    }

    /**
     * ===================================================================
     * STUDY COMPLETION
     * ===================================================================
     */

    /**
     * Setup finish button functionality
     */
    setupFinishButton() {
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.style.display = 'flex';
        }
    }

    /**
     * Handle study completion
     */
    async handleFinishStudy() {
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

            // Ensure conversations are saved locally
            if (this.currentConversationId && this.currentChatlog.length > 0) {
                const taskConversations = this.taskConversations[this.currentTask];
                const conversation = taskConversations.get(this.currentConversationId);
                if (conversation) {
                    conversation.messages = [...this.currentChatlog];
                }
            }

            // Calculate final metrics
            const behaviorMetrics = this.calculateFinalMetrics();

            // Organize conversations by task
            const organizedConversations = {};
            for (const [taskId, conversations] of Object.entries(this.taskConversations)) {
                organizedConversations[taskId] = Object.fromEntries(conversations);
            }

            // Prepare export data
            const exportData = {
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
                studyVersion: "1.0"
            };

            // Download data
            await this.downloadConversationData(exportData);

            // Save to server
            await this.saveToServer();

            // Mark session as completed
            await this.markSessionCompleted();

            // Close application
            this.closeApplication();

        } catch (error) {
            console.error('Study completion failed:', error);
            alert('There was an error completing the study. Please try again or contact support.');
            this.hideFinishLoadingIndicator();
            finishBtn.disabled = false;
        }
    }

    /**
     * Show finish confirmation dialog
     * @returns {Promise<boolean>} User confirmation
     */
    showFinishConfirmationDialog() {
        return new Promise((resolve) => {
            const modal = document.getElementById('finish-confirmation-modal');
            modal.style.display = 'flex';
            this.finishDialogResolve = resolve;
        });
    }

    /**
     * Hide finish confirmation dialog
     * @param {boolean} confirmed - User confirmation status
     */
    hideFinishConfirmationDialog(confirmed) {
        const modal = document.getElementById('finish-confirmation-modal');
        modal.style.display = 'none';

        if (this.finishDialogResolve) {
            this.finishDialogResolve(confirmed);
            this.finishDialogResolve = null;
        }
    }

    /**
     * Show finish loading indicator
     */
    showFinishLoadingIndicator() {
        const indicator = document.getElementById('finish-loading-indicator');
        indicator.style.display = 'block';
    }

    /**
     * Hide finish loading indicator
     */
    hideFinishLoadingIndicator() {
        const indicator = document.getElementById('finish-loading-indicator');
        indicator.style.display = 'none';
    }

    /**
     * Download conversation data as JSON file
     * @param {Object} data - Data to download
     */
    async downloadConversationData(data) {
        try {
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

        } catch (error) {
            console.error('Download creation failed:', error);
            throw error;
        }
    }

    /**
     * Close the application
     */
    closeApplication() {
        this.stopSessionTimer();
        this.isFinishing = true;

        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) finishBtn.style.display = 'none';

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
    }

    /**
     * ===================================================================
     * BEHAVIOR TRACKING
     * ===================================================================
     */

    /**
     * Initialize behavior tracking systems
     */
    initializeBehaviorTracking() {
        // Track keystrokes and backspaces
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

        // Disable context menu on input
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

    /**
     * Update user activity timestamp
     */
    updateActivity() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.behaviorMetrics.lastUserActivity;

        if (timeSinceLastActivity > this.idleThreshold) {
            this.behaviorMetrics.totalIdleTime += timeSinceLastActivity;
        }

        this.behaviorMetrics.lastUserActivity = now;
    }

    /**
     * Update idle time calculation
     */
    updateIdleTime() {
        const idleDuration = Date.now() - this.behaviorMetrics.idleStartTime;
        if (idleDuration > this.idleThreshold) {
            this.behaviorMetrics.totalIdleTime += idleDuration;
        }
        this.behaviorMetrics.idleStartTime = Date.now();
    }

    /**
     * Start idle time tracking
     */
    startIdleTracking() {
        this.idleCheckInterval = setInterval(() => {
            const timeSinceLastActivity = Date.now() - this.behaviorMetrics.lastUserActivity;
            if (timeSinceLastActivity > this.idleThreshold) {
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

    /**
     * Calculate final behavior metrics
     * @returns {Object} Final metrics object
     */
    calculateFinalMetrics() {
        return {
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
    }

    /**
     * ===================================================================
     * UI & UX UTILITIES
     * ===================================================================
     */

    /**
     * Update bot name and interface elements
     */
    updateBotName() {
        document.getElementById('bot-name').textContent = `Currently Chatting with ${this.config.displayName}`;
        document.getElementById('header-participant-id').textContent = this.participantId;
        document.getElementById('welcome-model-name').textContent = this.config.displayName;
        document.title = `${this.config.displayName} - Study ${this.participantId}`;
    }

    /**
     * Toggle theme between light and dark
     */
    toggleTheme() {
        document.body.classList.toggle('light-theme');
        this.currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    }

    /**
     * Toggle sidebar collapsed state
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    /**
     * Toggle mobile sidebar overlay
     */
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

    /**
     * Get or create sidebar backdrop element
     * @returns {HTMLElement} Backdrop element
     */
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

    /**
     * Handle clicks outside sidebar on mobile
     * @param {Event} e - Click event
     */
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

    /**
     * Scroll chat container to bottom
     */
    scrollToBottom() {
        const chatContainer = document.getElementById('chat-container');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /**
     * Show notification message
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, warning)
     */
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

    /**
     * Setup textarea auto-resize functionality
     */
    setupTextareaAutoResize() {
        const textarea = document.getElementById('message-input');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        });
    }

    /**
     * ===================================================================
     * ERROR HANDLING
     * ===================================================================
     */

    /**
     * Show error modal with details
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    showErrorModal(error, context = 'chat') {
        console.error('Error occurred:', error);

        const modal = document.getElementById('error-modal');
        const errorCodeSpan = document.getElementById('error-code');
        const participantIdSpan = document.getElementById('error-participant-id');

        // Generate error code
        let errorCode = 'UNKNOWN';
        if (error.status) {
            errorCode = `HTTP_${error.status}`;
        } else if (error.message) {
            if (error.message.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
            } else if (error.message.includes('JSON')) {
                errorCode = 'PARSE_ERROR';
            } else if (error.message.includes('timeout')) {
                errorCode = 'TIMEOUT_ERROR';
            } else {
                errorCode = 'API_ERROR';
            }
        }

        // Add context and timestamp
        const timestamp = new Date().toISOString().substring(0, 19).replace('T', '_');
        errorCode += `_${context.toUpperCase()}_${timestamp}`;

        // Update modal content
        errorCodeSpan.textContent = errorCode;
        participantIdSpan.textContent = this.participantId || 'Not Set';

        // Show modal
        modal.style.display = 'flex';

        // Setup event listeners
        this.setupErrorModalListeners();
    }

    /**
     * Hide error modal
     */
    hideErrorModal() {
        const modal = document.getElementById('error-modal');
        modal.style.display = 'none';
    }

    /**
     * Setup error modal event listeners
     */
    setupErrorModalListeners() {
        const closeBtn = document.getElementById('error-modal-close');
        const closeBtn2 = document.getElementById('error-close');
        const tryAgainBtn = document.getElementById('error-try-again');

        // Remove existing listeners
        closeBtn.onclick = null;
        closeBtn2.onclick = null;
        tryAgainBtn.onclick = null;

        // Add new listeners
        closeBtn.onclick = () => this.hideErrorModal();
        closeBtn2.onclick = () => this.hideErrorModal();
        tryAgainBtn.onclick = () => {
            this.hideErrorModal();
            // Retry the last message
            if (this.currentChatlog.length > 0) {
                const lastMessage = this.currentChatlog[this.currentChatlog.length - 1];
                if (lastMessage.sender === 'User') {
                    this.showTypingIndicator();
                    setTimeout(() => this.getLLMResponse(), 500);
                }
            }
        };

        // Close on backdrop click
        const modal = document.getElementById('error-modal');
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.hideErrorModal();
            }
        };
    }

    /**
     * ===================================================================
     * SESSION TIMER
     * ===================================================================
     */

    /**
     * Start the session timer
     */
    startSessionTimer() {
        if (this.sessionTimer.isRunning) return;

        this.sessionTimer.startTime = Date.now();
        this.sessionTimer.isRunning = true;

        this.updateTimerDisplay();

        this.sessionTimer.intervalId = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }

    /**
     * Stop the session timer
     */
    stopSessionTimer() {
        if (this.sessionTimer.intervalId) {
            clearInterval(this.sessionTimer.intervalId);
            this.sessionTimer.intervalId = null;
        }
        this.sessionTimer.isRunning = false;
    }

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        if (!this.sessionTimer.startTime) return;

        const elapsed = Date.now() - this.sessionTimer.startTime;
        const formattedTime = this.formatElapsedTime(elapsed);

        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = formattedTime;
        }
    }

    /**
     * Format elapsed time as HH:MM:SS
     * @param {number} milliseconds - Elapsed time in milliseconds
     * @returns {string} Formatted time string
     */
    formatElapsedTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get elapsed session time
     * @returns {number} Elapsed time in milliseconds
     */
    getElapsedTime() {
        if (!this.sessionTimer.startTime) return 0;
        return Date.now() - this.sessionTimer.startTime;
    }

    /**
     * ===================================================================
     * EVENT HANDLERS SETUP
     * ===================================================================
     */

    /**
     * Setup all event listeners for the application
     */
    setupEventListeners() {
        // Get fresh elements to avoid duplicate listeners
        const elements = {
            sendBtn: document.getElementById('send-btn'),
            messageInput: document.getElementById('message-input'),
            newChatBtn: document.getElementById('new-chat-btn'),
            saveChatBtn: document.getElementById('save-chat-btn'),
            finishBtn: document.getElementById('finish-btn'),
            themeSwitch: document.getElementById('theme-switch'),
            sidebarToggle: document.getElementById('sidebar-toggle'),
            mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),
            finishCancelBtn: document.getElementById('finish-cancel-btn'),
            finishConfirmBtn: document.getElementById('finish-confirm-btn')
        };

        // Clone and replace elements to remove existing listeners
        Object.entries(elements).forEach(([key, element]) => {
            if (element) {
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                elements[key] = newElement;
            }
        });

        // Add event listeners to fresh elements
        elements.sendBtn?.addEventListener('click', () => this.sendMessage());
        
        elements.messageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        elements.themeSwitch?.addEventListener('change', () => this.toggleTheme());
        elements.newChatBtn?.addEventListener('click', () => this.createNewConversation());
        elements.saveChatBtn?.addEventListener('click', () => this.manualSave());
        elements.finishBtn?.addEventListener('click', () => this.handleFinishStudy());
        elements.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
        elements.mobileSidebarToggle?.addEventListener('click', () => this.toggleMobileSidebar());

        // Finish modal buttons
        elements.finishCancelBtn?.addEventListener('click', () => this.hideFinishConfirmationDialog(false));
        elements.finishConfirmBtn?.addEventListener('click', () => this.hideFinishConfirmationDialog(true));

        // Outside click handler
        document.addEventListener('click', (e) => this.handleOutsideClick(e));

        // Task tab listeners
        document.querySelectorAll('.task-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const taskId = tab.dataset.task;
                this.switchToTask(taskId);
            });
        });
    }

    /**
     * ===================================================================
     * UTILITY FUNCTIONS
     * ===================================================================
     */

    /**
     * Delay utility function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * ===================================================================
 * APPLICATION BOOTSTRAP
 * ===================================================================
 */

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});