/**
 * ===================================================================
 * IMAGE GENERATION TASK PAGE
 * ===================================================================
 * 
 * Task Configuration:
 * - Image generation: ENABLED
 * - Copy/paste: DISABLED
 * - Task name: image-generation
 */

// Task configuration
const TASK_CONFIG = {
    name: 'Image Generation',
    taskId: 'image-generation',
    icon: '🎨',
    description: 'Use this chat to generate images! Try typing "Make me an image of..."',
    enableImageGeneration: true,
    enableCopy: false
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎨 Initializing Image Generation task...');

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

        console.log('✅ Image Generation task initialized successfully');

    } catch (error) {
        console.error('❌ Task initialization failed:', error);
        
        // Show error to user
        const core = new StudyCore(TASK_CONFIG.taskId);
        core.showError(error);
    }
});