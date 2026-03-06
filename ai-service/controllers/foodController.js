const asyncHandler = require('express-async-handler');
const { callWithFallback } = require('../services/llmChain');

/**
 * @desc    Estimate nutritional values for a food item via LLM
 * @route   POST /ai/food/lookup
 * @access  Private
 */
const lookupFood = asyncHandler(async (req, res) => {
    const { food_name, portion = '100g' } = req.body;

    if (!food_name) {
        res.status(400);
        throw new Error('food_name is required');
    }

    const system = `You are a nutrition database. Given a food name and portion size, return ONLY valid JSON with estimated nutritional values. No markdown, no explanation, no extra text.`;

    const userMessage = `Estimate the nutritional values for: "${food_name}", portion: "${portion}".
Respond ONLY with this JSON format:
{
  "name": "${food_name}",
  "portion": "${portion}",
  "calories": <number>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fat": <number in grams>
}`;

    const { text, provider } = await callWithFallback(system, userMessage, 256);

    let food;
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        food = JSON.parse(cleaned);
    } catch (err) {
        res.status(500);
        throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
    }

    res.json({ ...food, _provider: provider });
});

module.exports = { lookupFood };
