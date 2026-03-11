const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const OnboardingWorkoutPlannerService = require('../services/onboardingWorkoutPlannerService');
const OnboardingMenuPlannerService = require('../services/onboardingMenuPlannerService');
const MealPlan = require('../models/MealPlan');

const onboardingWorkoutPlannerService = new OnboardingWorkoutPlannerService();
const onboardingMenuPlannerService = new OnboardingMenuPlannerService();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

function normalizeIncomingProfile(profile = {}) {
    const normalized = { ...(profile || {}) };

    const planChoice = String(normalized.plan_choice || '').trim().toLowerCase();
    if (planChoice === 'existing') {
        normalized.workout_plan_status = 'skipped';
        normalized.workout_plan_error = undefined;
    }
    if (planChoice === 'ai' && normalized.onboarding_completed === true) {
        normalized.workout_plan_status = normalized.workout_plan_status || 'pending';
    }

    const menuChoice = String(normalized.menu_choice || '').trim().toLowerCase();
    if (menuChoice === 'tracking_only') {
        normalized.menu_plan_status = 'skipped';
    } else if (menuChoice === 'ai' && normalized.onboarding_completed === true) {
        normalized.menu_plan_status = normalized.menu_plan_status || 'pending';
    }
    // 'manual' stays pending; saveManualMenuSafely() will set it to 'ready'

    // Strip null/undefined nested objects — Mongoose can't cast them
    if (!normalized.menu_ai_preferences || typeof normalized.menu_ai_preferences !== 'object') {
        delete normalized.menu_ai_preferences;
    }
    if (!Array.isArray(normalized.manual_menu) || normalized.manual_menu.length === 0) {
        delete normalized.manual_menu;
    }

    return normalized;
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
        return { triggered: false, status: 'failed_to_start' };
    }
}

async function runOnboardingMenuPlannerSafely({ userId, requestId, trigger }) {
    try {
        return await onboardingMenuPlannerService.ensurePlanForUser({
            userId,
            requestId,
            trigger,
        });
    } catch (error) {
        console.error('userController.onboardingMenuPlanner error:', {
            userId,
            requestId,
            trigger,
            message: error?.message,
        });
        return { triggered: false, status: 'failed_to_start' };
    }
}

async function saveManualMenuSafely({ userId, profile }) {
    if (!userId || !profile) return;
    const menuChoice = String(profile.menu_choice || '').trim().toLowerCase();
    if (menuChoice !== 'manual') return;

    const manualMenu = profile.manual_menu;
    if (!Array.isArray(manualMenu) || manualMenu.length === 0) return;

    try {
        // Archive any existing manual plan for this user
        await MealPlan.updateMany(
            { user: userId, source: 'manual', archived: false },
            { $set: { archived: true } }
        );

        await MealPlan.create({
            user: userId,
            source: 'manual',
            meals: manualMenu.map((m) => ({
                meal_name: m.name || 'Meal',
                foods: m.foods
                    ? [{ name: m.foods }]
                    : [],
            })),
            archived: false,
        });

        await require('../models/User').findByIdAndUpdate(userId, {
            $set: {
                'profile.has_existing_menu': true,
                'profile.menu_plan_status': 'ready',
                'profile.menu_plan_source': 'manual',
                'profile.menu_plan_error': undefined,
                'profile.menu_plan_generated_at': new Date(),
            },
        });
    } catch (error) {
        console.error('userController.saveManualMenu error:', {
            userId,
            message: error?.message,
        });
    }
}

// @desc    Register new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, profile } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const user = await User.create({
        name,
        email,
        password,
        profile: normalizeIncomingProfile(profile),
    });

    if (user) {
        await runOnboardingPlannerSafely({
            userId: user.id,
            requestId: req.requestId,
            trigger: 'register',
        });
        await runOnboardingMenuPlannerSafely({
            userId: user.id,
            requestId: req.requestId,
            trigger: 'register',
        });
        await saveManualMenuSafely({ userId: user.id, profile: user.profile });

        const latestUser = await User.findById(user.id);
        res.status(201).json({
            _id: user.id,
            name: latestUser?.name || user.name,
            email: latestUser?.email || user.email,
            profile: latestUser?.profile || user.profile,
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

    if (!user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Update profile fields
    user.profile = normalizeIncomingProfile({ ...user.profile, ...req.body });

    await user.save();
    await runOnboardingPlannerSafely({
        userId: user.id,
        requestId: req.requestId,
        trigger: 'update_profile',
    });
    await runOnboardingMenuPlannerSafely({
        userId: user.id,
        requestId: req.requestId,
        trigger: 'update_profile',
    });
    await saveManualMenuSafely({ userId: user.id, profile: user.profile });

    const updatedUser = await User.findById(user.id);

    res.status(200).json({
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        profile: updatedUser.profile
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
};
