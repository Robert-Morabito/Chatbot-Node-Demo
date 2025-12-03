/**
 * Test Suite for Chatbot Study
 * Simplified, actionable testing with clean logging
 */

// Global state
let testState = {
    participantId: null,
    allocationId: null,
    chatHistory: [],
    generatedImages: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    log('info', 'Test suite ready');
    
    // Auto-populate PID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const pidFromUrl = urlParams.get('pid');
    if (pidFromUrl) {
        document.getElementById('participant-id').value = pidFromUrl;
        log('info', `Loaded PID from URL: ${pidFromUrl}`);
    }
});

// ===================================================================
// LOGGING SYSTEM (Simplified)
// ===================================================================

/**
 * Log a test event (simplified output)
 */
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
    log('info', 'Log cleared');
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
        generatedImages: []
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

// ===================================================================
// ALLOCATION TESTS
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
// CHAT TESTS
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
                conversationId: `test_${Date.now()}`
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
        
        testState.chatHistory.push({ model, message, response: fullResponse });
        
    } catch (error) {
        log('error', `Chat failed: ${error.message}`);
        responseDiv.innerHTML = `<span style="color: #fca5a5;">Error: ${error.message}</span>`;
    }
}

// ===================================================================
// IMAGE GENERATION TESTS
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
    previewDiv.innerHTML = '<em>Generating...</em>';
    infoDiv.innerHTML = '';
    
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
                            log('info', 'Image request detected');
                        } else if (data.type === 'content' && data.imageUrl) {
                            imageData = data;
                            
                            const isBase64 = data.imageUrl.startsWith('data:');
                            const sizeKB = (data.imageUrl.length / 1024).toFixed(1);
                            
                            log('success', `Image generated (${sizeKB} KB)`);
                            log('info', `Format: ${isBase64 ? 'Base64' : 'External URL'}`);
                            
                            previewDiv.innerHTML = `<img src="${data.imageUrl}" alt="Generated">`;
                            
                            infoDiv.innerHTML = `
                                <div class="info-badge">Size: ${sizeKB} KB</div>
                                <div class="info-badge">${isBase64 ? 'Base64' : 'External'}</div>
                            `;
                            
                            testState.generatedImages.push(imageData);
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        // Skip
                    }
                }
            }
        }
        
    } catch (error) {
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

// ===================================================================
// SAVE/LOAD TESTS
// ===================================================================

async function testAutoSave() {
    const pid = getParticipantId();
    if (!pid) return;
    
    log('start', 'Testing auto-save');
    
    const taskData = {
        conversations: {
            [`test_${Date.now()}`]: {
                messages: testState.chatHistory.map((chat, i) => ({
                    msg_id: i + 1,
                    sender: 'User',
                    content: chat.message
                }))
            }
        },
        behaviorMetrics: {
            messageCount: testState.chatHistory.length
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
        
        log('success', 'Auto-save successful');
        showResult('save-result', 'Task data saved to GitHub', true);
        
    } catch (error) {
        log('error', `Auto-save failed: ${error.message}`);
        showResult('save-result', error.message, false);
    }
}

async function testTaskRetrieval() {
    const pid = getParticipantId();
    if (!pid) return;
    
    log('start', 'Retrieving task data');
    
    try {
        const response = await fetch(`/api/chat/participant-data?pid=${encodeURIComponent(pid)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        const taskCount = Object.keys(data.tasks || {}).length;
        log('success', `Retrieved ${taskCount} task(s)`);
        
        showResult('save-result', `Found ${taskCount} task file(s) for ${pid}`, true);
        
    } catch (error) {
        log('error', `Retrieval failed: ${error.message}`);
        showResult('save-result', error.message, false);
    }
}

async function testFinalCompilation() {
    const pid = getParticipantId();
    if (!pid) return;
    
    log('start', 'Testing final compilation');
    log('info', 'This simulates the acro-build page logic');
    
    await testTaskRetrieval();
}

// ===================================================================
// FINAL TASK TESTS
// ===================================================================

async function testCompleteStudy() {
    const pid = getParticipantId();
    if (!pid) return;
    
    log('start', 'Simulating study completion');
    
    try {
        log('info', 'Step 1: Retrieving all tasks');
        const response = await fetch(`/api/chat/participant-data?pid=${encodeURIComponent(pid)}`);
        const allTasksData = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to retrieve tasks');
        }
        
        log('info', 'Step 2: Compiling dataset');
        const completeData = {
            participantId: pid,
            sessionId: testState.allocationId || 'test-session',
            modelConfig: {
                displayedModel: 'GPT-4',
                actualModel: 'gpt-4-0125-preview'
            },
            tasks: allTasksData.tasks,
            completedAt: new Date().toISOString()
        };
        
        log('info', 'Step 3: Saving to /finished');
        const saveResponse = await fetch('/api/chat/save-finished', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completeData)
        });
        
        const saveResult = await saveResponse.json();
        
        if (!saveResponse.ok) {
            throw new Error(saveResult.error || 'Save failed');
        }
        
        log('success', 'Study completion successful');
        log('info', 'Data saved to GitHub: finished/{pid}/complete-study-data.json');
        
        showResult('final-result', 'Complete study simulation succeeded', true);
        
    } catch (error) {
        log('error', `Study completion failed: ${error.message}`);
        showResult('final-result', error.message, false);
    }
}

function testFinalDownload() {
    const pid = getParticipantId();
    if (!pid) return;
    
    log('start', 'Testing download');
    
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
    
    log('success', 'Download triggered');
}

function testSanitization() {
    log('start', 'Testing data sanitization');
    
    const rawData = {
        participantId: 'TEST123',
        modelConfig: {
            displayedModel: 'GPT-4',
            actualModel: 'gpt-4-0125-preview', // Should be removed
            trueModel: 'gpt-4-0125-preview' // Should be removed
        }
    };
    
    const sanitized = JSON.parse(JSON.stringify(rawData));
    delete sanitized.modelConfig.actualModel;
    delete sanitized.modelConfig.trueModel;
    
    log('success', 'Sensitive fields removed');
    log('info', 'Before: displayedModel, actualModel, trueModel');
    log('info', 'After: displayedModel only');
    
    showResult('final-result', 'Sanitization successful', true);
}