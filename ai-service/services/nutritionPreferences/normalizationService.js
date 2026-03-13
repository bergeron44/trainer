const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_ALIASES = new Map([
    ['sunday', 'sunday'],
    ['sun', 'sunday'],
    ['\u05e8\u05d0\u05e9\u05d5\u05df', 'sunday'],
    ['\u05d9\u05d5\u05dd \u05e8\u05d0\u05e9\u05d5\u05df', 'sunday'],
    ['\u05d1\u05d9\u05d5\u05dd \u05e8\u05d0\u05e9\u05d5\u05df', 'sunday'],
    ['\u05d1\u05e8\u05d0\u05e9\u05d5\u05df', 'sunday'],

    ['monday', 'monday'],
    ['mon', 'monday'],
    ['\u05e9\u05e0\u05d9', 'monday'],
    ['\u05d9\u05d5\u05dd \u05e9\u05e0\u05d9', 'monday'],
    ['\u05d1\u05d9\u05d5\u05dd \u05e9\u05e0\u05d9', 'monday'],
    ['\u05d1\u05e9\u05e0\u05d9', 'monday'],

    ['tuesday', 'tuesday'],
    ['tue', 'tuesday'],
    ['\u05e9\u05dc\u05d9\u05e9\u05d9', 'tuesday'],
    ['\u05d9\u05d5\u05dd \u05e9\u05dc\u05d9\u05e9\u05d9', 'tuesday'],
    ['\u05d1\u05d9\u05d5\u05dd \u05e9\u05dc\u05d9\u05e9\u05d9', 'tuesday'],
    ['\u05d1\u05e9\u05dc\u05d9\u05e9\u05d9', 'tuesday'],

    ['wednesday', 'wednesday'],
    ['wed', 'wednesday'],
    ['\u05e8\u05d1\u05d9\u05e2\u05d9', 'wednesday'],
    ['\u05d9\u05d5\u05dd \u05e8\u05d1\u05d9\u05e2\u05d9', 'wednesday'],
    ['\u05d1\u05d9\u05d5\u05dd \u05e8\u05d1\u05d9\u05e2\u05d9', 'wednesday'],
    ['\u05d1\u05e8\u05d1\u05d9\u05e2\u05d9', 'wednesday'],

    ['thursday', 'thursday'],
    ['thu', 'thursday'],
    ['\u05d7\u05de\u05d9\u05e9\u05d9', 'thursday'],
    ['\u05d9\u05d5\u05dd \u05d7\u05de\u05d9\u05e9\u05d9', 'thursday'],
    ['\u05d1\u05d9\u05d5\u05dd \u05d7\u05de\u05d9\u05e9\u05d9', 'thursday'],
    ['\u05d1\u05d7\u05de\u05d9\u05e9\u05d9', 'thursday'],

    ['friday', 'friday'],
    ['fri', 'friday'],
    ['\u05e9\u05d9\u05e9\u05d9', 'friday'],
    ['\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9', 'friday'],
    ['\u05d1\u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9', 'friday'],
    ['\u05d1\u05e9\u05d9\u05e9\u05d9', 'friday'],

    ['saturday', 'saturday'],
    ['sat', 'saturday'],
    ['\u05e9\u05d1\u05ea', 'saturday'],
    ['\u05d1\u05e9\u05d1\u05ea', 'saturday'],
]);

const DIET_PATTERNS = [
    { value: 'vegan', regexes: [/\bvegan\b/i, /\u05d8\u05d1\u05e2\u05d5\u05e0(?:\u05d9|\u05d9\u05ea|\u05d9\u05dd|\u05d9\u05d5\u05ea)?/i] },
    { value: 'vegetarian', regexes: [/\bvegetarian\b/i, /\bveggie\b/i, /\u05e6\u05de\u05d7\u05d5\u05e0(?:\u05d9|\u05d9\u05ea|\u05d9\u05dd|\u05d9\u05d5\u05ea)?/i] },
    { value: 'pescatarian', regexes: [/\bpescatarian\b/i, /\u05e4\u05e1\u05e7\u05d8\u05e8\u05d9\u05d0\u05e0/i] },
    { value: 'kosher', regexes: [/\bkosher\b/i, /\u05db\u05e9\u05e8/i] },
    { value: 'halal', regexes: [/\bhalal\b/i, /\u05d7\u05dc\u05d0\u05dc/i] },
    { value: 'gluten_free', regexes: [/\bgluten[-\s]?free\b/i, /\u05dc\u05dc\u05d0 \u05d2\u05dc\u05d5\u05d8\u05df/i, /\u05d1\u05dc\u05d9 \u05d2\u05dc\u05d5\u05d8\u05df/i] },
    { value: 'lactose_free', regexes: [/\blactose[-\s]?free\b/i, /\bdairy[-\s]?free\b/i, /\u05dc\u05dc\u05d0 \u05dc\u05e7\u05d8\u05d5\u05d6/i, /\u05dc\u05dc\u05d0 \u05de\u05d5\u05e6\u05e8\u05d9 \u05d7\u05dc\u05d1/i] },
];

const CUISINE_PATTERNS = [
    { value: 'mediterranean', regexes: [/\bmediterranean\b/i, /\u05d9\u05dd \u05ea\u05d9\u05db\u05d5\u05df/i] },
    { value: 'italian', regexes: [/\bitalian\b/i, /\u05d0\u05d9\u05d8\u05dc\u05e7/i] },
    { value: 'asian', regexes: [/\basian\b/i, /\u05d0\u05e1\u05d9\u05d9\u05ea/i] },
    { value: 'middle_eastern', regexes: [/\bmiddle[-\s]?eastern\b/i, /\u05de\u05d6\u05e8\u05d7 \u05ea\u05d9\u05db\u05d5\u05df/i] },
    { value: 'mexican', regexes: [/\bmexican\b/i, /\u05de\u05e7\u05e1\u05d9\u05e7\u05e0\u05d9/i] },
    { value: 'japanese', regexes: [/\bjapanese\b/i, /\u05d9\u05e4\u05e0\u05d9/i] },
    { value: 'indian', regexes: [/\bindian\b/i, /\u05d4\u05d5\u05d3\u05d9/i] },
];

const COOKING_SKILL_PATTERNS = [
    { value: 'beginner', regexes: [/\bbeginner\b/i, /\u05de\u05ea\u05d7\u05d9\u05dc/i] },
    { value: 'intermediate', regexes: [/\bintermediate\b/i, /\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9/i] },
    { value: 'advanced', regexes: [/\badvanced\b/i, /\u05de\u05ea\u05e7\u05d3\u05dd/i] },
];

function canonicalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value).replace(/\s+/g, ' ').trim();
}

function dedupeStrings(values = []) {
    const seen = new Set();
    const output = [];
    for (const raw of values) {
        const value = canonicalizeString(raw);
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(value);
    }
    return output;
}

function splitList(raw = '') {
    const normalized = canonicalizeString(raw);
    if (!normalized) return [];
    return normalized
        .split(/,|;|\/|\n|\band\b|\&|\+|\s+\u05d5(?:\u05d2\u05dd)?\s+|\s+\u05d2\u05dd\s+/gi)
        .map((part) => canonicalizeString(part))
        .filter(Boolean);
}

function detectByPatterns(text = '', patternDefs = []) {
    const result = [];
    for (const definition of patternDefs) {
        if (definition.regexes.some((regex) => regex.test(text))) {
            result.push(definition.value);
        }
    }
    return dedupeStrings(result);
}

function normalizeDayToken(token = '') {
    const value = canonicalizeString(token).toLowerCase();
    return DAY_ALIASES.get(value) || null;
}

function extractDays(text = '') {
    const normalizedText = canonicalizeString(text).toLowerCase();
    const found = [];

    for (const alias of DAY_ALIASES.keys()) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|\\s|[.,;:!?()])${escaped}(?:$|\\s|[.,;:!?()])`, 'i');
        if (regex.test(normalizedText)) {
            const normalized = DAY_ALIASES.get(alias);
            if (normalized) found.push(normalized);
        }
    }

    return dedupeStrings(found);
}

function normalizeCurrency(token = '') {
    const value = canonicalizeString(token).toLowerCase();
    if (!value) return null;
    if (value.includes('\u20aa') || value.includes('nis') || value.includes('ils') || value.includes('\u05e9\u05e7\u05dc')) {
        return 'ILS';
    }
    if (value.includes('$') || value.includes('usd') || value.includes('dollar')) {
        return 'USD';
    }
    return null;
}

function compactObject(value) {
    if (Array.isArray(value)) {
        const compactedArray = value
            .map((item) => compactObject(item))
            .filter((item) => {
                if (item === undefined || item === null) return false;
                if (typeof item === 'string') return item.trim().length > 0;
                if (Array.isArray(item)) return item.length > 0;
                if (typeof item === 'object') return Object.keys(item).length > 0;
                return true;
            });
        return compactedArray.length ? compactedArray : undefined;
    }

    if (value && typeof value === 'object') {
        const compacted = {};
        for (const [key, nested] of Object.entries(value)) {
            const compactedNested = compactObject(nested);
            if (compactedNested !== undefined) {
                compacted[key] = compactedNested;
            }
        }
        return Object.keys(compacted).length ? compacted : undefined;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }

    return value === undefined ? undefined : value;
}

module.exports = {
    WEEK_DAYS,
    canonicalizeString,
    compactObject,
    dedupeStrings,
    detectByPatterns,
    extractDays,
    splitList,
    normalizeCurrency,
    normalizeDayToken,
    DIET_PATTERNS,
    CUISINE_PATTERNS,
    COOKING_SKILL_PATTERNS,
};
