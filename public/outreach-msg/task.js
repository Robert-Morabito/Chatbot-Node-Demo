/**
 * ===================================================================
 * OUTREACH MESSAGE TASK PAGE
 * ===================================================================
 * 
 * Task Configuration:
 * - Image generation: DISABLED
 * - Copy/paste: ENABLED
 * - Task name: outreach-msg
 */

// Task configuration
const TASK_CONFIG = {
    name: 'Social Media Outreach',
    taskId: 'outreach-msg',
    icon: '📱',
    description: 'Use this chat to write a convincing outreach message!',
    enableImageGeneration: false,
    enableCopy: true
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 Initializing Outreach Message task...');

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
        chat.initialize();

        // Store globally for debugging
        window.studyCore = core;
        window.taskChat = chat;

        console.log('✅ Outreach Message task initialized successfully');

    } catch (error) {
        console.error('❌ Task initialization failed:', error);
        
        // Show error to user
        const core = new StudyCore(TASK_CONFIG.taskId);
        core.showError(error);
    }
});