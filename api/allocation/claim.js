/**
 * Allocation Claim Middleware
 * Proxies requests to claim a model allocation for a user
 */

const API_BASE = 'http://5.161.254.250:3001';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.body;
        
        if (!user_id || typeof user_id !== 'string' || user_id.trim().length === 0) {
            return res.status(400).json({ error: 'Valid user_id is required' });
        }

        console.log('🎯 Claiming allocation for user:', user_id);

        const response = await fetch(`${API_BASE}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user_id.trim() })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Database claim failed:', response.status, data);
            return res.status(response.status).json(data);
        }

        console.log('✅ Allocation claimed successfully:', data);
        return res.status(response.status).json(data);

    } catch (error) {
        console.error('❌ Claim request failed:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
}