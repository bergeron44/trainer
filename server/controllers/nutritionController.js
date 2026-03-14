const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const axios = require('axios');
const NutritionLog = require('../models/NutritionLog');
const MealPlan = require('../models/MealPlan');
const LikedMealRecap = require('../models/LikedMealRecap');
const OnboardingMenuPlannerService = require('../services/onboardingMenuPlannerService');
const SingleMealPlannerService = require('../services/singleMealPlannerService');

const onboardingMenuPlannerService = new OnboardingMenuPlannerService();
const singleMealPlannerService = new SingleMealPlannerService();

// @desc    Retry AI menu plan generation
// @route   POST /api/nutrition/menu/retry
// @access  Private
const retryOnboardingMenuPlan = asyncHandler(async (req, res) => {
    const outcome = await onboardingMenuPlannerService.ensurePlanForUser({
        userId: req.user.id,
        requestId: req.requestId,
        trigger: 'manual_retry',
        force: true,
    });
    res.status(200).json(outcome);
});

// @desc    Regenerate the active AI meal plan from the latest user context
// @route   POST /api/nutrition/menu/regenerate
// @access  Private
const regenerateActiveMealPlan = asyncHandler(async (req, res) => {
    const outcome = await onboardingMenuPlannerService.ensurePlanForUser({
        userId: req.user.id,
        requestId: req.requestId,
        trigger: 'nutrition_demo_refresh',
        force: true,
    });
    res.status(200).json(outcome);
});

// @desc    Get the active meal plan for the user (most recent non-archived)
// @route   GET /api/nutrition/menu/active
// @access  Private
const getActiveMealPlan = asyncHandler(async (req, res) => {
    const plan = await MealPlan.findOne({
        user: req.user.id,
        archived: { $ne: true },
    }).sort({ createdAt: -1 });

    res.status(200).json(plan || null);
});

const toFiniteNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const sanitizeFoodName = (value) => String(value || '').trim();

const isLikelyFoodToken = (name) => {
    if (!name) return false;
    const normalized = name.replace(/\s+/g, ' ').trim();
    if (!normalized) return false;
    const words = normalized.split(' ').filter(Boolean);
    return words.length <= 4;
};

const hasAnyNutritionSignal = (food = {}) => {
    return toFiniteNumber(food.calories) > 0 ||
        toFiniteNumber(food.protein) > 0 ||
        toFiniteNumber(food.carbs) > 0 ||
        toFiniteNumber(food.fat) > 0;
};

const sanitizeRecapText = (value) => String(value || '').trim();
const sanitizeRecapList = (value) => (
    Array.isArray(value)
        ? value
            .map((item) => sanitizeRecapText(item))
            .filter(Boolean)
        : String(value || '')
            .split(/\r?\n|,/)
            .map((item) => sanitizeRecapText(item))
            .filter(Boolean)
);

const normalizeRecapMeal = (meal = {}) => ({
    meal_name: sanitizeRecapText(meal.meal_name) || 'Meal recapy',
    meal_type: sanitizeRecapText(meal.meal_type),
    calories: toFiniteNumber(meal.calories ?? meal.total_calories),
    protein: toFiniteNumber(meal.protein ?? meal.total_protein),
    carbs: toFiniteNumber(meal.carbs ?? meal.total_carbs),
    fat: toFiniteNumber(meal.fat ?? meal.total_fat),
    foods: Array.isArray(meal.foods)
        ? meal.foods
            .map((food) => ({
                name: sanitizeFoodName(food?.name),
                portion: sanitizeRecapText(food?.portion),
                calories: toFiniteNumber(food?.calories),
                protein: toFiniteNumber(food?.protein),
                carbs: toFiniteNumber(food?.carbs),
                fat: toFiniteNumber(food?.fat),
            }))
            .filter((food) => food.name)
        : [],
});

const normalizeRecapPayload = (recap = {}) => ({
    title: sanitizeRecapText(recap.title),
    recipe_title: sanitizeRecapText(recap.recipe_title ?? recap.title),
    ingredients_rubric: sanitizeRecapList(
        recap.ingredients_rubric ??
        recap.ingredients ??
        recap.ingredient_list
    ),
    recipe_guide: sanitizeRecapText(
        recap.recipe_guide ??
        recap.recipe_text ??
        recap.recipe_summary ??
        recap.summary
    ),
    recipe_text: sanitizeRecapText(
        recap.recipe_guide ??
        recap.recipe_text ??
        recap.recipe_summary ??
        recap.summary
    ),
    meal_macros: {
        calories: toFiniteNumber(recap?.meal_macros?.calories),
        protein: toFiniteNumber(recap?.meal_macros?.protein),
        carbs: toFiniteNumber(recap?.meal_macros?.carbs),
        fat: toFiniteNumber(recap?.meal_macros?.fat),
    },
    updated_macros: {
        consumed_after_meal: {
            calories: toFiniteNumber(recap?.updated_macros?.consumed_after_meal?.calories),
            protein: toFiniteNumber(recap?.updated_macros?.consumed_after_meal?.protein),
            carbs: toFiniteNumber(recap?.updated_macros?.consumed_after_meal?.carbs),
            fat: toFiniteNumber(recap?.updated_macros?.consumed_after_meal?.fat),
        },
        remaining_after_meal: {
            calories: toFiniteNumber(recap?.updated_macros?.remaining_after_meal?.calories),
            protein: toFiniteNumber(recap?.updated_macros?.remaining_after_meal?.protein),
            carbs: toFiniteNumber(recap?.updated_macros?.remaining_after_meal?.carbs),
            fat: toFiniteNumber(recap?.updated_macros?.remaining_after_meal?.fat),
        },
    },
        source: {
        label: sanitizeRecapText(recap?.source?.label),
        url: sanitizeRecapText(recap?.source?.url),
        provider: sanitizeRecapText(recap?.source?.provider),
    },
});

const buildLikedRecapSignature = ({ meal, recap }) => {
    const signatureBase = JSON.stringify({
        meal_name: meal.meal_name,
        meal_type: meal.meal_type,
        foods: meal.foods.map((food) => ({
            name: food.name,
            portion: food.portion,
        })),
        recipe_title: recap.recipe_title,
        ingredients_rubric: recap.ingredients_rubric,
        recipe_guide: recap.recipe_guide,
        source_url: recap?.source?.url || '',
    });

    return crypto.createHash('sha256').update(signatureBase).digest('hex');
};

function resolveMealPlannerContext({ body = {}, user = {} } = {}) {
    const profile = user.profile || {};
    return {
        current_calories_consumed: toFiniteNumber(body.current_calories_consumed),
        protein_consumed: toFiniteNumber(body.protein_consumed),
        carbs_consumed: toFiniteNumber(body.carbs_consumed),
        fat_consumed: toFiniteNumber(body.fat_consumed),
        target_calories: toFiniteNumber(body.target_calories || profile.target_calories || profile.tdee || 2000),
        protein_goal: toFiniteNumber(body.protein_goal || profile.protein_goal || 150),
        carbs_goal: toFiniteNumber(body.carbs_goal || profile.carbs_goal || 200),
        fat_goal: toFiniteNumber(body.fat_goal || profile.fat_goal || 65),
        time_of_day: String(body.time_of_day || '').trim() || '12:00',
        meal_period: String(body.meal_period || '').trim() || 'lunch',
        day_of_week: String(body.day_of_week || '').trim().toLowerCase(),
        meals_eaten_today: toFiniteNumber(body.meals_eaten_today),
        total_meals_planned: Math.max(1, toFiniteNumber(body.total_meals_planned) || Number(profile.meal_frequency) || 4),
        meal_request_note: String(body.meal_request_note || '').trim(),
        meal_request_priority: String(body.meal_request_priority || '').trim().toLowerCase() === 'high' ? 'high' : 'normal',
        nutrition_preferences_note: String(body.nutrition_preferences_note || '').trim(),
        nutrition_preferences:
            body.nutrition_preferences && typeof body.nutrition_preferences === 'object' && !Array.isArray(body.nutrition_preferences)
                ? body.nutrition_preferences
                : (user.nutrition_preferences || {}),
        workout_context:
            body.workout_context && typeof body.workout_context === 'object' && !Array.isArray(body.workout_context)
                ? body.workout_context
                : {},
    };
}

const sanitizeNutritionFoods = (foods = []) => (
    Array.isArray(foods)
        ? foods
            .map((food) => ({
                name: sanitizeFoodName(food?.name),
                portion: String(food?.portion || '').trim(),
                calories: toFiniteNumber(food?.calories),
                protein: toFiniteNumber(food?.protein),
                carbs: toFiniteNumber(food?.carbs),
                fat: toFiniteNumber(food?.fat),
            }))
            .filter((food) => food.name)
        : []
);

const sanitizeNutritionLogPayload = (body = {}) => ({
    meal_name: String(body?.meal_name || '').trim(),
    meal_period: String(body?.meal_period || '').trim(),
    meal_period_id: String(body?.meal_period_id || '').trim(),
    meal_period_label: String(body?.meal_period_label || '').trim(),
    calories: toFiniteNumber(body?.calories),
    protein: toFiniteNumber(body?.protein),
    carbs: toFiniteNumber(body?.carbs),
    fat: toFiniteNumber(body?.fat),
    date: body?.date ? new Date(body.date) : undefined,
    foods: body?.foods !== undefined ? sanitizeNutritionFoods(body.foods) : undefined,
});

const buildMonthRange = (monthValue = '') => {
    const raw = String(monthValue || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
        return null;
    }

    return {
        start: new Date(year, monthIndex, 1, 0, 0, 0, 0),
        end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
    };
};

// @desc    Get nutrition logs
// @route   GET /api/nutrition
// @access  Private
const getNutritionLogs = asyncHandler(async (req, res) => {
    const logs = await NutritionLog.find({ user: req.user.id });

    res.status(200).json(logs);
});

// @desc    Log meal
// @route   POST /api/nutrition
// @access  Private
const logMeal = asyncHandler(async (req, res) => {
    const log = await NutritionLog.create({
        user: req.user.id,
        ...req.body
    });

    res.status(200).json(log);
});

// @desc    Get logs by date
// @route   GET /api/nutrition/:date
// @access  Private
const getLogsByDate = asyncHandler(async (req, res) => {
    const start = new Date(req.params.date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(req.params.date);
    end.setHours(23, 59, 59, 999);

    const logs = await NutritionLog.find({
        user: req.user.id,
        date: {
            $gte: start,
            $lte: end
        }
    });

    res.status(200).json(logs);
});

// @desc    Get nutrition calendar summaries for one month
// @route   GET /api/nutrition/calendar
// @access  Private
const getNutritionCalendar = asyncHandler(async (req, res) => {
    const monthValue = String(req.query.month || '').trim();
    const range = buildMonthRange(monthValue);

    if (!range) {
        res.status(400);
        throw new Error('month query must be in YYYY-MM format');
    }

    const logs = await NutritionLog.find({
        user: req.user.id,
        date: {
            $gte: range.start,
            $lte: range.end,
        },
    }).sort({ date: 1, createdAt: 1 });

    const dayMap = new Map();
    logs.forEach((log) => {
        const key = new Date(log.date).toISOString().slice(0, 10);
        const existing = dayMap.get(key) || {
            date: key,
            total_calories: 0,
            total_protein: 0,
            total_carbs: 0,
            total_fat: 0,
            meal_count: 0,
            meals: [],
        };

        existing.total_calories += toFiniteNumber(log.calories);
        existing.total_protein += toFiniteNumber(log.protein);
        existing.total_carbs += toFiniteNumber(log.carbs);
        existing.total_fat += toFiniteNumber(log.fat);
        existing.meal_count += 1;
        existing.meals.push({
            id: String(log._id),
            meal_name: log.meal_name || '',
            meal_period_label: log.meal_period_label || '',
            calories: toFiniteNumber(log.calories),
        });
        dayMap.set(key, existing);
    });

    res.status(200).json({
        month: monthValue,
        days: Array.from(dayMap.values()),
    });
});

// @desc    Update one nutrition log entry
// @route   PUT /api/nutrition/entry/:id
// @access  Private
const updateNutritionLog = asyncHandler(async (req, res) => {
    const log = await NutritionLog.findOne({
        _id: req.params.id,
        user: req.user.id,
    });

    if (!log) {
        res.status(404);
        throw new Error('Nutrition log not found');
    }

    const updates = sanitizeNutritionLogPayload(req.body || {});

    if (updates.meal_name) log.meal_name = updates.meal_name;
    if (updates.meal_period !== undefined) log.meal_period = updates.meal_period;
    if (updates.meal_period_id !== undefined) log.meal_period_id = updates.meal_period_id;
    if (updates.meal_period_label !== undefined) log.meal_period_label = updates.meal_period_label;
    if (Number.isFinite(updates.calories)) log.calories = updates.calories;
    if (Number.isFinite(updates.protein)) log.protein = updates.protein;
    if (Number.isFinite(updates.carbs)) log.carbs = updates.carbs;
    if (Number.isFinite(updates.fat)) log.fat = updates.fat;
    if (updates.date instanceof Date && !Number.isNaN(updates.date.getTime())) log.date = updates.date;
    if (updates.foods !== undefined) log.foods = updates.foods;

    const saved = await log.save();
    res.status(200).json(saved);
});

// @desc    Delete one nutrition log entry
// @route   DELETE /api/nutrition/entry/:id
// @access  Private
const deleteNutritionLog = asyncHandler(async (req, res) => {
    const log = await NutritionLog.findOneAndDelete({
        _id: req.params.id,
        user: req.user.id,
    });

    if (!log) {
        res.status(404);
        throw new Error('Nutrition log not found');
    }

    res.status(200).json({ id: String(log._id) });
});

// @desc    Get recent saved meals (accepted history for meal planner context)
// @route   GET /api/nutrition/recent-saved
// @access  Private
const getRecentSavedMeals = asyncHandler(async (req, res) => {
    const limitRaw = parseInt(String(req.query.limit || '20'), 10);
    const daysRaw = parseInt(String(req.query.days || '45'), 10);
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 20));
    const days = Math.max(1, Math.min(365, Number.isFinite(daysRaw) ? daysRaw : 45));

    const start = new Date();
    start.setDate(start.getDate() - days);

    const logs = await NutritionLog.find({
        user: req.user.id,
        createdAt: { $gte: start }
    })
        .sort({ createdAt: -1 })
        .limit(limit);

    const meals = logs.map((log) => ({
        id: String(log._id),
        date: log.date || log.createdAt,
        meal_name: log.meal_name || '',
        calories: toFiniteNumber(log.calories),
        protein: toFiniteNumber(log.protein),
        carbs: toFiniteNumber(log.carbs),
        fat: toFiniteNumber(log.fat),
        foods: Array.isArray(log.foods)
            ? log.foods.map((food) => ({
                name: sanitizeFoodName(food?.name),
                portion: String(food?.portion || '').trim(),
                calories: toFiniteNumber(food?.calories),
                protein: toFiniteNumber(food?.protein),
                carbs: toFiniteNumber(food?.carbs),
                fat: toFiniteNumber(food?.fat),
            })).filter((food) => food.name)
            : [],
    }));

    res.status(200).json({ meals });
});

// @desc    Get liked meal recapies for the current user
// @route   GET /api/nutrition/liked-recaps
// @access  Private
const getLikedMealRecaps = asyncHandler(async (req, res) => {
    const items = await LikedMealRecap.find({ user: req.user.id })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();

    res.status(200).json({
        items: items.map((item) => ({
            ...item,
            id: String(item._id),
        })),
    });
});

// @desc    Save a liked meal recapy for the current user
// @route   POST /api/nutrition/liked-recaps
// @access  Private
const saveLikedMealRecap = asyncHandler(async (req, res) => {
    const meal = normalizeRecapMeal(req.body?.meal || {});
    const recap = normalizeRecapPayload(req.body?.recap || {});

    if (!meal.meal_name) {
        res.status(400);
        throw new Error('Meal data is required.');
    }

    if (!recap.recipe_guide) {
        res.status(400);
        throw new Error('Recipe guide is required.');
    }

    const signature = buildLikedRecapSignature({ meal, recap });

    const doc = await LikedMealRecap.findOneAndUpdate(
        { user: req.user.id, signature },
        {
            $set: {
                meal,
                recap,
                signature,
                user: req.user.id,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        }
    );

    res.status(200).json({
        item: {
            ...doc.toObject(),
            id: String(doc._id),
        },
    });
});

// @desc    Remove a liked meal recapy for the current user
// @route   DELETE /api/nutrition/liked-recaps/:id
// @access  Private
const deleteLikedMealRecap = asyncHandler(async (req, res) => {
    const doc = await LikedMealRecap.findOneAndDelete({
        _id: req.params.id,
        user: req.user.id,
    });

    if (!doc) {
        res.status(404);
        throw new Error('Liked recapy not found.');
    }

    res.status(200).json({ id: String(doc._id) });
});

// @desc    Generate a meal plan (mock — rule-based, ready for LLM swap)
// @route   POST /api/nutrition/meal-plan
// @access  Private
const generateMealPlan = asyncHandler(async (req, res) => {
    try {
        const mealContext = resolveMealPlannerContext({
            body: req.body,
            user: req.user,
        });

        const outcome = await singleMealPlannerService.generateMealForUser({
            userId: String(req.user.id),
            requestId: req.requestId,
            trigger: 'nutrition_demo_single_meal',
            user: req.user,
            mealContext,
        });

        res.status(200).json({
            ...outcome.meal,
            _provider: outcome.provider,
            _toolTrace: outcome.toolTrace,
            plannerMetadata: outcome.plannerMetadata,
        });
    } catch (error) {
        console.error('nutritionController.generateMealPlan error:', {
            requestId: req.requestId,
            userId: req.user?.id,
            status: error?.status,
            code: error?.code,
            message: error?.message,
        });

        const status = typeof error?.status === 'number' ? error.status : 500;
        res.status(status).json({
            message: String(error?.message || 'Failed to generate meal.'),
            code: error?.code || 'MEAL_PLAN_GENERATION_FAILED',
        });
    }
});

// @desc    Proxy OpenFoodFacts search (avoids browser CORS + HTTP2 limits)
// @route   POST /api/nutrition/foods
// @access  Private
const fetchFoods = asyncHandler(async (req, res) => {
    const { queries = [] } = req.body;

    const results = await Promise.allSettled(
        queries.map(q =>
            axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
                params: {
                    search_terms: q,
                    json: 1,
                    page_size: 3,
                    fields: 'product_name,image_front_url,image_front_thumb_url,nutriments,brands'
                },
                timeout: 8000,
                headers: { 'User-Agent': 'TrainerApp/1.0' }
            })
                .then(r => r.data.products || [])
                .catch(() => [])
        )
    );

    const products = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    res.json({ products });
});

module.exports = {
    getNutritionLogs,
    logMeal,
    getLogsByDate,
    getNutritionCalendar,
    updateNutritionLog,
    deleteNutritionLog,
    getRecentSavedMeals,
    getLikedMealRecaps,
    saveLikedMealRecap,
    deleteLikedMealRecap,
    generateMealPlan,
    fetchFoods,
    retryOnboardingMenuPlan,
    regenerateActiveMealPlan,
    getActiveMealPlan,
};
