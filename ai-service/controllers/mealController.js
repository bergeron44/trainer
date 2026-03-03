const asyncHandler = require('express-async-handler');
const { callWithFallback } = require('../services/llmChain');
const { buildMealSystem, buildMealUserMessage } = require('../prompts/mealPrompt');

/**
 * @desc    Generate next meal using LLM
 * @route   POST /ai/meal/next
 * @access  Private
 */
const generateNextMeal = asyncHandler(async (req, res) => {
    const user = req.user;
    const p = user.profile || {};

    const {
        current_calories_consumed = 0,
        protein_consumed = 0,
        carbs_consumed = 0,
        fat_consumed = 0,
        meals_eaten_today = 0,
        total_meals_planned = 4,
        time_of_day = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        meal_period = 'Lunch',
    } = req.body;

    // Calculate remaining macros
    const remaining = {
        calories: Math.max(0, (p.target_calories || 2000) - current_calories_consumed),
        protein: Math.max(0, (p.protein_goal || 150) - protein_consumed),
        carbs: Math.max(0, (p.carbs_goal || 200) - carbs_consumed),
        fat: Math.max(0, (p.fat_goal || 65) - fat_consumed),
    };

    const meals_remaining = Math.max(1, total_meals_planned - meals_eaten_today);
    const per_meal_target = {
        calories: Math.round(remaining.calories / meals_remaining),
        protein: Math.round(remaining.protein / meals_remaining),
        carbs: Math.round(remaining.carbs / meals_remaining),
        fat: Math.round(remaining.fat / meals_remaining),
    };

    const systemPrompt = buildMealSystem(user);
    const userMessage = buildMealUserMessage({
        remaining,
        per_meal_target,
        liked_foods: user.liked_foods || [],
        disliked_foods: (user.disliked_foods || []).map(f => f.name),
        time_of_day,
        meal_period,
        meals_remaining,
    });

    const { text, provider } = await callWithFallback(systemPrompt, userMessage, 800);

    // Parse JSON — strip markdown code fences if model added them
    let meal;
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        meal = JSON.parse(cleaned);
    } catch (err) {
        res.status(500);
        throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
    }

    res.json({ ...meal, _provider: provider });
});

module.exports = { generateNextMeal };
