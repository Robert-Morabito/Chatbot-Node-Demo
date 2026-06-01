/**
 * Demo: Finished Study Save — no-op. Returns success without persisting anything.
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { participantId } = req.body || {};
    return res.json({ success: true, participantId, message: 'Demo mode: data not saved' });
}

export const config = {
    api: { bodyParser: { sizeLimit: '15mb' } },
};
