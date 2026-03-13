const { compactObject, canonicalizeString } = require('./normalizationService');
const { normalizeExtractedPreferences } = require('./normalizationLayer');

const FOOD_CANONICAL_ALIASES = new Map([
    ['tofu', 'tofu'],
    ['\u05d8\u05d5\u05e4\u05d5', 'tofu'],
    ['avocado', 'avocado'],
    ['\u05d0\u05d1\u05d5\u05e7\u05d3\u05d5', 'avocado'],
    ['chocolate', 'chocolate'],
    ['\u05e9\u05d5\u05e7\u05d5\u05dc\u05d3', 'chocolate'],
]);

function canonicalizeFoodToken(value) {
    const key = canonicalizeString(value).toLowerCase();
    return FOOD_CANONICAL_ALIASES.get(key) || key;
}

function dedupeArray(values = []) {
    const seen = new Set();
    const output = [];

    for (const value of values) {
        if (value === undefined || value === null) continue;

        let key;
        if (typeof value === 'string') {
            key = normalizeKey(value);
            if (!key) continue;
        } else if (typeof value === 'object') {
            key = JSON.stringify(value);
        } else {
            key = String(value);
        }

        if (seen.has(key)) continue;
        seen.add(key);
        output.push(value);
    }

    return output;
}

function normalizeKey(value) {
    const raw = canonicalizeString(value).toLowerCase();
    if (!raw) return '';

    const stripped = raw
        .replace(/\b(?:i|we)\b/g, ' ')
        .replace(/\b(?:do\s*not|don't|dont|not)\b/g, ' ')
        .replace(/\b(?:like|love|prefer|enjoy|hate|dislike|avoid)\b/g, ' ')
        .replace(/\b(?:eat|eating|to eat)\b/g, ' ')
        .replace(/(?:\u05d0\u05e0\u05d9|\u05d0\u05e0\u05d7\u05e0\u05d5)/g, ' ')
        .replace(/(?:\u05dc\u05d0)/g, ' ')
        .replace(/(?:\u05d0\u05d5\u05d4\u05d1(?:\u05ea)?|\u05e9\u05d5\u05e0\u05d0(?:\u05ea)?|\u05de\u05e2\u05d3\u05d9\u05e3(?:\u05d4|\u05d9\u05dd|\u05d5\u05ea)?|\u05e0\u05de\u05e0\u05e2(?:\u05ea|\u05d9\u05dd|\u05d5\u05ea)?)/g, ' ')
        .replace(/(?:\u05dc\u05d0\u05db\u05d5\u05dc|\u05d1\u05e6\u05d4\u05e8\u05d9\u05d9\u05dd|\u05d1\u05e2\u05e8\u05d1|\u05d1\u05d1\u05d5\u05e7\u05e8)/g, ' ')
        .replace(/[.,!?;:()[\]{}"']/g, ' ')
        .replace(/\b(?:really|very|totally|absolutely|overall|general|at all)\b/g, ' ')
        .replace(/(?:\u05d1\u05db\u05dc\u05dc|\u05de\u05de\u05e9|\u05de\u05d0\u05d5\u05d3)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!stripped) return '';

    const tokens = stripped.split(' ').filter(Boolean);
    const dedupedTokens = [];
    for (const token of tokens) {
        if (dedupedTokens[dedupedTokens.length - 1] === token) continue;
        dedupedTokens.push(token);
    }

    return dedupedTokens.map((token) => canonicalizeFoodToken(token)).join(' ').trim();
}

function ensureStringArray(value) {
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
}

function upsertByLatest(baseValues = [], incomingValues = [], latestWins = true) {
    const existingMap = new Map();

    for (const item of ensureStringArray(baseValues)) {
        const key = normalizeKey(item);
        if (!key || existingMap.has(key)) continue;
        existingMap.set(key, item);
    }

    if (latestWins) {
        for (const item of ensureStringArray(incomingValues)) {
            const key = normalizeKey(item);
            if (!key) continue;
            existingMap.set(key, item);
        }
    }

    return Array.from(existingMap.values());
}

function removeValuesByKey(values = [], valuesToRemove = []) {
    const removalSet = new Set(ensureStringArray(valuesToRemove).map((v) => normalizeKey(v)).filter(Boolean));
    return ensureStringArray(values).filter((item) => !removalSet.has(normalizeKey(item)));
}

function resolveOppositeListConflicts({
    likes = [],
    dislikes = [],
    incomingLikes = [],
    incomingDislikes = [],
}) {
    let nextLikes = upsertByLatest(likes, incomingLikes, true);
    let nextDislikes = upsertByLatest(dislikes, incomingDislikes, true);

    // Latest explicit dislikes remove matching likes.
    nextLikes = removeValuesByKey(nextLikes, incomingDislikes);
    // Latest explicit likes remove matching dislikes.
    nextDislikes = removeValuesByKey(nextDislikes, incomingLikes);

    // Cleanup any remaining overlap (fallback policy: keep in dislikes for safety).
    const dislikeSet = new Set(nextDislikes.map((item) => normalizeKey(item)).filter(Boolean));
    nextLikes = nextLikes.filter((item) => !dislikeSet.has(normalizeKey(item)));

    return {
        likes: dedupeArray(nextLikes),
        dislikes: dedupeArray(nextDislikes),
    };
}

function applySoftPreferenceResolution(merged = {}, incoming = {}) {
    const incomingLikeFoods = incoming.soft_likes?.foods || [];
    const incomingLikeCuisines = incoming.soft_likes?.cuisines || [];
    const incomingDislikeFoods = incoming.soft_dislikes?.foods || [];
    const incomingDislikeCuisines = incoming.soft_dislikes?.cuisines || [];

    const currentLikeFoods = merged.soft_likes?.foods || [];
    const currentLikeCuisines = merged.soft_likes?.cuisines || [];
    const currentDislikeFoods = merged.soft_dislikes?.foods || [];
    const currentDislikeCuisines = merged.soft_dislikes?.cuisines || [];

    const foodsResolution = resolveOppositeListConflicts({
        likes: currentLikeFoods,
        dislikes: currentDislikeFoods,
        incomingLikes: incomingLikeFoods,
        incomingDislikes: incomingDislikeFoods,
    });

    const cuisinesResolution = resolveOppositeListConflicts({
        likes: currentLikeCuisines,
        dislikes: currentDislikeCuisines,
        incomingLikes: incomingLikeCuisines,
        incomingDislikes: incomingDislikeCuisines,
    });

    const next = { ...merged };
    next.soft_likes = { ...(next.soft_likes || {}) };
    next.soft_dislikes = { ...(next.soft_dislikes || {}) };

    if (foodsResolution.likes.length) next.soft_likes.foods = foodsResolution.likes;
    else delete next.soft_likes.foods;

    if (cuisinesResolution.likes.length) next.soft_likes.cuisines = cuisinesResolution.likes;
    else delete next.soft_likes.cuisines;

    if (foodsResolution.dislikes.length) next.soft_dislikes.foods = foodsResolution.dislikes;
    else delete next.soft_dislikes.foods;

    if (cuisinesResolution.dislikes.length) next.soft_dislikes.cuisines = cuisinesResolution.dislikes;
    else delete next.soft_dislikes.cuisines;

    return next;
}

function mergeValues(existingValue, incomingValue) {
    if (incomingValue === undefined) return existingValue;

    if (Array.isArray(existingValue) || Array.isArray(incomingValue)) {
        const existingArray = Array.isArray(existingValue) ? existingValue : [];
        const incomingArray = Array.isArray(incomingValue) ? incomingValue : [];
        return dedupeArray([...existingArray, ...incomingArray]);
    }

    const existingIsObject = existingValue && typeof existingValue === 'object' && !Array.isArray(existingValue);
    const incomingIsObject = incomingValue && typeof incomingValue === 'object' && !Array.isArray(incomingValue);
    if (existingIsObject || incomingIsObject) {
        const existingObject = existingIsObject ? existingValue : {};
        const incomingObject = incomingIsObject ? incomingValue : {};
        const merged = { ...existingObject };

        for (const [key, value] of Object.entries(incomingObject)) {
            merged[key] = mergeValues(existingObject[key], value);
        }

        return merged;
    }

    return incomingValue;
}

function mergeNutritionPreferences(existingPreferences = {}, incomingPreferences = {}) {
    const merged = mergeValues(existingPreferences, incomingPreferences) || {};
    const resolved = applySoftPreferenceResolution(merged, incomingPreferences);
    const normalized = normalizeExtractedPreferences(resolved);
    const resolvedAgain = applySoftPreferenceResolution(normalized, incomingPreferences);
    return compactObject(resolvedAgain) || {};
}

module.exports = {
    mergeNutritionPreferences,
};
