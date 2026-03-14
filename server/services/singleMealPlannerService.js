const BaseLLMRequest = require('./requests/baseLLMRequest');
const User = require('../models/User');
const NutritionLog = require('../models/NutritionLog');

const DEFAULT_MAX_TOOL_CALLS = 6;
const DEFAULT_MAX_TOOL_ITERATIONS = 4;
const DEFAULT_RETRY_ATTEMPTS = 1;
const RECENT_MEAL_HISTORY_LIMIT = 20;
const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MEAL_PERIODS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack', 'post_workout', 'other'];

function parseBoolean(value, fallback = true) {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value).trim().toLowerCase() === 'true';
}

function parseIntOrFallback(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function listOrNone(items = []) {
    const normalized = (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
}

function pushIfValue(lines, label, value, formatter = (input) => input) {
    if (value === undefined || value === null) return;
    if (typeof value === 'string' && !value.trim()) return;
    if (Array.isArray(value) && value.length === 0) return;
    lines.push(`${label}: ${formatter(value)}`);
}

function normalizeDayValue(value) {
    const day = String(value || '').trim().toLowerCase();
    return WEEK_DAYS.includes(day) ? day : '';
}

function normalizeMealPeriodValue(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const normalized = raw.replace(/\s+/g, '_');
    if (normalized === 'afternoon') return 'afternoon_snack';
    if (normalized === 'evening') return 'evening_snack';
    return MEAL_PERIODS.includes(normalized) ? normalized : '';
}

function summarizeProfile(profile = {}) {
    const lines = [];
    pushIfValue(lines, 'goal', profile.goal);
    pushIfValue(lines, 'diet_type', profile.diet_type);
    pushIfValue(lines, 'target_calories', profile.target_calories || profile.tdee, (value) => `${value} kcal`);
    pushIfValue(lines, 'protein_goal', profile.protein_goal, (value) => `${value} g`);
    pushIfValue(lines, 'carbs_goal', profile.carbs_goal, (value) => `${value} g`);
    pushIfValue(lines, 'fat_goal', profile.fat_goal, (value) => `${value} g`);
    pushIfValue(lines, 'meal_frequency_hint', profile.meal_frequency);
    pushIfValue(lines, 'activity_level', profile.activity_level);
    pushIfValue(lines, 'experience_level', profile.experience_level);
    pushIfValue(lines, 'workout_days_per_week', profile.workout_days_per_week);
    pushIfValue(lines, 'session_duration', profile.session_duration, (value) => `${value} min`);
    pushIfValue(lines, 'environment', profile.environment);
    pushIfValue(lines, 'injuries', profile.injuries);
    pushIfValue(lines, 'allergies_text', profile.allergies);
    pushIfValue(lines, 'trainer_personality', profile.trainer_personality);
    pushIfValue(lines, 'workout_plan_status', profile.workout_plan_status);
    pushIfValue(lines, 'workout_plan_source', profile.workout_plan_source);
    pushIfValue(lines, 'has_existing_plan', profile.has_existing_plan);
    return lines.length ? lines.join('\n') : 'none';
}

function summarizeStructuredNutritionPreferences(preferences = {}) {
    if (!preferences || typeof preferences !== 'object') return 'none';

    const sections = [];
    const hard = preferences.hard_restrictions || {};
    const softLikes = preferences.soft_likes || {};
    const softDislikes = preferences.soft_dislikes || {};
    const budget = preferences.budget_preferences || {};
    const rules = preferences.rule_based_preferences || {};
    const practical = preferences.practical_constraints || {};

    const hardLines = [];
    pushIfValue(hardLines, 'diets', hard.diets, listOrNone);
    pushIfValue(hardLines, 'allergies', hard.allergies, listOrNone);
    pushIfValue(hardLines, 'medical_restrictions', hard.medical_restrictions, listOrNone);
    pushIfValue(hardLines, 'forbidden_ingredients', hard.forbidden_ingredients, listOrNone);
    pushIfValue(hardLines, 'notes', hard.notes);
    if (hardLines.length) sections.push(`Hard restrictions:\n${hardLines.join('\n')}`);

    const softLikeLines = [];
    pushIfValue(softLikeLines, 'cuisines', softLikes.cuisines, listOrNone);
    pushIfValue(softLikeLines, 'foods', softLikes.foods, listOrNone);
    pushIfValue(softLikeLines, 'notes', softLikes.notes);
    if (softLikeLines.length) sections.push(`Soft likes:\n${softLikeLines.join('\n')}`);

    const softDislikeLines = [];
    pushIfValue(softDislikeLines, 'cuisines', softDislikes.cuisines, listOrNone);
    pushIfValue(softDislikeLines, 'foods', softDislikes.foods, listOrNone);
    pushIfValue(softDislikeLines, 'notes', softDislikes.notes);
    if (softDislikeLines.length) sections.push(`Soft dislikes:\n${softDislikeLines.join('\n')}`);

    const budgetLines = [];
    pushIfValue(budgetLines, 'currency', budget.currency);
    pushIfValue(budgetLines, 'daily_budget', budget.daily_budget);
    pushIfValue(budgetLines, 'weekly_budget', budget.weekly_budget);
    pushIfValue(budgetLines, 'notes', budget.notes);
    if (budgetLines.length) sections.push(`Budget preferences:\n${budgetLines.join('\n')}`);

    const ruleLines = [];
    pushIfValue(ruleLines, 'cheat_meals_per_week', rules.cheat_meals_per_week);
    pushIfValue(ruleLines, 'cheat_days', rules.cheat_days, listOrNone);
    if (Array.isArray(rules.day_rules) && rules.day_rules.length) {
        const dayRules = rules.day_rules
            .map((rule) => [rule?.day_of_week, rule?.rule_type, rule?.note].filter(Boolean).join(' | '))
            .filter(Boolean);
        pushIfValue(ruleLines, 'day_rules', dayRules, listOrNone);
    }
    if (Array.isArray(rules.meal_time_rules) && rules.meal_time_rules.length) {
        const mealTimeRules = rules.meal_time_rules
            .map((rule) => {
                const maxCalories = rule?.max_calories !== undefined ? `max_calories=${rule.max_calories}` : '';
                return [rule?.meal_period, rule?.preference, maxCalories, rule?.note].filter(Boolean).join(' | ');
            })
            .filter(Boolean);
        pushIfValue(ruleLines, 'meal_time_rules', mealTimeRules, listOrNone);
    }
    if (Array.isArray(rules.time_context_notes) && rules.time_context_notes.length) {
        const timeContextNotes = rules.time_context_notes
            .map((rule) => [rule?.day_of_week || 'any', rule?.meal_period || 'any', rule?.note].filter(Boolean).join(' | '))
            .filter(Boolean);
        pushIfValue(ruleLines, 'time_context_notes', timeContextNotes, listOrNone);
    }
    pushIfValue(ruleLines, 'notes', rules.notes);
    if (ruleLines.length) sections.push(`Rule-based preferences:\n${ruleLines.join('\n')}`);

    const practicalLines = [];
    pushIfValue(practicalLines, 'max_prep_time_minutes', practical.max_prep_time_minutes);
    pushIfValue(practicalLines, 'cooking_skill', practical.cooking_skill);
    pushIfValue(practicalLines, 'equipment', practical.equipment, listOrNone);
    pushIfValue(practicalLines, 'meals_per_day', practical.meals_per_day);
    pushIfValue(practicalLines, 'batch_cooking', practical.batch_cooking);
    pushIfValue(practicalLines, 'notes', practical.notes);
    if (practicalLines.length) sections.push(`Practical constraints:\n${practicalLines.join('\n')}`);

    return sections.length ? sections.join('\n\n') : 'none';
}

function summarizeLikedFoods(likedFoods = []) {
    const lines = (Array.isArray(likedFoods) ? likedFoods : [])
        .slice(0, 30)
        .map((food) => {
            const name = String(food?.name || '').trim();
            if (!name) return '';
            const macros = [];
            if (Number.isFinite(Number(food?.calories)) && Number(food.calories) > 0) macros.push(`${Number(food.calories)} kcal`);
            if (Number.isFinite(Number(food?.protein)) && Number(food.protein) > 0) macros.push(`P:${Number(food.protein)}`);
            if (Number.isFinite(Number(food?.carbs)) && Number(food.carbs) > 0) macros.push(`C:${Number(food.carbs)}`);
            if (Number.isFinite(Number(food?.fat)) && Number(food.fat) > 0) macros.push(`F:${Number(food.fat)}`);
            return macros.length ? `${name} (${macros.join(' ')})` : name;
        })
        .filter(Boolean);
    return lines.length ? lines.join('\n') : 'none';
}

function summarizeDislikedFoods(dislikedFoods = []) {
    const lines = (Array.isArray(dislikedFoods) ? dislikedFoods : [])
        .slice(0, 30)
        .map((food) => String(food?.name || '').trim())
        .filter(Boolean);
    return lines.length ? lines.join(', ') : 'none';
}

function summarizeLegacyMenuPreferences(menuPreferences = {}) {
    const likes = String(menuPreferences?.likes || '').trim();
    const dislikes = String(menuPreferences?.dislikes || '').trim();
    if (!likes && !dislikes) return 'none';
    return [
        `likes: ${likes || 'none'}`,
        `dislikes: ${dislikes || 'none'}`,
    ].join('\n');
}

function normalizeRecentMeals(logs = []) {
    return (Array.isArray(logs) ? logs : [])
        .map((log) => {
            const source = typeof log?.toObject === 'function' ? log.toObject() : log;
            const mealName = String(source?.meal_name || '').trim();
            if (!mealName) return null;
            return {
                meal_name: mealName,
                date: source?.date || source?.createdAt || null,
                calories: Number(source?.calories) || 0,
                protein: Number(source?.protein) || 0,
                carbs: Number(source?.carbs) || 0,
                fat: Number(source?.fat) || 0,
                foods: Array.isArray(source?.foods)
                    ? source.foods
                        .map((food) => String(food?.name || '').trim())
                        .filter(Boolean)
                        .slice(0, 6)
                    : [],
            };
        })
        .filter(Boolean);
}

function summarizeAcceptedMealHistory(meals = []) {
    const lines = (Array.isArray(meals) ? meals : [])
        .slice(0, RECENT_MEAL_HISTORY_LIMIT)
        .map((meal) => {
            const foods = meal.foods?.length ? ` | foods: ${meal.foods.join(', ')}` : '';
            return `- ${meal.meal_name} (${meal.calories} kcal, P:${meal.protein} C:${meal.carbs} F:${meal.fat})${foods}`;
        });
    return lines.length ? lines.join('\n') : 'none';
}

function summarizeWorkoutContext(workoutContext = {}) {
    if (!workoutContext || typeof workoutContext !== 'object') return 'none';
    const entries = Object.entries(workoutContext)
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
        .map(([key, value]) => `${key}: ${value}`);
    return entries.length ? entries.join('\n') : 'none';
}

function summarizeLegacyStyleLikedFoods(likedFoods = []) {
    return (Array.isArray(likedFoods) ? likedFoods : [])
        .slice(0, 20)
        .map((food) => {
            const name = String(food?.name || '').trim();
            if (!name) return '';
            const calories = Number(food?.calories);
            const protein = Number(food?.protein);
            const carbs = Number(food?.carbs);
            const fat = Number(food?.fat);
            const hasMacros = [calories, protein, carbs, fat].some((value) => Number.isFinite(value) && value > 0);
            return hasMacros
                ? `${name} (${Math.max(0, calories || 0)}kcal/100g, P:${Math.max(0, protein || 0)}g C:${Math.max(0, carbs || 0)}g F:${Math.max(0, fat || 0)}g)`
                : name;
        })
        .filter(Boolean)
        .join('\n');
}

function buildContextualTimePreferenceSection(preferences = {}, { currentDay = '', currentMealPeriod = '' } = {}) {
    const rules = preferences.rule_based_preferences || {};
    const lines = [];

    const dayNote = String(rules?.time_notes?.by_day?.[currentDay] || '').trim();
    if (dayNote) lines.push(`[time_notes day=${currentDay}] ${dayNote}`);

    const mealNote = String(rules?.time_notes?.by_meal_period?.[currentMealPeriod] || '').trim();
    if (mealNote) lines.push(`[time_notes meal=${currentMealPeriod}] ${mealNote}`);

    if (Array.isArray(rules.time_context_notes) && rules.time_context_notes.length) {
        const matches = rules.time_context_notes
            .filter((entry) => {
                const day = normalizeDayValue(entry?.day_of_week) || (String(entry?.day_of_week || '').toLowerCase() === 'any' ? 'any' : '');
                const meal = normalizeMealPeriodValue(entry?.meal_period) || (String(entry?.meal_period || '').toLowerCase() === 'any' ? 'any' : '');
                const dayOk = day === 'any' || day === currentDay;
                const mealOk = meal === 'any' || meal === currentMealPeriod;
                return dayOk && mealOk && String(entry?.note || '').trim();
            })
            .map((entry) => `[time_context day=${String(entry?.day_of_week || 'any').toLowerCase()} meal=${String(entry?.meal_period || 'any').toLowerCase()}] ${String(entry?.note || '').trim()}`);
        lines.push(...matches);
    }

    return lines.length
        ? `Current time-context preferences for this meal:\n${lines.join('\n')}`
        : 'none';
}

function buildSingleMealMetadata({ user, recentAcceptedMeals }) {
    return {
        agent: 'nutritionist',
        agent_service: 'SingleMealPlannerService',
        optional_tools: ['nutrition_web_search'],
        data_sources: {
            profile_fields: Object.keys(user?.profile || {}).filter((key) => {
                const value = user?.profile?.[key];
                return value !== undefined && value !== null && value !== '';
            }),
            nutrition_preferences_sections: Object.keys(user?.nutrition_preferences || {}).filter((key) => {
                const value = user?.nutrition_preferences?.[key];
                return value && typeof value === 'object' && Object.keys(value).length > 0;
            }),
            liked_foods_count: Array.isArray(user?.liked_foods) ? user.liked_foods.length : 0,
            disliked_foods_count: Array.isArray(user?.disliked_foods) ? user.disliked_foods.length : 0,
            accepted_meal_history_count: Array.isArray(recentAcceptedMeals) ? recentAcceptedMeals.length : 0,
        },
    };
}

function stripCodeFences(text = '') {
    return String(text || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
}

function roundNumber(value) {
    return Math.max(0, Math.round(Number(value) || 0));
}

function hasUsableMealContent(meal) {
    if (!meal || typeof meal !== 'object') return false;
    const foods = Array.isArray(meal.foods) ? meal.foods : [];
    const hasFood = foods.some((food) => String(food?.name || '').trim());
    return hasFood || roundNumber(meal.total_calories) > 0;
}

class SingleMealPlannerService extends BaseLLMRequest {
    constructor({
        chatBrainService,
        userModel = User,
        nutritionLogModel = NutritionLog,
        logger = console,
        enabled,
    } = {}) {
        super({
            chatBrainService,
            agentType: 'nutritionist',
            personaId: 'nutritionist',
            temperature: 0.55,
            maxToolCalls: parseIntOrFallback(process.env.SINGLE_MEAL_AI_PLANNER_MAX_TOOL_CALLS, DEFAULT_MAX_TOOL_CALLS),
            maxToolIterations: parseIntOrFallback(process.env.SINGLE_MEAL_AI_PLANNER_MAX_ITERATIONS, DEFAULT_MAX_TOOL_ITERATIONS),
            retryAttempts: parseIntOrFallback(process.env.SINGLE_MEAL_AI_PLANNER_RETRY_ATTEMPTS, DEFAULT_RETRY_ATTEMPTS),
            maxSystemChars: 14000,
            logger,
        });
        this.UserModel = userModel;
        this.NutritionLogModel = nutritionLogModel;
        this.enabled = enabled ?? parseBoolean(process.env.SINGLE_MEAL_AI_PLANNER_ENABLED, true);
    }

    isEnabled() {
        return this.enabled;
    }

    getToolAllowlist() {
        return ['nutrition_web_search'];
    }

    buildSystemPrompt({ requestId, mealContext = {} }) {
        const currentMealPeriod = normalizeMealPeriodValue(mealContext.meal_period) || 'other';
        return [
            'You are the nutritionist agent responsible for generating one meal for the user right now.',
            'Use the same priority logic as the full daily meal planner.',
            'Treat the following as the actual meal-generation prompt for this task.',
            'Use the full user snapshot provided in the user message. Do NOT call profile, nutrition, or meals lookup tools.',
            'You may optionally use nutrition_web_search only if the task is hard, the meal idea is weak, or your confidence in the meal is not high.',
            'Do not use nutrition_web_search by default. Prefer the user snapshot first.',
            'If you use nutrition_web_search, keep it minimal: at most 2 searches, focused on the user diet/goal/meal period.',
            '',
            'Rules:',
            '- Respond ONLY with valid JSON - no markdown, no extra text, no explanation',
            '- Food names in English',
            '- coach_note in Hebrew (short, motivational, 1 sentence)',
            '- Choose real foods that fit the user diet type',
            '- Portions must be realistic (grams/units)',
            '- Never output empty meals: each meal must have realistic calories and macros',
            '- Never use schedule/context sentences as food names',
            '- If request priority is HIGH, prioritize that request unless it conflicts with hard restrictions',
            '- Priority order for decisions:',
            '  1. Specific request for this meal text',
            '  2. Time context (time_of_day, day_of_week, meal_period)',
            '  3. Hard restrictions (diet, allergies, medical, forbidden ingredients)',
            '  4. Soft likes/dislikes + liked_foods/disliked_foods',
            '  5. Practical constraints (prep time, cooking skill, equipment)',
            '  6. Rule-based preferences (cheat rules, day/meal rules, time notes)',
            '  7. Budget preferences',
            '  8. Workout context + remaining macro targets',
            '  9. Previous accepted meals history',
            '- If the task is hard or your confidence in the meal is not high, use nutrition_web_search before answering',
            '',
            'Return exactly one meal aligned to the current meal slot and the remaining daily macros.',
            'You may be flexible with macros, but stay meaningfully aligned with the remaining calories/protein/carbs/fat.',
            'Do not mention web search or sources in the final answer.',
            `If you need an idempotency marker in your reasoning, use request key: "single-meal-${requestId || 'request'}"`,
            '',
            'Respond ONLY with valid JSON in this exact shape:',
            '{',
            '  "meal_name": "Creative name for this meal",',
            `  "meal_type": "${currentMealPeriod}",`,
            '  "foods": [',
            '    { "name": "Food name", "portion": "Xg", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }',
            '  ],',
            '  "total_calories": 0,',
            '  "total_protein": 0,',
            '  "total_carbs": 0,',
            '  "total_fat": 0,',
            '  "coach_note": "משפט מוטיבציה קצר בעברית"',
            '}',
        ].join('\n');
    }

    buildUserPrompt({ user, mealContext = {} }) {
        const remaining = {
            calories: Math.max(0, roundNumber(mealContext.target_calories) - roundNumber(mealContext.current_calories_consumed)),
            protein: Math.max(0, roundNumber(mealContext.protein_goal) - roundNumber(mealContext.protein_consumed)),
            carbs: Math.max(0, roundNumber(mealContext.carbs_goal) - roundNumber(mealContext.carbs_consumed)),
            fat: Math.max(0, roundNumber(mealContext.fat_goal) - roundNumber(mealContext.fat_consumed)),
        };
        const mealsRemaining = Math.max(1, roundNumber(mealContext.total_meals_planned) - roundNumber(mealContext.meals_eaten_today));
        const perMealTarget = {
            calories: Math.max(0, Math.round(remaining.calories / mealsRemaining)),
            protein: Math.max(0, Math.round(remaining.protein / mealsRemaining)),
            carbs: Math.max(0, Math.round(remaining.carbs / mealsRemaining)),
            fat: Math.max(0, Math.round(remaining.fat / mealsRemaining)),
        };
        const mealRequest = String(mealContext.meal_request_note || '').trim();
        const mealRequestPriority = String(mealContext.meal_request_priority || 'normal').trim().toLowerCase() === 'high' ? 'HIGH' : 'NORMAL';
        const preferencesNote = String(mealContext.nutrition_preferences_note || '').trim();
        const likedList = summarizeLegacyStyleLikedFoods(mealContext.liked_foods || []);
        const dislikedList = summarizeDislikedFoods(mealContext.disliked_foods || []);
        const effectivePreferences = mealContext.nutrition_preferences || {};
        const currentDay = normalizeDayValue(mealContext.day_of_week) || String(mealContext.day_of_week || 'unknown').trim().toLowerCase() || 'unknown';
        const currentMealPeriod = normalizeMealPeriodValue(mealContext.meal_period) || 'other';
        const structuredPreferences = summarizeStructuredNutritionPreferences(effectivePreferences);
        const workoutSummary = summarizeWorkoutContext(mealContext.workout_context || {});
        const acceptedMealsSummary = summarizeAcceptedMealHistory(mealContext.accepted_meal_history || []);
        const profile = user?.profile || {};

        return [
            'Generate my next meal now.',
            '',
            'User profile:',
            `- Goal: ${profile.goal || 'recomp'}`,
            `- Diet: ${profile.diet_type || 'everything'}`,
            `- Daily targets: ${roundNumber(mealContext.target_calories || profile.target_calories || profile.tdee || 2000)} kcal | ${roundNumber(mealContext.protein_goal || profile.protein_goal || 150)}g protein | ${roundNumber(mealContext.carbs_goal || profile.carbs_goal || 200)}g carbs | ${roundNumber(mealContext.fat_goal || profile.fat_goal || 65)}g fat`,
            '',
            `Time: ${mealContext.time_of_day || '12:00'} | Day: ${mealContext.day_of_week || 'unknown'} | Period: ${mealContext.meal_period || 'other'}`,
            `Meals eaten today: ${roundNumber(mealContext.meals_eaten_today)} | Total meals planned: ${Math.max(1, roundNumber(mealContext.total_meals_planned))} | Meals remaining: ${mealsRemaining}`,
            '',
            'Remaining macros I still need today:',
            `- Calories: ${remaining.calories} kcal`,
            `- Protein: ${remaining.protein}g`,
            `- Carbs: ${remaining.carbs}g`,
            `- Fat: ${remaining.fat}g`,
            '',
            `Target for THIS meal (~${perMealTarget.calories} kcal):`,
            `- Protein: ~${perMealTarget.protein}g`,
            `- Carbs: ~${perMealTarget.carbs}g`,
            `- Fat: ~${perMealTarget.fat}g`,
            '',
            'My liked foods (prefer these):',
            likedList || 'Any healthy foods',
            '',
            `Foods I dislike (avoid): ${dislikedList || 'none'}`,
            '',
            'Decision tabs to read before creating this meal (in order):',
            '1) Specific request for this meal text',
            '2) Time context (time_of_day, day_of_week, meal_period)',
            '3) Hard restrictions (diet, allergies, medical, forbidden ingredients)',
            '4) Soft likes/dislikes + liked_foods/disliked_foods',
            '5) Practical constraints (prep time, cooking skill, equipment)',
            '6) Rule-based preferences (cheat rules, day/meal rules, time notes)',
            '7) Budget preferences',
            '8) Workout context + remaining macro targets',
            '9) Previous accepted meals history',
            '',
            buildContextualTimePreferenceSection(effectivePreferences, {
                currentDay,
                currentMealPeriod,
            }),
            structuredPreferences !== 'none'
                ? `Structured nutrition preferences from profile:\n${structuredPreferences}`
                : 'Structured nutrition preferences from profile:\nnone',
            workoutSummary !== 'none'
                ? `Workout context from profile/session:\n${workoutSummary}`
                : 'Workout context from profile/session:\nnone',
            acceptedMealsSummary !== 'none'
                ? `Previous meals this user accepted/saved (prefer similar patterns unless user request says otherwise):\n${acceptedMealsSummary}`
                : 'Previous meals this user accepted/saved (prefer similar patterns unless user request says otherwise):\nnone',
            preferencesNote
                ? `My nutrition priorities (always consider these):\n${preferencesNote}`
                : '',
            mealRequest
                ? `Request priority: ${mealRequestPriority}${mealRequestPriority === 'HIGH' ? ' (give this request very high weight unless it conflicts with hard restrictions)' : ''}`
                : '',
            mealRequest
                ? `Specific request for this meal:\n${mealRequest}`
                : '',
            '',
            'Create one practical meal for this slot only.',
            'If you can produce a high-quality answer from the provided user context, do not search.',
            'If the task is hard or your confidence in the meal is not high, use nutrition_web_search before answering.',
        ].join('\n');
    }

    validateResult(result) {
        if (!String(result?.response || '').trim()) {
            throw new Error('Single meal planner did not return a response.');
        }
    }

    getContext({ trigger }) {
        return {
            workflow: 'single_meal_planner',
            trigger: trigger || 'unknown',
        };
    }

    async buildPlanningContext({ userId, mealContext = {}, user = null }) {
        const logs = await this.NutritionLogModel.find({
            user: userId,
            archived: { $ne: true },
        })
            .sort({ createdAt: -1 })
            .limit(RECENT_MEAL_HISTORY_LIMIT);

        const profile = user?.profile || {};
        const mergedWorkoutContext = {
            goal: profile.goal || '',
            experience_level: profile.experience_level || '',
            workout_days_per_week: profile.workout_days_per_week ?? null,
            session_duration: profile.session_duration ?? null,
            environment: profile.environment || '',
            activity_level: profile.activity_level || '',
            injuries: profile.injuries || '',
            workout_plan_status: profile.workout_plan_status || '',
            workout_plan_source: profile.workout_plan_source || '',
            has_existing_plan: Boolean(profile.has_existing_plan),
            trainer_personality: profile.trainer_personality || '',
            ...(mealContext.workout_context && typeof mealContext.workout_context === 'object'
                ? mealContext.workout_context
                : {}),
        };

        return {
            recentAcceptedMeals: normalizeRecentMeals(logs),
            workoutContext: mergedWorkoutContext,
        };
    }

    normalizeMealResult(parsedMeal = {}, mealContext = {}) {
        const foods = (Array.isArray(parsedMeal.foods) ? parsedMeal.foods : [])
            .map((food) => ({
                name: String(food?.name || '').trim(),
                portion: String(food?.portion || '').trim(),
                calories: roundNumber(food?.calories),
                protein: roundNumber(food?.protein),
                carbs: roundNumber(food?.carbs),
                fat: roundNumber(food?.fat),
            }))
            .filter((food) => food.name);

        const totalsFromFoods = foods.reduce((acc, food) => ({
            calories: acc.calories + roundNumber(food.calories),
            protein: acc.protein + roundNumber(food.protein),
            carbs: acc.carbs + roundNumber(food.carbs),
            fat: acc.fat + roundNumber(food.fat),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const normalized = {
            meal_name: String(parsedMeal.meal_name || 'Meal suggestion').trim(),
            meal_type: normalizeMealPeriodValue(parsedMeal.meal_type || mealContext.meal_period) || 'other',
            foods,
            total_calories: roundNumber(parsedMeal.total_calories ?? totalsFromFoods.calories),
            total_protein: roundNumber(parsedMeal.total_protein ?? totalsFromFoods.protein),
            total_carbs: roundNumber(parsedMeal.total_carbs ?? totalsFromFoods.carbs),
            total_fat: roundNumber(parsedMeal.total_fat ?? totalsFromFoods.fat),
            coach_note: String(parsedMeal.coach_note || '').trim(),
        };

        if (!hasUsableMealContent(normalized)) {
            throw new Error('Single meal planner returned an empty meal.');
        }

        return normalized;
    }

    parseMealResponse(response, mealContext = {}) {
        let parsed;
        try {
            parsed = JSON.parse(stripCodeFences(response));
        } catch (error) {
            throw new Error(`Single meal planner returned invalid JSON: ${String(response || '').slice(0, 240)}`);
        }

        return this.normalizeMealResult(parsed, mealContext);
    }

    async generateMealForUser({
        userId,
        requestId,
        trigger = 'nutrition_demo_single_meal',
        user = null,
        mealContext = {},
    }) {
        if (!userId) {
            throw new Error('Missing userId for single meal planner.');
        }
        if (!this.isEnabled()) {
            throw new Error('Single meal planner is disabled.');
        }

        const resolvedUser = user || await this.UserModel.findById(userId);
        if (!resolvedUser) {
            throw new Error('User not found.');
        }

        const planningContext = await this.buildPlanningContext({
            userId,
            mealContext,
            user: resolvedUser,
        });

        const enrichedMealContext = {
            ...mealContext,
            nutrition_preferences: mealContext.nutrition_preferences || resolvedUser.nutrition_preferences || {},
            liked_foods: Array.isArray(resolvedUser.liked_foods) ? resolvedUser.liked_foods : [],
            disliked_foods: Array.isArray(resolvedUser.disliked_foods) ? resolvedUser.disliked_foods : [],
            workout_context: planningContext.workoutContext,
            accepted_meal_history: planningContext.recentAcceptedMeals,
        };

        const result = await this.execute({
            userId,
            requestId,
            trigger,
            user: resolvedUser,
            mealContext: enrichedMealContext,
            planningContext,
        });

        const meal = this.parseMealResponse(result.response, enrichedMealContext);

        return {
            status: 'ready',
            meal,
            response: result.response,
            toolTrace: result.toolTrace,
            provider: result.provider,
            plannerMetadata: buildSingleMealMetadata({
                user: resolvedUser,
                recentAcceptedMeals: planningContext.recentAcceptedMeals,
            }),
        };
    }
}

module.exports = SingleMealPlannerService;
