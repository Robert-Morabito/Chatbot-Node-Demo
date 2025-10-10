/**
 * Allocation Claim Middleware
 * Proxies requests to claim a model allocation for a user
 */

const API_BASE = 'http://5.161.254.250:3001';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
            message: 'This endpoint only accepts POST requests'
        });
    }

    try {
        const { user_id } = req.body;
        
        if (!user_id || typeof user_id !== 'string' || user_id.trim().length === 0) {
            console.error('❌ Invalid user_id provided:', user_id);
            return res.status(400).json({ 
                error: 'Invalid user ID',
                code: 'INVALID_USER_ID',
                message: 'A valid 24-character Prolific ID is required'
            });
        }

        console.log('🎯 Claiming allocation for user:', user_id);

        const response = await fetch(`${API_BASE}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user_id.trim() })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Database claim failed:', {
                status: response.status,
                data: data,
                userId: user_id,
                timestamp: new Date().toISOString()
            });

            // Map specific database errors to user-friendly responses
            if (response.status === 409) {
                return res.status(409).json({
                    error: 'Study complete',
                    code: 'STUDY_EXHAUSTED',
                    message: 'All available study slots have been filled'
                });
            }

            return res.status(response.status).json({
                error: data.error || 'Database operation failed',
                code: 'DATABASE_ERROR',
                message: 'Unable to process allocation request',
                details: data
            });
        }

        console.log('✅ Allocation claimed successfully:', {
            id: data.id,
            userId: user_id,
            shownModel: data.shown_model,
            sourceModel: data.source_model
        });
        
        return res.status(response.status).json(data);

    } catch (error) {
        console.error('❌ Claim request failed:', {
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({ 
            error: 'Internal server error',
            code: 'SERVER_ERROR',
            message: 'An unexpected error occurred while processing your request'
        });
    }
}