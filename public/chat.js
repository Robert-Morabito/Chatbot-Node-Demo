/**
 * ===================================================================
 * CHATBOT INTERFACE - MAIN APPLICATION CLASS
 * ===================================================================
 * 
 * A comprehensive chatbot interface for research studies featuring:
 * - Multi-task conversation management
 * - Sophisticated welcome experience with model comparison
 * - Behavioral metrics tracking
 * - Session management and data persistence
 * - Responsive design and error handling
 */

class ChatApp {
    constructor() {
        // ===================================================================
        // CORE PROPERTIES
        // ===================================================================
        this.participantId = null;
        this.sessionId = null;
        this.configurationId = null;

        // Task-based conversation storage
        this.taskConversations = {
            'image-generation': new Map(),
            'social-media': new Map(),
            'acronym-building': new Map()
        };
        this.taskSequence = ['image-generation', 'social-media', 'acronym-building'];
        this.currentTaskIndex = 0;
        this.currentTask = this.taskSequence[0];
        this.completedTasks = [];

        this.currentConversationId = null;
        this.currentChatlog = [];
        this.msgWidgets = {};

        // UI State
        this.currentTheme = 'dark';
        this.autoSaveTimeout = null;
        this.messageIdCounter = 0;
        this.sessionStartTime = Date.now();
        this.isFinishing = false;

        // Welcome Experience State
        this.currentStepIndex = 0;
        this.maxSteps = 3;
        this.isAnimationPlaying = false;

        // ===================================================================
        // CONFIGURATION
        // ===================================================================
        this.config = {
            givenModel: 'GPT-4',
            trueModel: 'gpt-4-turbo',
            displayName: 'GPT-4'
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

        // Image generation context
        this.imageContext = {
            lastPrompt: null,
            lastImageUrl: null,
            conversationHasImage: false
        };

        // ===================================================================
        // BEHAVIOR TRACKING
        // ===================================================================
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

        // Idle tracking configuration
        this.idleThreshold = 5000;
        this.idleCheckInterval = null;

        // Session timer
        this.sessionTimer = {
            startTime: null,
            intervalId: null,
            isRunning: false
        };

        // Initialize the application
        this.initializeApp();
    }

    // ===================================================================
    // INITIALIZATION & CONFIGURATION
    // ===================================================================

    /**
     * Initialize the complete application
     */
    async initializeApp() {
        // Show welcome experience immediately, load config in background
        this.initializeWelcomeExperience();
        this.showWelcomeExperience();

        // Load configuration in the background
        try {
            await this.loadConfiguration();
            console.log('✅ Configuration loaded:', this.config);
            this.setupReleaseHandler();

        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
            this.setupReleaseHandler();
        }
    }

    /**
     * Load model configuration from server
     */
    async loadConfiguration() {
        try {
            console.log('🔄 Loading configuration...');

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

            // Fallback configuration
            this.sessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.configurationId = 1;
            return false;
        }
    }

    /**
     * Register session with participant ID
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
                console.warn('Failed to register session');
            }
        } catch (error) {
            console.warn('Session registration error:', error);
        }
    }

    /**
     * Set up page close handler for cleanup
     */
    setupReleaseHandler() {
        window.addEventListener('beforeunload', (e) => this.onClose(e));
        console.log('🔓 Release handler set up for config:', this.configurationId);
    }

    /**
     * Initialize main app after welcome completion
     */
    async init() {
        this.setupEventListeners();
        this.updateBotName();
        this.updateFinishButton();
        this.createNewConversation();
        this.setupTextareaAutoResize();
        this.setupAdvancedAnimations();
        this.startSessionTimer();
        this.initializeBehaviorTracking();
        this.setupFinishButton();
    }

    // ===================================================================
    // WELCOME EXPERIENCE
    // ===================================================================

    /**
     * Get model comparison data based on assigned configuration
     */
    getModelComparisonData() {
        const modelFamilies = {
            'openai': [
                {
                    name: 'GPT-3.5',
                    year: 'released 2022',
                    capabilities: {
                        reasoning: 1, // number of lightbulbs
                        speed: 2, // number of lightning bolts
                        knowledge: 'Sept 2021'
                    },
                    lmarena: {
                        creative: 139,
                        instruction: 139,
                        hard: 144
                    },
                    strengths: "Quick responses and good general knowledge for everyday tasks.",
                    weaknesses: "Limited creativity and may struggle with complex reasoning tasks.",
                    bestFor: "Quick questions, basic writing, and simple problem-solving tasks."
                },
                {
                    name: 'GPT-4',
                    year: 'released 2023',
                    capabilities: {
                        reasoning: 2,
                        speed: 3,
                        knowledge: 'Dec 2023'
                    },
                    lmarena: {
                        creative: 88,
                        instruction: 102,
                        hard: 110
                    },
                    strengths: "Excellent balance of creativity, accuracy, and professional communication.",
                    weaknesses: "Slower response times compared to simpler models.",
                    bestFor: "Professional writing, creative projects, and complex analysis tasks."
                },
                {
                    name: 'GPT-5',
                    year: 'released 2024',
                    capabilities: {
                        reasoning: 4,
                        speed: 3,
                        knowledge: 'Sept 2024'
                    },
                    lmarena: {
                        creative: 3,
                        instruction: 1,
                        hard: 1
                    },
                    strengths: "Exceptional reasoning abilities and highly creative problem-solving.",
                    weaknesses: "Takes significantly more time to process and respond to requests.",
                    bestFor: "Complex creative challenges, advanced reasoning, and innovative solutions."
                }
            ],
            'claude': [
                {
                    name: 'Claude 3',
                    year: 'released 2024',
                    capabilities: {
                        reasoning: 1,
                        speed: 3,
                        knowledge: 'Aug 2023'
                    },
                    lmarena: {
                        creative: 127,
                        instruction: 122,
                        hard: 122
                    },
                    strengths: "Fast responses with good accuracy for routine tasks.",
                    weaknesses: "Limited depth in creative and complex analytical tasks.",
                    bestFor: "Quick tasks, basic writing assistance, and straightforward questions."
                },
                {
                    name: 'Claude 3.5',
                    year: 'released 2024',
                    capabilities: {
                        reasoning: 2,
                        speed: 3,
                        knowledge: 'July 2024'
                    },
                    lmarena: {
                        creative: 57,
                        instruction: 62,
                        hard: 59
                    },
                    strengths: "Outstanding professional communication and analytical capabilities.",
                    weaknesses: "May be overly verbose in some responses.",
                    bestFor: "Professional communication, detailed analysis, and structured writing."
                },
                {
                    name: 'Claude 4',
                    year: 'released 2025',
                    capabilities: {
                        reasoning: 4,
                        speed: 2,
                        knowledge: 'Mar 2025'
                    },
                    lmarena: {
                        creative: 11,
                        instruction: 14,
                        hard: 18
                    },
                    strengths: "Cutting-edge reasoning with exceptional creative and analytical depth.",
                    weaknesses: "Slower processing for maximum accuracy and thoughtfulness.",
                    bestFor: "Advanced creative projects, complex reasoning, and high-stakes communication."
                }
            ]
        };

        // Determine family based on assigned model
        const assignedModel = this.config?.trueModel || 'gpt-4-turbo';
        let family = 'openai';

        if (assignedModel.includes('claude')) {
            family = 'claude';
        }

        return {
            family: family,
            models: modelFamilies[family],
            assignedIndex: this.getAssignedModelIndex(modelFamilies[family])
        };
    }

    /**
     * Get assigned model index from display name
     */
    getAssignedModelIndex(models) {
        const assignedDisplayName = this.config?.displayName || 'GPT-4';

        for (let i = 0; i < models.length; i++) {
            if (models[i].name === assignedDisplayName) {
                return i;
            }
        }

        return 1; // Default to middle model
    }

    /**
     * Initialize welcome experience
     */
    initializeWelcomeExperience() {
        this.currentStepIndex = 0;
        this.maxSteps = 3;
        this.isAnimationPlaying = false;
    }

    /**
     * Show welcome experience overlay
     */
    showWelcomeExperience() {
        const experience = document.getElementById('welcome-experience');
        experience.style.display = 'block';

        requestAnimationFrame(() => {
            experience.classList.add('active');
            this.renderWelcomeStep(0);
        });
    }

    /**
     * Render specific welcome step
     */
    renderWelcomeStep(stepIndex) {
        this.currentStepIndex = stepIndex;
        this.updateProgressIndicator();

        const panels = document.querySelectorAll('.content-panel');
        panels.forEach((panel, index) => {
            if (index === stepIndex) {
                panel.classList.add('active');

                // Special handling for step 2 (comparison animation)
                if (stepIndex === 1) {
                    this.startComparisonAnimation();
                }

                // Special handling for step 3 (prolific ID validation)
                if (stepIndex === 2) {
                    setTimeout(() => {
                        this.setupProlificValidation();
                    }, 100);
                }
            } else {
                panel.classList.remove('active');
            }
        });

        this.updateNavigationButtons();
    }

    /**
     * Update progress indicator
     */
    updateProgressIndicator() {
        const progress = ((this.currentStepIndex + 1) / this.maxSteps) * 100;
        const indicator = document.getElementById('progress-indicator');
        const currentStep = document.getElementById('current-step');

        indicator.style.width = `${progress}%`;
        currentStep.textContent = this.currentStepIndex + 1;
    }

    /**
     * Update navigation buttons to hide popup when continuing
     */
    updateNavigationButtons() {
        const continueBtn = document.getElementById('nav-continue');

        // Check if we're on step 2 (index 1) and animation is playing
        if (this.currentStepIndex === 1 && this.isAnimationPlaying) {
            continueBtn.style.opacity = '0';
            continueBtn.disabled = true;
            return;
        }

        continueBtn.style.opacity = '1';
        continueBtn.style.visibility = 'visible';
        continueBtn.style.display = 'flex';
        continueBtn.disabled = false;

        // Special handler for step 2 (comparison step) - currentStepIndex === 1
        if (this.currentStepIndex === 1) {
            continueBtn.innerHTML = `
            See Details
            <svg class="nav-icon" viewBox="0 0 24 24">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
            </svg>
        `;

            continueBtn.onclick = () => {
                this.showCapabilityCardsSequence();
            };
            return;
        }

        // Regular continue button for other steps
        if (this.currentStepIndex === 2) {
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

        // Enable regular progression for other steps
        continueBtn.onclick = () => {
            if (this.currentStepIndex < this.maxSteps - 1) {
                this.renderWelcomeStep(this.currentStepIndex + 1);
            } else if (this.currentStepIndex === 2) {
                this.handleProlificSubmission();
            }
        };
    }

    showCapabilityCardsSequence() {
        const comparisonContainer = document.querySelector('.comparison-container');
        const modelContainer = document.getElementById('model-comparison-container');
        const cardsHeader = document.getElementById('capability-cards-header');
        const cards = document.getElementById('capability-cards');
        const continueBtn = document.getElementById('nav-continue');
        const popup = document.getElementById('assignment-popup');

        // Add showing-cards class and shrink models
        comparisonContainer.classList.add('showing-cards');
        modelContainer.classList.add('compact');

        // Show capability cards after animation
        setTimeout(() => {
            if (cardsHeader) {
                cardsHeader.classList.add('show');
            }

            setTimeout(() => {
                if (cards) {
                    cards.classList.add('show');
                }

                // Update button to continue to next step
                setTimeout(() => {
                    continueBtn.innerHTML = `
                    Continue to ID Entry
                    <svg class="nav-icon" viewBox="0 0 24 24">
                        <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                    </svg>
                `;

                    continueBtn.onclick = () => {
                        this.renderWelcomeStep(this.currentStepIndex + 1);
                    };
                }, 500);
            }, 300);
        }, 500);
    }

    /**
     * Start model comparison animation sequence
     */
    startComparisonAnimation() {
        this.isAnimationPlaying = true;
        const comparisonData = this.getModelComparisonData();

        this.populateModelComparison(comparisonData);
        this.runAnimationSequence(comparisonData);
    }

    /**
     * Populate model comparison cards with data
     */
    populateModelComparison(comparisonData) {
        const { models, assignedIndex } = comparisonData;

        // Populate headers
        models.forEach((model, index) => {
            const nameEl = document.getElementById(`model-name-card-${index}`);
            const yearEl = document.getElementById(`model-year-card-${index}`);

            if (nameEl) nameEl.textContent = model.name;
            if (yearEl) yearEl.textContent = model.year;
        });

        // Populate capability icons in each card with proper lit/unlit states
        document.querySelectorAll('.model-card').forEach((card, modelIndex) => {
            const model = models[modelIndex];

            // Populate reasoning icons (always show 4 total, some lit based on capability)
            const reasoningContainer = card.querySelector('[data-capability="reasoning"] .capability-icons-inline');
            if (reasoningContainer) {
                reasoningContainer.innerHTML = '';
                for (let i = 0; i < 4; i++) { // Always show 4 bulbs total
                    const icon = document.createElement('span');
                    icon.className = 'capability-icon-item-inline bulb';
                    if (i < model.capabilities.reasoning) {
                        // This bulb should be lit
                        icon.classList.add('lit');
                    }
                    icon.textContent = '💡';
                    icon.style.animationDelay = `${i * 100}ms`;
                    reasoningContainer.appendChild(icon);
                }
            }

            // Populate speed icons (always show 4 total, some lit based on capability)  
            const speedContainer = card.querySelector('[data-capability="speed"] .capability-icons-inline');
            if (speedContainer) {
                speedContainer.innerHTML = '';
                for (let i = 0; i < 4; i++) { // Always show 4 bolts total
                    const icon = document.createElement('span');
                    icon.className = 'capability-icon-item-inline bolt';
                    if (i < model.capabilities.speed) {
                        // This bolt should be lit
                        icon.classList.add('lit');
                    }
                    icon.textContent = '⚡';
                    icon.style.animationDelay = `${i * 100}ms`;
                    speedContainer.appendChild(icon);
                }
            }

            // Populate knowledge date
            const knowledgeEl = card.querySelector('.knowledge-date-inline');
            if (knowledgeEl) {
                knowledgeEl.textContent = model.capabilities.knowledge;
            }

            // Populate LMArena rankings (no crowns)
            const rankingItems = card.querySelectorAll('.ranking-item');
            const rankings = ['creative', 'instruction', 'hard'];

            rankingItems.forEach((item, rankIndex) => {
                const rankText = item.querySelector('.rank-text-card');

                if (rankText && rankings[rankIndex]) {
                    const rank = model.lmarena[rankings[rankIndex]];
                    rankText.textContent = this.formatOrdinal(rank);
                }
            });
        });

        const assignedModel = models[assignedIndex];
        const strengthEl = document.getElementById('strength-text');
        const weaknessEl = document.getElementById('weakness-text');
        const useCaseEl = document.getElementById('usecase-text');

        if (strengthEl) strengthEl.textContent = assignedModel.strengths;
        if (weaknessEl) weaknessEl.textContent = assignedModel.weaknesses;
        if (useCaseEl) useCaseEl.textContent = assignedModel.bestFor;

        // Update the capability cards header with the assigned model name
        const modelNameEl = document.getElementById('capability-model-name');
        if (modelNameEl) {
            modelNameEl.textContent = assignedModel.name;
        }
    }

    /**
     * Format number as ordinal (1st, 2nd, 3rd, etc.)
     */
    formatOrdinal(num) {
        const suffixes = ["th", "st", "nd", "rd"];
        const v = num % 100;
        return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    }

    /**
     * Animate capability icons with staggered timing
     */
    animateCapabilityIcons() {
        const capabilityRows = document.querySelectorAll('.capability-row');

        capabilityRows.forEach((row, rowIndex) => {
            const delay = rowIndex * 2000;

            setTimeout(() => {
                const iconGroups = row.querySelectorAll('.capability-icons-group');
                iconGroups.forEach((group, groupIndex) => {
                    const groupDelay = groupIndex * 200;

                    setTimeout(() => {
                        const icons = group.querySelectorAll('.capability-icon-item');
                        icons.forEach((icon, iconIndex) => {
                            const iconDelay = iconIndex * 300;

                            setTimeout(() => {
                                icon.classList.add('lit');
                            }, iconDelay);
                        });
                    }, groupDelay);
                });

                // Animate knowledge dates for knowledge row
                if (row.dataset.capability === 'knowledge') {
                    const knowledgeDates = row.querySelectorAll('.knowledge-date');
                    knowledgeDates.forEach((date, dateIndex) => {
                        const dateDelay = dateIndex * 200;
                        setTimeout(() => {
                            date.classList.add('show');
                        }, dateDelay);
                    });
                }
            }, delay);
        });
    }

    /**
     * Run the complete animation sequence
     */
    runAnimationSequence(comparisonData) {
        this.isAnimationPlaying = true;
        const { assignedIndex } = comparisonData;

        const timeline = [
            // 0-1s: Cards appear
            () => {
                const container = document.getElementById('model-comparison-container');
                container.style.animation = 'fadeInUp 2s ease-out forwards';
            },

            // 1-4s: Animate capabilities in each card
            () => this.animateCardCapabilities(),

            // 4.5s: Highlight assigned model
            () => this.highlightAssignedModel(assignedIndex),

            // 5s: Show popup and enable continue button
            () => {
                this.showAssignmentPopup(assignedIndex);
                this.isAnimationPlaying = false;
                this.updateNavigationButtons();
            }
        ];

        const delays = [0, 1000, 4500, 5000];

        timeline.forEach((action, index) => {
            setTimeout(action, delays[index]);
        });
    }

    /**
     * Animate capabilities within each card
     */
    animateCardCapabilities() {
        document.querySelectorAll('.model-card').forEach((card, cardIndex) => {
            const baseDelay = cardIndex * 200; // Stagger between cards

            // Animate capability items
            card.querySelectorAll('.capability-item').forEach((item, itemIndex) => {
                const itemDelay = baseDelay + (itemIndex * 300);

                setTimeout(() => {
                    item.classList.add('show');

                    // Animate only the lit icons within the item
                    const litIcons = item.querySelectorAll('.capability-icon-item-inline.lit');
                    litIcons.forEach((icon, iconIndex) => {
                        setTimeout(() => {
                            // Add a special animation class for the lit icons
                            icon.classList.add('animate-in');
                        }, iconIndex * 150);
                    });
                }, itemDelay);
            });

            // Animate ranking items (no crown animation needed)
            card.querySelectorAll('.ranking-item').forEach((item, itemIndex) => {
                const itemDelay = baseDelay + 1800 + (itemIndex * 200);

                setTimeout(() => {
                    item.classList.add('show');
                }, itemDelay);
            });
        });
    }

    /**
     * Highlight the assigned model
     */
    highlightAssignedModel(assignedIndex) {
        const modelCard = document.querySelector(`.model-card[data-model="${assignedIndex}"]`);
        if (modelCard) {
            modelCard.classList.add('highlighted');
        }
    }

    /**
     * Show assignment popup above the assigned model (persistent)
     */
    showAssignmentPopup(assignedIndex) {
        const popup = document.getElementById('assignment-popup');
        const assignedCard = document.querySelector(`.model-card[data-model="${assignedIndex}"]`);

        if (popup && assignedCard) {
            const rect = assignedCard.getBoundingClientRect();
            const containerRect = document.querySelector('.comparison-container').getBoundingClientRect();

            popup.style.left = `${rect.left - containerRect.left + (rect.width / 2)}px`;
            popup.classList.add('show', 'persistent');
        }
    }

    /**
     * Show capability cards and header
     */
    showCapabilityCards() {
        const header = document.getElementById('capability-cards-header');
        const cards = document.getElementById('capability-cards');

        if (header) {
            header.classList.add('show');
        }

        if (cards) {
            setTimeout(() => {
                cards.classList.add('show');
            }, 300);
        }
    }

    /**
     * Set up Prolific ID validation
     */
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

    /**
     * Handle Prolific ID submission
     */
    async handleProlificSubmission() {
        const input = document.getElementById('prolific-input');
        const prolificId = input.value.trim();

        if (!/^[a-zA-Z0-9]{24}$/.test(prolificId)) return;

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
     * Hide welcome experience and start main app
     */
    hideWelcomeExperience() {
        const experience = document.getElementById('welcome-experience');
        experience.classList.remove('active');

        setTimeout(() => {
            experience.style.display = 'none';
            const appContainer = document.querySelector('.app-container');
            appContainer.classList.add('ready');
            this.init();
        }, 600);
    }

    // ===================================================================
    // TASK AND CONVERSATION MANAGEMENT
    // ===================================================================

    /**
     * Get current task configuration
     */
    getCurrentTaskConfig() {
        return this.taskConfig[this.currentTask];
    }

    /**
     * Check if this is the final task
     */
    isFinalTask() {
        return this.currentTaskIndex >= this.taskSequence.length - 1;
    }

    /**
     * Get next task in sequence
     */
    getNextTask() {
        const nextIndex = this.currentTaskIndex + 1;
        return nextIndex < this.taskSequence.length ? this.taskSequence[nextIndex] : null;
    }

    /**
     * Progress to next task
     */
    async progressToNextTask() {
        // Mark current task as completed
        this.completedTasks.push(this.currentTask);

        // Move to next task
        this.currentTaskIndex++;
        if (this.currentTaskIndex < this.taskSequence.length) {
            this.currentTask = this.taskSequence[this.currentTaskIndex];

            // Reset conversation state for new task
            this.currentConversationId = null;
            this.currentChatlog = [];

            // Update UI for new task
            this.updateFinishButton();

            // AUTO-CREATE new chat for the new task (ADD this line)
            this.createNewConversation();
        }
    }

    /**
     * Handle task completion
     */
    async handleTaskCompletion() {
        const taskConfig = this.getCurrentTaskConfig();
        const isLastTask = this.isFinalTask();

        // Show confirmation dialog
        const confirmed = await this.showTaskCompletionDialog(taskConfig.name, isLastTask);
        if (!confirmed) return;

        try {
            // Save current task's conversations
            await this.saveCurrentTaskData();

            if (isLastTask) {
                // This is the final task - complete the study
                await this.completeEntireStudy();
            } else {
                // Progress to next task
                await this.progressToNextTask();
            }

        } catch (error) {
            console.error('❌ Task completion error:', error);
            alert('Error completing task. Please try again.');
        }
    }

    /**
     * Show task completion confirmation dialog
     */
    showTaskCompletionDialog(taskName, isLastTask) {
        return new Promise((resolve) => {
            const modal = document.getElementById('finish-confirmation-modal');
            const titleEl = modal.querySelector('h3');
            const bodyEl = modal.querySelector('p');

            if (isLastTask) {
                titleEl.textContent = 'Complete Study';
                bodyEl.textContent = `You are about to complete the final task (${taskName}) and finish the entire study. This will download your data and close the interface. Please make sure you have finished everything before continuing.`;
            } else {
                titleEl.textContent = `Complete ${taskName} Task?`;
                bodyEl.textContent = `Continuting will finish the ${taskName} task and move to the next task. You won't be able to return.`;
            }

            modal.style.display = 'flex';
            this.taskCompletionResolve = resolve;
        });
    }

    /**
     * Hide task completion dialog
     */
    hideTaskCompletionDialog(confirmed) {
        const modal = document.getElementById('finish-confirmation-modal');
        modal.style.display = 'none';

        if (this.taskCompletionResolve) {
            this.taskCompletionResolve(confirmed);
            this.taskCompletionResolve = null;
        }
    }

    /**
     * Save current task's conversation data
     */
    async saveCurrentTaskData() {
        // Save current conversation if any
        if (this.currentConversationId) {
            const taskConversations = this.taskConversations[this.currentTask];
            const currentConv = taskConversations.get(this.currentConversationId);
            if (currentConv) {
                currentConv.messages = [...this.currentChatlog];
                currentConv.lastMessageAt = new Date();
            }
        }
    }

    /**
     * Update finish button based on current task
     */
    updateFinishButton() {
        const finishBtn = document.getElementById('finish-btn');
        if (!finishBtn) return;

        finishBtn.classList.add('has-custom-content');

        const isLastTask = this.isFinalTask();

        if (isLastTask) {
            finishBtn.innerHTML = '🏁 Finish Study';
            finishBtn.title = 'Complete study and download data';
            finishBtn.classList.add('final-task'); // ADD: red styling for final task
        } else {
            const nextTask = this.getNextTask();
            const nextTaskConfig = nextTask ? this.taskConfig[nextTask] : null;
            finishBtn.innerHTML = `📋 Complete Task`;
            finishBtn.title = nextTaskConfig ?
                `Finish current task and move to ${nextTaskConfig.name}` :
                'Complete current task';
            finishBtn.classList.remove('final-task'); // ADD: ensure blue styling for tasks
        }
    }

    /**
     * Create new conversation for current task
     */
    createNewConversation() {
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

        this.taskConversations[this.currentTask].set(conversationId, conversation);
        this.switchToConversation(conversationId);
        this.updateConversationList();
        this.showWelcomeMessage();
    }

    /**
     * Switch to specific conversation
     */
    switchToConversation(conversationId) {
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
     * Render current conversation
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

        // Get existing items to avoid re-animating them
        const existingItems = new Set();
        conversationList.querySelectorAll('.conversation-item').forEach(item => {
            const convId = item.dataset.conversationId;
            if (convId) existingItems.add(convId);
        });

        const sortedConversations = Array.from(taskConversations.values())
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

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

            const isExisting = existingItems.has(conversation.id);
            if (!isExisting) {
                conversationItem.style.animationDelay = `${index * 0.1}s`;
            } else {
                conversationItem.style.opacity = '1';
                conversationItem.style.transform = 'translateX(0)';
                conversationItem.style.animation = 'none';
            }

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

    // ===================================================================
    // MESSAGE HANDLING
    // ===================================================================

    /**
     * Send user message
     */
    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message) {
            console.log('❌ Empty message, returning');
            return;
        }

        console.log('💬 Sending message:', message);

        if (!this.currentConversationId) {
            this.createNewConversation();
        }

        // Track metrics
        this.behaviorMetrics.taskMetrics[this.currentTask].messages++;
        this.behaviorMetrics.messageLengths.push(message.length);
        this.behaviorMetrics.messageCount++;
        this.behaviorMetrics.messageTimes.push(new Date().toISOString());

        // Remove welcome message
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

        this.currentChatlog.push(userMsg);
        this.renderMessage(userMsg);

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';

        this.updateConversationTitle(message);
        this.showTypingIndicator();
        setTimeout(() => this.getLLMResponse(), 500);
    }

    /**
     * Get response from LLM
     */
    async getLLMResponse() {
        try {
            const requestData = {
                messages: this.currentChatlog,
                model: this.config.trueModel,
                sessionId: this.sessionId,
                conversationId: this.currentConversationId,
                imageContext: this.imageContext
            };

            console.log('🟦 DEBUG: Request data prepared:', {
                messageCount: requestData.messages.length,
                model: requestData.model,
                lastMessage: requestData.messages[requestData.messages.length - 1]?.content?.substring(0, 50) + '...',
                hasImageContext: !!requestData.imageContext?.lastPrompt
            });

            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('🔴 DEBUG: Stream response error:', response.status, errorText);
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.responseText = errorText;
                throw error;
            }

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
                            if (data.type === 'error') {
                                const error = new Error(data.error || 'Stream error occurred');
                                error.context = 'stream';
                                throw error;
                            }

                            if (data.type === 'image_request_detected') {
                                console.log('🟨 DEBUG: IMAGE REQUEST DETECTED!');
                                isImageGeneration = true;
                                this.hideTypingIndicator();
                                this.showImageGenerationIndicator();
                            } else if (data.type === 'typing_start') {
                                console.log('🟦 DEBUG: Regular chat typing started');

                            } else if (data.type === 'content' && isImageGeneration) {
                                console.log('🟨 DEBUG: Image generation completed, showing result');

                            } else if (data.type === 'done') {
                                console.log('🟦 DEBUG: Stream completed, type:', data.finishReason || 'normal');
                                break;

                            } else if (data.type === 'error') {
                                console.error('🔴 DEBUG: Stream error:', data.error);
                                const error = new Error(data.error || 'Stream error occurred');
                                error.context = 'stream';
                                throw error;
                            } else if (data.type === 'content') {
                                if (!botMsg && !isImageGeneration) {
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
                            console.error('❌ JSON parse error:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ getLLMResponse error:', error);
            this.hideTypingIndicator();
            this.hideImageGenerationIndicator();
            this.showErrorModal(error, 'chat');
        }
    }

    /**
     * Show typing indicator
     */
    showTypingIndicator() {
        const messagesContainer = document.getElementById('messages');

        const existing = document.getElementById('typing-indicator');
        if (existing) existing.remove();

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-message';
        typingDiv.id = 'typing-indicator';

        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = 'Bot';

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
     * Render message in chat
     */
    renderMessage(msgInfo, autoScroll = true) {
        const messagesContainer = document.getElementById('messages');

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msgInfo.sender.toLowerCase()}`;
        messageDiv.dataset.msgId = msgInfo.msg_id;

        const iconImg = document.createElement('img');
        iconImg.className = 'message-icon';
        iconImg.alt = msgInfo.sender;

        if (msgInfo.sender === 'User') {
            iconImg.src = 'images/user.png';
        } else {
            const displayedModel = this.config?.displayName || '';

            if (displayedModel.toLowerCase().includes('claude')) {
                iconImg.src = 'images/claude.png';
            } else {
                iconImg.src = 'images/gpt.png';
            }
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.position = 'relative';

        if (msgInfo.sender === 'Bot') {
            contentDiv.innerHTML = marked.parse(msgInfo.content, {
                breaks: true,
                gfm: true,
                sanitize: false
            });

            this.setupImageClickHandlers(contentDiv);
        } else {
            contentDiv.textContent = msgInfo.content;

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

        if (autoScroll) {
            this.scrollToBottom();
        }
    }

    /**
     * Set up image click handlers for modal viewing
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
     * Show image in modal
     */
    showImageModal(imageSrc, altText) {
        const existingModal = document.querySelector('.image-modal');
        if (existingModal) {
            existingModal.remove();
        }

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

    /**
     * Edit message functionality
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

        if (contentDiv.querySelector('.edit-mode')) {
            return;
        }

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
     * Delete messages from a certain point
     */
    deleteMessages(fromMsgId) {
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

    /**
     * Update conversation title from first message
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
     * Auto-save conversation with debouncing
     */
    autoSaveConversation() {
        if (!this.currentConversationId) return;

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

    // ===================================================================
    // UI MANAGEMENT
    // ===================================================================

    /**
     * Update bot name display
     */
    updateBotName() {
        document.getElementById('bot-name').textContent = `Currently Chatting with ${this.config.displayName}`;
        document.getElementById('header-participant-id').textContent = this.participantId;
        document.getElementById('welcome-model-name').textContent = this.config.displayName;
        document.title = `${this.config.displayName} - Study ${this.participantId}`;
    }

    /**
     * Scroll to bottom of chat
     */
    scrollToBottom() {
        const chatContainer = document.getElementById('chat-container');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        document.body.classList.toggle('light-theme');
        this.currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    /**
     * Toggle mobile sidebar
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
     * Get or create sidebar backdrop
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
     * Handle outside clicks for mobile
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
     * Set up textarea auto-resize
     */
    setupTextareaAutoResize() {
        const textarea = document.getElementById('message-input');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        });
    }

    /**
     * Set up advanced UI animations
     */
    setupAdvancedAnimations() {
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

        const style = document.createElement('style');
        style.textContent = `
            @keyframes ripple {
                to { transform: scale(2); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Set up finish button
     */
    setupFinishButton() {
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.style.display = 'flex';
        }
    }

    // ===================================================================
    // SESSION MANAGEMENT
    // ===================================================================

    /**
     * Start session timer
     */
    startSessionTimer() {
        console.log('⏱️ Starting session timer');

        if (this.sessionTimer.isRunning) {
            console.log('⏱️ Timer already running');
            return;
        }

        this.sessionTimer.startTime = Date.now();
        this.sessionTimer.isRunning = true;

        this.updateTimerDisplay();

        this.sessionTimer.intervalId = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }

    /**
     * Stop session timer
     */
    stopSessionTimer() {
        console.log('⏱️ Stopping session timer');

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
     */
    formatElapsedTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get elapsed time in milliseconds
     */
    getElapsedTime() {
        if (!this.sessionTimer.startTime) return 0;
        return Date.now() - this.sessionTimer.startTime;
    }

    // ===================================================================
    // BEHAVIOR TRACKING
    // ===================================================================

    /**
     * Initialize behavior tracking
     */
    initializeBehaviorTracking() {
        // Track backspaces and keystrokes
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

        document.getElementById('message-input').addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        this.startIdleTracking();

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
     */
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

    // ===================================================================
    // ERROR HANDLING
    // ===================================================================

    /**
     * Show error modal
     */
    showErrorModal(error, context = 'chat') {
        console.error('🚨 Showing error modal:', error);

        const modal = document.getElementById('error-modal');
        const errorCodeSpan = document.getElementById('error-code');
        const participantIdSpan = document.getElementById('error-participant-id');

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

        const timestamp = new Date().toISOString().substring(0, 19).replace('T', '_');
        errorCode += `_${context.toUpperCase()}_${timestamp}`;

        errorCodeSpan.textContent = errorCode;
        participantIdSpan.textContent = this.participantId || 'Not Set';

        modal.style.display = 'flex';
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
     * Set up error modal event listeners
     */
    setupErrorModalListeners() {
        const closeBtn = document.getElementById('error-modal-close');
        const closeBtn2 = document.getElementById('error-close');
        const tryAgainBtn = document.getElementById('error-try-again');

        closeBtn.onclick = null;
        closeBtn2.onclick = null;
        tryAgainBtn.onclick = null;

        closeBtn.onclick = () => this.hideErrorModal();
        closeBtn2.onclick = () => this.hideErrorModal();
        tryAgainBtn.onclick = () => {
            this.hideErrorModal();
            if (this.currentChatlog.length > 0) {
                const lastMessage = this.currentChatlog[this.currentChatlog.length - 1];
                if (lastMessage.sender === 'User') {
                    this.showTypingIndicator();
                    setTimeout(() => this.getLLMResponse(), 500);
                }
            }
        };

        const modal = document.getElementById('error-modal');
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.hideErrorModal();
            }
        };
    }

    /**
     * Show notification
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

    // ===================================================================
    // SAVE AND FINISH FUNCTIONALITY
    // ===================================================================

    /**
     * Save data to server
     */
    async saveToServer() {
        try {
            console.log('🔵 Starting save to server...');

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
                completedTasks: this.completedTasks, // ADD this line
                currentTaskIndex: this.currentTaskIndex // ADD this line
            };

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
                const error = new Error(result.error || 'Save failed');
                error.status = response.status;
                throw error;
            }
        } catch (error) {
            console.error('❌ Error saving to server:', error);
            this.showErrorModal(error, 'save');
            throw error;
        }
    }

    /**
     * Manual save function
     */
    manualSave() {
        if (this.currentChatlog.length === 0) {
            alert('No messages to save!');
            return;
        }

        this.autoSaveConversation();

        this.saveToServer().then(result => {
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
     * Handle finish study
     */
    async completeEntireStudy() {
        console.log('🏁 Completing entire study...');

        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn.disabled) return;
        finishBtn.disabled = true;

        try {
            this.showFinishLoadingIndicator();

            // Save any remaining conversation data  
            if (this.currentConversationId && this.currentChatlog.length > 0) {
                const taskConversations = this.taskConversations[this.currentTask]; // CHANGE: use current task
                const conversation = taskConversations.get(this.currentConversationId);
                if (conversation) {
                    conversation.messages = [...this.currentChatlog];
                }
            }

            const behaviorMetrics = this.calculateFinalMetrics();

            // CHANGE: Organize conversations by task (instead of single conversations map)
            const organizedConversations = {};
            for (const [taskId, conversations] of Object.entries(this.taskConversations)) {
                organizedConversations[taskId] = Object.fromEntries(conversations);
            }

            const exportData = {
                participantId: this.participantId,
                sessionId: this.sessionId,
                completedAt: new Date().toISOString(),
                modelConfig: {
                    displayedModel: this.config.givenModel,
                    actualModel: this.config.trueModel,
                    configurationId: this.configurationId
                },
                conversations: organizedConversations, // CHANGE: use organized conversations
                behaviorMetrics: behaviorMetrics,
                completedTasks: this.completedTasks, // ADD: track completed tasks
                studyVersion: "2.0" // CHANGE: update version
            };

            console.log('📦 Export data prepared:', exportData);

            await this.downloadConversationData(exportData);
            await this.saveToServer();
            await this.markSessionCompleted();

            this.closeApplication();

        } catch (error) {
            console.error('Error finishing study:', error);
            alert('There was an error completing the study. Please try again or contact support.');
            this.hideFinishLoadingIndicator();
            finishBtn.disabled = false;
        }
    }

    /**
     * Handle task completion - this is the NEW method that the finish button calls
     */
    async handleTaskCompletion() {
        const taskConfig = this.getCurrentTaskConfig();
        const isLastTask = this.isFinalTask();

        // Show confirmation dialog
        const confirmed = await this.showTaskCompletionDialog(taskConfig.name, isLastTask);
        if (!confirmed) return;

        try {
            // Save current task's conversations
            await this.saveCurrentTaskData();

            if (isLastTask) {
                // This is the final task - complete the entire study
                await this.completeEntireStudy();
            } else {
                // Progress to next task
                await this.progressToNextTask();
            }

        } catch (error) {
            console.error('❌ Task completion error:', error);
            alert('Error completing task. Please try again.');
        }
    }

    /**
     * Show finish confirmation dialog
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
     * Download conversation data as JSON
     */
    async downloadConversationData(data) {
        try {
            const jsonContent = JSON.stringify(data, null, 2);
            const filename = `study-data-${this.participantId}-${Date.now()}.json`;

            console.log('💾 Creating download:', filename);

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
            console.error('Error creating download:', error);
            throw error;
        }
    }

    /**
     * Mark session as completed on server
     */
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
            throw error;
        }
    }

    /**
     * Close application
     */
    closeApplication() {
        this.stopSessionTimer();
        this.isFinishing = true;

        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) finishBtn.style.display = 'none';

        this.hideFinishLoadingIndicator();

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

    // ===================================================================
    // CLEANUP AND EVENT HANDLERS
    // ===================================================================

    /**
     * Handle page close event
     */
    async onClose(event) {
        this.stopSessionTimer();

        if (this.isFinishing) return;

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

        if (this.currentConversationId && this.currentChatlog.length > 0) {
            const conversation = this.conversations.get(this.currentConversationId);
            if (conversation) {
                conversation.messages = [...this.currentChatlog];
            }

            try {
                const behaviorMetrics = this.calculateFinalMetrics();
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
                    completedTasks: this.completedTasks, // ADD this line
                    currentTaskIndex: this.currentTaskIndex // ADD this line
                };

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
     * Show saving indicator
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
     * Release reservation
     */
    async releaseReservation() {
        try {
            const response = await fetch('/api/sessions/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configurationId: this.configurationId })
            });

            if (response.ok) {
                console.log('✅ Reservation released successfully');
            } else {
                console.warn('⚠️ Release request failed:', response.status);
            }

            return response.ok;
        } catch (error) {
            console.error('❌ Release request error:', error);
            return false;
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Remove existing listeners to prevent duplicates
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

        // Replace elements
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        messageInput.parentNode.replaceChild(newMessageInput, messageInput);
        newChatBtn.parentNode.replaceChild(newNewChatBtn, newChatBtn);
        saveChatBtn.parentNode.replaceChild(newSaveChatBtn, saveChatBtn);
        finishBtn.parentNode.replaceChild(newFinishBtn, finishBtn);
        themeSwitch.parentNode.replaceChild(newThemeSwitch, themeSwitch);
        sidebarToggle.parentNode.replaceChild(newSidebarToggle, sidebarToggle);
        mobileSidebarToggle.parentNode.replaceChild(newMobileSidebarToggle, mobileSidebarToggle);

        // Add event listeners to new elements
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
}

// ===================================================================
// INITIALIZE APPLICATION
// ===================================================================

/**
 * Initialize the ChatApp when page loads
 */
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});