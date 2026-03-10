const {
    canonicalizeString,
    dedupeStrings,
    detectByPatterns,
    extractDays,
    splitList,
    normalizeCurrency,
    DIET_PATTERNS,
    CUISINE_PATTERNS,
    COOKING_SKILL_PATTERNS,
    compactObject,
} = require('./normalizationService');

const LIKE_PATTERNS = [
    /\b(?:i\s+)?(?:really\s+)?(?:like|love|prefer|enjoy)\s+([^.\n;]+)/gi,
    /(?:\u05d0\u05e0\u05d9|\u05d0\u05e0\u05d7\u05e0\u05d5)\s*(?:\u05de\u05de\u05e9\s*)?(?:\u05d0\u05d5\u05d4\u05d1(?:\u05ea)?|\u05de\u05e2\u05d3\u05d9\u05e3(?:\u05d4|\u05d9\u05dd|\u05d5\u05ea)?|\u05e0\u05d4\u05e0(?:\u05d4|\u05d9\u05dd|\u05d5\u05ea))\s+([^.\n;]+)/gi,
];

const DISLIKE_PATTERNS = [
    /\b(?:i\s+)?(?:do\s*not|don't|cant|can't)\s+(?:like|eat)\s+([^.\n;]+)/gi,
    /\b(?:i\s+)?(?:hate|dislike|avoid)\s+([^.\n;]+)/gi,
    /(?:\u05d0\u05e0\u05d9|\u05d0\u05e0\u05d7\u05e0\u05d5)\s*(?:\u05dc\u05d0\s*\u05d0\u05d5\u05d4\u05d1(?:\u05ea)?|\u05e9\u05d5\u05e0\u05d0(?:\u05ea)?|\u05e0\u05de\u05e0\u05e2(?:\u05ea|\u05d9\u05dd|\u05d5\u05ea)?)\s+([^.\n;]+)/gi,
];

const ALLERGY_PATTERNS = [
    /\b(?:allergic|allergy)\s*(?:to)?\s+([^.\n;]+)/gi,
    /אלרג(?:י|ית|יה)\s*(?:ל)?\s*([^.\n;]+)/gi,
];

const STRICT_FORBIDDEN_PATTERNS = [
    /\bstrictly\s+no\s+([^.\n;]+)/gi,
    /\bmust\s+not\s+eat\s+([^.\n;]+)/gi,
    /אסור\s*(?:לי)?\s*(?:לאכול)?\s*([^.\n;]+)/gi,
    /לא\s*יכול(?:ה)?\s*לאכול\s+([^.\n;]+)/gi,
];

const MEDICAL_KEYWORDS = [
    { label: 'diabetes', regex: /\bdiabet/i },
    { label: 'hypertension', regex: /\bhigh blood pressure|hypertension\b/i },
    { label: 'cholesterol_management', regex: /\bcholesterol\b/i },
    { label: 'celiac', regex: /\bceliac\b|צליאק/i },
    { label: 'ibs', regex: /\bibs\b|מעי רגיז/i },
    { label: 'pregnancy', regex: /\bpregnan/i },
    { label: 'סוכרת', regex: /סוכרת/i },
    { label: 'לחץ דם גבוה', regex: /לחץ דם/i },
    { label: 'כולסטרול', regex: /כולסטרול/i },
];

const EQUIPMENT_KEYWORDS = [
    { value: 'microwave', regexes: [/\bmicrowave\b/i, /מיקרוגל/i] },
    { value: 'oven', regexes: [/\boven\b/i, /תנור/i] },
    { value: 'air_fryer', regexes: [/\bair\s*fryer\b/i, /אייר פריי|נינג'ה/i] },
    { value: 'stovetop', regexes: [/\bstovetop\b|\bstove\b/i, /כיריים/i] },
    { value: 'grill', regexes: [/\bgrill\b/i, /גריל/i] },
    { value: 'blender', regexes: [/\bblender\b/i, /בלנדר/i] },
];

const BATCH_COOKING_PATTERNS = [/\bmeal\s*prep\b/i, /\bbatch\s*cook/i, /הכנה מראש/i, /מבשל מראש/i];

const BUDGET_FLEX_PATTERNS = [/\bspend more\b/i, /\bmore budget\b/i, /יותר כסף/i, /אפשר להשקיע יותר/i];

const CHEAT_PATTERNS = [/\bcheat\b/i, /צ['’]?\s*יט/i, /ארוח(?:ת|ה) חופשית/i];

const FASTING_PATTERNS = [/\bfasting\b/i, /\bfast\b/i, /\bintermittent\s*fast/i, /צום/i];

const MEAL_PERIOD_PATTERN_DEFS = [
    { period: 'breakfast', patterns: [/\bbreakfast\b/i, /ארוחת בוקר/i, /בבוקר/i] },
    { period: 'lunch', patterns: [/\blunch\b/i, /ארוחת צהריים/i, /בצהריים/i] },
    { period: 'afternoon_snack', patterns: [/\bafternoon snack\b/i, /נשנוש(?: אחרי הצהריים)?/i] },
    { period: 'dinner', patterns: [/\bdinner\b/i, /ארוחת ערב/i, /בערב/i] },
    { period: 'evening_snack', patterns: [/\bevening\b/i, /\bnight\b/i, /בלילה/i] },
];

const MEAL_PREFERENCE_PATTERN_DEFS = [
    { preference: 'light', patterns: [/\blight\b/i, /\bnot\s+heavy\b/i, /קל(?:ה)?/i, /לא כבדה/i] },
    { preference: 'moderate', patterns: [/\bmoderate\b/i, /\bbalanced\b/i, /בינוני(?:ת)?/i, /מאוזנ(?:ת)?/i] },
    { preference: 'heavy', patterns: [/\bheavy\b/i, /\bbig meal\b/i, /כבד(?:ה)?/i] },
    { preference: 'high_protein', patterns: [/\bhigh protein\b/i, /\bprotein[-\s]*rich\b/i, /הרבה חלבון/i, /עשיר(?:ה)? בחלבון/i] },
    { preference: 'low_carb', patterns: [/\blow carb\b/i, /\blow carbs\b/i, /מעט פחמימות/i, /דל פחמימות/i] },
];

const HEBREW_NUMBER_WORDS = new Map([
    ['אחד', 1],
    ['אחת', 1],
    ['שתיים', 2],
    ['שניים', 2],
    ['שלוש', 3],
    ['ארבע', 4],
    ['חמש', 5],
]);

const ENGLISH_NUMBER_WORDS = new Map([
    ['one', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
]);

function collectMatches(text, patterns) {
    const results = [];
    for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match = pattern.exec(text);
        while (match) {
            if (match[1]) results.push(match[1]);
            match = pattern.exec(text);
        }
    }
    return results;
}

function mapItemsToCuisineOrFood(items) {
    const cuisines = [];
    const foods = [];

    for (const item of items) {
        const value = canonicalizeString(item);
        if (!value) continue;
        const detectedCuisine = detectByPatterns(value, CUISINE_PATTERNS)[0];
        if (detectedCuisine) {
            cuisines.push(detectedCuisine);
            continue;
        }
        foods.push(value);
    }

    return {
        cuisines: dedupeStrings(cuisines),
        foods: dedupeStrings(foods),
    };
}

function classifyPreferenceToken(item) {
    const value = canonicalizeString(item);
    if (!value) return null;

    const detectedCuisine = detectByPatterns(value, CUISINE_PATTERNS)[0];
    if (detectedCuisine) {
        return { bucket: 'cuisines', value: detectedCuisine };
    }

    return { bucket: 'foods', value };
}

function collectPreferenceEvents(text, patterns, preferenceType) {
    const events = [];

    for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match = pattern.exec(text);
        while (match) {
            const fullMatch = canonicalizeString(match[0] || '').toLowerCase();
            const startIndex = Number.isFinite(match.index) ? match.index : 0;
            const prefixContext = canonicalizeString(
                text.slice(Math.max(0, startIndex - 24), startIndex)
            ).toLowerCase();
            if (
                preferenceType === 'like' &&
                (
                    /\b(?:do\s*not|don't|dont|cannot|can't|cant|not)\s*$/.test(fullMatch) ||
                    /\b(?:do\s*not|don't|dont|cannot|can't|cant|not)\s*$/.test(prefixContext)
                )
            ) {
                match = pattern.exec(text);
                continue;
            }

            const parts = splitList(match[1] || '');

            parts.forEach((part, offset) => {
                let cleanedPart = canonicalizeString(part).replace(/^(?:but|however|although|אבל|אך)\s+/i, '');
                if (
                    preferenceType === 'like' &&
                    /\b(?:do\s*not|don't|dont|cannot|can't|cant|not|dislike|hate|avoid)\b/i.test(cleanedPart)
                ) {
                    return;
                }

                const classified = classifyPreferenceToken(cleanedPart);
                if (!classified) return;
                events.push({
                    index: startIndex + offset,
                    preferenceType,
                    bucket: classified.bucket,
                    value: classified.value,
                });
            });

            match = pattern.exec(text);
        }
    }

    return events;
}

function preparePreferenceTextForParsing(textInput) {
    const text = canonicalizeString(textInput);
    if (!text) return '';

    // Insert delimiters before repeated statements so no-punctuation text is parsed safely.
    // Example: "אני אוהב טופו אני לא אוהב טופו"
    return text
        .replace(/\s+((?:i|we)\s+(?:do\s*not|don't|dont|not)\s+(?:like|eat))/gi, '; $1')
        .replace(/\s+((?:i|we)\s+(?:like|love|prefer|enjoy))/gi, '; $1')
        .replace(/\s+((?:\u05d0\u05e0\u05d9|\u05d0\u05e0\u05d7\u05e0\u05d5)\s+\u05dc\u05d0\s+\u05d0\u05d5\u05d4\u05d1(?:\u05ea)?)/gi, '; $1')
        .replace(/\s+((?:\u05d0\u05e0\u05d9|\u05d0\u05e0\u05d7\u05e0\u05d5)\s+(?:\u05d0\u05d5\u05d4\u05d1(?:\u05ea)?|\u05e9\u05d5\u05e0\u05d0(?:\u05ea)?|\u05de\u05e2\u05d3\u05d9\u05e3(?:\u05d4|\u05d9\u05dd|\u05d5\u05ea)?))/gi, '; $1')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractPreferenceSignalsFromText(textInput) {
    const text = preparePreferenceTextForParsing(textInput);
    if (!text) {
        return {
            likes: { foods: [], cuisines: [] },
            dislikes: { foods: [], cuisines: [] },
            ambiguousItems: [],
        };
    }

    const events = [
        ...collectPreferenceEvents(text, LIKE_PATTERNS, 'like'),
        ...collectPreferenceEvents(text, DISLIKE_PATTERNS, 'dislike'),
    ].sort((a, b) => a.index - b.index);

    const latestByKey = new Map();
    const seenTypesByKey = new Map();

    for (const event of events) {
        const key = `${event.bucket}:${event.value.toLowerCase()}`;
        latestByKey.set(key, event);
        if (!seenTypesByKey.has(key)) {
            seenTypesByKey.set(key, new Set());
        }
        seenTypesByKey.get(key).add(event.preferenceType);
    }

    const likes = { foods: [], cuisines: [] };
    const dislikes = { foods: [], cuisines: [] };
    const ambiguousItems = [];

    for (const [key, latest] of latestByKey.entries()) {
        if (latest.preferenceType === 'like') {
            likes[latest.bucket].push(latest.value);
        } else {
            dislikes[latest.bucket].push(latest.value);
        }

        const seenTypes = seenTypesByKey.get(key) || new Set();
        if (seenTypes.has('like') && seenTypes.has('dislike')) {
            ambiguousItems.push({
                value: latest.value,
                bucket: latest.bucket,
                resolved_to: latest.preferenceType,
            });
        }
    }

    likes.foods = dedupeStrings(likes.foods);
    likes.cuisines = dedupeStrings(likes.cuisines);
    dislikes.foods = dedupeStrings(dislikes.foods);
    dislikes.cuisines = dedupeStrings(dislikes.cuisines);

    return {
        likes,
        dislikes,
        ambiguousItems,
    };
}

function parseBudget(text, category) {
    const output = {};
    const dailyRegexes = [
        /(?:budget|up to|max|עד|תקציב)\s*(\d{1,6})\s*(₪|\$|usd|ils|nis)?\s*(?:per day|daily|a day|ליום)/i,
        /(\d{1,6})\s*(₪|\$|usd|ils|nis)\s*(?:per day|daily|ליום)/i,
    ];
    const weeklyRegexes = [
        /(?:budget|up to|max|עד|תקציב)\s*(\d{1,6})\s*(₪|\$|usd|ils|nis)?\s*(?:per week|weekly|a week|לשבוע)/i,
        /(\d{1,6})\s*(₪|\$|usd|ils|nis)\s*(?:per week|weekly|לשבוע)/i,
    ];

    for (const regex of dailyRegexes) {
        const match = text.match(regex);
        if (match) {
            output.daily_budget = Number.parseInt(match[1], 10);
            const currency = normalizeCurrency(match[2] || text);
            if (currency) output.currency = currency;
            break;
        }
    }

    for (const regex of weeklyRegexes) {
        const match = text.match(regex);
        if (match) {
            output.weekly_budget = Number.parseInt(match[1], 10);
            const currency = normalizeCurrency(match[2] || text);
            if (currency) output.currency = currency;
            break;
        }
    }

    const daysMentioned = extractDays(text);
    const hasFlexPhrase = BUDGET_FLEX_PATTERNS.some((pattern) => pattern.test(text));
    if (hasFlexPhrase && daysMentioned.length) {
        output.expensive_days = daysMentioned.map((day) => ({
            day_of_week: day,
            note: 'Higher budget allowed on this day',
        }));
    }

    if (!output.daily_budget && !output.weekly_budget && /\bbudget\b|תקציב/i.test(text)) {
        output.notes = category.notes || 'User mentioned budget preference without an exact amount.';
    }

    return output;
}

function parseCheatMeals(text) {
    const numericMatch = text.match(/(\d{1,2})\s*(?:cheat meals?|ארוחות? צ['’]יט)\s*(?:per week|a week|בשבוע)/i);
    if (numericMatch) return Number.parseInt(numericMatch[1], 10);

    const englishWordMatch = text.match(/\b(one|two|three|four|five)\b\s*cheat meals?\s*(?:per week|a week)/i);
    if (englishWordMatch) return ENGLISH_NUMBER_WORDS.get(englishWordMatch[1].toLowerCase()) || null;

    const wordMatch = text.match(/(אחד|אחת|שתיים|שניים|שלוש|ארבע|חמש)\s*ארוח(?:ת|ה)?\s*צ['’]יט.*בשבוע/i);
    if (wordMatch) return HEBREW_NUMBER_WORDS.get(wordMatch[1]) || null;

    return null;
}

function detectMealPeriods(text) {
    const periods = [];
    for (const definition of MEAL_PERIOD_PATTERN_DEFS) {
        if (definition.patterns.some((pattern) => pattern.test(text))) {
            periods.push(definition.period);
        }
    }
    return dedupeStrings(periods);
}

function detectMealPreference(text) {
    for (const definition of MEAL_PREFERENCE_PATTERN_DEFS) {
        if (definition.patterns.some((pattern) => pattern.test(text))) {
            return definition.preference;
        }
    }
    return null;
}

function parseMealMaxCalories(text) {
    const match = text.match(/(?:max|up to|עד)?\s*(\d{2,4})\s*(?:kcal|calories|קלוריות)/i);
    if (!match) return undefined;
    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) ? value : undefined;
}

function parseDayRules(text) {
    const rules = [];
    const segments = canonicalizeString(text)
        .split(/[.\n;]+/)
        .map((segment) => canonicalizeString(segment))
        .filter(Boolean);

    for (const segment of segments) {
        const days = extractDays(segment);
        if (!days.length) continue;

        let ruleType = null;
        if (CHEAT_PATTERNS.some((pattern) => pattern.test(segment))) {
            ruleType = 'cheat_day';
        } else if (BUDGET_FLEX_PATTERNS.some((pattern) => pattern.test(segment))) {
            ruleType = 'budget_flex';
        } else if (FASTING_PATTERNS.some((pattern) => pattern.test(segment))) {
            ruleType = 'fasting';
        } else if (/(on|during|every|at)\s+\w+|ביום|בשבת/i.test(segment)) {
            ruleType = 'custom';
        }

        if (!ruleType) continue;

        const note = canonicalizeString(segment);
        for (const day of days) {
            rules.push({
                day_of_week: day,
                rule_type: ruleType,
                note,
            });
        }
    }

    const seen = new Set();
    return rules.filter((rule) => {
        const key = `${rule.day_of_week}:${rule.rule_type}:${rule.note || ''}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function parseMealTimeRules(text) {
    const rules = [];
    const segments = canonicalizeString(text)
        .split(/[.\n;]+/)
        .map((segment) => canonicalizeString(segment))
        .filter(Boolean);

    for (const segment of segments) {
        const mealPeriods = detectMealPeriods(segment);
        if (!mealPeriods.length) continue;

        const preference = detectMealPreference(segment);
        const maxCalories = parseMealMaxCalories(segment);
        if (!preference) continue;

        const note = canonicalizeString(segment);
        for (const mealPeriod of mealPeriods) {
            const candidate = {
                meal_period: mealPeriod,
                preference,
                note,
            };
            if (Number.isFinite(maxCalories)) {
                candidate.max_calories = maxCalories;
            }
            rules.push(candidate);
        }
    }

    const seen = new Set();
    return rules.filter((rule) => {
        const key = `${rule.meal_period}:${rule.preference}:${rule.max_calories || ''}:${rule.note || ''}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function parseTimeContextNotes(text) {
    const rules = [];
    const segments = canonicalizeString(text)
        .split(/[.\n;]+/)
        .map((segment) => canonicalizeString(segment))
        .filter(Boolean);

    for (const segment of segments) {
        const days = extractDays(segment);
        const mealPeriods = detectMealPeriods(segment);
        const note = canonicalizeString(segment);
        if (!note) continue;

        // Capture user notes that mention a day and/or meal timing.
        if (!days.length && !mealPeriods.length) continue;

        const dayValues = days.length ? days : ['any'];
        const mealValues = mealPeriods.length ? mealPeriods : ['any'];

        for (const day of dayValues) {
            for (const mealPeriod of mealValues) {
                rules.push({
                    day_of_week: day,
                    meal_period: mealPeriod,
                    note,
                });
            }
        }
    }

    const seen = new Set();
    return rules.filter((rule) => {
        const key = `${rule.day_of_week}:${rule.meal_period}:${rule.note.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function parseTimeNotesMap(text) {
    const byDay = {};
    const byMealPeriod = {};

    const segments = canonicalizeString(text)
        .split(/[.\n;]+/)
        .map((segment) => canonicalizeString(segment))
        .filter(Boolean);

    const appendUnique = (target, key, note) => {
        const existing = canonicalizeString(target[key] || '');
        const normalizedNote = canonicalizeString(note);
        if (!normalizedNote) return;
        if (!existing) {
            target[key] = normalizedNote;
            return;
        }
        if (existing.toLowerCase().includes(normalizedNote.toLowerCase())) return;
        target[key] = `${existing} | ${normalizedNote}`;
    };

    for (const segment of segments) {
        const days = extractDays(segment);
        const mealPeriods = detectMealPeriods(segment);
        const note = canonicalizeString(segment);
        if (!note) continue;

        for (const day of days) {
            appendUnique(byDay, day, note);
        }

        for (const mealPeriod of mealPeriods) {
            appendUnique(byMealPeriod, mealPeriod, note);
        }
    }

    return compactObject({
        by_day: byDay,
        by_meal_period: byMealPeriod,
    }) || {};
}

function extractNutritionPreferencesFromText(textInput) {
    const text = preparePreferenceTextForParsing(textInput);
    if (!text) return {};

    const output = {
        hard_restrictions: {},
        soft_likes: {},
        soft_dislikes: {},
        budget_preferences: {},
        rule_based_preferences: {},
        practical_constraints: {},
    };

    output.hard_restrictions.diets = detectByPatterns(text, DIET_PATTERNS);

    const allergyItems = collectMatches(text, ALLERGY_PATTERNS).flatMap((part) => splitList(part));
    if (allergyItems.length) output.hard_restrictions.allergies = dedupeStrings(allergyItems);

    const medicalRestrictions = [];
    for (const keyword of MEDICAL_KEYWORDS) {
        if (keyword.regex.test(text)) medicalRestrictions.push(keyword.label);
    }
    if (medicalRestrictions.length) {
        output.hard_restrictions.medical_restrictions = dedupeStrings(medicalRestrictions);
    }

    const forbiddenItems = collectMatches(text, STRICT_FORBIDDEN_PATTERNS).flatMap((part) => splitList(part));
    if (forbiddenItems.length) output.hard_restrictions.forbidden_ingredients = dedupeStrings(forbiddenItems);

    const preferenceSignals = extractPreferenceSignalsFromText(text);
    if (preferenceSignals.likes.cuisines.length) output.soft_likes.cuisines = preferenceSignals.likes.cuisines;
    if (preferenceSignals.likes.foods.length) output.soft_likes.foods = preferenceSignals.likes.foods;
    if (preferenceSignals.dislikes.cuisines.length) output.soft_dislikes.cuisines = preferenceSignals.dislikes.cuisines;
    if (preferenceSignals.dislikes.foods.length) output.soft_dislikes.foods = preferenceSignals.dislikes.foods;

    output.budget_preferences = parseBudget(text, output.budget_preferences);

    const cheatMealsPerWeek = parseCheatMeals(text);
    if (cheatMealsPerWeek !== null) {
        output.rule_based_preferences.cheat_meals_per_week = cheatMealsPerWeek;
    }

    if (CHEAT_PATTERNS.some((pattern) => pattern.test(text))) {
        const cheatDays = extractDays(text);
        if (cheatDays.length) output.rule_based_preferences.cheat_days = cheatDays;
        output.rule_based_preferences.special_rules = dedupeStrings([
            ...(output.rule_based_preferences.special_rules || []),
            'User mentioned cheat-meal/day rules.',
        ]);
    }

    const dayRules = parseDayRules(text);
    if (dayRules.length) output.rule_based_preferences.day_rules = dayRules;

    const mealTimeRules = parseMealTimeRules(text);
    if (mealTimeRules.length) output.rule_based_preferences.meal_time_rules = mealTimeRules;

    const timeContextNotes = parseTimeContextNotes(text);
    if (timeContextNotes.length) output.rule_based_preferences.time_context_notes = timeContextNotes;

    const timeNotes = parseTimeNotesMap(text);
    if (Object.keys(timeNotes).length) output.rule_based_preferences.time_notes = timeNotes;

    const prepTimeMatch = text.match(/(?:max|up to|עד)?\s*(\d{1,3})\s*(?:minutes|min|דקות)\s*(?:prep|preparation|cook|בישול|הכנה)?/i);
    if (prepTimeMatch) {
        output.practical_constraints.max_prep_time_minutes = Number.parseInt(prepTimeMatch[1], 10);
    }

    const cookingSkill = detectByPatterns(text, COOKING_SKILL_PATTERNS)[0];
    if (cookingSkill) output.practical_constraints.cooking_skill = cookingSkill;

    const equipment = [];
    for (const eq of EQUIPMENT_KEYWORDS) {
        if (eq.regexes.some((regex) => regex.test(text))) {
            equipment.push(eq.value);
        }
    }
    if (equipment.length) output.practical_constraints.equipment = dedupeStrings(equipment);

    const mealsPerDayMatch = text.match(/(\d{1,2})\s*(?:meals?\s*(?:per day|a day|\/day)|ארוחות ביום)/i);
    if (mealsPerDayMatch) {
        output.practical_constraints.meals_per_day = Number.parseInt(mealsPerDayMatch[1], 10);
    }

    if (BATCH_COOKING_PATTERNS.some((pattern) => pattern.test(text))) {
        output.practical_constraints.batch_cooking = true;
    }

    // Store meaningful but ambiguous details in notes fields
    const hasDietCue = /\b(?:kosher|halal|vegan|vegetarian)\b|(?:\u05db\u05e9\u05e8|\u05d7\u05dc\u05d0\u05dc|\u05d8\u05d1\u05e2\u05d5\u05e0\u05d9|\u05e6\u05de\u05d7\u05d5\u05e0\u05d9)/i.test(text);
    const hasLikeCue = /\b(?:like|love|prefer|enjoy)\b|(?:\u05d0\u05d5\u05d4\u05d1(?:\u05ea)?|\u05de\u05e2\u05d3\u05d9\u05e3(?:\u05d4|\u05d9\u05dd|\u05d5\u05ea)?)/i.test(text);
    const hasDislikeCue = /\b(?:dislike|hate|avoid|do\s*not\s+like|don't\s+like)\b|(?:\u05dc\u05d0\s+\u05d0\u05d5\u05d4\u05d1(?:\u05ea)?|\u05e9\u05d5\u05e0\u05d0(?:\u05ea)?|\u05e0\u05de\u05e0\u05e2(?:\u05ea|\u05d9\u05dd|\u05d5\u05ea)?)/i.test(text);

    if (!output.hard_restrictions.diets?.length && hasDietCue) {
        output.hard_restrictions.notes = 'Possible dietary restriction was mentioned but could not be normalized confidently.';
    }
    if (!output.soft_likes.foods?.length && hasLikeCue && !output.soft_dislikes.foods?.length) {
        output.soft_likes.notes = 'User expressed positive preferences with ambiguous food names.';
    }
    if (!output.soft_dislikes.foods?.length && hasDislikeCue) {
        output.soft_dislikes.notes = 'User expressed avoidance preferences with ambiguous food names.';
    }
    if (!output.rule_based_preferences.special_rules && /week|שבוע|שבת|friday|saturday|יום/i.test(text)) {
        output.rule_based_preferences.notes = 'User mentioned timing/day-specific rules.';
    }
    if (!output.rule_based_preferences.meal_time_rules && /evening|night|dinner|breakfast|lunch|meal time|time of day|ערב|בוקר|צהריים/i.test(text)) {
        output.rule_based_preferences.notes = output.rule_based_preferences.notes
            ? `${output.rule_based_preferences.notes} User mentioned meal-time specific needs.`
            : 'User mentioned meal-time specific needs.';
    }
    if (!output.practical_constraints.max_prep_time_minutes && /quick|fast|easy|מהיר|קל להכנה/i.test(text)) {
        output.practical_constraints.notes = 'User prefers practical/quick meals.';
    }

    return compactObject(output) || {};
}

module.exports = {
    extractNutritionPreferencesFromText,
    extractPreferenceSignalsFromText,
};
