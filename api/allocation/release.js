/**
 * Configuration Allocation Release API
 * 
 * Releases user's allocation when they leave without completing.
 */

const DATABASE_API_BASE = process.env.DATABASE_API_BASE || 'http://5.161.254.250';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.body;
        
        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        console.log('🔓 [Release] Releasing allocation for user:', user_id);

        const response = await fetch(`${DATABASE_API_BASE}/release`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id })
        });

        if (response.status === 204) {
            console.log('✅ [Release] Allocation released successfully for user:', user_id);
            return res.json({
                success: true,
                message: 'Allocation released successfully'
            });
        }

        const data = await response.json();

        if (response.status === 404) {
            console.log('📭 [Release] No releasable allocation found for user:', user_id);
            return res.json({
                success: true,
                message: 'No active allocation to release (already submitted or none exists)'
            });
        }

        // Handle other errors
        console.error('❌ [Release] Database API error:', response.status, data);
        return res.status(response.status).json({
            error: 'DATABASE_ERROR', 
            message: 'Failed to release allocation',
            details: data
        });

    } catch (error) {
        console.error('💥 [Release] Release failed:', error.message);
        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to release allocation',
            details: error.message
        });
    }
}