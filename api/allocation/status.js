/**
 * Demo: Allocation Status — returns a randomly selected mock allocation.
 * OpenAI models only; shown_model is always older than source_model.
 */

const DEMO_ALLOCATIONS = [
    { shown_model: 'GPT-3.5', source_model: 'gpt-4o'            },
    { shown_model: 'GPT-4',   source_model: 'gpt-5-2025-08-07'  },
    { shown_model: 'GPT-3.5', source_model: 'gpt-5-2025-08-07'  },
];

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { user_id } = req.query;

    if (!user_id || typeof user_id !== 'string') {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    const id         = user_id.trim();
    const allocation = DEMO_ALLOCATIONS[Math.floor(Math.random() * DEMO_ALLOCATIONS.length)];

    return res.status(200).json({
        id:           `demo-${id}`,
        user_id:      id,
        shown_model:  allocation.shown_model,
        source_model: allocation.source_model,
        status:       'claimed'
    });
}
