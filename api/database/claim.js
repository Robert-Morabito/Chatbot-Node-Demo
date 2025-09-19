/**
 * Database Claim API
 * 
 * Handles configuration assignment by proxying to the database API.
 * Claims a random available configuration for a user.
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.body;
        
        // Validate user ID format
        if (!user_id || !/^[a-zA-Z0-9]{24}$/.test(user_id)) {
            return res.status(400).json({ 
                error: 'Invalid user ID format. Must be exactly 24 alphanumeric characters.',
                code: 'INVALID_USER_ID'
            });
        }

        console.log('🎯 [Database] Claiming configuration for user:', user_id);

        // Proxy to database API
        const response = await fetch('http://5.161.254.250/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [Database] Claim failed:', response.status, errorText);
            
            // Handle specific database errors
            if (response.status === 409) {
                return res.status(409).json({
                    error: 'Study is currently full - no configurations available',
                    code: 'STUDY_EXHAUSTED',
                    userMessage: 'This study has reached capacity. Thank you for your interest!'
                });
            }

            if (response.status === 400) {
                return res.status(400).json({
                    error: 'Invalid request format',
                    code: 'INVALID_REQUEST',
                    userMessage: 'Please check your Prolific ID and try again.'
                });
            }

            return res.status(500).json({
                error: 'Database operation failed',
                code: 'DATABASE_ERROR',
                userMessage: 'We\'re experiencing technical difficulties. Please report this error.',
                details: errorText
            });
        }

        const data = await response.json();
        
        console.log('✅ [Database] Configuration claimed successfully:', {
            user_id,
            config_id: data.id,
            shown_model: data.shown_model,
            source_model: data.source_model,
            was_existing: response.status === 200
        });

        return res.status(response.status).json({
            success: true,
            configuration: {
                id: data.id,
                actualModel: data.source_model,
                displayedModel: data.shown_model
            },
            isExisting: response.status === 200,
            message: response.status === 200 ? 'Existing configuration retrieved' : 'New configuration assigned'
        });

    } catch (error) {
        console.error('❌ [Database] Claim handler error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            userMessage: 'Connection failed. Please check your internet connection and try again.',
            details: error.message
        });
    }
}