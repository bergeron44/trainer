const { createChatProvider } = require('../ai/providers');
const {
    buildOnboardingNutritionMenuSystem,
    buildOnboardingNutritionMenuUserMessage,
} = require('../prompts/onboardingNutritionMenuPrompt');

const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function roundNumber(value, digits = 0) {
    const multiplier = 10 ** digits;
    return Math.round(Number(value || 0) * multiplier) / multiplier;
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function cleanText(value, maxLen = 160) {
    return String(value || '').trim().slice(0, maxLen);
}

function parseIntOrFallback(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function buildFallbackNutritionTargets(profile = {}) {
    const weight = clampNumber(profile.weight, 35, 250, 75);
    const goal = normalizeText(profile.goal);
    const targetCalories = clampNumber(
        profile.target_calories || profile.tdee,
        1200,
        6000,
        goal === 'muscle_gain' ? 2800 : goal === 'weight_loss' ? 1900 : 2400
    );
    const proteinGoal = clampNumber(profile.protein_goal, 60, 320, roundNumber(weight * 2));
    const fatGoal = clampNumber(profile.fat_goal, 35, 180, roundNumber((targetCalories * 0.25) / 9));
    const remainderCalories = Math.max(0, targetCalories - (proteinGoal * 4) - (fatGoal * 9));
    const carbsGoal = clampNumber(profile.carbs_goal, 40, 550, roundNumber(remainderCalories / 4));

    return {
        targetCalories,
        proteinGoal,
        carbsGoal,
        fatGoal,
    };
}

function buildMealPeriodsFromCount(mealCount = 4) {
    const normalizedCount = Math.min(6, Math.max(2, Number.parseInt(mealCount, 10) || 4));

    if (normalizedCount === 2) return ['First Meal', 'Final Feast'];
    if (normalizedCount === 3) return ['Morning Fuel', 'Midday Recharger', 'Evening Recovery'];
    if (normalizedCount === 4) return ['Breakfast', 'Lunch', 'Pre-Workout Snack', 'Dinner'];
    if (normalizedCount === 5) return ['Early Kickoff', 'Mid-Morning Snack', 'Lunch', 'Afternoon Fuel', 'Dinner'];
    return ['Early Kickoff', 'Mid-Morning Snack', 'Lunch', 'Afternoon Fuel', 'Dinner', 'Evening Snack'];
}

function buildMealPeriods(profile = {}) {
    const explicitMealFrequency = Number.parseInt(profile.meal_frequency, 10);
    if (Number.isFinite(explicitMealFrequency)) {
        return buildMealPeriodsFromCount(explicitMealFrequency);
    }

    const goal = normalizeText(profile.goal);
    const dietType = normalizeText(profile.diet_type);

    let mealCount = 4;
    if (goal === 'muscle_gain') mealCount = 5;
    if (goal === 'weight_loss') mealCount = 3;
    if (goal === 'athletic_performance') mealCount = 5;
    if (dietType === 'keto') mealCount = Math.max(2, mealCount - 1);

    return buildMealPeriodsFromCount(mealCount);
}

function buildReasoning(reasoning = {}, mealCount, optionCount, mealPeriods = []) {
    return {
        meal_count: mealCount,
        meal_count_rationale: cleanText(reasoning?.meal_count_rationale, 400),
        option_count: optionCount,
        option_count_rationale: cleanText(reasoning?.option_count_rationale, 400),
        notes: Array.isArray(reasoning?.notes)
            ? reasoning.notes.map((note) => cleanText(note, 200)).filter(Boolean).slice(0, 6)
            : [],
        meal_periods: mealPeriods,
    };
}

function sanitizeFood(food = {}) {
    const name = cleanText(food?.name, 120);
    if (!name) return null;

    const portion = cleanText(food?.portion, 60) || '1 serving';
    return {
        name,
        portion,
        calories: clampNumber(food?.calories, 0, 5000, 0),
        protein: clampNumber(food?.protein, 0, 1000, 0),
        carbs: clampNumber(food?.carbs, 0, 1000, 0),
        fat: clampNumber(food?.fat, 0, 1000, 0),
    };
}

function sanitizeOption(option = {}) {
    const mealName = cleanText(option?.meal_name, 160);
    const foods = Array.isArray(option?.foods)
        ? option.foods.map(sanitizeFood).filter(Boolean).slice(0, 12)
        : [];

    if (!mealName || foods.length === 0) return null;

    return {
        meal_name: mealName,
        foods,
        total_calories: clampNumber(option?.total_calories, 1, 10000, 0),
        total_protein: clampNumber(option?.total_protein, 0, 1500, 0),
        total_carbs: clampNumber(option?.total_carbs, 0, 1500, 0),
        total_fat: clampNumber(option?.total_fat, 0, 1500, 0),
    };
}

function parseJsonResponse(text = '') {
    const cleaned = String(text || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
    const candidates = [];
    const pushCandidate = (value) => {
        if (!value) return;
        if (!candidates.includes(value)) {
            candidates.push(value);
        }
    };

    pushCandidate(cleaned);

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        pushCandidate(cleaned.slice(firstBrace, lastBrace + 1));
    }

    let lastError;
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (error) {
            lastError = error;
        }

        try {
            return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Failed to parse onboarding nutrition JSON response.');
}

function buildJsonRepairUserMessage({ originalUserMessage, invalidResponse, parseError }) {
    const responsePreview = cleanText(String(invalidResponse || ''), 1500);
    return [
        originalUserMessage,
        '',
        'Your previous response was invalid JSON.',
        `Parse error: ${cleanText(parseError?.message, 200) || 'unknown parse error'}`,
        'Return the full payload again as strict valid JSON only.',
        'Do not include markdown, comments, trailing commas, or extra text.',
        'Previous invalid response:',
        responsePreview,
    ].join('\n');
}

function flattenMealPeriods({
    payload = {},
    date = new Date(),
    targets = buildFallbackNutritionTargets({}),
    provider = 'unknown',
}) {
    const returnedPeriods = Array.isArray(payload?.meal_periods) ? payload.meal_periods : [];
    if (returnedPeriods.length < 2) {
        throw new Error('Onboarding nutrition LLM returned fewer than 2 meal periods.');
    }

    const chosenMealCount = Math.min(6, Math.max(2, returnedPeriods.length));
    const canonicalMealPeriods = buildMealPeriodsFromCount(chosenMealCount);
    const flatEntries = [];
    let chosenOptionCount = 3;

    canonicalMealPeriods.forEach((canonicalPeriod, index) => {
        const period = returnedPeriods[index] || {};
        const options = Array.isArray(period?.options)
            ? period.options.map(sanitizeOption).filter(Boolean).slice(0, 4)
            : [];

        if (options.length < 3) {
            throw new Error(`Onboarding nutrition LLM returned fewer than 3 valid meal options for "${canonicalPeriod}".`);
        }

        chosenOptionCount = options.length;
        options.forEach((option) => {
            flatEntries.push({
                date,
                meal_period: canonicalPeriod,
                meal_name: option.meal_name,
                source: 'ai',
                total_calories: option.total_calories,
                total_protein: option.total_protein,
                total_carbs: option.total_carbs,
                total_fat: option.total_fat,
                note: `AI onboarding menu via ${provider} for ${targets.targetCalories} kcal/day`,
                foods: option.foods,
            });
        });
    });

    return {
        menuEntries: flatEntries,
        reasoning: buildReasoning(payload?.reasoning, chosenMealCount, chosenOptionCount, canonicalMealPeriods),
    };
}

async function defaultGenerateChat({ system, userMessage, userId }) {
    const provider = createChatProvider();
    const requestedMaxTokens = Math.max(
        parseIntOrFallback(
            process.env.ONBOARDING_AI_PLANNER_MAX_OUTPUT_TOKENS,
            DEFAULT_MAX_OUTPUT_TOKENS
        ),
        DEFAULT_MAX_OUTPUT_TOKENS
    );
    return provider.generateSafe({
        system,
        messages: [{ role: 'user', content: userMessage }],
        userId: userId ? String(userId) : undefined,
        options: {
            temperature: 0.2,
            responseFormat: 'json_object',
            maxTokens: requestedMaxTokens,
        },
    });
}

async function buildOnboardingAiNutritionMenu({
    profile = {},
    likedFoods = [],
    dislikedFoods = [],
    date = new Date(),
    userId,
    generateChat = defaultGenerateChat,
} = {}) {
    const targets = buildFallbackNutritionTargets(profile);
    const system = buildOnboardingNutritionMenuSystem();
    const userMessage = buildOnboardingNutritionMenuUserMessage({
        profile,
        likedFoods,
        dislikedFoods,
        targets,
    });

    const completion = await generateChat({
        system,
        userMessage,
        userId,
    });
    let finalCompletion = completion;
    let payload;

    try {
        payload = parseJsonResponse(completion?.text || '');
    } catch (parseError) {
        finalCompletion = await generateChat({
            system,
            userMessage: buildJsonRepairUserMessage({
                originalUserMessage: userMessage,
                invalidResponse: completion?.text || '',
                parseError,
            }),
            userId,
        });
        payload = parseJsonResponse(finalCompletion?.text || '');
    }

    const flattened = flattenMealPeriods({
        payload,
        date,
        targets,
        provider: finalCompletion?.model || finalCompletion?.provider || 'unknown',
    });

    return {
        ...flattened,
        provider: finalCompletion?.provider,
        model: finalCompletion?.model,
    };
}

module.exports = {
    buildFallbackNutritionTargets,
    buildMealPeriods,
    buildMealPeriodsFromCount,
    buildOnboardingAiNutritionMenu,
};
