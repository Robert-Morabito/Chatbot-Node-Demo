export default async function handler(req, res) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Allocation API Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: #1a1a1a;
            color: #fff;
        }
        .test-section {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1rem 0;
            border: 1px solid #444;
        }
        .test-button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            margin: 0.5rem 0.5rem 0.5rem 0;
            font-size: 0.875rem;
            transition: all 0.3s ease;
        }
        .test-button:hover {
            background: #2563eb;
            transform: translateY(-1px);
        }
        .test-button.danger {
            background: #ef4444;
        }
        .test-button.danger:hover {
            background: #dc2626;
        }
        .test-input {
            background: #1a1a1a;
            border: 1px solid #555;
            color: #fff;
            padding: 0.75rem;
            border-radius: 6px;
            font-size: 1rem;
            width: 300px;
            margin: 0.5rem 0;
        }
        .result {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 1rem;
            margin: 1rem 0;
            font-family: monospace;
            font-size: 0.875rem;
            white-space: pre-wrap;
            max-height: 200px;
            overflow-y: auto;
        }
        .success {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.1);
        }
        .error {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
        }
        .clear-btn {
            background: #6b7280;
            font-size: 0.75rem;
            padding: 0.5rem 1rem;
        }
    </style>
</head>
<body>
    <h1>🧪 Allocation API Test Suite</h1>
    <p>Test the database allocation middleware endpoints</p>

    <!-- User ID Input -->
    <div class="test-section">
        <h2>Test Configuration</h2>
        <label>
            <strong>User ID (Prolific ID):</strong><br>
            <input type="text" id="user-id" class="test-input" placeholder="Enter test user ID" value="test_user_123">
        </label>
        <p><em>Use a test ID like "test_user_123" - don't use real participant IDs</em></p>
    </div>

    <!-- Current Status Display -->
    <div class="test-section">
        <h2>📋 Current Status</h2>
        <button class="test-button" onclick="checkStatus()">Check Current Status</button>
        <button class="clear-btn test-button" onclick="clearResult('status-result')">Clear</button>
        <div id="status-result" class="result" style="display: none;"></div>
    </div>

    <!-- Claim Test -->
    <div class="test-section">
        <h2>🎯 Claim Allocation</h2>
        <p>Request a new allocation for the user (or get existing one)</p>
        <button class="test-button" onclick="testClaim()">Claim Allocation</button>
        <button class="clear-btn test-button" onclick="clearResult('claim-result')">Clear</button>
        <div id="claim-result" class="result" style="display: none;"></div>
    </div>

    <!-- Release Test -->
    <div class="test-section">
        <h2>🔓 Release Allocation</h2>
        <p>Release the user's allocation (abandon study - only works if not confirmed)</p>
        <button class="test-button danger" onclick="testRelease()">Release Allocation</button>
        <button class="clear-btn test-button" onclick="clearResult('release-result')">Clear</button>
        <div id="release-result" class="result" style="display: none;"></div>
    </div>

    <script>
        function getUserId() {
            const userId = document.getElementById('user-id').value.trim();
            if (!userId) {
                alert('Please enter a user ID');
                return null;
            }
            return userId;
        }

        function displayResult(elementId, result, isSuccess = true) {
            const element = document.getElementById(elementId);
            element.style.display = 'block';
            element.className = \`result \${isSuccess ? 'success' : 'error'}\`;
            
            const timestamp = new Date().toLocaleTimeString();
            const header = \`[\${timestamp}] \${isSuccess ? '✅' : '❌'}\\n\`;
            
            if (typeof result === 'object') {
                element.textContent = header + JSON.stringify(result, null, 2);
            } else {
                element.textContent = header + result;
            }
        }

        function clearResult(elementId) {
            const element = document.getElementById(elementId);
            element.style.display = 'none';
            element.textContent = '';
        }

        async function makeRequest(endpoint, method = 'GET', body = null) {
            try {
                const options = {
                    method,
                    headers: { 'Content-Type': 'application/json' }
                };
                
                if (body) {
                    options.body = JSON.stringify(body);
                }

                const response = await fetch(\`/api/allocation/\${endpoint}\`, options);
                const data = response.status === 204 ? { message: 'Success (No Content)' } : await response.json();
                
                return {
                    success: response.ok,
                    status: response.status,
                    data: data
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }

        async function checkStatus() {
            const userId = getUserId();
            if (!userId) return;

            const result = await makeRequest(\`status?user_id=\${encodeURIComponent(userId)}\`);
            displayResult('status-result', {
                status: result.status,
                success: result.success,
                data: result.data || result.error
            }, result.success);
        }

        async function testClaim() {
            const userId = getUserId();
            if (!userId) return;

            const result = await makeRequest('claim', 'POST', { user_id: userId });
            displayResult('claim-result', {
                status: result.status,
                success: result.success,
                data: result.data || result.error
            }, result.success);
        }

        async function testRelease() {
            const userId = getUserId();
            if (!userId) return;

            const result = await makeRequest('release', 'POST', { user_id: userId });
            displayResult('release-result', {
                status: result.status,
                success: result.success,
                data: result.data || result.error
            }, result.success);
        }
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}