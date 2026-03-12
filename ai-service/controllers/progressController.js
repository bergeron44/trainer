const asyncHandler = require('express-async-handler');
const { callWithFallback } = require('../services/llmChain');

/**
 * @desc  Generate AI insights for a day's progress snapshot
 * @route POST /ai/progress-insights
 * @access Private
 */
const generateProgressInsights = asyncHandler(async (req, res) => {
    const { snapshot } = req.body;

    if (!snapshot) {
        res.status(400);
        throw new Error('snapshot is required');
    }

    const systemPrompt = `You are a personal trainer and nutritionist AI.
Analyze the user's daily progress data and provide 3-5 concise, actionable insights.
Return ONLY valid JSON array with objects: [{ "type": "success"|"warning"|"tip", "text": "..." }]
- "success": positive achievements to celebrate
- "warning": concerning patterns that need attention
- "tip": actionable recommendations for improvement
Keep each insight under 80 characters. Be specific with numbers from the data.`;

    const userMessage = `Analyze today's fitness data and provide insights:
${JSON.stringify(snapshot, null, 2)}`;

    const { text } = await callWithFallback(systemPrompt, userMessage, 600);

    let insights;
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Extract JSON array even if surrounded by text
        const match = cleaned.match(/\[[\s\S]*\]/);
        insights = JSON.parse(match ? match[0] : cleaned);
        if (!Array.isArray(insights)) throw new Error('not an array');
    } catch (err) {
        res.status(500);
        throw new Error(`LLM returned invalid JSON: ${text.slice(0, 300)}`);
    }

    // Validate and sanitize
    const valid = insights
        .filter(i => i && typeof i.text === 'string' && ['success', 'warning', 'tip'].includes(i.type))
        .slice(0, 5);

    res.json({ insights: valid });
});

module.exports = { generateProgressInsights };
