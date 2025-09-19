/**
 * Database Confirm API
 * 
 * Marks a user's configuration as completed/submitted.
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.body;
        
        if (!user_id) {
            return res.status(400).json({ 
                error: 'User ID is required',
                code: 'MISSING_USER_ID'
            });
        }

        console.log('✅ [Database] Confirming completion for user:', user_id);

        const response = await fetch('http://5.161.254.250/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id })
        });

        if (response.status === 204) {
            console.log('✅ [Database] Study completion confirmed');
            return res.status(200).json({
                success: true,
                message: 'Study completion confirmed'
            });
        }

        const errorText = await response.text();
        console.error('❌ [Database] Confirm failed:', response.status, errorText);

        if (response.status === 404) {
            return res.status(404).json({
                error: 'No active assignment found to confirm',
                code: 'NO_ASSIGNMENT',
                userMessage: 'No active study session found.'
            });
        }

        return res.status(500).json({
            error: 'Database operation failed',
            code: 'DATABASE_ERROR',
            userMessage: 'Failed to confirm study completion.',
            details: errorText
        });

    } catch (error) {
        console.error('❌ [Database] Confirm handler error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            details: error.message
        });
    }
}