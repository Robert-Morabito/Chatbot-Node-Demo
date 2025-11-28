/**
 * ===================================================================
 * ACRONYM BUILDING TASK PAGE (FINAL TASK)
 * ===================================================================
 * 
 * Task Configuration:
 * - Image generation: DISABLED
 * - Copy/paste: DISABLED
 * - Task name: acro-build
 * - Special: This is the final task, includes data compilation & download
 */

// Task configuration
const TASK_CONFIG = {
    name: 'Acronym Building',
    taskId: 'acro-build',
    icon: '🔤',
    description: 'Use this chat to create some funny acronyms!',
    enableImageGeneration: false,
    enableCopy: false,
    isFinalTask: true
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔤 Initializing Acronym Building task (FINAL)...');

    try {
        // Initialize StudyCore
        const core = new StudyCore(TASK_CONFIG.taskId);

        // Extract participant ID from URL
        const participantId = core.extractParticipantIdFromUrl();
        
        if (!participantId) {
            throw new Error('No participant ID found in URL. Please use the link provided to you.');
        }

        console.log('👤 Participant ID:', participantId);

        // Verify allocation
        await core.verifyAllocation();

        console.log('✅ Allocation verified:', {
            displayedModel: core.config.displayName,
            actualModel: core.config.trueModel
        });

        // Initialize chat with task config
        const chat = new TaskChat(core, TASK_CONFIG);
        
        // Override completeTask for final task
        chat.completeTask = async function() {
            await completeFinalTask(core, chat);
        };
        
        chat.initialize();

        // Store globally for debugging
        window.studyCore = core;
        window.taskChat = chat;

        console.log('✅ Acronym Building task (FINAL) initialized successfully');

    } catch (error) {
        console.error('❌ Task initialization failed:', error);
        
        // Show error to user
        const core = new StudyCore(TASK_CONFIG.taskId);
        core.showError(error);
    }
});

/**
 * Complete final task with full study compilation
 */
async function completeFinalTask(core, chat) {
    console.log('🏁 Completing final task and study...');

    // Show confirmation
    const confirmed = await showFinalConfirmation();
    if (!confirmed) return;

    // Show loading indicator
    const loadingIndicator = document.getElementById('finish-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    try {
        // 1. Save current task data
        console.log('💾 Saving final task data...');
        const currentTaskData = chat.getExportData();
        await core.saveTaskData(currentTaskData, false);

        // 2. Fetch all task data
        console.log('📥 Fetching all task data...');
        const allTasksResponse = await fetch(`/api/chat/participant-data?pid=${encodeURIComponent(core.participantId)}`);
        
        if (!allTasksResponse.ok) {
            throw new Error('Failed to fetch complete study data');
        }

        const allTasksData = await allTasksResponse.json();

        // 3. Compile complete dataset
        console.log('📦 Compiling complete study data...');
        const completeData = {
            participantId: core.participantId,
            sessionId: core.allocation.id,
            modelConfig: {
                displayedModel: core.config.givenModel,
                actualModel: core.config.trueModel,
                allocationId: core.allocation.id
            },
            tasks: allTasksData.tasks,
            completedAt: new Date().toISOString(),
            studyVersion: '2.0'
        };

        // 4. Download for participant
        console.log('⬇️ Downloading study data...');
        downloadStudyData(completeData);

        // 5. Save to "finished" folder on GitHub
        console.log('🏁 Saving to finished folder...');
        await saveToFinishedFolder(completeData);

        // 6. Confirm allocation in database
        console.log('✅ Confirming allocation...');
        await core.confirmAllocation();

        // 7. Stop timers
        chat.stopSessionTimer();
        core.stopAutoSave();

        // 8. Show completion page
        showStudyCompletionPage();

    } catch (error) {
        console.error('❌ Study completion failed:', error);
        
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        
        alert('There was an error completing the study. Your data has been saved. Please contact the researchers with this error: ' + error.message);
    }
}

/**
 * Show final confirmation dialog
 */
function showFinalConfirmation() {
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
 * Download complete study data for participant
 */
function downloadStudyData(completeData) {
    const jsonContent = JSON.stringify(completeData, null, 2);
    const filename = `study-data-${completeData.participantId}-${Date.now()}.json`;

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

    console.log('✅ Study data downloaded:', filename);
}

/**
 * Save complete data to "finished" folder on GitHub
 */
async function saveToFinishedFolder(completeData) {
    const response = await fetch('/api/chat/save-finished', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to save to finished folder: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Saved to finished folder:', result);
}

/**
 * Show study completion page
 */
function showStudyCompletionPage() {
    document.body.innerHTML = `
        <div style="
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
            color: #f3f4f6;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            padding: 2rem;
        ">
            <div style="max-width: 600px;">
                <h1 style="color: #10b981; margin-bottom: 20px; font-size: 2.5rem;">🏁 Study Completed!</h1>
                
                <p style="font-size: 1.25rem; margin-bottom: 15px; color: #e5e7eb;">
                    Thank you for participating. Your data has been downloaded.
                </p>
                
                <div style="
                    background: rgba(59, 130, 246, 0.1);
                    border: 2px solid rgba(59, 130, 246, 0.3);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 2rem 0;
                    text-align: left;
                ">
                    <p style="font-size: 1.125rem; line-height: 1.6; margin: 0; color: #d1d5db;">
                        <strong style="color: #60a5fa;">Next Steps:</strong><br><br>
                        1. Locate the downloaded JSON file on your computer<br>
                        2. Return to the Tally survey<br>
                        3. Upload the file when prompted<br>
                        4. Complete any remaining survey questions
                    </p>
                </div>

                <p style="color: #9ca3af; margin-top: 30px; font-size: 0.9375rem;">
                    You may close this window when you're ready.
                </p>
            </div>
        </div>
    `;
}