import express from 'express';

const router = express.Router();

// Model information
const modelInfo = {
    'GPT-4': `GPT-4 is OpenAI's most advanced language model, offering superior reasoning capabilities and extensive knowledge. It excels at complex tasks requiring deep understanding and nuanced responses.`,
    'GPT-4o': `GPT-4o is an optimized version of GPT-4 designed for faster response times while maintaining high quality outputs. It's ideal for real-time conversations and interactive applications.`,
    'GPT-3.5': `GPT-3.5 Turbo is a fast, efficient model that balances performance with cost-effectiveness. It's suitable for most conversational tasks and general-purpose applications.`,
    'o1-mini': `o1-mini is a compact reasoning model optimized for quick responses on simpler reasoning tasks. It provides faster inference while maintaining logical thinking capabilities.`,
    'o1-preview': `o1-preview is OpenAI's advanced reasoning model that excels at complex problem-solving, mathematics, and multi-step logical reasoning tasks.`
};

/**
 * GET /api/models/:modelId/info
 * Get specific model information
 */
router.get('/:modelId/info', (req, res) => {
    const { modelId } = req.params;
    const info = modelInfo[modelId];
    
    if (!info) {
        return res.status(404).json({ 
            error: 'Model not found',
            modelId: modelId 
        });
    }
    
    res.json({
        success: true,
        modelId: modelId,
        info: info
    });
});

export { router as modelsRouter };