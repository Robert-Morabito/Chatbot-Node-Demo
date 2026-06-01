/**
 * Demo: Per-Task Save — no-op. Returns success without persisting anything.
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { participantId, taskName } = req.body || {};
    return res.json({ success: true, participantId, taskName, message: 'Demo mode: data not saved' });
}

export const config = {
    api: { bodyParser: { sizeLimit: '10mb' } },
};
