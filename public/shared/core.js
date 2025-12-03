/**
 * ===================================================================
 * SHARED CORE MODULE
 * ===================================================================
 * 
 * Common utilities for all study pages:
 * - Participant ID extraction and validation
 * - Allocation verification and management
 * - Auto-save functionality
 * - Error handling
 */

class StudyCore {
    constructor(taskName) {
        this.taskName = taskName;
        this.participantId = null;
        this.allocation = null;
        this.config = null;

        // Auto-save state
        this.autoSaveInterval = null;
        this.lastSaveTime = null;
        this.saveInProgress = false;
        this.hasUnsavedChanges = false;

        // Error types (consistent across pages)
        this.errorTypes = {
            NETWORK_TIMEOUT: 'network_timeout',
            NETWORK_OFFLINE: 'network_offline',
            INVALID_USER_ID: 'invalid_user_id',
            ALLOCATION_NOT_FOUND: 'allocation_not_found',
            STUDY_FULL: 'study_full',
            SERVER_ERROR: 'server_error',
            SAVE_ERROR: 'save_error',
            UNKNOWN: 'unknown'
        };

        console.log(`📋 StudyCore initialized for task: ${taskName}`);
    }

    // ===================================================================
    // PARTICIPANT ID MANAGEMENT
    // ===================================================================

    /**
     * Extract participant ID from URL path
     * Expected format: /task-name/PROLIFIC_ID
     * @returns {string|null} Participant ID or null if not found
     */
    extractParticipantIdFromUrl() {
        const pathParts = window.location.pathname.split('/').filter(Boolean);

        // URL structure: /task-name/prolificid
        // pathParts[0] = task-name, pathParts[1] = prolificid
        if (pathParts.length >= 2) {
            const pid = pathParts[1];

            // Validate format (24 alphanumeric characters for Prolific)
            if (this.validateProlificId(pid)) {
                console.log('✅ Participant ID extracted from URL:', pid);
                this.participantId = pid;
                return pid;
            } else {
                console.warn('⚠️ Invalid participant ID format in URL:', pid);
            }
        }

        console.warn('⚠️ No participant ID found in URL path');
        return null;
    }

    /**
     * Validate Prolific ID format
     * @param {string} pid - Participant ID to validate
     * @returns {boolean} Whether the ID is valid
     */
    validateProlificId(pid) {
        if (!pid || typeof pid !== 'string') return false;
        return /^[a-zA-Z0-9]{24}$/.test(pid.trim());
    }

    // ===================================================================
    // ALLOCATION MANAGEMENT
    // ===================================================================

    /**
     * Verify participant has a valid allocation
     * @returns {Promise<Object>} Allocation data
     * @throws {Error} If allocation not found or invalid
     */
    async verifyAllocation() {
        if (!this.participantId) {
            throw new Error('No participant ID available');
        }

        console.log('🔍 Verifying allocation for:', this.participantId);

        try {
            const response = await fetch(`/api/allocation/status?user_id=${encodeURIComponent(this.participantId)}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                if (response.status === 404) {
                    throw new Error('ALLOCATION_NOT_FOUND: No allocation found for this participant ID');
                }

                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const allocation = await response.json();

            console.log('✅ Allocation verified:', {
                id: allocation.id,
                shownModel: allocation.shown_model,
                sourceModel: allocation.source_model
            });

            this.allocation = allocation;

            // Map to config format used by chat system
            this.config = {
                givenModel: allocation.shown_model,
                trueModel: allocation.source_model,
                displayName: allocation.shown_model
            };

            return allocation;

        } catch (error) {
            console.error('❌ Allocation verification failed:', error.message);
            throw error;
        }
    }

    /**
     * Confirm allocation as completed (called on final task)
     * @returns {Promise<boolean>} Success status
     */
    async confirmAllocation() {
        if (!this.participantId) {
            throw new Error('No participant ID available');
        }

        console.log('✅ Confirming allocation for:', this.participantId);

        try {
            const response = await fetch('/api/allocation/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.participantId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Confirm failed: ${error.error || response.statusText}`);
            }

            console.log('✅ Allocation confirmed successfully');
            return true;

        } catch (error) {
            console.error('❌ Allocation confirmation failed:', error.message);
            throw error;
        }
    }

    // ===================================================================
    // AUTO-SAVE FUNCTIONALITY
    // ===================================================================

    /**
     * Start auto-save interval
     * @param {Function} getDataCallback - Function that returns data to save
     * @param {number} intervalMs - Save interval in milliseconds (default 60000)
     */
    startAutoSave(getDataCallback, intervalMs = 60000) {
        if (this.autoSaveInterval) {
            console.log('⚠️ Auto-save already running');
            return;
        }

        console.log(`⏰ Starting auto-save every ${intervalMs / 1000} seconds`);

        this.autoSaveInterval = setInterval(async () => {
            if (this.hasUnsavedChanges && !this.saveInProgress) {
                console.log('💾 Auto-save triggered...');
                await this.saveTaskData(getDataCallback(), false); // silent save
            }
        }, intervalMs);
    }

    /**
     * Stop auto-save interval
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log('⏹️ Auto-save stopped');
        }
    }

    /**
     * Mark that there are unsaved changes
     */
    markUnsavedChanges() {
        this.hasUnsavedChanges = true;
    }

    /**
     * Save task data to GitHub
     * @param {Object} taskData - Data to save
     * @param {boolean} showIndicator - Whether to show save indicator
     * @returns {Promise<Object>} Save result
     */
    async saveTaskData(taskData, showIndicator = true) {
        if (this.saveInProgress) {
            console.log('⚠️ Save already in progress, skipping');
            return { success: false, reason: 'save_in_progress' };
        }

        this.saveInProgress = true;

        try {
            console.log('💾 Saving task data:', {
                task: this.taskName,
                participant: this.participantId,
                dataSize: JSON.stringify(taskData).length
            });
            
            // Count images in data (for logging)
            const imageCount = JSON.stringify(taskData).match(/data:image/g)?.length || 0;
            if (imageCount > 0) {
                console.log(`🖼️ Task contains ${imageCount} image(s)`);
            }

            if (showIndicator) {
                this.showSaveIndicator('saving');
            }

            const savePayload = {
                participantId: this.participantId,
                taskName: this.taskName,
                sessionId: this.allocation?.id,
                modelConfig: this.config,
                taskData: taskData,
                savedAt: new Date().toISOString()
            };

            console.log('📤 Sending save request to /api/chat/save-task...'); // ADD THIS

            const response = await fetch('/api/chat/save-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(savePayload)
            });

            console.log('📥 Save response status:', response.status); // ADD THIS

            const result = await response.json();

            console.log('📥 Save response body:', result); // ADD THIS

            if (!response.ok) {
                throw new Error(result.error || 'Save failed');
            }

            this.lastSaveTime = new Date();
            this.hasUnsavedChanges = false;

            console.log('✅ Task data saved successfully');

            if (showIndicator) {
                this.showSaveIndicator('success');
            }

            return { success: true, ...result };

        } catch (error) {
            console.error('❌ Task data save failed:', error.message);
            console.error('❌ Full error:', error); // ADD THIS

            if (showIndicator) {
                this.showSaveIndicator('error');
            }

            return { success: false, error: error.message };

        } finally {
            this.saveInProgress = false;
        }
    }

    /**
     * Save data using sendBeacon (for page close)
     * @param {Object} taskData - Data to save
     */
    saveTaskDataBeacon(taskData) {
        if (!this.participantId || !this.hasUnsavedChanges) {
            return;
        }

        console.log('📡 Sending data via beacon...');

        const savePayload = {
            participantId: this.participantId,
            taskName: this.taskName,
            sessionId: this.allocation?.id,
            modelConfig: this.config,
            taskData: taskData,
            savedAt: new Date().toISOString(),
            savedVia: 'beacon'
        };

        const blob = new Blob([JSON.stringify(savePayload)], { type: 'application/json' });
        navigator.sendBeacon('/api/chat/save-task', blob);
    }

    /**
     * Show save status indicator
     * @param {string} status - 'saving', 'success', or 'error'
     */
    showSaveIndicator(status) {
        let indicator = document.getElementById('save-indicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'save-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                transition: all 0.3s ease;
                opacity: 0;
                transform: translateX(100px);
            `;
            document.body.appendChild(indicator);
        }

        const configs = {
            saving: { bg: '#3b82f6', text: '💾 Saving...', color: 'white' },
            success: { bg: '#10b981', text: '✅ Saved', color: 'white' },
            error: { bg: '#ef4444', text: '❌ Save failed', color: 'white' }
        };

        const config = configs[status] || configs.saving;
        indicator.style.backgroundColor = config.bg;
        indicator.style.color = config.color;
        indicator.textContent = config.text;
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateX(0)';

        if (status !== 'saving') {
            setTimeout(() => {
                indicator.style.opacity = '0';
                indicator.style.transform = 'translateX(100px)';
            }, 2000);
        }
    }

    // ===================================================================
    // ERROR HANDLING
    // ===================================================================

    /**
     * Classify error for user-friendly display
     * @param {Error} error - Error object
     * @returns {string} Error type
     */
    classifyError(error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return this.errorTypes.NETWORK_OFFLINE;
        }
        if (error.message.includes('timeout')) {
            return this.errorTypes.NETWORK_TIMEOUT;
        }
        if (error.message.includes('ALLOCATION_NOT_FOUND')) {
            return this.errorTypes.ALLOCATION_NOT_FOUND;
        }
        if (error.message.includes('STUDY_FULL')) {
            return this.errorTypes.STUDY_FULL;
        }
        if (error.status === 400) {
            return this.errorTypes.INVALID_USER_ID;
        }
        if (error.status >= 500) {
            return this.errorTypes.SERVER_ERROR;
        }
        return this.errorTypes.UNKNOWN;
    }

    /**
     * Get user-friendly error message
     * @param {string} errorType - Error type from classifyError
     * @returns {Object} Error info with title, message, instruction
     */
    getErrorInfo(errorType) {
        const messages = {
            [this.errorTypes.NETWORK_OFFLINE]: {
                title: 'Connection Error',
                message: 'Unable to connect to the server.',
                instruction: 'Please check your internet connection and refresh the page.',
                recoverable: true
            },
            [this.errorTypes.NETWORK_TIMEOUT]: {
                title: 'Connection Timeout',
                message: 'The request took too long to complete.',
                instruction: 'Please check your connection and try again.',
                recoverable: true
            },
            [this.errorTypes.ALLOCATION_NOT_FOUND]: {
                title: 'Session Not Found',
                message: 'No active study session found for your participant ID.',
                instruction: 'Please ensure you completed the welcome page first. If you believe this is an error, contact the researchers via Prolific.',
                recoverable: false
            },
            [this.errorTypes.INVALID_USER_ID]: {
                title: 'Invalid Participant ID',
                message: 'The participant ID in the URL is not valid.',
                instruction: 'Please use the exact link provided to you. The participant ID should be 24 characters.',
                recoverable: false
            },
            [this.errorTypes.STUDY_FULL]: {
                title: 'Study Complete',
                message: 'This study has reached the required number of participants.',
                instruction: 'Thank you for your interest. You may close this window.',
                recoverable: false
            },
            [this.errorTypes.SAVE_ERROR]: {
                title: 'Save Error',
                message: 'Unable to save your data.',
                instruction: 'Your conversation is still active. Please try the action again.',
                recoverable: true
            },
            [this.errorTypes.SERVER_ERROR]: {
                title: 'Server Error',
                message: 'The server is experiencing technical difficulties.',
                instruction: 'Please wait a moment and try again.',
                recoverable: true
            },
            [this.errorTypes.UNKNOWN]: {
                title: 'Unexpected Error',
                message: 'An unexpected error occurred.',
                instruction: 'Please screenshot this error and contact the researchers via Prolific.',
                recoverable: true
            }
        };

        return messages[errorType] || messages[this.errorTypes.UNKNOWN];
    }

    /**
     * Show error page/modal
     * @param {Error} error - Error object
     */
    showError(error) {
        const errorType = this.classifyError(error);
        const errorInfo = this.getErrorInfo(errorType);

        console.error('📛 Showing error:', { errorType, error: error.message });

        // Create error overlay
        const overlay = document.createElement('div');
        overlay.id = 'error-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100000;
        `;

        overlay.innerHTML = `
            <div style="
                background: #1f2937;
                border: 2px solid #ef4444;
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            ">
                <div style="
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    padding: 1.5rem;
                    text-align: center;
                ">
                    <h2 style="margin: 0; font-size: 1.25rem;">⚠️ ${errorInfo.title}</h2>
                </div>
                <div style="padding: 2rem; color: #f3f4f6;">
                    <p style="margin: 0 0 1rem 0; font-size: 1.1rem;">${errorInfo.message}</p>
                    <p style="margin: 0 0 1.5rem 0; color: #9ca3af; font-style: italic;">${errorInfo.instruction}</p>
                    <div style="
                        background: rgba(239, 68, 68, 0.1);
                        border: 1px solid rgba(239, 68, 68, 0.3);
                        border-radius: 6px;
                        padding: 1rem;
                        font-family: monospace;
                        font-size: 0.875rem;
                    ">
                        <strong>Error Code:</strong> ${errorType.toUpperCase()}_${Date.now().toString().slice(-6)}<br>
                        <strong>Participant:</strong> ${this.participantId || 'Unknown'}<br>
                        <strong>Task:</strong> ${this.taskName}
                    </div>
                </div>
                <div style="
                    background: #374151;
                    padding: 1rem 2rem;
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                ">
                    ${errorInfo.recoverable ? `
                        <button onclick="location.reload()" style="
                            background: #ef4444;
                            color: white;
                            border: none;
                            padding: 0.75rem 1.5rem;
                            border-radius: 6px;
                            font-weight: 500;
                            cursor: pointer;
                        ">Try Again</button>
                    ` : ''}
                    <button onclick="window.close(); document.getElementById('error-overlay').remove();" style="
                        background: transparent;
                        color: #9ca3af;
                        border: 1px solid #6b7280;
                        padding: 0.75rem 1.5rem;
                        border-radius: 6px;
                        font-weight: 500;
                        cursor: pointer;
                    ">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    // ===================================================================
    // UTILITY METHODS
    // ===================================================================

    /**
     * Get model icon path based on model name
     * @returns {string} Path to model icon
     */
    getModelIcon() {
        const model = this.config?.displayName || '';
        return model.toLowerCase().includes('claude')
            ? '/images/claude.png'
            : '/images/gpt.png';
    }

    /**
     * Format elapsed time as HH:MM:SS
     * @param {number} milliseconds - Elapsed time
     * @returns {string} Formatted time string
     */
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Export for use in other modules
window.StudyCore = StudyCore;