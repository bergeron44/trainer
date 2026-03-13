const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { buildNutritionPreferenceUpdateWithEditor } = require('../services/nutritionPreferences');
const { runNutritionPreferencePhase1Pipeline } = require('../services/nutritionPreferencePhase1');
const { resolveDefaultCurrencyFromContext } = require('../utils/currencyByCountry');
const { writeTrackedUserSnapshot } = require('../utils/liveUserSnapshot');

const TIME_NOTE_DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TIME_NOTE_MEAL_KEYS = ['breakfast', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];

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

async function tryWriteLiveUserSnapshot(userDoc) {
    try {
        await writeTrackedUserSnapshot(userDoc);
    } catch (error) {
        console.error('ai-service.liveSnapshot error:', {
            message: error?.message,
            userId: userDoc?._id || userDoc?.id || null,
        });
    }
}

// @desc    Extract nutrition preferences from free text and update user
// @route   PUT /ai/users/nutrition-preferences/extract
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
// @route   PUT /ai/users/nutrition-preferences/extract-phase1
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

module.exports = {
    extractNutritionPreferences,
    extractNutritionPreferencesPhase1,
};
