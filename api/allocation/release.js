/**
 * Allocation Release Middleware
 * Proxies requests to release unsubmitted allocations
 */

const API_BASE = 'http://5.161.254.250:3001';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.body;
        
        if (!user_id || typeof user_id !== 'string') {
            return res.status(400).json({ error: 'Valid user_id is required' });
        }

        console.log('🔓 Releasing allocation for user:', user_id);

        const response = await fetch(`${API_BASE}/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Database release failed:', response.status, errorData);
            return res.status(response.status).json(errorData);
        }

        console.log('✅ Allocation released successfully');
        return res.status(204).send();

    } catch (error) {
        console.error('❌ Release request failed:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
}