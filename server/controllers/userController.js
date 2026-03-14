const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const OnboardingWorkoutPlannerService = require('../services/onboardingWorkoutPlannerService');
const nodemailer = require('nodemailer');
const { buildNutritionPreferenceUpdateWithEditor, mergeNutritionPreferences } = require('../services/nutritionPreferences');
const { runNutritionPreferencePhase1Pipeline } = require('../services/nutritionPreferencePhase1');
const { resolveDefaultCurrencyFromContext } = require('../utils/currencyByCountry');
const { writeTrackedUserSnapshot } = require('../utils/liveUserSnapshot');

const onboardingWorkoutPlannerService = new OnboardingWorkoutPlannerService();
const TIME_NOTE_DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TIME_NOTE_MEAL_KEYS = ['breakfast', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];
const OnboardingMenuPlannerService = require('../services/onboardingMenuPlannerService');
const MealPlan = require('../models/MealPlan');
const onboardingMenuPlannerService = new OnboardingMenuPlannerService();

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

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

async function tryWriteLiveUserSnapshot(userDoc) {
    try {
        await writeTrackedUserSnapshot(userDoc);
    } catch (error) {
        console.error('userController.liveSnapshot error:', {
            message: error?.message,
            userId: userDoc?._id || userDoc?.id || null,
        });
    }
}

function ensureNutritionTimeNotesShape(preferences = {}) {
    const next = { ...(preferences || {}) };
    next.rule_based_preferences = { ...(next.rule_based_preferences || {}) };

    const source = next.rule_based_preferences.time_notes || {};
    const byDaySource = source.by_day && typeof source.by_day === 'object' ? source.by_day : {};
    const byMealSource = source.by_meal_period && typeof source.by_meal_period === 'object' ? source.by_meal_period : {};

    const by_day = {};
    for (const day of TIME_NOTE_DAY_KEYS) {
        by_day[day] = String(byDaySource[day] || '').trim();
    }

    const by_meal_period = {};
    for (const meal of TIME_NOTE_MEAL_KEYS) {
        by_meal_period[meal] = String(byMealSource[meal] || '').trim();
    }

    next.rule_based_preferences.time_notes = {
        by_day,
        by_meal_period,
    };

    return next;
}

// @desc    Register new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, profile } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
        res.status(400);
        throw new Error('Please add all fields');
    }

    const userExists = await User.findOne({ email: normalizedEmail });

    if (userExists) {
        res.status(400);
        throw new Error('This email is already signed up. Please log in instead.');
    }

    const user = await User.create({
        name,
        email: normalizedEmail,
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
        await tryWriteLiveUserSnapshot(latestUser);
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
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail });

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
    await tryWriteLiveUserSnapshot(updatedUser);

    res.status(200).json({
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        profile: updatedUser.profile
    });
});

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        res.status(400);
        throw new Error('Please provide current password and new password');
    }

    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const isCurrentPasswordValid = await user.matchPassword(currentPassword);
    if (!isCurrentPasswordValid) {
        res.status(401);
        throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();
    await tryWriteLiveUserSnapshot(user);

    res.status(200).json({ message: 'Password updated successfully' });
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
    await tryWriteLiveUserSnapshot(user);

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

// @desc    Get full nutrition preference snapshot
// @route   GET /api/users/nutrition-preferences
// @access  Private
const getNutritionPreferences = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select(
        'liked_foods disliked_foods nutrition_preferences'
    );

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const repairedNutritionPreferences = ensureNutritionTimeNotesShape(mergeNutritionPreferences(
        user.nutrition_preferences || {},
        {}
    ));

    const existingSerialized = JSON.stringify(user.nutrition_preferences || {});
    const repairedSerialized = JSON.stringify(repairedNutritionPreferences || {});
    if (existingSerialized !== repairedSerialized) {
        user.nutrition_preferences = repairedNutritionPreferences;
        await user.save();
        await tryWriteLiveUserSnapshot(user);
    }

    return res.status(200).json({
        liked_foods: user.liked_foods || [],
        disliked_foods: user.disliked_foods || [],
        nutrition_preferences: repairedNutritionPreferences || {},
    });
});

// @desc    Extract nutrition preferences from free text and update user
// @route   PUT /api/users/nutrition-preferences/extract
// @access  Private
const extractNutritionPreferences = asyncHandler(async (req, res) => {
    const text = String(req.body?.text || '').trim();
    const countryCode = String(req.body?.country_code || '').trim();
    const confirmConflicts = req.body?.confirm_conflicts === true || String(req.body?.confirm_conflicts || '').toLowerCase() === 'true';
    if (!text) {
        res.status(400);
        throw new Error('text is required');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    let pipelineResult;
    try {
        pipelineResult = await buildNutritionPreferenceUpdateWithEditor({
            text,
            existingNutritionPreferences: user.nutrition_preferences || {},
            existingLikedFoods: user.liked_foods || [],
            existingDislikedFoods: user.disliked_foods || [],
        });
    } catch (error) {
        if (error.validationErrors) {
            return res.status(400).json({
                message: 'Nutrition preference validation failed',
                errors: error.validationErrors,
            });
        }
        throw error;
    }

    const clarificationQuestions = pipelineResult.clarificationQuestions || [];
    if (pipelineResult.doNotSave) {
        return res.status(200).json({
            message: pipelineResult.doNotSaveReason || 'Nutrition preferences were not saved',
            do_not_save: true,
            requires_confirmation: false,
            partial_update: pipelineResult.partialUpdate,
            conflicts: pipelineResult.conflicts,
            clarification_questions: clarificationQuestions,
            editor: pipelineResult.editor || null,
            liked_foods: user.liked_foods || [],
            disliked_foods: user.disliked_foods || [],
            nutrition_preferences: ensureNutritionTimeNotesShape(user.nutrition_preferences || {}),
        });
    }

    if (clarificationQuestions.length && !confirmConflicts) {
        return res.status(200).json({
            message: 'Clarification required before saving nutrition preferences',
            requires_confirmation: true,
            partial_update: pipelineResult.partialUpdate,
            conflicts: pipelineResult.conflicts,
            clarification_questions: clarificationQuestions,
            editor: pipelineResult.editor || null,
            liked_foods: user.liked_foods || [],
            disliked_foods: user.disliked_foods || [],
            nutrition_preferences: ensureNutritionTimeNotesShape(user.nutrition_preferences || {}),
        });
    }

    const explicitCurrencyFromInput = String(
        pipelineResult.partialUpdate?.nutrition_preferences?.budget_preferences?.currency || ''
    ).trim().toUpperCase();
    const hasExplicitCurrencyInput = Boolean(explicitCurrencyFromInput);
    const fallbackCurrency = resolveDefaultCurrencyFromContext({
        providedCountryCode: countryCode,
        headers: req.headers || {},
        profile: user.profile || {},
        acceptLanguage: req.headers?.['accept-language'] || '',
    });
    const mergedBudget = pipelineResult.mergedNutritionPreferences?.budget_preferences || {};
    const mergedCurrency = String(mergedBudget.currency || '').trim().toUpperCase();
    if (!hasExplicitCurrencyInput) {
        if (!pipelineResult.mergedNutritionPreferences.budget_preferences) {
            pipelineResult.mergedNutritionPreferences.budget_preferences = {};
        }
        if (!mergedCurrency || mergedCurrency === 'USD') {
            pipelineResult.mergedNutritionPreferences.budget_preferences.currency = fallbackCurrency;
        }
    }

    user.nutrition_preferences = ensureNutritionTimeNotesShape(pipelineResult.mergedNutritionPreferences);
    user.liked_foods = pipelineResult.mergedLikedFoods;
    user.disliked_foods = pipelineResult.mergedDislikedFoods;
    await user.save();
    await tryWriteLiveUserSnapshot(user);

    return res.status(200).json({
        message: 'Nutrition preferences updated',
        partial_update: pipelineResult.partialUpdate,
        conflicts: pipelineResult.conflicts,
        clarification_questions: clarificationQuestions,
        conflicts_confirmed: confirmConflicts,
        editor: pipelineResult.editor || null,
        liked_foods: user.liked_foods || [],
        disliked_foods: user.disliked_foods || [],
        nutrition_preferences: user.nutrition_preferences || {},
    });
});

// @desc    Phase 1 LLM extraction pipeline with reviewer + deterministic decisions
// @route   PUT /api/users/nutrition-preferences/extract-phase1
// @access  Private
const extractNutritionPreferencesPhase1 = asyncHandler(async (req, res) => {
    const text = String(req.body?.text || '').trim();
    const countryCode = String(req.body?.country_code || '').trim();

    if (!text) {
        res.status(400);
        throw new Error('text is required');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const pipelineResult = await runNutritionPreferencePhase1Pipeline({
        rawText: text,
        userId: String(user._id),
        existingNutritionPreferences: user.nutrition_preferences || {},
        recentFailureCount: Number.isFinite(req.body?.recent_failure_count)
            ? Number(req.body.recent_failure_count)
            : 0,
        logger: {
            auditLogPath: process.env.NUTRITION_AUDIT_LOG_PATH,
            programmerQueuePath: process.env.NUTRITION_PROGRAMMER_QUEUE_PATH,
        },
    });

    if (pipelineResult.final_decision === 'AUTO_SAVE') {
        user.nutrition_preferences = ensureNutritionTimeNotesShape(pipelineResult.merged_nutrition_preferences);

        const mergedBudget = user.nutrition_preferences?.budget_preferences || {};
        const mergedCurrency = String(mergedBudget.currency || '').trim().toUpperCase();
        if (!mergedCurrency || mergedCurrency === 'USD') {
            const fallbackCurrency = resolveDefaultCurrencyFromContext({
                providedCountryCode: countryCode,
                headers: req.headers || {},
                profile: user.profile || {},
                acceptLanguage: req.headers?.['accept-language'] || '',
            });

            if (!user.nutrition_preferences.budget_preferences) {
                user.nutrition_preferences.budget_preferences = {};
            }
            user.nutrition_preferences.budget_preferences.currency = fallbackCurrency;
        }

        await user.save();
        await tryWriteLiveUserSnapshot(user);
    }

    return res.status(200).json({
        message: pipelineResult.final_decision === 'AUTO_SAVE'
            ? 'Nutrition preferences updated'
            : 'Nutrition preferences were not saved automatically',
        final_decision: pipelineResult.final_decision,
        reasons: pipelineResult.decision_reasons,
        clarification_question: pipelineResult.clarification_question,
        extractor_output: pipelineResult.extractor_output,
        normalized_output: pipelineResult.normalized_output,
        validation_result: pipelineResult.validation_result,
        reviewer_output: pipelineResult.reviewer_output,
        conflicts_detected: pipelineResult.conflicts_detected,
        rule_suggestions: pipelineResult.rule_suggestions,
        audit_log_path: pipelineResult.audit_log_path,
        programmer_review_queue_path: pipelineResult.programmer_review_queue_path,
        nutrition_preferences: user.nutrition_preferences || {},
    });
});

// @desc    Forgot Password - Reset and send random password
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Generate random 8-character password
    const newPassword = Math.random().toString(36).slice(-8);

    // Save new password (it will be hashed by the pre-save hook)
    user.password = newPassword;
    await user.save();
    await tryWriteLiveUserSnapshot(user);

    // Send email via nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            // we assume it is a gmail address given the typical structure
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Your New Password for Trainer App',
        text: `Hello ${user.name},\n\nYou requested a password reset. Your new temporary password is:\n\n${newPassword}\n\nPlease login and change it as soon as possible.\n\nBest,\nTrainer App Team`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Password reset successful. Check your email for the new password.' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Password was reset but failed to send email. Please ensure your email credentials are correct.' });
    }
});

module.exports = {
    registerUser,
    loginUser,
    getMe,
    updateProfile,
    changePassword,
    addFoodPreference,
    getFoodPreferences,
    getNutritionPreferences,
    extractNutritionPreferences,
    extractNutritionPreferencesPhase1,
    forgotPassword,
};
