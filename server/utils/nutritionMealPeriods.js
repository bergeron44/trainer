const nutritionMealPeriods = require('../../shared/nutritionMealPeriods.json');

function normalizePeriodToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

function clampMealCount(value, fallback = 5) {
    const parsed = Number.parseInt(value, 10);
    const normalized = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(6, Math.max(2, normalized));
}

function getCanonicalMealPeriods(mealCount = 5) {
    const normalizedCount = clampMealCount(mealCount);
    return nutritionMealPeriods.canonicalByMealCount[String(normalizedCount)] || nutritionMealPeriods.canonicalByMealCount['5'];
}

function buildAliasLookup() {
    const lookup = new Map();

    Object.entries(nutritionMealPeriods.aliasesByCanonical || {}).forEach(([canonical, aliases]) => {
        const variants = Array.isArray(aliases) ? aliases : [];
        [canonical, ...variants].forEach((variant) => {
            const key = normalizePeriodToken(variant);
            if (!key) return;
            const existing = lookup.get(key) || [];
            if (!existing.includes(canonical)) {
                lookup.set(key, [...existing, canonical]);
            }
        });
    });

    return lookup;
}

const aliasLookup = buildAliasLookup();

function getCandidateMealPeriods(value, allowedPeriods = []) {
    const token = normalizePeriodToken(value);
    if (!token) return [];

    const allowed = Array.isArray(allowedPeriods) && allowedPeriods.length
        ? allowedPeriods
        : Array.from(new Set(Object.values(nutritionMealPeriods.canonicalByMealCount).flat()));
    const allowedSet = new Set(allowed);

    if (allowed.some((period) => normalizePeriodToken(period) === token)) {
        return allowed.filter((period) => normalizePeriodToken(period) === token);
    }

    const candidates = aliasLookup.get(token) || [];
    return candidates.filter((candidate) => allowedSet.has(candidate));
}

function resolveCanonicalMealPeriod(value, { mealCount, allowedPeriods } = {}) {
    const allowed = Array.isArray(allowedPeriods) && allowedPeriods.length
        ? allowedPeriods
        : getCanonicalMealPeriods(mealCount);
    const candidates = getCandidateMealPeriods(value, allowed);
    return candidates[0] || null;
}

function normalizeImportedNutritionMenuPeriods(entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) return [];

    const distinctPeriods = new Set(
        entries
            .map((entry) => normalizePeriodToken(entry?.meal_period))
            .filter(Boolean)
    ).size;
    const targetPeriods = getCanonicalMealPeriods(distinctPeriods || entries.length || 4);
    const remainingPeriods = [...targetPeriods];
    const assignments = new Array(entries.length).fill(null);

    const assign = (index, period) => {
        assignments[index] = period;
        const remainingIndex = remainingPeriods.indexOf(period);
        if (remainingIndex >= 0) {
            remainingPeriods.splice(remainingIndex, 1);
        }
    };

    entries.forEach((entry, index) => {
        const candidates = getCandidateMealPeriods(entry?.meal_period, targetPeriods)
            .filter((period) => remainingPeriods.includes(period));
        if (candidates.length === 1) {
            assign(index, candidates[0]);
        }
    });

    entries.forEach((entry, index) => {
        if (assignments[index]) return;
        const candidates = getCandidateMealPeriods(entry?.meal_period, targetPeriods)
            .filter((period) => remainingPeriods.includes(period));
        if (candidates.length > 0) {
            assign(index, candidates[0]);
        }
    });

    return entries.map((entry, index) => ({
        ...entry,
        meal_period: assignments[index]
            || remainingPeriods.shift()
            || resolveCanonicalMealPeriod(entry?.meal_period, { allowedPeriods: targetPeriods })
            || String(entry?.meal_period || '').trim(),
    }));
}

module.exports = {
    clampMealCount,
    getCanonicalMealPeriods,
    getCandidateMealPeriods,
    normalizeImportedNutritionMenuPeriods,
    normalizePeriodToken,
    resolveCanonicalMealPeriod,
};
