/**
 * Test Suite for Chatbot Study
 * Routes through ACTUAL participant functions - no rewrites
 */

// Global state
let testState = {
    participantId: null,
    allocationId: null,
    chatHistory: [],
    generatedImages: [],
    currentDataCache: null,
    currentTask: 'image-generation' // Track current task for saves
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    log('info', 'Test suite ready');

    const urlParams = new URLSearchParams(window.location.search);
    const pidFromUrl = urlParams.get('pid');
    if (pidFromUrl) {
        document.getElementById('participant-id').value = pidFromUrl;
        log('info', `Loaded PID from URL: ${pidFromUrl}`);
    }
});

// ===================================================================
// LOGGING SYSTEM
// ===================================================================

function log(type, message) {
    const logContainer = document.getElementById('test-log');
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

    const icons = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        start: '▶️',
        finish: '⏹️'
    };

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-icon">${icons[type] || 'ℹ️'}</span>
        <span class="log-message">${message}</span>
    `;

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearLog() {
    const logContainer = document.getElementById('test-log');
    logContainer.innerHTML = '<div class="log-entry"><span class="log-time">--:--:--</span><span class="log-icon">ℹ️</span><span class="log-message">Log cleared</span></div>';
}

function copyLog() {
    const logContainer = document.getElementById('test-log');
    const text = Array.from(logContainer.querySelectorAll('.log-entry'))
        .map(entry => entry.innerText)
        .join('\n');

    navigator.clipboard.writeText(text).then(() => {
        log('info', 'Log copied to clipboard');
    });
}

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

function showResult(elementId, content, isSuccess = true) {
    const element = document.getElementById(elementId);
    element.style.display = 'block';
    element.className = `result-box ${isSuccess ? 'success' : 'error'}`;
    element.textContent = typeof content === 'object'
        ? JSON.stringify(content, null, 2)
        : content;
}

function getParticipantId() {
    const input = document.getElementById('participant-id');
    const pid = input.value.trim();

    if (!pid) {
        log('error', 'No participant ID provided');
        alert('Please enter a participant ID first');
        return null;
    }

    if (pid.length !== 24) {
        log('warning', `PID is ${pid.length} chars (expected 24)`);
    }

    return pid;
}

function generateTestId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'TEST';
    for (let i = 0; i < 20; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('participant-id').value = id;
    log('info', `Generated test ID: ${id}`);
}

function resetTest() {
    if (!confirm('Reset all test data?')) return;

    testState = {
        participantId: null,
        allocationId: null,
        chatHistory: [],
        generatedImages: [],
        currentDataCache: null,
        currentTask: 'image-generation'
    };

    clearLog();
}

async function quickStart() {
    log('start', 'Running quick setup...');

    if (!document.getElementById('participant-id').value) {
        generateTestId();
    }

    const pid = getParticipantId();
    if (!pid) return;

    await testAllocationClaim();
    log('finish', 'Quick setup complete');
}

function toggleSection(headerElement) {
    const section = headerElement.parentElement;
    section.classList.toggle('collapsed');
}

/**
 * Set current task context (for proper save routing)
 */
function setCurrentTask(taskName) {
    testState.currentTask = taskName;
    log('info', `Task context set to: ${taskName}`);
}

// ===================================================================
// ALLOCATION TESTS (Routes through /api/allocation/*)
// ===================================================================

async function testAllocationClaim() {
    const pid = getParticipantId();
    if (!pid) return;

    log('start', `Claiming allocation for ${pid}`);

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

        log('success', `Claimed allocation #${data.id}`);
        log('info', `Assigned: ${data.shown_model} (actual: ${data.source_model})`);

        showResult('allocation-result', `Allocation #${data.id}\nShown: ${data.shown_model}\nActual: ${data.source_model}`, true);

    } catch (error) {
        log('error', `Claim failed: ${error.message}`);
        showResult('allocation-result', error.message, false);
    }
}

async function testAllocationStatus() {
    const pid = getParticipantId();
    if (!pid) return;

    log('start', 'Checking allocation status');

    try {
        const response = await fetch(`/api/allocation/status?user_id=${encodeURIComponent(pid)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        log('success', `Status: ${data.submitted ? 'Submitted' : 'Active'}`);
        showResult('allocation-result', `Allocation #${data.id}\nStatus: ${data.submitted ? 'Submitted' : 'Active'}`, true);

    } catch (error) {
        log('error', `Status check failed: ${error.message}`);
        showResult('allocation-result', error.message, false);
    }
}

async function testAllocationRelease() {
    const pid = getParticipantId();
    if (!pid) return;

    if (!confirm('Release allocation? This frees the slot.')) return;

    log('start', 'Releasing allocation');

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

        log('success', 'Allocation released');
        showResult('allocation-result', 'Released successfully', true);
        testState.allocationId = null;

    } catch (error) {
        log('error', `Release failed: ${error.message}`);
        showResult('allocation-result', error.message, false);
    }
}

async function testAllocationConfirm() {
    const pid = getParticipantId();
    if (!pid) return;

    log('start', 'Confirming allocation');

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

        log('success', 'Allocation confirmed as submitted');
        showResult('allocation-result', 'Confirmed successfully', true);

    } catch (error) {
        log('error', `Confirm failed: ${error.message}`);
        showResult('allocation-result', error.message, false);
    }
}

// ===================================================================
// CHAT TESTS (Routes through /api/chat/stream - SAME as chat.js)
// ===================================================================

async function testChat(model) {
    const message = document.getElementById('chat-message').value.trim();

    if (!message) {
        log('error', 'No message provided');
        alert('Enter a message first');
        return;
    }

    log('start', `Testing ${model}`);
    log('info', `Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

    const resultDiv = document.getElementById('chat-result');
    const responseDiv = document.getElementById('chat-response');

    resultDiv.style.display = 'block';
    responseDiv.innerHTML = '<em>Waiting...</em>';

    try {
        const messages = [{ sender: 'User', content: message }];

        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                model,
                sessionId: testState.allocationId || 'test-session',
                conversationId: `${testState.currentTask}_${Date.now()}`
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

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
                            log('success', `Response received (${fullResponse.length} chars)`);
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        // Skip parse errors
                    }
                }
            }
        }

        testState.chatHistory.push({
            model,
            message,
            response: fullResponse,
            task: testState.currentTask,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log('error', `Chat failed: ${error.message}`);
        responseDiv.innerHTML = `<span style="color: #fca5a5;">Error: ${error.message}</span>`;
    }
}

// ===================================================================
// IMAGE GENERATION TESTS (Routes through /api/chat/stream - SAME as chat.js)
// ===================================================================

async function testImageGeneration() {
    const prompt = document.getElementById('image-prompt').value.trim();

    if (!prompt) {
        log('error', 'No image prompt');
        alert('Enter a prompt first');
        return;
    }

    log('start', 'Generating image');
    log('info', `Prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

    const resultDiv = document.getElementById('image-result');
    const previewDiv = document.getElementById('image-preview');
    const infoDiv = document.getElementById('image-info');

    resultDiv.style.display = 'block';

    // Add timer display
    previewDiv.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
            <div style="color: #9ca3af; margin-bottom: 0.5rem;">Generating image...</div>
            <div style="font-family: monospace; font-size: 1.5rem; color: #60a5fa;" id="generation-timer">0.0s</div>
        </div>
    `;
    infoDiv.innerHTML = '';

    // Start timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const timerEl = document.getElementById('generation-timer');
        if (timerEl) {
            timerEl.textContent = `${elapsed}s`;
        }
    }, 100);

    try {
        const messages = [{ sender: 'User', content: prompt }];

        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                model: 'gpt-4-0125-preview',
                sessionId: testState.allocationId || 'test-session',
                conversationId: `image-generation_${Date.now()}`,
                imageContext: null
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let imageData = null;
        let detectedImageRequest = false;

        // Buffer for accumulating incomplete SSE events
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                log('info', 'Stream ended');
                break;
            }

            // Decode chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete SSE events (terminated by \n\n)
            const events = buffer.split('\n\n');

            // Keep the last incomplete event in buffer
            buffer = events.pop() || '';

            // Process each complete event
            for (const event of events) {
                if (!event.trim()) continue;

                const lines = event.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.slice(6));

                        // Log server events to client
                        if (data.type === 'server_log') {
                            log('info', `[SERVER] ${data.message}`);
                            continue;
                        }

                        if (data.type === 'image_request_detected') {
                            detectedImageRequest = true;
                            log('info', 'Image request detected by classifier');

                        } else if (data.type === 'content' && data.imageUrl) {
                            clearInterval(timerInterval);
                            const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

                            imageData = data;

                            const isBase64 = data.imageUrl.startsWith('data:');
                            const format = data.imageFormat || (isBase64 ? 'base64' : 'blob');
                            const sizeKB = data.imageSize || (data.imageUrl.length / 1024).toFixed(1);

                            log('success', `Image generated in ${totalTime}s (${sizeKB} KB)`);
                            log('info', `Format: ${format}`);

                            if (data.imagePrompt) {
                                log('info', `Enhanced: "${data.imagePrompt.substring(0, 60)}${data.imagePrompt.length > 60 ? '...' : ''}"`);
                            }

                            if (data.revisedPrompt) {
                                log('info', `DALL-E: "${data.revisedPrompt.substring(0, 60)}${data.revisedPrompt.length > 60 ? '...' : ''}"`);
                            }

                            // Display the image
                            previewDiv.innerHTML = `<img src="${data.imageUrl}" alt="Generated" style="max-width: 100%; border-radius: 8px;">`;

                            infoDiv.innerHTML = `
                                <div class="info-badge">Time: ${totalTime}s</div>
                                <div class="info-badge">Size: ${sizeKB} KB</div>
                                <div class="info-badge">Format: ${format}</div>
                                <div class="info-badge">Type: ${isBase64 ? '✅ Data URL' : '⚠️ External'}</div>
                            `;

                            testState.generatedImages.push(imageData);

                        } else if (data.type === 'done') {
                            log('info', 'Generation complete');

                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        // Only log if it's not just whitespace
                        if (line.trim()) {
                            console.warn('Parse error on line:', line.substring(0, 100));
                        }
                    }
                }
            }
        }

        clearInterval(timerInterval);

        if (!imageData) {
            throw new Error('No image data received from stream');
        }

    } catch (error) {
        clearInterval(timerInterval);
        log('error', `Image generation failed: ${error.message}`);
        previewDiv.innerHTML = `<span style="color: #fca5a5;">Error: ${error.message}</span>`;
    }
}

async function testImageError() {
    log('info', 'Testing error handling with policy violation');
    const originalPrompt = document.getElementById('image-prompt').value;
    document.getElementById('image-prompt').value = 'Generate violent content';
    await testImageGeneration();
    setTimeout(() => {
        document.getElementById('image-prompt').value = originalPrompt;
    }, 1000);
}

async function testImageRetry() {
    log('info', 'Testing retry logic (observe server logs)');
    await testImageGeneration();
}

function testImageDownload() {
    if (testState.generatedImages.length === 0) {
        log('error', 'No images to download');
        alert('Generate an image first');
        return;
    }

    const lastImage = testState.generatedImages[testState.generatedImages.length - 1];

    log('start', 'Testing download');

    try {
        const link = document.createElement('a');
        link.href = lastImage.imageUrl;
        link.download = `test-image-${Date.now()}.png`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        log('success', 'Download triggered');
    } catch (error) {
        log('error', `Download failed: ${error.message}`);
    }
}

async function testGitHubUpload() {
    if (testState.generatedImages.length === 0) {
        log('error', 'No images to upload');
        alert('Generate an image first');
        return;
    }

    const pid = getParticipantId();
    if (!pid) return;

    const lastImage = testState.generatedImages[testState.generatedImages.length - 1];

    log('start', 'Testing GitHub upload (simulating task save)');
    log('info', 'This uses the same path as task completion');

    try {
        // Extract base64 from data URL
        const base64Data = lastImage.imageUrl.replace(/^data:image\/\w+;base64,/, '');

        // Generate test filename
        const timestamp = Date.now();
        const filename = `${pid}_chat1_msg1_test.png`;

        log('info', `Uploading as: ${filename}`);
        log('info', `Size: ${lastImage.imageSize || 'unknown'} KB`);

        // Upload to GitHub using your existing endpoint
        const response = await fetch('/api/test/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                participantId: pid,
                filename: filename,
                base64: base64Data,
                metadata: {
                    originalPrompt: lastImage.originalPrompt,
                    enhancedPrompt: lastImage.imagePrompt,
                    size: lastImage.imageSize
                }
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }

        log('success', `Image uploaded to GitHub`);
        log('info', `Path: images/${pid}/${filename}`);
        log('info', `SHA: ${result.sha?.substring(0, 8)}...`);

        // Show success in UI
        const infoDiv = document.getElementById('image-info');
        const uploadBadge = document.createElement('div');
        uploadBadge.className = 'info-badge';
        uploadBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        uploadBadge.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        uploadBadge.textContent = '✅ Uploaded to GitHub';
        infoDiv.appendChild(uploadBadge);

    } catch (error) {
        log('error', `GitHub upload failed: ${error.message}`);
        alert(`Upload failed: ${error.message}`);
    }
}

// ===================================================================
// SAVE/LOAD TESTS (Routes through /api/chat/save-task - SAME as core.js)
// ===================================================================

async function testManualSave() {
    const pid = getParticipantId();
    if (!pid) return;

    log('start', `Testing manual save (task: ${testState.currentTask})`);

    // Filter chat history for current task
    const taskChats = testState.chatHistory.filter(chat => chat.task === testState.currentTask);

    const taskData = {
        conversations: {
            [`test_${Date.now()}`]: {
                messages: taskChats.map((chat, i) => ({
                    msg_id: i + 1,
                    sender: 'User',
                    content: chat.message,
                    timestamp: chat.timestamp
                }))
            }
        },
        behaviorMetrics: {
            messageCount: taskChats.length
        },
        savedAt: new Date().toISOString(),
        savedVia: 'manual'
    };

    try {
        const response = await fetch('/api/chat/save-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                participantId: pid,
                taskName: testState.currentTask, // ✅ FIXED: Now uses current task
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

        log('success', `Manual save successful for ${testState.currentTask}`);
        log('info', `Saved ${taskChats.length} messages`);

    } catch (error) {
        log('error', `Manual save failed: ${error.message}`);
    }
}

async function testAutoSave() {
    const pid = getParticipantId();
    if (!pid) return;

    log('start', `Testing auto-save (task: ${testState.currentTask})`);

    // Filter chat history for current task
    const taskChats = testState.chatHistory.filter(chat => chat.task === testState.currentTask);

    const taskData = {
        conversations: {
            [`test_${Date.now()}`]: {
                messages: taskChats.map((chat, i) => ({
                    msg_id: i + 1,
                    sender: 'User',
                    content: chat.message,
                    timestamp: chat.timestamp
                }))
            }
        },
        behaviorMetrics: {
            messageCount: taskChats.length
        },
        savedAt: new Date().toISOString(),
        savedVia: 'auto'
    };

    try {
        const response = await fetch('/api/chat/save-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                participantId: pid,
                taskName: testState.currentTask, // ✅ FIXED: Now uses current task
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

        log('success', `Auto-save successful for ${testState.currentTask}`);
        log('info', `Saved ${taskChats.length} messages`);

    } catch (error) {
        log('error', `Auto-save failed: ${error.message}`);
    }
}

// ===================================================================
// DATA RETRIEVAL & DOWNLOAD (Routes through /api/chat/participant-data)
// ===================================================================

async function retrieveSelectedData() {
    const pid = getParticipantId();
    if (!pid) return;

    const selector = document.getElementById('data-select');
    const selection = selector.value;

    log('start', `Retrieving ${selection}`);

    try {
        if (selection === 'final') {
            // Retrieve all tasks for final compilation
            const response = await fetch(`/api/chat/participant-data?pid=${encodeURIComponent(pid)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            testState.currentDataCache = data;

            const taskCount = Object.keys(data.tasks || {}).length;
            log('success', `Retrieved final data (${taskCount} tasks)`);

            const displayArea = document.getElementById('data-display');
            displayArea.style.display = 'block';
            displayArea.textContent = JSON.stringify(data, null, 2);

        } else {
            // Retrieve specific task
            const response = await fetch(`/api/chat/participant-data?pid=${encodeURIComponent(pid)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            const taskData = data.tasks[selection];

            if (!taskData) {
                log('warning', `No data found for ${selection}`);
                const displayArea = document.getElementById('data-display');
                displayArea.style.display = 'block';
                displayArea.textContent = `No data saved for task: ${selection}`;
                return;
            }

            testState.currentDataCache = taskData;

            log('success', `Retrieved ${selection}`);

            const displayArea = document.getElementById('data-display');
            displayArea.style.display = 'block';
            displayArea.textContent = JSON.stringify(taskData, null, 2);
        }

    } catch (error) {
        log('error', `Retrieval failed: ${error.message}`);
        const displayArea = document.getElementById('data-display');
        displayArea.style.display = 'block';
        displayArea.textContent = `Error: ${error.message}`;
    }
}

function downloadSelectedData() {
    if (!testState.currentDataCache) {
        log('error', 'No data to download. Retrieve first.');
        alert('Please retrieve data first');
        return;
    }

    const selector = document.getElementById('data-select');
    const selection = selector.value;
    const pid = getParticipantId();

    log('start', `Downloading ${selection}`);

    const jsonContent = JSON.stringify(testState.currentDataCache, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${pid}_${selection}_${Date.now()}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    log('success', `Download triggered: ${link.download}`);
}

// ===================================================================
// FINAL TASK TESTS
// ===================================================================

async function testCompleteTask() {
    const pid = getParticipantId();
    if (!pid) return;

    log('start', 'Testing "Complete Task" flow');
    log('info', 'This simulates clicking the Complete Task button');

    try {
        // Save current task data
        log('info', `Saving task: ${testState.currentTask}`);
        await testManualSave();

        log('success', 'Task completion flow successful');
        log('info', 'In production: User would see completion page');

        showResult('final-result', 'Complete Task simulation succeeded', true);

    } catch (error) {
        log('error', `Complete task failed: ${error.message}`);
        showResult('final-result', error.message, false);
    }
}

async function testFinishStudy() {
    const pid = getParticipantId();
    if (!pid) return;

    log('start', 'Testing "Finish Study" flow (final task only)');
    log('info', 'This simulates the acro-build page finish logic');

    try {
        // Step 1: Save final task
        log('info', 'Step 1: Saving final task data');
        await testManualSave();

        // Step 2: Retrieve all tasks
        log('info', 'Step 2: Retrieving all tasks');
        const response = await fetch(`/api/chat/participant-data?pid=${encodeURIComponent(pid)}`);
        const allTasksData = await response.json();

        if (!response.ok) {
            throw new Error('Failed to retrieve tasks');
        }

        // Step 3: Compile complete data
        log('info', 'Step 3: Compiling complete dataset');
        const completeData = {
            participantId: pid,
            sessionId: testState.allocationId || 'test-session',
            modelConfig: {
                displayedModel: 'GPT-4'
                // NOTE: actualModel/trueModel will be removed by sanitization
            },
            tasks: allTasksData.tasks,
            completedAt: new Date().toISOString()
        };

        // Step 4: Save to /finished
        log('info', 'Step 4: Saving to /finished folder');
        const saveResponse = await fetch('/api/chat/save-finished', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completeData)
        });

        const saveResult = await saveResponse.json();

        if (!saveResponse.ok) {
            throw new Error(saveResult.error || 'Save failed');
        }

        // Step 5: Trigger download
        log('info', 'Step 5: Triggering download for participant');
        const jsonContent = JSON.stringify(completeData, null, 2);
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

        // Step 6: Confirm allocation
        log('info', 'Step 6: Confirming allocation');
        await testAllocationConfirm();

        log('success', 'Finish Study flow complete');
        log('info', 'Download triggered, GitHub saved, allocation confirmed');

        showResult('final-result', 'Finish Study simulation succeeded', true);

    } catch (error) {
        log('error', `Finish study failed: ${error.message}`);
        showResult('final-result', error.message, false);
    }
}

// ===================================================================
// AUTOMATED FULL STUDY SIMULATION
// ===================================================================

async function automateFullStudy() {
    log('start', '🤖 Starting automated full study simulation');
    log('info', 'This will test all 6 models across all tasks');

    const pid = getParticipantId();
    if (!pid) return;

    // Array of all 6 models to test
    const allModels = [
        'gpt-3.5-turbo-0125',
        'gpt-4-0125-preview',
        'gpt-5-2025-08-07',
        'claude-3-haiku-20240307',
        'claude-3-5-haiku-20241022',
        'claude-sonnet-4-20250514'
    ];

    try {
        // Step 1: Claim allocation
        log('info', '=== STEP 1: Claiming allocation ===');
        await testAllocationClaim();
        await sleep(1000);

        // Step 2: Image generation task
        log('info', '=== STEP 2: Image Generation Task ===');
        setCurrentTask('image-generation');

        // Generate first image
        log('info', 'Chat 1: Generating sunset image');
        document.getElementById('image-prompt').value = 'A beautiful sunset over mountains';
        await testImageGeneration();
        await sleep(2000);

        // Generate second image (new chat simulation)
        log('info', 'Chat 2: Generating cat image');
        document.getElementById('image-prompt').value = 'A fluffy cat playing with yarn';
        await testImageGeneration();
        await sleep(2000);

        // Edit and regenerate (simulate message edit)
        log('info', 'Chat 2: Editing prompt and regenerating');
        document.getElementById('image-prompt').value = 'A fluffy orange cat playing with blue yarn';
        await testImageGeneration();
        await sleep(2000);

        // Save image-generation task
        log('info', 'Saving image-generation task');
        await testManualSave();
        await sleep(1000);

        // Step 3: Outreach message task (test models 1-3)
        log('info', '=== STEP 3: Outreach Message Task ===');
        setCurrentTask('outreach-msg');

        // Chat 1 - Model 1 (GPT-3.5)
        log('info', `Chat 1: Testing ${allModels[0]}`);
        document.getElementById('chat-message').value = 'Write a professional outreach message for a collaboration';
        await testChat(allModels[0]);
        await sleep(2000);

        // Chat 2 - Model 2 (GPT-4)
        log('info', `Chat 2: Testing ${allModels[1]}`);
        document.getElementById('chat-message').value = 'Make it more casual and friendly';
        await testChat(allModels[1]);
        await sleep(2000);

        // Chat 3 - Model 3 (GPT-5)
        log('info', `Chat 3: Testing ${allModels[2]}`);
        document.getElementById('chat-message').value = 'Add a creative opening line';
        await testChat(allModels[2]);
        await sleep(2000);

        // Save outreach-msg task
        log('info', 'Saving outreach-msg task');
        await testManualSave();
        await sleep(1000);

        // Step 4: Acronym building task (test models 4-6)
        log('info', '=== STEP 4: Acronym Building Task ===');
        setCurrentTask('acro-build');

        // Chat 1 - Model 4 (Claude 3)
        log('info', `Chat 1: Testing ${allModels[3]}`);
        document.getElementById('chat-message').value = 'Create a funny acronym for STUDY';
        await testChat(allModels[3]);
        await sleep(2000);

        // Chat 2 - Model 5 (Claude 3.5)
        log('info', `Chat 2: Testing ${allModels[4]}`);
        document.getElementById('chat-message').value = 'Create an acronym for RESEARCH';
        await testChat(allModels[4]);
        await sleep(2000);

        // Chat 3 - Model 6 (Claude 4)
        log('info', `Chat 3: Testing ${allModels[5]}`);
        document.getElementById('chat-message').value = 'Create a professional acronym for SCIENCE';
        await testChat(allModels[5]);
        await sleep(2000);

        // Edit message simulation
        log('info', `Chat 3: Editing and retrying with ${allModels[5]}`);
        document.getElementById('chat-message').value = 'Create a creative acronym for SCIENCE';
        await testChat(allModels[5]);
        await sleep(2000);

        // Save acro-build task
        log('info', 'Saving acro-build task');
        await testManualSave();
        await sleep(1000);

        // Step 5: Complete all tasks
        log('info', '=== STEP 5: Completing tasks ===');

        setCurrentTask('image-generation');
        log('info', 'Completing image-generation task');
        await testCompleteTask();
        await sleep(1000);

        setCurrentTask('outreach-msg');
        log('info', 'Completing outreach-msg task');
        await testCompleteTask();
        await sleep(1000);

        setCurrentTask('acro-build');
        log('info', 'Completing acro-build task (final)');
        await testCompleteTask();
        await sleep(1000);

        // Step 6: Finish study
        log('info', '=== STEP 6: Finishing study ===');
        await testFinishStudy();

        log('success', '🎉 Automated full study simulation complete!');
        log('info', '✅ All 6 models tested across 3 tasks');
        log('info', 'Check logs above for any errors');

        showResult('final-result', 'Full study automation succeeded! All 6 models tested. Check logs for details.', true);

    } catch (error) {
        log('error', `Automation failed: ${error.message}`);
        showResult('final-result', `Automation error: ${error.message}`, false);
    }
}

// Helper function for delays
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}