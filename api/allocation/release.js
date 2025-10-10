/**
 * Allocation Release Middleware
 * Proxies requests to release unsubmitted allocations
 */

const API_BASE = 'http://5.161.254.250:3001';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
        });
    }

    try {
        const { user_id } = req.body;
        
        if (!user_id || typeof user_id !== 'string') {
            console.error('❌ Invalid user_id for release:', user_id);
            return res.status(400).json({ 
                error: 'Invalid user ID',
                code: 'INVALID_USER_ID'
            });
        }

        console.log('🔓 Releasing allocation for user:', user_id);

        const response = await fetch(`${API_BASE}/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Database release failed:', {
                status: response.status,
                error: errorData,
                userId: user_id,
                timestamp: new Date().toISOString()
            });
            
            return res.status(response.status).json({
                error: errorData.error || 'Failed to release allocation',
                code: 'DATABASE_ERROR'
            });
        }

        console.log('✅ Allocation released successfully for user:', user_id);
        return res.status(204).send();

    } catch (error) {
        console.error('❌ Release request failed:', {
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({ 
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
}