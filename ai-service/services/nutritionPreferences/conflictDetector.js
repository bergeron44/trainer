const { dedupeStrings } = require('./normalizationService');

const DIET_CONFLICTS = new Map([
    ['vegan', new Set(['pescatarian'])],
    ['vegetarian', new Set(['pescatarian'])],
    ['pescatarian', new Set(['vegan', 'vegetarian'])],
]);

function addConflict(conflicts, payload) {
    conflicts.push({
        path: payload.path,
        existing: payload.existing,
        incoming: payload.incoming,
        message: payload.message,
        severity: payload.severity || 'warning',
    });
}

function detectDietConflicts(conflicts, existingDiets = [], incomingDiets = []) {
    for (const existing of existingDiets) {
        const blocked = DIET_CONFLICTS.get(existing);
        if (!blocked) continue;
        for (const incoming of incomingDiets) {
            if (blocked.has(incoming)) {
                addConflict(conflicts, {
                    path: 'nutrition_preferences.hard_restrictions.diets',
                    existing,
                    incoming,
                    message: `Incoming diet "${incoming}" conflicts with existing diet "${existing}".`,
                    severity: 'high',
                });
            }
        }
    }
}

function detectOppositePreferenceConflicts(conflicts, existingLikes = [], existingDislikes = [], incomingLikes = [], incomingDislikes = []) {
    const existingLikeSet = new Set(dedupeStrings(existingLikes).map((v) => v.toLowerCase()));
    const existingDislikeSet = new Set(dedupeStrings(existingDislikes).map((v) => v.toLowerCase()));
    const incomingLikeSet = new Set(dedupeStrings(incomingLikes).map((v) => v.toLowerCase()));
    const incomingDislikeSet = new Set(dedupeStrings(incomingDislikes).map((v) => v.toLowerCase()));

    for (const value of incomingDislikeSet) {
        if (existingLikeSet.has(value)) {
            addConflict(conflicts, {
                path: 'nutrition_preferences.soft_dislikes',
                existing: value,
                incoming: value,
                message: `Incoming dislike "${value}" conflicts with an existing like.`,
            });
        }
    }

    for (const value of incomingLikeSet) {
        if (existingDislikeSet.has(value)) {
            addConflict(conflicts, {
                path: 'nutrition_preferences.soft_likes',
                existing: value,
                incoming: value,
                message: `Incoming like "${value}" conflicts with an existing dislike.`,
            });
        }
    }
}

function detectNumericConflicts(conflicts, path, existingValue, incomingValue) {
    if (!Number.isFinite(existingValue) || !Number.isFinite(incomingValue)) return;
    if (existingValue === incomingValue) return;
    addConflict(conflicts, {
        path,
        existing: existingValue,
        incoming: incomingValue,
        message: `Incoming numeric value (${incomingValue}) differs from existing value (${existingValue}).`,
    });
}

function detectNutritionPreferenceConflicts(existingPreferences = {}, incomingPreferences = {}) {
    const conflicts = [];

    const existingDiets = existingPreferences.hard_restrictions?.diets || [];
    const incomingDiets = incomingPreferences.hard_restrictions?.diets || [];
    detectDietConflicts(conflicts, existingDiets, incomingDiets);

    const existingLikes = [
        ...(existingPreferences.soft_likes?.foods || []),
        ...(existingPreferences.soft_likes?.cuisines || []),
    ];
    const existingDislikes = [
        ...(existingPreferences.soft_dislikes?.foods || []),
        ...(existingPreferences.soft_dislikes?.cuisines || []),
    ];
    const incomingLikes = [
        ...(incomingPreferences.soft_likes?.foods || []),
        ...(incomingPreferences.soft_likes?.cuisines || []),
    ];
    const incomingDislikes = [
        ...(incomingPreferences.soft_dislikes?.foods || []),
        ...(incomingPreferences.soft_dislikes?.cuisines || []),
    ];
    detectOppositePreferenceConflicts(conflicts, existingLikes, existingDislikes, incomingLikes, incomingDislikes);

    detectNumericConflicts(
        conflicts,
        'nutrition_preferences.budget_preferences.daily_budget',
        existingPreferences.budget_preferences?.daily_budget,
        incomingPreferences.budget_preferences?.daily_budget
    );

    detectNumericConflicts(
        conflicts,
        'nutrition_preferences.budget_preferences.weekly_budget',
        existingPreferences.budget_preferences?.weekly_budget,
        incomingPreferences.budget_preferences?.weekly_budget
    );

    detectNumericConflicts(
        conflicts,
        'nutrition_preferences.rule_based_preferences.cheat_meals_per_week',
        existingPreferences.rule_based_preferences?.cheat_meals_per_week,
        incomingPreferences.rule_based_preferences?.cheat_meals_per_week
    );

    return conflicts;
}

module.exports = {
    detectNutritionPreferenceConflicts,
};
