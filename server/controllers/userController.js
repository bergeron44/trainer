const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const OnboardingWorkoutPlannerService = require('../services/onboardingWorkoutPlannerService');
const OnboardingNutritionMenuService = require('../services/onboardingNutritionMenuService');
const { normalizeImportedNutritionMenuPeriods } = require('../utils/nutritionMealPeriods');

const onboardingWorkoutPlannerService = new OnboardingWorkoutPlannerService();
const onboardingNutritionMenuService = new OnboardingNutritionMenuService();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function cleanText(value, maxLen = 200) {
    return String(value || '').trim().slice(0, maxLen);
}

function normalizeTrainerPersonality(value) {
    if (value === undefined || value === null || value === '') return undefined;
    const normalized = String(value).trim().toLowerCase();
    const aliases = {
        drill_sergeant: 'drill_sergeant_coach',
        scientist: 'scientist_coach',
        nutritionist: 'nutritionist',
        zen: 'zen_coach',
        zen_coach: 'zen_coach',
        drill_sergeant_coach: 'drill_sergeant_coach',
        scientist_coach: 'scientist_coach',
    };
    return aliases[normalized] || 'drill_sergeant_coach';
}

function sanitizeMenuFoods(foods) {
    if (!Array.isArray(foods)) return [];
    return foods
        .slice(0, 20)
        .map((food) => ({
            name: cleanText(food?.name, 120),
            portion: cleanText(food?.portion, 60),
            calories: clampNumber(food?.calories, 0, 5000, 0),
            protein: clampNumber(food?.protein, 0, 1000, 0),
            carbs: clampNumber(food?.carbs, 0, 1000, 0),
            fat: clampNumber(food?.fat, 0, 1000, 0),
        }))
        .filter((food) => food.name);
}

function sanitizeCustomNutritionMenu(entries) {
    if (!Array.isArray(entries)) return [];
    const sanitized = entries
        .slice(0, 30)
        .map((entry) => ({
            meal_name: cleanText(entry?.meal_name || entry?.name, 160),
            meal_period: cleanText(entry?.meal_period || entry?.period, 80),
            total_calories: clampNumber(entry?.total_calories ?? entry?.calories, 1, 10000, 0),
            total_protein: clampNumber(entry?.total_protein ?? entry?.protein, 0, 1500, 0),
            total_carbs: clampNumber(entry?.total_carbs ?? entry?.carbs, 0, 1500, 0),
            total_fat: clampNumber(entry?.total_fat ?? entry?.fat, 0, 1500, 0),
            note: cleanText(entry?.note, 500),
            foods: sanitizeMenuFoods(entry?.foods),
        }))
        .filter((entry) => entry.meal_name && entry.total_calories > 0);
    return normalizeImportedNutritionMenuPeriods(sanitized);
}


function normalizeIncomingProfile(profile = {}) {
    const normalized = { ...(profile || {}) };

    if (Object.hasOwn(normalized, 'trainer_personality')) {
        normalized.trainer_personality = normalizeTrainerPersonality(normalized.trainer_personality);
    }

    const hasWorkoutPlanChoice = typeof normalized.plan_choice === 'string';
    const planChoice = hasWorkoutPlanChoice
        ? String(normalized.plan_choice || '').trim().toLowerCase()
        : '';

    if (hasWorkoutPlanChoice) {
        if (planChoice === 'existing') {
            normalized.workout_plan_status = 'skipped';
            normalized.workout_plan_error = undefined;
        }
        if (planChoice === 'ai' && normalized.onboarding_completed === true) {
            normalized.workout_plan_status = normalized.workout_plan_status || 'pending';
        }
    }

    const hasNutritionPlanChoice = typeof normalized.nutrition_plan_choice === 'string';
    const nutritionPlanChoice = hasNutritionPlanChoice
        ? String(normalized.nutrition_plan_choice || '').trim().toLowerCase()
        : '';

    if (hasNutritionPlanChoice) {
        if (nutritionPlanChoice === 'existing') {
            normalized.nutrition_plan_status = 'skipped';
            normalized.nutrition_plan_error = undefined;
            normalized.nutrition_plan_source = 'manual';
        }
        if (nutritionPlanChoice === 'tracking_only') {
            normalized.nutrition_plan_status = 'skipped';
            normalized.nutrition_plan_error = undefined;
            normalized.nutrition_plan_source = 'none';
        }
        if (nutritionPlanChoice === 'ai' && normalized.onboarding_completed === true) {
            normalized.nutrition_plan_status = normalized.nutrition_plan_status || 'pending';
            normalized.nutrition_plan_error = undefined;
            normalized.nutrition_plan_source = normalized.nutrition_plan_source || 'none';
        }
    }

    return normalized;
}

function prepareProfileForAsyncPlanners({
    profile = {},
    shouldTriggerWorkoutPlanner = false,
    shouldTriggerNutritionPlanner = false,
    incomingCustomNutritionMenu = [],
}) {
    const nextProfile = { ...(profile || {}) };
    const onboardingCompleted = nextProfile.onboarding_completed === true;
    const planChoice = String(nextProfile.plan_choice || '').trim().toLowerCase();
    const nutritionPlanChoice = String(nextProfile.nutrition_plan_choice || '').trim().toLowerCase();

    if (shouldTriggerWorkoutPlanner && onboardingCompleted && planChoice === 'ai') {
        nextProfile.workout_plan_status = 'pending';
        nextProfile.workout_plan_error = undefined;
        nextProfile.workout_plan_source = 'agent';
    }

    if (shouldTriggerNutritionPlanner && onboardingCompleted) {
        if (nutritionPlanChoice === 'ai') {
            nextProfile.nutrition_plan_status = 'pending';
            nextProfile.nutrition_plan_error = undefined;
            nextProfile.nutrition_plan_source = 'agent';
        }

        if (nutritionPlanChoice === 'existing' && incomingCustomNutritionMenu.length > 0) {
            nextProfile.nutrition_plan_status = 'pending';
            nextProfile.nutrition_plan_error = undefined;
            nextProfile.nutrition_plan_source = 'manual';
        }
    }

    return nextProfile;
}

function scheduleDetachedTask(label, metadata, task) {
    setImmediate(() => {
        Promise.resolve()
            .then(task)
            .catch((error) => {
                console.error(`userController.${label} detached error:`, {
                    ...(metadata || {}),
                    message: error?.message,
                });
            });
    });
}

function enqueueOnboardingPlanners({
    userId,
    requestId,
    trigger,
    shouldTriggerWorkoutPlanner = false,
    shouldTriggerNutritionPlanner = false,
    profile = {},
    incomingCustomNutritionMenu = [],
}) {
    if (shouldTriggerWorkoutPlanner) {
        scheduleDetachedTask('onboardingPlanner', {
            userId,
            requestId,
            trigger,
        }, async () => {
            await runOnboardingPlannerSafely({
                userId,
                requestId,
                trigger,
            });
        });
    }

    if (shouldTriggerNutritionPlanner) {
        scheduleDetachedTask('onboardingNutritionPlanner', {
            userId,
            requestId,
            trigger,
        }, async () => {
            await onboardingNutritionMenuService.ensureMenuForUser({
                userId,
                requestId,
                trigger,
                profile: withTransientMenu(profile, incomingCustomNutritionMenu),
            });
        });
    }
}

async function runOnboardingPlannerSafely({ userId, requestId, trigger }) {
    try {
        return await onboardingWorkoutPlannerService.ensurePlanForUser({
            userId,
            requestId,
            trigger,
        });
    } catch (error) {
        console.error('userController.onboardingPlanner error:', {
            userId,
            requestId,
            trigger,
            message: error?.message,
        });
        return {
            triggered: false,
            status: 'failed_to_start',
        };
    }
}


function extractIncomingCustomNutritionMenu(sourceProfile) {
    const source = sourceProfile || {};
    const entries = Array.isArray(source.custom_nutrition_menu) ? source.custom_nutrition_menu : [];
    return sanitizeCustomNutritionMenu(entries);
}

function stripTransientProfileFields(profile = {}) {
    const nextProfile = { ...(profile || {}) };
    delete nextProfile.custom_nutrition_menu;
    return nextProfile;
}

function withTransientMenu(profile = {}, menu = []) {
    if (!Array.isArray(menu) || menu.length === 0) return profile;
    return {
        ...(profile || {}),
        custom_nutrition_menu: menu,
    };
}

function shouldTriggerWorkoutPlannerFromProfilePatch(patch = {}) {
    const source = patch || {};
    const triggerKeys = [
        'onboarding_completed',
        'plan_choice',
        'workout_plan_status',
        'has_existing_plan',
        'custom_plan',
    ];
    return triggerKeys.some((key) => Object.hasOwn(source, key));
}

function shouldTriggerNutritionPlannerFromProfilePatch(patch = {}) {
    const source = patch || {};
    const triggerKeys = [
        'onboarding_completed',
        'nutrition_plan_choice',
        'nutrition_plan_status',
        'custom_nutrition_menu',
    ];
    return triggerKeys.some((key) => Object.hasOwn(source, key));
}

// @desc    Register new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, profile } = req.body;
    const shouldTriggerWorkoutPlanner = shouldTriggerWorkoutPlannerFromProfilePatch(profile);
    const shouldTriggerNutritionPlanner = shouldTriggerNutritionPlannerFromProfilePatch(profile);
    const incomingCustomNutritionMenu = extractIncomingCustomNutritionMenu(profile);

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const normalizedProfile = normalizeIncomingProfile(stripTransientProfileFields(profile));
    const preparedProfile = prepareProfileForAsyncPlanners({
        profile: normalizedProfile,
        shouldTriggerWorkoutPlanner,
        shouldTriggerNutritionPlanner,
        incomingCustomNutritionMenu,
    });

    const user = await User.create({
        name,
        email,
        password,
        profile: preparedProfile,
    });

    if (user) {
        enqueueOnboardingPlanners({
            userId: user.id,
            requestId: req.requestId,
            trigger: 'register',
            shouldTriggerWorkoutPlanner,
            shouldTriggerNutritionPlanner,
            profile: user.profile,
            incomingCustomNutritionMenu,
        });
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            profile: user.profile,
            token: generateToken(user.id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            profile: user.profile,
            token: generateToken(user.id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid credentials');
    }
});

// @desc    Get user data
// @route   GET /api/users/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found in Database');
    }

    res.status(200).json({
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile
    });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const shouldTriggerWorkoutPlanner = shouldTriggerWorkoutPlannerFromProfilePatch(req.body);
    const shouldTriggerNutritionPlanner = shouldTriggerNutritionPlannerFromProfilePatch(req.body);
    const incomingCustomNutritionMenu = extractIncomingCustomNutritionMenu(req.body);

    if (!user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Update profile fields
    user.profile = prepareProfileForAsyncPlanners({
        profile: normalizeIncomingProfile({
            ...user.profile,
            ...stripTransientProfileFields(req.body),
        }),
        shouldTriggerWorkoutPlanner,
        shouldTriggerNutritionPlanner,
        incomingCustomNutritionMenu,
    });

    await user.save();
    enqueueOnboardingPlanners({
        userId: user.id,
        requestId: req.requestId,
        trigger: 'update_profile',
        shouldTriggerWorkoutPlanner,
        shouldTriggerNutritionPlanner,
        profile: user.profile,
        incomingCustomNutritionMenu,
    });

    res.status(200).json({
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile
    });
});

// @desc    Add food preference (like or dislike)
// @route   POST /api/users/food-preference
// @access  Private
const addFoodPreference = asyncHandler(async (req, res) => {
    const { food, action } = req.body; // action: 'like' | 'dislike'

    if (!food || !food.name || !action) {
        res.status(400);
        throw new Error('Please provide food object and action (like/dislike)');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (action === 'like') {
        // Remove from disliked if present
        user.disliked_foods = user.disliked_foods.filter(f => f.name !== food.name);
        // Add to liked if not already there
        const alreadyLiked = user.liked_foods.some(f => f.name === food.name);
        if (!alreadyLiked) {
            user.liked_foods.push({
                name: food.name,
                image: food.image || '',
                calories: food.calories || 0,
                protein: food.protein || 0,
                carbs: food.carbs || 0,
                fat: food.fat || 0
            });
        }
    } else if (action === 'dislike') {
        // Remove from liked if present
        user.liked_foods = user.liked_foods.filter(f => f.name !== food.name);
        // Add to disliked if not already there
        const alreadyDisliked = user.disliked_foods.some(f => f.name === food.name);
        if (!alreadyDisliked) {
            user.disliked_foods.push({ name: food.name });
        }
    } else {
        res.status(400);
        throw new Error('Action must be "like" or "dislike"');
    }

    await user.save();

    res.status(200).json({
        liked_count: user.liked_foods.length,
        disliked_count: user.disliked_foods.length
    });
});

// @desc    Get food preferences
// @route   GET /api/users/food-preferences
// @access  Private
const getFoodPreferences = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('liked_foods disliked_foods');
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    res.status(200).json({
        liked_foods: user.liked_foods || [],
        disliked_foods: user.disliked_foods || []
    });
});

module.exports = {
    registerUser,
    loginUser,
    getMe,
    updateProfile,
    addFoodPreference,
    getFoodPreferences,
    normalizeIncomingProfile,
    prepareProfileForAsyncPlanners,
};
