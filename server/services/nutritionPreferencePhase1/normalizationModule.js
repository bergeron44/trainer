const {
    canonicalizeString,
    dedupeStrings,
    normalizeDayToken,
    compactObject,
} = require('../nutritionPreferences/normalizationService');
const { normalizeExtractedPreferences } = require('../nutritionPreferences/normalizationLayer');

function toObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function lower(value) {
    return canonicalizeString(value).toLowerCase();
}

function mapByDictionary(value, dictionary = {}) {
    const key = lower(value);
    if (!key) return '';
    return canonicalizeString(dictionary[key] || value);
}

function invertFoodSynonyms(foodSynonyms = {}) {
    const mapping = {};
    for (const [canonical, aliases] of Object.entries(foodSynonyms || {})) {
        const canonicalKey = lower(canonical);
        if (!canonicalKey) continue;
        mapping[canonicalKey] = canonical;
        for (const alias of toArray(aliases)) {
            const aliasKey = lower(alias);
            if (!aliasKey) continue;
            mapping[aliasKey] = canonical;
        }
    }
    return mapping;
}

function normalizeFoods(values, foodSynonymMap) {
    return dedupeStrings(toArray(values).map((item) => {
        const token = canonicalizeString(item);
        const mapped = foodSynonymMap[lower(token)];
        return canonicalizeString(mapped || token);
    }));
}

function normalizeCuisines(values, dictionary) {
    return dedupeStrings(toArray(values).map((item) => mapByDictionary(item, dictionary))).map((item) => lower(item));
}

function applySafeRuleLayer(extractedPreferences = {}, safeRuleLayer = {}) {
    const source = toObject(extractedPreferences);
    const dict = toObject(safeRuleLayer.normalizationDictionary);
    const foodSynonymMap = invertFoodSynonyms(safeRuleLayer.foodSynonyms || {});

    const mapped = {
        ...source,
        hard_restrictions: {
            ...(source.hard_restrictions || {}),
            diets: dedupeStrings(toArray(source.hard_restrictions?.diets).map((item) => mapByDictionary(item, dict.diets || {}))).map((item) => lower(item)),
        },
        soft_likes: {
            ...(source.soft_likes || {}),
            cuisines: normalizeCuisines(source.soft_likes?.cuisines, dict.cuisines || {}),
            foods: normalizeFoods(source.soft_likes?.foods, foodSynonymMap),
        },
        soft_dislikes: {
            ...(source.soft_dislikes || {}),
            cuisines: normalizeCuisines(source.soft_dislikes?.cuisines, dict.cuisines || {}),
            foods: normalizeFoods(source.soft_dislikes?.foods, foodSynonymMap),
        },
        rule_based_preferences: {
            ...(source.rule_based_preferences || {}),
            cheat_days: dedupeStrings(toArray(source.rule_based_preferences?.cheat_days).map((day) => normalizeDayToken(day) || day)).map((day) => lower(day)),
            day_rules: toArray(source.rule_based_preferences?.day_rules).map((rule) => ({
                ...toObject(rule),
                day_of_week: normalizeDayToken(rule?.day_of_week) || lower(rule?.day_of_week),
                rule_type: lower(mapByDictionary(rule?.rule_type, dict.day_rule_types || {})),
            })),
            meal_time_rules: toArray(source.rule_based_preferences?.meal_time_rules).map((rule) => ({
                ...toObject(rule),
                meal_period: lower(mapByDictionary(rule?.meal_period, dict.meal_periods || {})),
                preference: lower(mapByDictionary(rule?.preference, dict.meal_preferences || {})),
            })),
        },
    };

    return compactObject(mapped) || {};
}

function detectAmbiguitySignals(rawText, safeRuleLayer = {}) {
    const text = lower(rawText);
    const rules = toArray(safeRuleLayer.ambiguityRules);
    const signals = [];

    for (const rule of rules) {
        const pattern = lower(rule?.pattern);
        if (!pattern) continue;
        if (text.includes(pattern)) {
            signals.push({
                pattern: rule.pattern,
                action: canonicalizeString(rule.action || 'mark_uncertain'),
                route_to: canonicalizeString(rule.route_to || ''),
            });
        }
    }

    return signals;
}

function normalizeExtractionResult({ extractorOutput, safeRuleLayer }) {
    const source = toObject(extractorOutput);
    const rawText = canonicalizeString(source.raw_text);
    const proposedUpdate = toObject(source.proposed_update);
    const nutritionPreferences = toObject(proposedUpdate.nutrition_preferences || proposedUpdate);
    const withRuleLayer = applySafeRuleLayer(nutritionPreferences, safeRuleLayer);
    const normalizedNutrition = normalizeExtractedPreferences(withRuleLayer);
    const normalizedOutput = {
        nutrition_preferences: normalizedNutrition || {},
    };

    const ambiguitySignals = detectAmbiguitySignals(rawText, safeRuleLayer);
    const uncertainFromSignals = ambiguitySignals.map((signal) => `Ambiguous phrase matched: ${signal.pattern}`);
    const uncertainItems = dedupeStrings([...(source.uncertain_items || []), ...uncertainFromSignals]);

    return {
        raw_text: rawText,
        normalized_output: normalizedOutput,
        uncertain_items: uncertainItems,
        ambiguity_signals: ambiguitySignals,
        conflicts_detected: toArray(source.conflicts_detected),
        delete_requests: toArray(source.delete_requests),
    };
}

module.exports = {
    normalizeExtractionResult,
};
