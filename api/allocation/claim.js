/**
 * Configuration Allocation Claim API
 * 
 * Claims a random available configuration for a user from the database.
 * Replaces the old session assignment system.
 */

const DATABASE_API_BASE = process.env.DATABASE_API_BASE || 'http://5.161.254.250';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.body;
        
        // Validate required fields
        if (!user_id || typeof user_id !== 'string' || user_id.length !== 24) {
            return res.status(400).json({ 
                error: 'Invalid user_id - must be 24-character Prolific ID' 
            });
        }

        console.log('🎯 [Allocation] Claiming configuration for user:', user_id);

        // Call database API
        const response = await fetch(`${DATABASE_API_BASE}/claim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id })
        });

        const data = await response.json();

        // Handle different response codes
        if (response.status === 200) {
            // User already had allocation
            console.log('✅ [Allocation] Existing allocation returned:', data);
            return res.json({
                success: true,
                allocation: {
                    id: data.id,
                    sourceModel: data.source_model,
                    shownModel: data.shown_model
                },
                message: 'Existing allocation retrieved'
            });
        }

        if (response.status === 201) {
            // New allocation created
            console.log('🆕 [Allocation] New allocation created:', data);
            return res.json({
                success: true,
                allocation: {
                    id: data.id,
                    sourceModel: data.source_model,
                    shownModel: data.shown_model
                },
                message: 'New allocation claimed'
            });
        }

        if (response.status === 409) {
            // No slots available - study exhausted
            console.log('🚫 [Allocation] Study exhausted for user:', user_id);
            return res.status(409).json({
                error: 'STUDY_EXHAUSTED',
                message: 'All study slots have been filled. Thank you for your interest.',
                userMessage: 'This study has reached capacity. Please return the study on Prolific.'
            });
        }

        if (response.status === 400) {
            console.error('❌ [Allocation] Bad request from database:', data);
            return res.status(400).json({
                error: 'INVALID_REQUEST',
                message: 'Invalid request format',
                details: data
            });
        }

        // Handle other errors
        console.error('❌ [Allocation] Database API error:', response.status, data);
        throw new Error(`Database API returned ${response.status}: ${JSON.stringify(data)}`);

    } catch (error) {
        console.error('💥 [Allocation] Claim failed:', error.message);
        
        // Check if it's a network error
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json({
                error: 'SERVICE_UNAVAILABLE',
                message: 'Database service is currently unavailable',
                userMessage: 'The study system is temporarily unavailable. Please try again in a few minutes.',
                errorCode: 'DB_CONNECTION_FAILED'
            });
        }

        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to claim configuration',
            details: error.message,
            errorCode: 'CLAIM_FAILED'
        });
    }
}