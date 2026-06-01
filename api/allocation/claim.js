/**
 * Demo: Allocation Claim — returns a deterministic mock allocation.
 * No external server required.
 */

const DEMO_ALLOCATIONS = [
    { shown_model: 'Claude 3',   source_model: 'claude-sonnet-4-20250514' },
    { shown_model: 'GPT-3.5',    source_model: 'gpt-5-2025-08-07'         },
    { shown_model: 'Claude 3.5', source_model: 'claude-sonnet-4-20250514' },
];

function pickAllocation(userId) {
    const hash = userId.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return DEMO_ALLOCATIONS[hash % DEMO_ALLOCATIONS.length];
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { user_id } = req.body;

    if (!user_id || typeof user_id !== 'string' || user_id.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    const id = user_id.trim();
    const allocation = pickAllocation(id);

    return res.status(200).json({
        id:           `demo-${id}`,
        user_id:      id,
        shown_model:  allocation.shown_model,
        source_model: allocation.source_model,
        status:       'claimed'
    });
}
