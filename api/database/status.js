/**
 * Database Status API
 * 
 * Gets the current allocation status for a user.
 */

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return res.status(400).json({ 
                error: 'User ID is required',
                code: 'MISSING_USER_ID'
            });
        }

        console.log('📊 [Database] Getting status for user:', user_id);

        const response = await fetch(`http://5.161.254.250/by-user?user_id=${encodeURIComponent(user_id)}`);

        if (response.ok) {
            const data = await response.json();
            return res.status(200).json({
                success: true,
                allocation: data
            });
        }

        if (response.status === 404) {
            return res.status(404).json({
                error: 'No allocation found for user',
                code: 'NO_ALLOCATION'
            });
        }

        const errorText = await response.text();
        return res.status(500).json({
            error: 'Database operation failed',
            code: 'DATABASE_ERROR',
            details: errorText
        });

    } catch (error) {
        console.error('❌ [Database] Status handler error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            details: error.message
        });
    }
}