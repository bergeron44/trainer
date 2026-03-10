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
        day_of_week = '',
        meal_request_note = '',
        meal_request_priority = 'normal',
        nutrition_preferences_note = '',
        nutrition_preferences = null,
        workout_context = null,
        accepted_meal_history = [],
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

    const profileWorkoutContext = {
        goal: p.goal || '',
        experience_level: p.experience_level || '',
        workout_days_per_week: Number.isFinite(p.workout_days_per_week) ? Number(p.workout_days_per_week) : null,
        session_duration: Number.isFinite(p.session_duration) ? Number(p.session_duration) : null,
        environment: p.environment || '',
        activity_level: p.activity_level || '',
        injuries: p.injuries || '',
        workout_plan_status: p.workout_plan_status || '',
        workout_plan_source: p.workout_plan_source || '',
        has_existing_plan: Boolean(p.has_existing_plan),
        trainer_personality: p.trainer_personality || '',
    };
    const resolvedWorkoutContext = workout_context && typeof workout_context === 'object'
        ? { ...profileWorkoutContext, ...workout_context }
        : profileWorkoutContext;

    const systemPrompt = buildMealSystem(user);
    const userMessage = buildMealUserMessage({
        remaining,
        per_meal_target,
        liked_foods: user.liked_foods || [],
        disliked_foods: (user.disliked_foods || []).map(f => f.name),
        nutrition_preferences:
            nutrition_preferences && typeof nutrition_preferences === 'object'
                ? nutrition_preferences
                : (user.nutrition_preferences || {}),
        time_of_day,
        meal_period,
        day_of_week,
        meals_remaining,
        meal_request_note,
        meal_request_priority,
        nutrition_preferences_note,
        workout_context: resolvedWorkoutContext,
        accepted_meal_history: Array.isArray(accepted_meal_history) ? accepted_meal_history : [],
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

/**
 * @desc    Parse user's free-text meal description into structured meal data
 * @route   POST /ai/meal/from-text
 * @access  Private
 */
const generateMealFromText = asyncHandler(async (req, res) => {
    const user = req.user;
    const p = user.profile || {};
    const { meal_description } = req.body;

    if (!meal_description || !meal_description.trim()) {
        res.status(400);
        throw new Error('meal_description is required');
    }

    const systemPrompt = buildMealSystem(user);

    const userMessage = `The user described a meal they ate or plan to eat:
"${meal_description.trim()}"

Parse this description and estimate nutritional values for each component.
User diet: ${p.diet_type || 'everything'}.

Respond ONLY with this exact JSON structure (no markdown, no extra text):
{
  "meal_name": "Short name describing the meal",
  "foods": [
    { "name": "Food name", "portion": "Xg or X units", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
  ],
  "total_calories": 0,
  "total_protein": 0,
  "total_carbs": 0,
  "total_fat": 0,
  "coach_note": "משפט קצר בעברית על הארוחה"
}`;

    const { text, provider } = await callWithFallback(systemPrompt, userMessage, 800);

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

module.exports = { generateNextMeal, generateMealFromText };
