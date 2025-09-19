/**
 * Configuration Allocation Status API
 * 
 * Retrieves current allocation status for a user.
 */

const DATABASE_API_BASE = process.env.DATABASE_API_BASE || 'http://5.161.254.250';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return res.status(400).json({ error: 'user_id query parameter required' });
        }

        console.log('📊 [Status] Checking allocation for user:', user_id);

        const response = await fetch(`${DATABASE_API_BASE}/by-user?user_id=${encodeURIComponent(user_id)}`);
        const data = await response.json();

        if (response.status === 200) {
            console.log('✅ [Status] Allocation found:', data);
            return res.json({
                success: true,
                allocation: {
                    id: data.id,
                    sourceModel: data.source_model,
                    shownModel: data.shown_model,
                    assigned: data.assigned,
                    claimedAt: data.claimed_at,
                    submittedAt: data.submitted_at
                }
            });
        }

        if (response.status === 404) {
            console.log('📭 [Status] No allocation found for user:', user_id);
            return res.status(404).json({
                error: 'NO_ALLOCATION',
                message: 'No active allocation found for user'
            });
        }

        // Handle other errors
        console.error('❌ [Status] Database API error:', response.status, data);
        return res.status(response.status).json({
            error: 'DATABASE_ERROR',
            message: 'Failed to retrieve allocation status',
            details: data
        });

    } catch (error) {
        console.error('💥 [Status] Status check failed:', error.message);
        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to check allocation status',
            details: error.message
        });
    }
}