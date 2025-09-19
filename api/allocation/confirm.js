/**
 * Configuration Allocation Confirmation API
 * 
 * Marks user's allocation as submitted when they complete the study.
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

        console.log('✅ [Confirm] Confirming allocation for user:', user_id);

        const response = await fetch(`${DATABASE_API_BASE}/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id })
        });

        if (response.status === 204) {
            console.log('🎉 [Confirm] Allocation confirmed successfully for user:', user_id);
            return res.json({
                success: true,
                message: 'Allocation confirmed successfully'
            });
        }

        const data = await response.json();

        if (response.status === 404) {
            console.error('❌ [Confirm] No unsubmitted allocation found for user:', user_id);
            return res.status(404).json({
                error: 'NO_ACTIVE_ALLOCATION',
                message: 'No active, unsubmitted allocation found to confirm'
            });
        }

        // Handle other errors
        console.error('❌ [Confirm] Database API error:', response.status, data);
        return res.status(response.status).json({
            error: 'DATABASE_ERROR',
            message: 'Failed to confirm allocation',
            details: data
        });

    } catch (error) {
        console.error('💥 [Confirm] Confirmation failed:', error.message);
        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to confirm allocation',
            details: error.message
        });
    }
}