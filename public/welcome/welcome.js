/**
 * ===================================================================
 * WELCOME PAGE - MAIN CONTROLLER
 * ===================================================================
 * 
 * Handles:
 * - Prolific ID input and validation
 * - Model allocation claiming
 * - Model comparison animation
 * - Capability display and explanation
 */

class WelcomePage {
    constructor() {
        // Initialize StudyCore
        this.core = new StudyCore('welcome');

        // Welcome experience state
        this.welcomeState = {
            currentStep: 0,
            maxSteps: 2,
            isAnimating: false
        };

        // Allocation result
        this.allocation = null;

        // Model data (matches your existing structure)
        this.modelData = this.getModelData();

        console.log('👋 Welcome page initialized');
    }

    // ===================================================================
    // INITIALIZATION
    // ===================================================================

    initialize() {
        const experience = document.getElementById('welcome-experience');
        if (experience) {
            experience.style.display = 'block';
            requestAnimationFrame(() => {
                experience.classList.add('active');
            });
        }

        this.setupEventListeners();
        this.updateProgress();
        this.setupProlificValidation();
    }

    // ===================================================================
    // MODEL DATA
    // ===================================================================

    getModelData() {
        return {
            'openai': [
                {
                    name: 'GPT-3.5',
                    year: '2022',
                    capabilities: { reasoning: 1, speed: 3, creativity: 2, knowledge: 'Sept 2021' },
                    strengths: "Very quick and reliable for everyday use and general knowledge.",
                    weaknesses: "Not great at deep thinking or generating original ideas.",
                    bestFor: "Simple questions, short writing tasks, and quick answers."
                },
                {
                    name: 'GPT-4',
                    year: '2023',
                    capabilities: { reasoning: 2, speed: 3, creativity: 3, knowledge: 'Dec 2023' },
                    strengths: "Good mix of clear reasoning, creativity, and accuracy.",
                    weaknesses: "A bit slower than smaller or newer models on light tasks.",
                    bestFor: "Professional writing, creative projects, and general problem solving."
                },
                {
                    name: 'GPT-5',
                    year: '2025',
                    capabilities: { reasoning: 4, speed: 3, creativity: 4, knowledge: 'Sept 2024' },
                    strengths: "Top-level reasoning and strong creative thinking.",
                    weaknesses: "Takes a little longer on big or detailed requests.",
                    bestFor: "Complex writing, advanced problem solving, and creative work."
                }
            ],
            'claude': [
                {
                    name: 'Claude 3',
                    year: '2024',
                    capabilities: { reasoning: 1, speed: 4, creativity: 2, knowledge: 'Aug 2023' },
                    strengths: "Extremely fast and dependable for simple tasks.",
                    weaknesses: "Can miss details or struggle with hard reasoning problems.",
                    bestFor: "Quick replies, light writing, and everyday questions."
                },
                {
                    name: 'Claude 3.5',
                    year: '2024',
                    capabilities: { reasoning: 2, speed: 4, creativity: 3, knowledge: 'July 2024' },
                    strengths: "Fast, clear, and better at explaining ideas than older models.",
                    weaknesses: "Not as accurate on tough or technical topics as newer ones.",
                    bestFor: "Emails, reports, creative writing, and general problem solving."
                },
                {
                    name: 'Claude 4',
                    year: '2025',
                    capabilities: { reasoning: 4, speed: 2, creativity: 4, knowledge: 'Mar 2025' },
                    strengths: "Excellent reasoning and natural, creative writing style.",
                    weaknesses: "Slower to respond than faster, smaller models.",
                    bestFor: "Detailed writing, complex questions, and creative projects."
                }
            ]
        };
    }

    // ===================================================================
    // STEP NAVIGATION
    // ===================================================================

    renderStep(stepIndex) {
        this.welcomeState.currentStep = stepIndex;
        this.updateProgress();

        // Show appropriate panel
        const panels = document.querySelectorAll('.content-panel');
        panels.forEach((panel, index) => {
            if (index === stepIndex) {
                panel.classList.add('active');

                // Handle special step logic
                if (stepIndex === 1) {
                    this.startModelComparison();
                }
            } else {
                panel.classList.remove('active');
            }
        });

        this.updateNavigation();
    }

    updateProgress() {
        const progress = ((this.welcomeState.currentStep + 1) / this.welcomeState.maxSteps) * 100;
        const indicator = document.getElementById('progress-indicator');
        const currentStep = document.getElementById('current-step');

        if (indicator) indicator.style.width = `${progress}%`;
        if (currentStep) currentStep.textContent = this.welcomeState.currentStep + 1;
    }

    updateNavigation() {
        const continueBtn = document.getElementById('nav-continue');
        const backBtn = document.getElementById('nav-back');

        // Handle back button
        backBtn.style.display = this.welcomeState.currentStep > 0 ? 'flex' : 'none';
        if (this.welcomeState.currentStep > 0) {
            backBtn.onclick = () => this.renderStep(this.welcomeState.currentStep - 1);
        }

        // Clear existing styles
        continueBtn.style.opacity = '1';
        continueBtn.disabled = false;

        // Step 0: Prolific ID entry
        if (this.welcomeState.currentStep === 0) {
            continueBtn.innerHTML = 'Continue <svg class="nav-icon" viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
            continueBtn.disabled = true; // Disabled by default
            continueBtn.onclick = () => this.handleProlificSubmission();
        }
        // Step 1: Model comparison
        else if (this.welcomeState.currentStep === 1) {
            if (this.welcomeState.isAnimating) {
                continueBtn.innerHTML = 'Loading...';
                continueBtn.style.opacity = '0.6';
                continueBtn.disabled = true;
                return;
            }

            continueBtn.innerHTML = 'See Details <svg class="nav-icon" viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
            continueBtn.disabled = false;
            continueBtn.onclick = () => this.showCapabilityCards();
        }
    }

    // ===================================================================
    // PROLIFIC ID HANDLING
    // ===================================================================

    setupProlificValidation() {
        const input = document.getElementById('prolific-input');
        const continueBtn = document.getElementById('nav-continue');
        const errorDiv = document.getElementById('input-error');

        if (!input) {
            console.error('❌ Prolific input field not found');
            return;
        }

        console.log('✅ Setting up Prolific validation');

        const validateInput = () => {
            const value = input.value.trim();
            const isValid = this.core.validateProlificId(value);

            console.log('🔍 Validating input:', { value, isValid });

            if (continueBtn) {
                continueBtn.disabled = !isValid;
                console.log('🎯 Button disabled state:', continueBtn.disabled);
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

        input.addEventListener('input', validateInput);
        validateInput();

        // Focus the input
        setTimeout(() => {input.focus(); console.log('✅ Input focused');}, 100);
    }

    async handleProlificSubmission() {
        const input = document.getElementById('prolific-input');
        const prolificId = input.value.trim();

        if (!this.core.validateProlificId(prolificId)) return;

        const continueBtn = document.getElementById('nav-continue');
        const originalContent = continueBtn.innerHTML;
        continueBtn.innerHTML = 'Claiming allocation...';
        continueBtn.disabled = true;

        try {
            // Claim allocation via API
            await this.claimAllocation(prolificId);

            // Move to model comparison screen
            this.renderStep(1);

        } catch (error) {
            console.error('❌ Allocation claim failed:', error);
            this.showAllocationError(error);
            continueBtn.innerHTML = originalContent;
            continueBtn.disabled = false;
        }
    }

    async claimAllocation(prolificId) {
        console.log('🎯 Claiming allocation for:', prolificId);

        const response = await fetch('/api/allocation/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: prolificId })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.details = errorData;
            throw error;
        }

        this.allocation = await response.json();

        // Set participant ID in core
        this.core.participantId = prolificId;

        // Map allocation to config format
        this.core.allocation = this.allocation;
        this.core.config = {
            givenModel: this.allocation.shown_model,
            trueModel: this.allocation.source_model,
            displayName: this.allocation.shown_model
        };

        console.log('✅ Allocation claimed:', {
            id: this.allocation.id,
            shownModel: this.allocation.shown_model,
            sourceModel: this.allocation.source_model
        });
    }

    showAllocationError(error) {
        const errorType = this.core.classifyError(error);
        const errorInfo = this.core.getErrorInfo(errorType);

        const errorDisplay = document.getElementById('simple-error-display');
        const errorTitle = document.getElementById('error-title');
        const errorMessage = document.getElementById('error-message');
        const errorCodeDisplay = document.getElementById('error-code-display');

        errorTitle.textContent = errorInfo.title;
        errorMessage.innerHTML = `
            <p><strong>${errorInfo.message}</strong></p>
            <p class="error-instruction" style="margin-top: 1rem; font-style: italic; color: var(--text-secondary-dark); line-height: 1.4;">
                ${errorInfo.instruction}
            </p>
        `;

        const errorCode = `${errorType.toUpperCase()}_${error.status || 'NET'}_${Date.now().toString().slice(-6)}`;
        errorCodeDisplay.textContent = errorCode;

        errorDisplay.style.display = 'flex';

        // Set up handlers
        document.getElementById('simple-error-close').onclick = () => {
            errorDisplay.style.display = 'none';
        };

        const retryButton = document.getElementById('error-retry');
        if (errorInfo.recoverable) {
            retryButton.style.display = 'block';
            retryButton.onclick = () => {
                errorDisplay.style.display = 'none';
                // Re-enable continue button for retry
                const continueBtn = document.getElementById('nav-continue');
                continueBtn.disabled = false;
            };
        } else {
            retryButton.style.display = 'none';
        }

        document.getElementById('error-report').onclick = () => {
            const reportText = `Error Report:\n\nError Code: ${errorCode}\nParticipant ID: ${this.core.participantId || 'Not set'}\nError Type: ${errorInfo.title}\n\nTime: ${new Date().toISOString()}`;

            if (navigator.share) {
                navigator.share({ title: 'Study Error Report', text: reportText });
            } else {
                navigator.clipboard.writeText(reportText).then(() => {
                    alert('Error details copied to clipboard. Please paste this into your Prolific message to the researchers.');
                }).catch(() => {
                    alert('To report this error, take a screenshot and include the error code: ' + errorCode);
                });
            }
        };
    }

    // ===================================================================
    // MODEL COMPARISON ANIMATION
    // ===================================================================

    startModelComparison() {
        this.welcomeState.isAnimating = true;

        const comparisonData = this.getComparisonData();
        this.populateModelComparison(comparisonData);
        this.runComparisonAnimation(comparisonData);
    }

    getComparisonData() {
        const assignedModel = this.allocation.source_model;
        const family = assignedModel.includes('claude') ? 'claude' : 'openai';
        const models = this.modelData[family];

        const assignedIndex = models.findIndex(m => m.name === this.allocation.shown_model);

        return {
            family,
            models,
            assignedIndex
        };
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
        const iconEmojis = { bulb: '💡', bolt: '⚡', brush: '🎨' };

        capabilityTypes.forEach((capability, typeIndex) => {
            const container = card.querySelector(`[data-capability="${capability}"] .capability-icons-inline`);
            if (!container) return;

            container.innerHTML = '';
            const iconType = iconTypes[typeIndex];

            for (let i = 0; i < 4; i++) {
                const icon = document.createElement('span');
                icon.className = `capability-icon-item-inline ${iconType}`;
                if (i < model.capabilities[capability]) icon.classList.add('lit');
                icon.textContent = iconEmojis[iconType];
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
            'strength-text': model.strengths,
            'weakness-text': model.weaknesses,
            'usecase-text': model.bestFor
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
        this.updateNavigation();
    }

    // ===================================================================
    // CAPABILITY CARDS
    // ===================================================================

    showCapabilityCards() {
        const container = document.querySelector('.comparison-container');
        const modelContainer = document.getElementById('model-comparison-container');
        const cardsWrapper = document.getElementById('capability-cards-wrapper');

        // Shrink models and show cards
        container.classList.add('showing-cards');
        modelContainer.classList.add('compact');

        setTimeout(() => {
            if (cardsWrapper) {
                this.positionCapabilityCards(cardsWrapper);
                cardsWrapper.classList.add('show');
            }
            this.startReadingCountdown();
        }, 500);
    }

    positionCapabilityCards(cardsWrapper) {
        const comparisonData = this.getComparisonData();
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
        let timeLeft = 10;

        const updateButton = () => {
            if (timeLeft > 0) {
                continueBtn.innerHTML = `Please read... (${timeLeft}s)`;
                continueBtn.disabled = true;
                continueBtn.style.opacity = '0.6';
            } else {
                continueBtn.innerHTML = `Proceed to Study <svg class="nav-icon" viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>`;
                continueBtn.onclick = () => this.showNextStepsPage();
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';
            }
        };

        updateButton();
        const interval = setInterval(() => {
            timeLeft--;
            updateButton();
            if (timeLeft <= 0) clearInterval(interval);
        }, 1000);
    }

    // ===================================================================
    // COMPLETION & NEXT STEPS
    // ===================================================================

    showNextStepsPage() {
        // Build task URLs with participant ID
        const baseUrl = window.location.origin;
        const pid = this.core.participantId;

        const taskUrls = {
            imageGen: `${baseUrl}/image-gen/${pid}`,
            outreach: `${baseUrl}/outreach-msg/${pid}`,
            acronym: `${baseUrl}/acro-build/${pid}`
        };

        // Show completion page with links
        const container = document.querySelector('.welcome-container');
        container.innerHTML = `
            <div class="content-card" style="max-width: 700px; margin: auto;">
                <h1 class="content-title">Welcome Complete! ✅</h1>
                <p class="content-subtitle">You've been assigned <strong>${this.allocation.shown_model}</strong></p>

                <div class="info-grid" style="margin: 2rem 0;">
                    <div class="info-item-with-header">
                        <div class="info-item-top-bar"></div>
                        <div class="info-item-content">
                            <div class="info-item-dot"></div>
                            <div class="info-item-text">
                                <h4>Next Steps</h4>
                                <p>Return to the study instructions. You will be provided with links to each task in order. Use the links below only when instructed.</p>
                            </div>
                        </div>
                    </div>

                    <div class="info-item-with-header">
                        <div class="info-item-top-bar"></div>
                        <div class="info-item-content">
                            <div class="info-item-dot"></div>
                            <div class="info-item-text">
                                <h4>Important</h4>
                                <p><strong>Complete tasks in order.</strong> Each link below corresponds to a specific task. Only open a link when you've been instructed to do so in the study materials.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin: 2rem 0; padding: 1.5rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 8px;">
                    <h3 style="margin: 0 0 1rem 0; color: rgba(249, 250, 251, 0.95);">Your Task Links</h3>
                    
                    <div style="margin: 0.75rem 0;">
                        <strong style="color: rgba(249, 250, 251, 0.9);">Task 1: Image Generation</strong><br>
                        <input type="text" readonly value="${taskUrls.imageGen}" style="width: 100%; padding: 0.5rem; margin-top: 0.25rem; font-family: monospace; font-size: 0.875rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: rgba(249, 250, 251, 0.95); border-radius: 4px;" onclick="this.select()">
                    </div>

                    <div style="margin: 0.75rem 0;">
                        <strong style="color: rgba(249, 250, 251, 0.9);">Task 2: Outreach Message</strong><br>
                        <input type="text" readonly value="${taskUrls.outreach}" style="width: 100%; padding: 0.5rem; margin-top: 0.25rem; font-family: monospace; font-size: 0.875rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: rgba(249, 250, 251, 0.95); border-radius: 4px;" onclick="this.select()">
                    </div>

                    <div style="margin: 0.75rem 0;">
                        <strong style="color: rgba(249, 250, 251, 0.9);">Task 3: Acronym Building</strong><br>
                        <input type="text" readonly value="${taskUrls.acronym}" style="width: 100%; padding: 0.5rem; margin-top: 0.25rem; font-family: monospace; font-size: 0.875rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: rgba(249, 250, 251, 0.95); border-radius: 4px;" onclick="this.select()">
                    </div>

                    <p style="margin: 1rem 0 0 0; font-size: 0.875rem; color: rgba(209, 213, 219, 0.8); font-style: italic;">
                        💡 Click any link to select and copy it. You can also bookmark these links.
                    </p>
                </div>

                <div style="text-align: center; margin-top: 2rem;">
                    <p style="color: rgba(209, 213, 219, 0.8); font-size: 0.9375rem;">
                        Return to the study instructions to continue.
                    </p>
                </div>
            </div>
        `;
    }

    // ===================================================================
    // EVENT LISTENERS
    // ===================================================================

    setupEventListeners() {
        // Enter key on Prolific input
        const prolificInput = document.getElementById('prolific-input');
        if (prolificInput) {
            prolificInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const continueBtn = document.getElementById('nav-continue');
                    if (!continueBtn.disabled) {
                        this.handleProlificSubmission();
                    }
                }
            });
        }
    }
}

// ===================================================================
// INITIALIZATION
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    window.welcomePage = new WelcomePage();
    window.welcomePage.initialize();
});