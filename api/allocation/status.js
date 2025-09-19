/**
 * Allocation Status Middleware  
 * Proxies requests to get user's current allocation
 */

const API_BASE = 'http://5.161.254.250:3001';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.query;
        
        if (!user_id || typeof user_id !== 'string') {
            return res.status(400).json({ error: 'Valid user_id is required' });
        }

        console.log('📋 Getting status for user:', user_id);

        const response = await fetch(`${API_BASE}/by-user?user_id=${encodeURIComponent(user_id)}`);
        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Database status failed:', response.status, data);
            return res.status(response.status).json(data);
        }

        console.log('✅ Status retrieved successfully:', data);
        return res.status(response.status).json(data);

    } catch (error) {
        console.error('❌ Status request failed:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
}