/**
 * Database Release API
 * 
 * Releases a user's configuration back to the pool if not yet submitted.
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

        console.log('🔄 [Database] Releasing configuration for user:', user_id);

        const response = await fetch('http://5.161.254.250/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id })
        });

        if (response.status === 204) {
            console.log('✅ [Database] Configuration released successfully');
            return res.status(200).json({
                success: true,
                message: 'Configuration released successfully'
            });
        }

        const errorText = await response.text();
        console.log('ℹ️ [Database] Release response:', response.status, errorText);

        if (response.status === 404) {
            // This is actually OK - means nothing to release
            return res.status(200).json({
                success: true,
                message: 'No configuration to release (already submitted or none assigned)'
            });
        }

        return res.status(500).json({
            error: 'Database operation failed',
            code: 'DATABASE_ERROR',
            details: errorText
        });

    } catch (error) {
        console.error('❌ [Database] Release handler error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            details: error.message
        });
    }
}