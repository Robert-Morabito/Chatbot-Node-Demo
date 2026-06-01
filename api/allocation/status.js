/**
 * Demo: Allocation Status — randomly selects one of nine shown/true pairings,
 * covering every combination of the three GPT generations.
 */

const DEMO_ALLOCATIONS = [
    { shown_model: 'GPT-3.5', source_model: 'gpt-3.5-turbo-0125' },
    { shown_model: 'GPT-3.5', source_model: 'gpt-4-1106-preview'  },
    { shown_model: 'GPT-3.5', source_model: 'gpt-5-2025-08-07'   },
    { shown_model: 'GPT-4',   source_model: 'gpt-3.5-turbo-0125' },
    { shown_model: 'GPT-4',   source_model: 'gpt-4-1106-preview'  },
    { shown_model: 'GPT-4',   source_model: 'gpt-5-2025-08-07'   },
    { shown_model: 'GPT-5',   source_model: 'gpt-3.5-turbo-0125' },
    { shown_model: 'GPT-5',   source_model: 'gpt-4-1106-preview'  },
    { shown_model: 'GPT-5',   source_model: 'gpt-5-2025-08-07'   },
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
