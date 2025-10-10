/**
 * Allocation Status Middleware  
 * Proxies requests to get user's current allocation
 */

const API_BASE = 'http://5.161.254.250:3001';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
        });
    }

    try {
        const { user_id } = req.query;
        
        if (!user_id || typeof user_id !== 'string') {
            console.error('❌ Invalid user_id for status:', user_id);
            return res.status(400).json({ 
                error: 'Invalid user ID',
                code: 'INVALID_USER_ID'
            });
        }

        console.log('📋 Getting status for user:', user_id);

        const response = await fetch(`${API_BASE}/by-user?user_id=${encodeURIComponent(user_id)}`);
        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Database status failed:', {
                status: response.status,
                data: data,
                userId: user_id,
                timestamp: new Date().toISOString()
            });
            
            return res.status(response.status).json({
                error: data.error || 'Failed to get status',
                code: 'DATABASE_ERROR'
            });
        }

        console.log('✅ Status retrieved successfully for user:', user_id);
        return res.status(response.status).json(data);

    } catch (error) {
        console.error('❌ Status request failed:', {
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