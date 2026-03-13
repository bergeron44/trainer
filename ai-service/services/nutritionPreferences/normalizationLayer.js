const {
    canonicalizeString,
    dedupeStrings,
    normalizeCurrency,
    compactObject,
    WEEK_DAYS,
} = require('./normalizationService');

const MEAL_PERIODS = ['breakfast', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];
const TIME_CONTEXT_DAY_VALUES = [...WEEK_DAYS, 'any'];
const TIME_CONTEXT_MEAL_VALUES = [...MEAL_PERIODS, 'any'];
const DAY_RULE_TYPES = ['cheat_day', 'budget_flex', 'fasting', 'custom'];
const MEAL_PREFERENCE_TYPES = ['light', 'moderate', 'heavy', 'high_protein', 'low_carb'];

function cleanPreferenceFoodToken(value) {
    let text = canonicalizeString(value);
    if (!text) return '';

    text = text
        // Hebrew preference phrases
        .replace(/(?:\u05d0\u05e0\u05d9|\u05d0\u05e0\u05d7\u05e0\u05d5)\s+(?:\u05dc\u05d0\s+)?(?:\u05d0\u05d5\u05d4\u05d1(?:\u05ea)?|\u05e9\u05d5\u05e0\u05d0(?:\u05ea)?|\u05de\u05e2\u05d3\u05d9\u05e3(?:\u05d4|\u05d9\u05dd|\u05d5\u05ea)?|\u05e0\u05d4\u05e0(?:\u05d4|\u05d9\u05dd|\u05d5\u05ea)?)/gi, ' ')
        // English preference phrases
        .replace(/\b(?:i|we)\s+(?:do\s*not|don't|dont|not)?\s*(?:like|love|prefer|enjoy|hate|dislike|avoid)\b/gi, ' ')
        // Non-food context verbs/timing words
        .replace(/\b(?:eat|eating|to eat)\b/gi, ' ')
        .replace(/(?:\u05dc\u05d0\u05db\u05d5\u05dc|\u05d1\u05e6\u05d4\u05e8\u05d9\u05d9\u05dd|\u05d1\u05e2\u05e8\u05d1|\u05d1\u05d1\u05d5\u05e7\u05e8)/g, ' ')
        .replace(/\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, ' ')
        .replace(/(?:\u05d1?\u05e9\u05d1\u05ea|\u05d1?\u05e8\u05d0\u05e9\u05d5\u05df|\u05d1?\u05e9\u05e0\u05d9|\u05d1?\u05e9\u05dc\u05d9\u05e9\u05d9|\u05d1?\u05e8\u05d1\u05d9\u05e2\u05d9|\u05d1?\u05d7\u05de\u05d9\u05e9\u05d9|\u05d1?\u05e9\u05d9\u05e9\u05d9)/g, ' ')
        .replace(/\b(?:really|very|totally|at all)\b/gi, ' ')
        .replace(/(?:\u05d1\u05db\u05dc\u05dc|\u05de\u05de\u05e9|\u05de\u05d0\u05d5\u05d3)/g, ' ')
        .replace(/[.,!?;:()[\]{}"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!text) return '';

    const parts = text.split(/\s+/).filter(Boolean);
    const dedupedParts = [];
    for (const part of parts) {
        const normalizedPart = canonicalizeString(part);
        if (!normalizedPart) continue;
        if (dedupedParts[dedupedParts.length - 1] === normalizedPart) continue;
        dedupedParts.push(normalizedPart);
    }

    return dedupedParts.join(' ').trim();
}

function normalizeFoodTokenArray(values = []) {
    return dedupeStrings(values.map((item) => cleanPreferenceFoodToken(item)).filter(Boolean));
}

function normalizeExpensiveDays(expensiveDays = []) {
    const normalized = [];
    for (const dayEntry of expensiveDays) {
        if (!dayEntry || typeof dayEntry !== 'object') continue;
        const day = canonicalizeString(dayEntry.day_of_week).toLowerCase();
        if (!WEEK_DAYS.includes(day)) continue;

        const candidate = {
            day_of_week: day,
            budget_cap: Number.isFinite(dayEntry.budget_cap) ? Number(dayEntry.budget_cap) : undefined,
            note: canonicalizeString(dayEntry.note) || undefined,
        };
        normalized.push(compactObject(candidate));
    }

    const seen = new Set();
    return normalized.filter((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeDayRules(dayRules = []) {
    const normalized = [];
    for (const ruleEntry of dayRules) {
        if (!ruleEntry || typeof ruleEntry !== 'object') continue;
        const day = canonicalizeString(ruleEntry.day_of_week).toLowerCase();
        const ruleType = canonicalizeString(ruleEntry.rule_type).toLowerCase();
        if (!WEEK_DAYS.includes(day) || !DAY_RULE_TYPES.includes(ruleType)) continue;

        const candidate = {
            day_of_week: day,
            rule_type: ruleType,
            note: canonicalizeString(ruleEntry.note) || undefined,
        };
        normalized.push(compactObject(candidate));
    }

    const seen = new Set();
    return normalized.filter((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeMealTimeRules(mealTimeRules = []) {
    const normalized = [];
    for (const ruleEntry of mealTimeRules) {
        if (!ruleEntry || typeof ruleEntry !== 'object') continue;
        const mealPeriod = canonicalizeString(ruleEntry.meal_period).toLowerCase();
        const preference = canonicalizeString(ruleEntry.preference).toLowerCase();
        if (!MEAL_PERIODS.includes(mealPeriod) || !MEAL_PREFERENCE_TYPES.includes(preference)) continue;

        const candidate = {
            meal_period: mealPeriod,
            preference,
            max_calories: Number.isFinite(ruleEntry.max_calories) ? Number(ruleEntry.max_calories) : undefined,
            note: canonicalizeString(ruleEntry.note) || undefined,
        };
        normalized.push(compactObject(candidate));
    }

    const seen = new Set();
    return normalized.filter((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeTimeContextNotes(timeContextNotes = []) {
    const normalized = [];
    for (const entry of timeContextNotes) {
        if (!entry || typeof entry !== 'object') continue;
        const day = canonicalizeString(entry.day_of_week || 'any').toLowerCase();
        const meal = canonicalizeString(entry.meal_period || 'any').toLowerCase();
        const note = canonicalizeString(entry.note);

        if (!note) continue;
        if (!TIME_CONTEXT_DAY_VALUES.includes(day)) continue;
        if (!TIME_CONTEXT_MEAL_VALUES.includes(meal)) continue;

        normalized.push({
            day_of_week: day,
            meal_period: meal,
            note,
        });
    }

    const seen = new Set();
    return normalized.filter((item) => {
        const key = `${item.day_of_week}:${item.meal_period}:${item.note.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeTimeNotesMap(timeNotes = {}) {
    const source = timeNotes && typeof timeNotes === 'object' ? timeNotes : {};
    const byDaySource = source.by_day && typeof source.by_day === 'object' ? source.by_day : {};
    const byMealSource = source.by_meal_period && typeof source.by_meal_period === 'object' ? source.by_meal_period : {};

    const byDay = {};
    for (const day of WEEK_DAYS) {
        const note = canonicalizeString(byDaySource[day]);
        if (note) byDay[day] = note;
    }

    const byMealPeriod = {};
    for (const mealPeriod of MEAL_PERIODS) {
        const note = canonicalizeString(byMealSource[mealPeriod]);
        if (note) byMealPeriod[mealPeriod] = note;
    }

    const normalized = {};
    if (Object.keys(byDay).length) normalized.by_day = byDay;
    if (Object.keys(byMealPeriod).length) normalized.by_meal_period = byMealPeriod;
    return normalized;
}

function normalizeExtractedPreferences(extracted = {}) {
    const normalized = {
        hard_restrictions: {
            diets: dedupeStrings(extracted.hard_restrictions?.diets || []).map((d) => canonicalizeString(d).toLowerCase()),
            allergies: dedupeStrings(extracted.hard_restrictions?.allergies || []),
            medical_restrictions: dedupeStrings(extracted.hard_restrictions?.medical_restrictions || []),
            forbidden_ingredients: dedupeStrings(extracted.hard_restrictions?.forbidden_ingredients || []),
            notes: canonicalizeString(extracted.hard_restrictions?.notes),
        },
        soft_likes: {
            cuisines: dedupeStrings(extracted.soft_likes?.cuisines || []).map((c) => canonicalizeString(c).toLowerCase()),
            foods: normalizeFoodTokenArray(extracted.soft_likes?.foods || []),
            notes: canonicalizeString(extracted.soft_likes?.notes),
        },
        soft_dislikes: {
            cuisines: dedupeStrings(extracted.soft_dislikes?.cuisines || []).map((c) => canonicalizeString(c).toLowerCase()),
            foods: normalizeFoodTokenArray(extracted.soft_dislikes?.foods || []),
            notes: canonicalizeString(extracted.soft_dislikes?.notes),
        },
        budget_preferences: {
            currency: normalizeCurrency(extracted.budget_preferences?.currency) || canonicalizeString(extracted.budget_preferences?.currency),
            daily_budget: Number.isFinite(extracted.budget_preferences?.daily_budget)
                ? Number(extracted.budget_preferences.daily_budget)
                : undefined,
            weekly_budget: Number.isFinite(extracted.budget_preferences?.weekly_budget)
                ? Number(extracted.budget_preferences.weekly_budget)
                : undefined,
            expensive_days: normalizeExpensiveDays(extracted.budget_preferences?.expensive_days || []),
            notes: canonicalizeString(extracted.budget_preferences?.notes),
        },
        rule_based_preferences: {
            cheat_meals_per_week: Number.isFinite(extracted.rule_based_preferences?.cheat_meals_per_week)
                ? Number(extracted.rule_based_preferences.cheat_meals_per_week)
                : undefined,
            cheat_days: dedupeStrings(extracted.rule_based_preferences?.cheat_days || []).map((d) => canonicalizeString(d).toLowerCase()),
            day_rules: normalizeDayRules(extracted.rule_based_preferences?.day_rules || []),
            meal_time_rules: normalizeMealTimeRules(extracted.rule_based_preferences?.meal_time_rules || []),
            time_context_notes: normalizeTimeContextNotes(extracted.rule_based_preferences?.time_context_notes || []),
            time_notes: normalizeTimeNotesMap(extracted.rule_based_preferences?.time_notes || {}),
            special_rules: dedupeStrings(extracted.rule_based_preferences?.special_rules || []),
            notes: canonicalizeString(extracted.rule_based_preferences?.notes),
        },
        practical_constraints: {
            max_prep_time_minutes: Number.isFinite(extracted.practical_constraints?.max_prep_time_minutes)
                ? Number(extracted.practical_constraints.max_prep_time_minutes)
                : undefined,
            cooking_skill: canonicalizeString(extracted.practical_constraints?.cooking_skill).toLowerCase() || undefined,
            equipment: dedupeStrings(extracted.practical_constraints?.equipment || []).map((e) => canonicalizeString(e).toLowerCase()),
            meals_per_day: Number.isFinite(extracted.practical_constraints?.meals_per_day)
                ? Number(extracted.practical_constraints.meals_per_day)
                : undefined,
            batch_cooking: typeof extracted.practical_constraints?.batch_cooking === 'boolean'
                ? extracted.practical_constraints.batch_cooking
                : undefined,
            notes: canonicalizeString(extracted.practical_constraints?.notes),
        },
    };

    return compactObject(normalized) || {};
}

module.exports = {
    normalizeExtractedPreferences,
};
