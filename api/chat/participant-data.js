/**
 * Demo: Participant Data Retrieval — returns empty task set.
 */

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { pid } = req.query;
    return res.json({ success: true, participantId: pid, tasks: {} });
}
