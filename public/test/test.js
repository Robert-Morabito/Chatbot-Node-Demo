/**
 * Test Suite for Chatbot Study
 * Comprehensive testing interface for all participant-facing functionality
 */

// Global state
let testState = {
    participantId: null,
    allocationId: null,
    currentModel: null,
    currentTask: null,
    chatHistory: [],
    generatedImages: [],
    idleTimer: null,
    idleStartTime: null
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    log('info', 'Test suite initialized');

    // Auto-populate participant ID if in URL
    const urlParams = new URLSearchParams(window.location.search);
    const pidFromUrl = urlParams.get('pid');
    if (pidFromUrl) {
        document.getElementById('participant-id').value = pidFromUrl;
        log('info', `Participant ID loaded from URL: ${pidFromUrl}`);
    }
});

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

/**
 * Log a test event
 */
function log(type, message, details = null) {
    const logContainer = document.getElementById('test-log');
    const timestamp = new Date().toLocaleTimeString();

    const icons = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        test: '🧪',
        network: '📡',
        data: '💾',
        image: '🖼️'
    };

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-icon">${icons[type] || 'ℹ️'}</span>
        <span class="log-message">${message}${details ? `\n${JSON.stringify(details, null, 2)}` : ''}</span>
    `;

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;

    console.log(`[${type.toUpperCase()}] ${message}`, details || '');
}

/**
 * Show result in a result box
 */
function showResult(elementId, content, isSuccess = true) {
    const element = document.getElementById(elementId);
    element.style.display = 'block';
    element.className = `result-box ${isSuccess ? 'success' : 'error'}`;
    element.textContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
}

/**
 * Get participant ID from input
 */
function getParticipantId() {
    const input = document.getElementById('participant-id');
    const pid = input.value.trim();

    if (!pid) {
        log('error', 'No participant ID provided');
        alert('Please enter a participant ID first');
        return null;
    }

    if (pid.length !== 24) {
        log('warning', `Participant ID is ${pid.length} characters (expected 24)`);
    }

    return pid;
}

/**
 * Generate a test participant ID
 */
function generateTestId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'TEST';
    for (let i = 0; i < 20; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('participant-id').value = id;
    log('info', `Generated test ID: ${id}`);
}

/**
 * Reset test state
 */
function resetTest() {
    if (!confirm('Reset all test data? This will clear the log and state.')) return;

    testState = {
        participantId: null,
        allocationId: null,
        currentModel: null,
        currentTask: null,
        chatHistory: [],
        generatedImages: [],
        idleTimer: null,
        idleStartTime: null
    };

    clearLog();
    log('info', 'Test state reset');
}

/**
 * Quick start - common setup
 */
async function quickStart() {
    log('test', 'Starting quick setup...');

    if (!document.getElementById('participant-id').value) {
        generateTestId();
    }

    const pid = getParticipantId();
    if (!pid) return;

    await testAllocationClaim();
    log('success', 'Quick start completed');
}

/**
 * Toggle section collapse
 */
function toggleSection(headerElement) {
    const section = headerElement.parentElement;
    section.classList.toggle('collapsed');
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        log('info', 'Copied to clipboard');
    }).catch(err => {
        log('error', 'Failed to copy', err);
    });
}

function copyLog() {
    const logContainer = document.getElementById('test-log');
    copyToClipboard(logContainer.innerText);
}

function clearLog() {
    const logContainer = document.getElementById('test-log');
    logContainer.innerHTML = `
        <div class="log-entry">
            <span class="log-time">--:--:--</span>
            <span class="log-icon">ℹ️</span>
            <span class="log-message">Log cleared</span>
        </div>
    `;
}

function copyChatlog() {
    const json = document.getElementById('chatlog-json').textContent;
    copyToClipboard(json);
}

function copyFinalData() {
    const json = document.getElementById('final-data-json').textContent;
    copyToClipboard(json);
}

// ===================================================================
// ALLOCATION TESTS
// ===================================================================

async function testAllocationClaim() {
    const pid = getParticipantId();
    if (!pid) return;

    log('test', `Testing allocation claim for: ${pid}`);

    try {
        const response = await fetch('/api/allocation/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: pid })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        testState.allocationId = data.id;
        testState.participantId = pid;

        log('success', 'Allocation claimed successfully', {
            allocationId: data.id,
            shownModel: data.shown_model,
            sourceModel: data.source_model
        });

        showResult('allocation-result', data, true);

    } catch (error) {
        log('error', 'Allocation claim failed', error.message);
        showResult('allocation-result', error.message, false);
    }
}

async function testAllocationStatus() {
    const pid = getParticipantId();
    if (!pid) return;

    log('test', `Checking allocation status for: ${pid}`);

    try {
        const response = await fetch(`/api/allocation/status?user_id=${encodeURIComponent(pid)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        log('success', 'Allocation status retrieved', data);
        showResult('allocation-result', data, true);

    } catch (error) {
        log('error', 'Allocation status check failed', error.message);
        showResult('allocation-result', error.message, false);
    }
}

async function testAllocationRelease() {
    const pid = getParticipantId();
    if (!pid) return;

    if (!confirm('Release allocation? This will free up the slot.')) return;

    log('test', `Releasing allocation for: ${pid}`);

    try {
        const response = await fetch('/api/allocation/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: pid })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        log('success', 'Allocation released successfully');
        showResult('allocation-result', 'Allocation released', true);

        testState.allocationId = null;

    } catch (error) {
        log('error', 'Allocation release failed', error.message);
        showResult('allocation-result', error.message, false);
    }
}

async function testAllocationConfirm() {
    const pid = getParticipantId();
    if (!pid) return;

    log('test', `Confirming allocation for: ${pid}`);

    try {
        const response = await fetch('/api/allocation/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: pid })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        log('success', 'Allocation confirmed successfully');
        showResult('allocation-result', 'Allocation marked as submitted', true);

    } catch (error) {
        log('error', 'Allocation confirm failed', error.message);
        showResult('allocation-result', error.message, false);
    }
}

// ===================================================================
// CHAT TESTS
// ===================================================================

async function testChat(model) {
    const message = document.getElementById('chat-message').value.trim();

    if (!message) {
        log('error', 'No message provided');
        alert('Please enter a message first');
        return;
    }

    log('test', `Testing chat with ${model}`, { message });

    const resultDiv = document.getElementById('chat-result');
    const responseDiv = document.getElementById('chat-response');

    resultDiv.style.display = 'block';
    responseDiv.innerHTML = '<em>Waiting for response...</em>';

    try {
        const messages = [
            { sender: 'User', content: message }
        ];

        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                model,
                sessionId: testState.allocationId || 'test-session',
                conversationId: `test_${Date.now()}`
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Handle SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'content') {
                            fullResponse = data.fullContent || fullResponse + data.content;
                            responseDiv.textContent = fullResponse;
                        } else if (data.type === 'done') {
                            log('success', `Chat response received (${fullResponse.length} chars)`, {
                                model,
                                finishReason: data.finishReason
                            });
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        console.error('Parse error:', parseError);
                    }
                }
            }
        }

        testState.chatHistory.push({
            model,
            message,
            response: fullResponse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log('error', `Chat test failed with ${model}`, error.message);
        responseDiv.innerHTML = `<span style="color: #ef4444;">Error: ${error.message}</span>`;
    }
}

// ===================================================================
// IMAGE GENERATION TESTS
// ===================================================================

async function testImageGeneration() {
    const prompt = document.getElementById('image-prompt').value.trim();

    if (!prompt) {
        log('error', 'No image prompt provided');
        alert('Please enter an image prompt first');
        return;
    }

    log('test', 'Testing image generation', { prompt });

    const resultDiv = document.getElementById('image-result');
    const statusDiv = document.getElementById('image-status');
    const previewDiv = document.getElementById('image-preview');
    const infoDiv = document.getElementById('image-info');

    resultDiv.style.display = 'block';
    statusDiv.innerHTML = '<span class="status-badge pending">Generating...</span>';
    previewDiv.innerHTML = '';
    infoDiv.innerHTML = '';

    try {
        const messages = [
            { sender: 'User', content: prompt }
        ];

        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                model: 'gpt-4-0125-preview', // Use GPT-4 for image gen
                sessionId: testState.allocationId || 'test-session',
                conversationId: `image-generation_${Date.now()}`,
                imageContext: null
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Handle SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let imageData = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'image_request_detected') {
                            statusDiv.innerHTML = '<span class="status-badge pending">Image request detected...</span>';
                        } else if (data.type === 'content' && data.imageUrl) {
                            imageData = data;

                            statusDiv.innerHTML = '<span class="status-badge success">Image Generated!</span>';

                            previewDiv.innerHTML = `
                                <img src="${data.imageUrl}" alt="Generated image">
                            `;

                            infoDiv.innerHTML = `
                                <div class="info-badge">Prompt: ${data.imagePrompt || 'N/A'}</div>
                                <div class="info-badge">URL Type: ${data.imageUrl.startsWith('data:') ? 'Base64' : 'External'}</div>
                                <div class="info-badge">Size: ${(data.imageUrl.length / 1024).toFixed(2)} KB</div>
                            `;

                            log('success', 'Image generated successfully', {
                                originalPrompt: data.originalPrompt,
                                enhancedPrompt: data.imagePrompt,
                                urlType: data.imageUrl.startsWith('data:') ? 'base64' : 'external'
                            });

                            testState.generatedImages.push(imageData);
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        console.error('Parse error:', parseError);
                    }
                }
            }
        }

    } catch (error) {
        log('error', 'Image generation failed', error.message);
        statusDiv.innerHTML = `<span class="status-badge error">Error: ${error.message}</span>`;
    }
}

async function testImageError() {
    log('test', 'Testing image error handling');

    // Save original prompt
    const originalPrompt = document.getElementById('image-prompt').value;

    // Test with a normal prompt but we'll check for error patterns in response
    document.getElementById('image-prompt').value = 'Generate an image of a sunset';

    log('info', 'Generating image to test error detection patterns...');
    log('info', 'Note: Check server logs for error detection and retry logic');
    log('info', 'DALL-E text errors (e.g. "I cannot generate") should trigger retries');
    log('info', 'Content policy violations should be shown to user');

    await testImageGeneration();

    // Restore original prompt
    setTimeout(() => {
        document.getElementById('image-prompt').value = originalPrompt;
    }, 1000);
}

async function testImageRetry() {
    log('test', 'Testing image retry logic (simulated)');
    log('info', 'Note: This tests the retry flow by observing server logs');

    // This would need server-side instrumentation to properly test
    // For now, we'll just generate an image and observe
    await testImageGeneration();
}

async function testBlobConversion() {
    if (testState.generatedImages.length === 0) {
        log('error', 'No images generated yet. Generate an image first.');
        alert('Please generate an image first');
        return;
    }

    const lastImage = testState.generatedImages[testState.generatedImages.length - 1];

    log('test', 'Testing blob to base64 conversion');
    log('info', `Image URL type: ${lastImage.imageUrl.startsWith('data:') ? 'Already base64' : 'External blob'}`);

    if (lastImage.imageUrl.startsWith('data:')) {
        log('success', 'Image is already in base64 format (no blob conversion needed)');
    } else {
        log('warning', 'Image is still using external URL (blob conversion not implemented yet)');
    }
}

function testImageDownload() {
    if (testState.generatedImages.length === 0) {
        log('error', 'No images to download');
        alert('Please generate an image first');
        return;
    }

    const lastImage = testState.generatedImages[testState.generatedImages.length - 1];

    log('test', 'Testing image download functionality');

    try {
        const link = document.createElement('a');
        link.href = lastImage.imageUrl;
        link.download = `test-image-${Date.now()}.png`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        log('success', 'Image download triggered');
    } catch (error) {
        log('error', 'Image download failed', error.message);
    }
}

async function testGitHubUpload() {
    log('test', 'Verifying GitHub upload');
    log('info', 'Note: GitHub uploads happen server-side during save operations');
    log('info', 'Check your GitHub repo manually at: Chatbot-Node-Storage/images/');
}

// ===================================================================
// SAVE/LOAD TESTS
// ===================================================================

async function testAutoSave() {
    const pid = getParticipantId();
    if (!pid) return;

    log('test', 'Testing auto-save functionality');

    const taskData = {
        conversations: {
            [`test-conversation-${Date.now()}`]: {
                id: `test_${Date.now()}`,
                messages: testState.chatHistory.map((chat, i) => ({
                    msg_id: i + 1,
                    sender: 'User',
                    content: chat.message,
                    timestamp: chat.timestamp
                }))
            }
        },
        behaviorMetrics: {
            messageCount: testState.chatHistory.length,
            sessionDuration: Date.now() - testState.idleStartTime || 0
        },
        savedAt: new Date().toISOString()
    };

    try {
        const response = await fetch('/api/chat/save-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                participantId: pid,
                taskName: 'image-generation',
                sessionId: testState.allocationId,
                modelConfig: {
                    displayedModel: 'GPT-4',
                    actualModel: 'gpt-4-0125-preview'
                },
                taskData
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }

        log('success', 'Auto-save successful', result);
        showResult('save-result', result, true);

    } catch (error) {
        log('error', 'Auto-save failed', error.message);
        showResult('save-result', error.message, false);
    }
}

async function testManualSave() {
    await testAutoSave(); // Same logic for manual save
}

async function testTaskRetrieval() {
    const pid = getParticipantId();
    if (!pid) return;

    log('test', 'Testing task data retrieval');

    try {
        const response = await fetch(`/api/chat/participant-data?pid=${encodeURIComponent(pid)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        log('success', 'Task data retrieved', {
            participantId: data.participantId,
            tasksFound: Object.keys(data.tasks || {}).length
        });

        showResult('save-result', data, true);

        // Show chatlog preview
        document.getElementById('chatlog-preview').style.display = 'block';
        document.getElementById('chatlog-json').textContent = JSON.stringify(data, null, 2);

    } catch (error) {
        log('error', 'Task retrieval failed', error.message);
        showResult('save-result', error.message, false);
    }
}

async function testFinalCompilation() {
    const pid = getParticipantId();
    if (!pid) return;

    log('test', 'Testing final data compilation');

    try {
        // First retrieve all task data
        await testTaskRetrieval();

        // Then simulate compilation (this happens in acro-build task.js)
        log('info', 'Final compilation happens in the acro-build page');
        log('info', 'Check the "Final Task Tests" section for simulation');

    } catch (error) {
        log('error', 'Final compilation test failed', error.message);
    }
}

// ===================================================================
// IDLE DETECTION TESTS
// ===================================================================

function startIdleTest() {
    log('test', 'Starting idle detection test (accelerated: 30s real = 30min simulated)');

    testState.idleStartTime = Date.now();

    if (testState.idleTimer) {
        clearInterval(testState.idleTimer);
    }

    const resultDiv = document.getElementById('idle-result');
    resultDiv.style.display = 'block';
    resultDiv.className = 'result-box';
    resultDiv.textContent = 'Idle timer started. Warning at 25s, auto-release at 30s.';

    testState.idleTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - testState.idleStartTime) / 1000);
        document.getElementById('idle-time').textContent = `${elapsed}s`;

        const progress = (elapsed / 30) * 100;
        document.getElementById('idle-progress').style.width = `${Math.min(progress, 100)}%`;

        if (elapsed === 25) {
            triggerIdleWarning();
        } else if (elapsed >= 30) {
            triggerIdleRelease();
            stopIdleTest();
        }
    }, 1000);
}

function triggerIdleWarning() {
    log('warning', 'Idle warning triggered (25 minutes simulated)');

    const resultDiv = document.getElementById('idle-result');
    resultDiv.className = 'result-box error';
    resultDiv.textContent = '⚠️ IDLE WARNING: You have been idle for 25 minutes. Click to continue or you will be logged out in 5 minutes.';

    // Show modal (simulated)
    if (confirm('⚠️ Idle Warning\n\nYou have been idle for 25 minutes.\nYou will lose your position in 5 minutes.\n\nClick OK to stay active.')) {
        log('info', 'User clicked to stay active');
        stopIdleTest();
    }
}

function triggerIdleRelease() {
    log('error', 'Auto-release triggered (30 minutes simulated)');

    const resultDiv = document.getElementById('idle-result');
    resultDiv.className = 'result-box error';
    resultDiv.textContent = '❌ AUTO-RELEASE: Position released due to 30 minutes of inactivity.';

    // Would call testAllocationRelease() in production
}

function stopIdleTest() {
    if (testState.idleTimer) {
        clearInterval(testState.idleTimer);
        testState.idleTimer = null;
        log('info', 'Idle timer stopped');
    }
}

// ===================================================================
// FINAL TASK TESTS
// ===================================================================

async function testCompleteStudy() {
    const pid = getParticipantId();
    if (!pid) return;

    log('test', 'Simulating complete study workflow');

    try {
        // 1. Retrieve all task data
        log('info', 'Step 1: Retrieving all task data...');
        const response = await fetch(`/api/chat/participant-data?pid=${encodeURIComponent(pid)}`);
        const allTasksData = await response.json();

        if (!response.ok) {
            throw new Error('Failed to retrieve task data');
        }

        // 2. Compile complete dataset
        log('info', 'Step 2: Compiling complete dataset...');
        const completeData = {
            participantId: pid,
            sessionId: testState.allocationId || 'test-session',
            modelConfig: {
                displayedModel: 'GPT-4',
                actualModel: 'gpt-4-0125-preview'
            },
            tasks: allTasksData.tasks,
            completedAt: new Date().toISOString(),
            studyVersion: '2.0'
        };

        // 3. Save to finished folder
        log('info', 'Step 3: Saving to finished folder...');
        const saveResponse = await fetch('/api/chat/save-finished', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completeData)
        });

        const saveResult = await saveResponse.json();

        if (!saveResponse.ok) {
            throw new Error(saveResult.error || 'Failed to save finished data');
        }

        log('success', 'Complete study simulation successful', saveResult);
        showResult('final-result', saveResult, true);

        // Show preview
        document.getElementById('final-data-preview').style.display = 'block';
        document.getElementById('final-data-json').textContent = JSON.stringify(completeData, null, 2);

    } catch (error) {
        log('error', 'Complete study simulation failed', error.message);
        showResult('final-result', error.message, false);
    }
}

function testFinalDownload() {
    log('test', 'Testing final data download');

    const pid = getParticipantId();
    if (!pid) return;

    // Simulate download
    const mockData = {
        participantId: pid,
        sessionId: testState.allocationId,
        tasks: {},
        completedAt: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(mockData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `study-data-${pid}-${Date.now()}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    log('success', 'Final data downloaded');
}

function testSanitization() {
    log('test', 'Testing data sanitization (removing trueModel fields)');

    const rawData = {
        participantId: 'TEST123',
        modelConfig: {
            displayedModel: 'GPT-4',
            actualModel: 'gpt-4-0125-preview', // Should be removed
            trueModel: 'gpt-4-0125-preview', // Should be removed
            givenModel: 'GPT-4'
        }
    };

    // Sanitize
    const sanitized = JSON.parse(JSON.stringify(rawData));
    delete sanitized.modelConfig.actualModel;
    delete sanitized.modelConfig.trueModel;

    log('success', 'Data sanitized successfully');
    showResult('final-result', {
        before: rawData,
        after: sanitized
    }, true);
}

async function verifyGitHubFinished() {
    log('test', 'Verifying GitHub /finished folder');
    log('info', 'Please manually check: https://github.com/YOUR_USERNAME/Chatbot-Node-Storage/tree/main/finished');
    log('info', 'Look for folder: finished/{participantId}/complete-study-data.json');
}