const asyncHandler = require('express-async-handler');
const axios = require('axios');
const NutritionLog = require('../models/NutritionLog');
const MealPlan = require('../models/MealPlan');
const OnboardingMenuPlannerService = require('../services/onboardingMenuPlannerService');

const onboardingMenuPlannerService = new OnboardingMenuPlannerService();

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

// @desc    Generate a meal plan (mock — rule-based, ready for LLM swap)
// @route   POST /api/nutrition/meal-plan
// @access  Private
const generateMealPlan = asyncHandler(async (req, res) => {
    const {
        liked_foods = [],
        disliked_foods = [],
        current_calories_consumed = 0,
        target_calories = 2000,
        remaining_calories = 2000,
        protein_goal = 150, protein_consumed = 0,
        carbs_goal = 200, carbs_consumed = 0,
        fat_goal = 65, fat_consumed = 0,
        time_of_day = '12:00',
        meal_period = 'Lunch',
        meals_eaten_today = 0,
        total_meals_planned = 4,
        diet_type = 'everything',
        goal = 'recomp',
    } = req.body;

    // ======= LOG FULL PAYLOAD FOR VERIFICATION =======
    console.log('\n🍽️  MEAL PLAN REQUEST — FULL PAYLOAD:');
    console.log(JSON.stringify({
        user_id: req.user.id,
        liked_foods: liked_foods.map(f => f.name),
        disliked_foods,
        current_calories_consumed,
        target_calories,
        remaining_calories,
        protein_goal, protein_consumed,
        carbs_goal, carbs_consumed,
        fat_goal, fat_consumed,
        time_of_day,
        meal_period,
        meals_eaten_today,
        total_meals_planned,
        diet_type,
        goal,
    }, null, 2));
    console.log('====================================\n');

    // ======= RULE-BASED MOCK MEAL GENERATOR =======
    // Build meal from liked foods, targeting remaining macros
    const remaining_protein = Math.max(0, protein_goal - protein_consumed);
    const remaining_carbs = Math.max(0, carbs_goal - carbs_consumed);
    const remaining_fat = Math.max(0, fat_goal - fat_consumed);
    const meals_remaining = Math.max(1, total_meals_planned - meals_eaten_today);

    // Target per meal
    const target_per_meal = {
        calories: Math.round(remaining_calories / meals_remaining),
        protein: Math.round(remaining_protein / meals_remaining),
        carbs: Math.round(remaining_carbs / meals_remaining),
        fat: Math.round(remaining_fat / meals_remaining),
    };

    // Pick foods from liked_foods (or fallback generic)
    const dislikedNames = new Set(
        (Array.isArray(disliked_foods) ? disliked_foods : [])
            .map((name) => String(name || '').trim().toLowerCase())
            .filter(Boolean)
    );

    const sanitizedLikedFoods = (Array.isArray(liked_foods) ? liked_foods : [])
        .map((food) => {
            const normalized = {
                name: sanitizeFoodName(food?.name),
                calories: toFiniteNumber(food?.calories),
                protein: toFiniteNumber(food?.protein),
                carbs: toFiniteNumber(food?.carbs),
                fat: toFiniteNumber(food?.fat),
            };
            return normalized;
        })
        .filter((food) =>
            food.name &&
            isLikelyFoodToken(food.name) &&
            !dislikedNames.has(food.name.toLowerCase()) &&
            hasAnyNutritionSignal(food)
        );

    const pool = sanitizedLikedFoods.length > 0 ? sanitizedLikedFoods : [
        { name: 'Grilled Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        { name: 'Brown Rice', calories: 123, protein: 2.7, carbs: 26, fat: 1 },
        { name: 'Steamed Broccoli', calories: 55, protein: 3.7, carbs: 11, fat: 0.6 },
    ];

    // Select 2-3 foods, avoiding exceeding targets
    const selected = [];
    let total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    for (const food of shuffled) {
        if (selected.length >= 3) break;
        if (!hasAnyNutritionSignal(food)) continue;
        if (total.calories + (food.calories || 0) > target_per_meal.calories * 1.3) continue;

        const portion = Math.min(
            2,
            Math.max(0.5, target_per_meal.calories / Math.max(1, (food.calories || 200)))
        );
        const portionGrams = Math.round(portion * 100);

        selected.push({
            name: food.name,
            portion: `${portionGrams}g`,
            calories: Math.round((food.calories || 0) * portion),
            protein: Math.round((food.protein || 0) * portion),
            carbs: Math.round((food.carbs || 0) * portion),
            fat: Math.round((food.fat || 0) * portion),
        });

        total.calories += Math.round((food.calories || 0) * portion);
        total.protein += Math.round((food.protein || 0) * portion);
        total.carbs += Math.round((food.carbs || 0) * portion);
        total.fat += Math.round((food.fat || 0) * portion);
    }

    // If no foods selected, use defaults
    if (selected.length === 0) {
        selected.push(
            { name: 'Grilled Chicken Breast', portion: '200g', calories: 330, protein: 62, carbs: 0, fat: 7 },
            { name: 'Brown Rice', portion: '150g', calories: 185, protein: 4, carbs: 39, fat: 1.5 }
        );
        total = { calories: 515, protein: 66, carbs: 39, fat: 8.5 };
    }

    // Generate meal name based on time
    const hour = parseInt(time_of_day.split(':')[0]) || 12;
    let meal_name = 'Power Meal';
    if (hour < 10) meal_name = 'Morning Fuel';
    else if (hour < 13) meal_name = 'Midday Power Plate';
    else if (hour < 16) meal_name = 'Afternoon Boost';
    else if (hour < 20) meal_name = 'Evening Recovery';
    else meal_name = 'Late Night Repair';

    // Coach note based on goal
    const notes = {
        muscle_gain: 'High protein to support muscle growth 💪',
        weight_loss: 'Lean and satisfying to keep you on track 🎯',
        recomp: 'Balanced macros for body recomposition ⚖️',
        athletic_performance: 'Fuel for peak performance 🏃‍♂️',
    };

    res.status(200).json({
        meal_name,
        foods: selected,
        total_calories: Math.round(total.calories),
        total_protein: Math.round(total.protein),
        total_carbs: Math.round(total.carbs),
        total_fat: Math.round(total.fat),
        coach_note: notes[goal] || notes.recomp,
    });
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
    generateMealPlan,
    fetchFoods,
    retryOnboardingMenuPlan,
    getActiveMealPlan,
};
