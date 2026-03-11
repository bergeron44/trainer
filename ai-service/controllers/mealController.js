const asyncHandler = require('express-async-handler');
const { callWithFallback } = require('../services/llmChain');
const { buildMealSystem, buildMealUserMessage } = require('../prompts/mealPrompt');

const STRUCTURED_RESPONSE_OPTIONS = {
    responseFormat: { type: 'json_object' },
    timeoutMs: Number.parseInt(process.env.MEAL_LLM_TIMEOUT_MS || '', 10) || 20000,
    temperature: 0.2,
};

function stripMarkdownFences(text = '') {
    return String(text || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
}

function parseJsonResponse(text = '') {
    const cleaned = stripMarkdownFences(text);
    const candidates = [];
    const pushCandidate = (value) => {
        if (!value || candidates.includes(value)) return;
        candidates.push(value);
    };

    pushCandidate(cleaned);

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        pushCandidate(cleaned.slice(firstBrace, lastBrace + 1));
    }

    let lastError;
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (error) {
            lastError = error;
        }

        try {
            return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Failed to parse meal JSON response.');
}

function normalizeMacro(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function validateFoods(foods) {
    if (!Array.isArray(foods) || foods.length === 0) {
        throw new Error('Meal response must include at least one food.');
    }

    return foods.map((food) => {
        const name = String(food?.name || '').trim();
        if (!name) {
            throw new Error('Meal response contains a food without a name.');
        }
        return {
            name,
            portion: String(food?.portion || '').trim(),
            calories: normalizeMacro(food?.calories),
            protein: normalizeMacro(food?.protein),
            carbs: normalizeMacro(food?.carbs),
            fat: normalizeMacro(food?.fat),
        };
    });
}

function validateMealPayload(payload = {}) {
    const mealName = String(payload?.meal_name || '').trim();
    if (!mealName) {
        throw new Error('Meal response is missing meal_name.');
    }

    return {
        meal_name: mealName,
        foods: validateFoods(payload?.foods),
        total_calories: normalizeMacro(payload?.total_calories),
        total_protein: normalizeMacro(payload?.total_protein),
        total_carbs: normalizeMacro(payload?.total_carbs),
        total_fat: normalizeMacro(payload?.total_fat),
        coach_note: String(payload?.coach_note || '').trim(),
    };
}

function buildRepairPrompt({ originalUserMessage, invalidResponse, error }) {
    return [
        originalUserMessage,
        '',
        'Your previous response was not valid strict JSON for the required meal schema.',
        `Validation error: ${String(error?.message || 'unknown error').slice(0, 200)}`,
        'Return the full response again as strict JSON only.',
        'Do not include markdown, comments, trailing commas, or extra text.',
        'Previous invalid response:',
        String(invalidResponse || '').slice(0, 1200),
    ].join('\n');
}

async function generateStructuredMeal({ systemPrompt, userMessage, maxTokens }) {
    const firstAttempt = await callWithFallback(
        systemPrompt,
        userMessage,
        maxTokens,
        STRUCTURED_RESPONSE_OPTIONS
    );

    try {
        return {
            meal: validateMealPayload(parseJsonResponse(firstAttempt.text)),
            provider: firstAttempt.provider,
        };
    } catch (firstError) {
        const repairedAttempt = await callWithFallback(
            systemPrompt,
            buildRepairPrompt({
                originalUserMessage: userMessage,
                invalidResponse: firstAttempt.text,
                error: firstError,
            }),
            maxTokens,
            STRUCTURED_RESPONSE_OPTIONS
        );

        return {
            meal: validateMealPayload(parseJsonResponse(repairedAttempt.text)),
            provider: repairedAttempt.provider,
        };
    }
}

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

    let meal;
    let provider;
    try {
        const result = await generateStructuredMeal({
            systemPrompt,
            userMessage,
            maxTokens: 800,
        });
        meal = result.meal;
        provider = result.provider;
    } catch (error) {
        res.status(502);
        throw new Error(`LLM returned invalid structured meal response: ${String(error?.message || '').slice(0, 200)}`);
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

    let meal;
    let provider;
    try {
        const result = await generateStructuredMeal({
            systemPrompt,
            userMessage,
            maxTokens: 800,
        });
        meal = result.meal;
        provider = result.provider;
    } catch (error) {
        res.status(502);
        throw new Error(`LLM returned invalid structured meal response: ${String(error?.message || '').slice(0, 200)}`);
    }

    res.json({ ...meal, _provider: provider });
});

module.exports = { generateNextMeal, generateMealFromText };
