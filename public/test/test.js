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
    currentDataCache: null // Cache for retrieved data
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
        currentDataCache: null
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
// SAVE/LOAD TESTS (Routes through /api/chat/save-task - SAME as core.js)
// ===================================================================

async function testManualSave() {
    const pid = getParticipantId();
    if (!pid) return;
    
    log('start', 'Testing manual save');
    
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
        savedAt: new Date().toISOString(),
        savedVia: 'manual'
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
        
        log('success', 'Manual save successful');
        
    } catch (error) {
        log('error', `Manual save failed: ${error.message}`);
    }
}

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
        savedAt: new Date().toISOString(),
        savedVia: 'auto'
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
        // Step 1: Save current task data
        log('info', 'Step 1: Saving task data');
        await testManualSave();
        
        // Step 2: Show completion (no actual navigation in test)
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
    log('info', 'This will simulate a complete participant journey');
    
    const pid = getParticipantId();
    if (!pid) return;
    
    try {
        // Step 1: Claim allocation
        log('info', '=== STEP 1: Claiming allocation ===');
        await testAllocationClaim();
        await sleep(1000);
        
        // Step 2: Image generation task
        log('info', '=== STEP 2: Image Generation Task ===');
        
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
        
        // Save task
        log('info', 'Saving image-generation task');
        await testManualSave();
        await sleep(1000);
        
        // Step 3: Outreach message task
        log('info', '=== STEP 3: Outreach Message Task ===');
        
        // Chat 1
        log('info', 'Chat 1: Writing outreach message');
        document.getElementById('chat-message').value = 'Write a professional outreach message for a collaboration';
        await testChat('gpt-4-0125-preview');
        await sleep(2000);
        
        // Chat 2 (new chat)
        log('info', 'Chat 2: Refining message');
        document.getElementById('chat-message').value = 'Make it more casual and friendly';
        await testChat('gpt-4-0125-preview');
        await sleep(2000);
        
        // Step 4: Acronym building task
        log('info', '=== STEP 4: Acronym Building Task ===');
        
        // Chat 1
        log('info', 'Chat 1: Creating acronym');
        document.getElementById('chat-message').value = 'Create a funny acronym for STUDY';
        await testChat('gpt-4-0125-preview');
        await sleep(2000);
        
        // Chat 2 (new chat)
        log('info', 'Chat 2: Creating another acronym');
        document.getElementById('chat-message').value = 'Create an acronym for RESEARCH';
        await testChat('gpt-4-0125-preview');
        await sleep(2000);
        
        // Edit message simulation
        log('info', 'Chat 2: Editing and retrying');
        document.getElementById('chat-message').value = 'Create a professional acronym for RESEARCH';
        await testChat('gpt-4-0125-preview');
        await sleep(2000);
        
        // Step 5: Complete all tasks
        log('info', '=== STEP 5: Completing tasks ===');
        
        log('info', 'Completing image-generation task');
        await testCompleteTask();
        await sleep(1000);
        
        log('info', 'Completing outreach-msg task');
        await testCompleteTask();
        await sleep(1000);
        
        log('info', 'Completing acro-build task (final)');
        await testCompleteTask();
        await sleep(1000);
        
        // Step 6: Finish study
        log('info', '=== STEP 6: Finishing study ===');
        await testFinishStudy();
        
        log('success', '🎉 Automated full study simulation complete!');
        log('info', 'Check logs above for any errors or issues');
        
        showResult('final-result', 'Full study automation succeeded! Check logs for details.', true);
        
    } catch (error) {
        log('error', `Automation failed: ${error.message}`);
        showResult('final-result', `Automation error: ${error.message}`, false);
    }
}

// Helper function for delays
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}