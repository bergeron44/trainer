const PERSONALITY_DESC = {
    drill_sergeant: 'an intense military drill sergeant - demanding, blunt, no excuses',
    scientist: 'an analytical sports nutritionist - data-driven, precise, evidence-based',
    zen_coach: 'a calm and balanced wellness coach - supportive, mindful, holistic',
};

const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MEAL_PERIODS = ['breakfast', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];
const CONTEXT_NOISE_REGEX = /\b(אני|אוהב|לא אוהב|לאכול|בשבת|ביום|בערב|בבוקר|בצהריים|i|like|dislike|eat|on saturday|breakfast|lunch|dinner|snack|meal)\b/i;

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

function normalizeFoodPreferenceTerms(items = []) {
    return (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .filter((item) => item.length <= 40)
        .filter((item) => item.split(' ').filter(Boolean).length <= 4)
        .filter((item) => !CONTEXT_NOISE_REGEX.test(item) || item.split(' ').length === 1)
        .slice(0, 20);
}

function resolveCurrentDay(dayHint = '') {
    const normalizedHint = normalizeDayValue(dayHint);
    if (normalizedHint) return normalizedHint;
    return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function buildContextualTimePreferenceSection(preferences = {}, { currentDay = '', currentMealPeriod = '' } = {}) {
    const rules = preferences.rule_based_preferences || {};
    const lines = [];

    const dayNote = String(rules?.time_notes?.by_day?.[currentDay] || '').trim();
    if (dayNote) {
        lines.push(`[time_notes day=${currentDay}] ${dayNote}`);
    }

    const mealNote = String(rules?.time_notes?.by_meal_period?.[currentMealPeriod] || '').trim();
    if (mealNote) {
        lines.push(`[time_notes meal=${currentMealPeriod}] ${mealNote}`);
    }

    if (Array.isArray(rules.time_context_notes) && rules.time_context_notes.length) {
        const matches = rules.time_context_notes
            .filter((entry) => {
                const day = normalizeDayValue(entry?.day_of_week) || (String(entry?.day_of_week || '').toLowerCase() === 'any' ? 'any' : '');
                const meal = normalizeMealPeriodValue(entry?.meal_period) || (String(entry?.meal_period || '').toLowerCase() === 'any' ? 'any' : '');
                const dayOk = day === 'any' || day === currentDay;
                const mealOk = meal === 'any' || meal === currentMealPeriod;
                return dayOk && mealOk && String(entry?.note || '').trim();
            })
            .map((entry) => {
                const day = String(entry?.day_of_week || 'any').toLowerCase();
                const meal = String(entry?.meal_period || 'any').toLowerCase();
                return `[time_context day=${day} meal=${meal}] ${String(entry?.note || '').trim()}`;
            });
        lines.push(...matches);
    }

    if (Array.isArray(rules.day_rules) && rules.day_rules.length && currentDay) {
        const dayRuleMatches = rules.day_rules
            .filter((rule) => normalizeDayValue(rule?.day_of_week) === currentDay)
            .map((rule) => {
                const type = String(rule?.rule_type || '').trim();
                const note = String(rule?.note || '').trim();
                return note
                    ? `[day_rule ${currentDay}:${type}] ${note}`
                    : `[day_rule ${currentDay}:${type}] apply this day rule`;
            });
        lines.push(...dayRuleMatches);
    }

    if (Array.isArray(rules.meal_time_rules) && rules.meal_time_rules.length && currentMealPeriod) {
        const mealRuleMatches = rules.meal_time_rules
            .filter((rule) => normalizeMealPeriodValue(rule?.meal_period) === currentMealPeriod)
            .map((rule) => {
                const preference = String(rule?.preference || '').trim();
                const maxCalories = typeof rule?.max_calories === 'number' ? ` max_calories=${rule.max_calories}` : '';
                const note = String(rule?.note || '').trim();
                return note
                    ? `[meal_time_rule ${currentMealPeriod}:${preference}${maxCalories}] ${note}`
                    : `[meal_time_rule ${currentMealPeriod}:${preference}${maxCalories}] apply this meal-time rule`;
            });
        lines.push(...mealRuleMatches);
    }

    if (!lines.length) return '';
    return `\nCurrent time-context preferences (highest priority for this meal):\n${lines.join('\n')}\n`;
}

function summarizeStructuredNutritionPreferences(preferences = {}) {
    const sections = [];
    const hard = preferences.hard_restrictions || {};
    const softLikes = preferences.soft_likes || {};
    const softDislikes = preferences.soft_dislikes || {};
    const budget = preferences.budget_preferences || {};
    const rules = preferences.rule_based_preferences || {};
    const practical = preferences.practical_constraints || {};

    const hardParts = [];
    if (Array.isArray(hard.diets) && hard.diets.length) hardParts.push(`diets: ${hard.diets.join(', ')}`);
    if (Array.isArray(hard.allergies) && hard.allergies.length) hardParts.push(`allergies: ${hard.allergies.join(', ')}`);
    if (Array.isArray(hard.medical_restrictions) && hard.medical_restrictions.length) hardParts.push(`medical: ${hard.medical_restrictions.join(', ')}`);
    if (Array.isArray(hard.forbidden_ingredients) && hard.forbidden_ingredients.length) hardParts.push(`forbidden: ${hard.forbidden_ingredients.join(', ')}`);
    if (hard.notes) hardParts.push(`notes: ${hard.notes}`);
    if (hardParts.length) sections.push(`Hard restrictions (must obey): ${hardParts.join(' | ')}`);

    const softLikeParts = [];
    if (Array.isArray(softLikes.cuisines) && softLikes.cuisines.length) softLikeParts.push(`cuisines: ${softLikes.cuisines.join(', ')}`);
    const normalizedSoftLikeFoods = normalizeFoodPreferenceTerms(softLikes.foods);
    if (normalizedSoftLikeFoods.length) softLikeParts.push(`foods: ${normalizedSoftLikeFoods.join(', ')}`);
    if (softLikes.notes) softLikeParts.push(`notes: ${softLikes.notes}`);
    if (softLikeParts.length) sections.push(`Soft likes: ${softLikeParts.join(' | ')}`);

    const softDislikeParts = [];
    if (Array.isArray(softDislikes.cuisines) && softDislikes.cuisines.length) softDislikeParts.push(`cuisines: ${softDislikes.cuisines.join(', ')}`);
    const normalizedSoftDislikeFoods = normalizeFoodPreferenceTerms(softDislikes.foods);
    if (normalizedSoftDislikeFoods.length) softDislikeParts.push(`foods: ${normalizedSoftDislikeFoods.join(', ')}`);
    if (softDislikes.notes) softDislikeParts.push(`notes: ${softDislikes.notes}`);
    if (softDislikeParts.length) sections.push(`Soft dislikes: ${softDislikeParts.join(' | ')}`);

    const budgetParts = [];
    if (budget.currency) budgetParts.push(`currency: ${budget.currency}`);
    if (typeof budget.daily_budget === 'number') budgetParts.push(`daily_budget: ${budget.daily_budget}`);
    if (typeof budget.weekly_budget === 'number') budgetParts.push(`weekly_budget: ${budget.weekly_budget}`);
    if (Array.isArray(budget.expensive_days) && budget.expensive_days.length) {
        const days = budget.expensive_days
            .map((d) => {
                const day = d?.day_of_week || '';
                const cap = typeof d?.budget_cap === 'number' ? ` cap=${d.budget_cap}` : '';
                const note = d?.note ? ` (${d.note})` : '';
                return `${day}${cap}${note}`.trim();
            })
            .filter(Boolean);
        if (days.length) budgetParts.push(`expensive_days: ${days.join('; ')}`);
    }
    if (budget.notes) budgetParts.push(`notes: ${budget.notes}`);
    if (budgetParts.length) sections.push(`Budget preferences: ${budgetParts.join(' | ')}`);

    const ruleParts = [];
    if (typeof rules.cheat_meals_per_week === 'number') ruleParts.push(`cheat_meals_per_week: ${rules.cheat_meals_per_week}`);
    if (Array.isArray(rules.cheat_days) && rules.cheat_days.length) ruleParts.push(`cheat_days: ${rules.cheat_days.join(', ')}`);
    if (Array.isArray(rules.day_rules) && rules.day_rules.length) {
        const dayRules = rules.day_rules
            .map((rule) => {
                const day = rule?.day_of_week || '';
                const type = rule?.rule_type || '';
                const note = rule?.note ? ` (${rule.note})` : '';
                return `${day}:${type}${note}`.trim();
            })
            .filter(Boolean);
        if (dayRules.length) ruleParts.push(`day_rules: ${dayRules.join('; ')}`);
    }
    if (Array.isArray(rules.meal_time_rules) && rules.meal_time_rules.length) {
        const mealTimeRules = rules.meal_time_rules
            .map((rule) => {
                const mealPeriod = rule?.meal_period || '';
                const preference = rule?.preference || '';
                const maxCalories = typeof rule?.max_calories === 'number' ? ` max_calories=${rule.max_calories}` : '';
                const note = rule?.note ? ` (${rule.note})` : '';
                return `${mealPeriod}:${preference}${maxCalories}${note}`.trim();
            })
            .filter(Boolean);
        if (mealTimeRules.length) ruleParts.push(`meal_time_rules: ${mealTimeRules.join('; ')}`);
    }
    if (Array.isArray(rules.time_context_notes) && rules.time_context_notes.length) {
        const timeContextNotes = rules.time_context_notes
            .map((rule) => {
                const day = rule?.day_of_week || 'any';
                const meal = rule?.meal_period || 'any';
                const note = rule?.note ? ` ${rule.note}` : '';
                return `${day}/${meal}:${note}`.trim();
            })
            .filter(Boolean);
        if (timeContextNotes.length) ruleParts.push(`time_context_notes: ${timeContextNotes.join('; ')}`);
    }
    if (rules.time_notes && typeof rules.time_notes === 'object') {
        const byDay = rules.time_notes.by_day && typeof rules.time_notes.by_day === 'object'
            ? Object.entries(rules.time_notes.by_day).filter(([, note]) => String(note || '').trim())
            : [];
        const byMeal = rules.time_notes.by_meal_period && typeof rules.time_notes.by_meal_period === 'object'
            ? Object.entries(rules.time_notes.by_meal_period).filter(([, note]) => String(note || '').trim())
            : [];
        if (byDay.length) {
            ruleParts.push(`time_notes.by_day: ${byDay.map(([day, note]) => `${day}:${String(note).trim()}`).join('; ')}`);
        }
        if (byMeal.length) {
            ruleParts.push(`time_notes.by_meal_period: ${byMeal.map(([meal, note]) => `${meal}:${String(note).trim()}`).join('; ')}`);
        }
    }
    if (Array.isArray(rules.special_rules) && rules.special_rules.length) ruleParts.push(`special_rules: ${rules.special_rules.join('; ')}`);
    if (rules.notes) ruleParts.push(`notes: ${rules.notes}`);
    if (ruleParts.length) sections.push(`Rule-based preferences: ${ruleParts.join(' | ')}`);

    const practicalParts = [];
    if (typeof practical.max_prep_time_minutes === 'number') practicalParts.push(`max_prep_time_minutes: ${practical.max_prep_time_minutes}`);
    if (practical.cooking_skill) practicalParts.push(`cooking_skill: ${practical.cooking_skill}`);
    if (Array.isArray(practical.equipment) && practical.equipment.length) practicalParts.push(`equipment: ${practical.equipment.join(', ')}`);
    if (typeof practical.meals_per_day === 'number') practicalParts.push(`meals_per_day: ${practical.meals_per_day}`);
    if (typeof practical.batch_cooking === 'boolean') practicalParts.push(`batch_cooking: ${practical.batch_cooking}`);
    if (practical.notes) practicalParts.push(`notes: ${practical.notes}`);
    if (practicalParts.length) sections.push(`Practical constraints: ${practicalParts.join(' | ')}`);

    return sections.join('\n');
}

function summarizeWorkoutContext(workoutContext = {}) {
    if (!workoutContext || typeof workoutContext !== 'object') return '';
    const entries = Object.entries(workoutContext)
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
        .map(([key, value]) => `${key}: ${value}`);
    return entries.length ? entries.join(' | ') : '';
}

function summarizeAcceptedMealHistory(history = []) {
    if (!Array.isArray(history) || !history.length) return '';

    const entries = history
        .slice(0, 20)
        .map((meal) => {
            const mealName = String(meal?.meal_name || '').trim();
            if (!mealName) return '';
            const calories = Number(meal?.calories) || 0;
            const protein = Number(meal?.protein) || 0;
            const carbs = Number(meal?.carbs) || 0;
            const fat = Number(meal?.fat) || 0;
            const foods = (Array.isArray(meal?.foods) ? meal.foods : [])
                .map((food) => String(food?.name || '').trim())
                .filter(Boolean)
                .slice(0, 4);
            const foodsPart = foods.length ? ` | foods: ${foods.join(', ')}` : '';
            return `- ${mealName} (${calories} kcal, P:${protein} C:${carbs} F:${fat})${foodsPart}`;
        })
        .filter(Boolean);

    return entries.length ? entries.join('\n') : '';
}

function buildMealSystem(user) {
    const p = user.profile || {};
    const personality = PERSONALITY_DESC[p.trainer_personality] || PERSONALITY_DESC.zen_coach;

    return `You are NEXUS, ${personality}.

User profile:
- Goal: ${p.goal || 'recomp'}
- Diet: ${p.diet_type || 'everything'}
- Daily targets: ${p.target_calories || 2000} kcal | ${p.protein_goal || 150}g protein | ${p.carbs_goal || 200}g carbs | ${p.fat_goal || 65}g fat

Rules:
- Respond ONLY with valid JSON - no markdown, no extra text, no explanation
- Food names in English
- coach_note in Hebrew (short, motivational, 1 sentence)
- Choose real foods that fit the user's diet type
- Portions must be realistic (grams/units)
- Never output empty meals: each meal must have realistic calories and macros
- Never use schedule/context sentences as food names (e.g., do not output phrases like "on saturday ...")
- If request priority is HIGH, prioritize that request unless it conflicts with hard restrictions`;
}

function buildMealUserMessage(data) {
    const {
        remaining,
        per_meal_target,
        liked_foods = [],
        disliked_foods = [],
        time_of_day = '12:00',
        meal_period = 'Lunch',
        day_of_week = '',
        meals_remaining = 2,
        nutrition_preferences = {},
        workout_context = {},
        accepted_meal_history = [],
        meal_request_note = '',
        meal_request_priority = 'normal',
        nutrition_preferences_note = '',
    } = data;

    const likedList = liked_foods
        .slice(0, 20)
        .map((f) => {
            const name = String(f?.name || '').trim();
            if (!name) return '';
            const calories = Number(f?.calories);
            const protein = Number(f?.protein);
            const carbs = Number(f?.carbs);
            const fat = Number(f?.fat);
            const hasMacros = [calories, protein, carbs, fat].some((value) => Number.isFinite(value) && value > 0);
            return hasMacros
                ? `${name} (${Math.max(0, calories || 0)}kcal/100g, P:${Math.max(0, protein || 0)}g C:${Math.max(0, carbs || 0)}g F:${Math.max(0, fat || 0)}g)`
                : name;
        })
        .filter(Boolean)
        .join('\n');
    const dislikedList = disliked_foods.slice(0, 10).join(', ');

    const mealRequest = String(meal_request_note || '').trim();
    const requestPriority = String(meal_request_priority || 'normal').toLowerCase() === 'high' ? 'high' : 'normal';
    const nutritionPreferences = String(nutrition_preferences_note || '').trim();
    const mealRequestSection = mealRequest
        ? `\nSpecific request for this meal:\n${mealRequest}\n`
        : '';
    const requestPrioritySection = mealRequest
        ? `\nRequest priority: ${requestPriority.toUpperCase()}${requestPriority === 'high' ? ' (give this request very high weight unless it conflicts with hard restrictions)' : ''}\n`
        : '';
    const nutritionPreferencesSection = nutritionPreferences
        ? `\nMy nutrition priorities (always consider these):\n${nutritionPreferences}\n`
        : '';

    const currentDay = resolveCurrentDay(day_of_week);
    const currentMealPeriod = normalizeMealPeriodValue(meal_period) || 'lunch';
    const timeContextSection = buildContextualTimePreferenceSection(nutrition_preferences, {
        currentDay,
        currentMealPeriod,
    });

    const structuredPreferences = summarizeStructuredNutritionPreferences(nutrition_preferences);
    const workoutSummary = summarizeWorkoutContext(workout_context);
    const acceptedMealsSummary = summarizeAcceptedMealHistory(accepted_meal_history);
    const structuredPreferencesSection = structuredPreferences
        ? `\nStructured nutrition preferences from profile:\n${structuredPreferences}\n`
        : '';
    const workoutContextSection = workoutSummary
        ? `\nWorkout context from profile/session:\n${workoutSummary}\n`
        : '';
    const acceptedMealsSection = acceptedMealsSummary
        ? `\nPrevious meals this user accepted/saved (prefer similar patterns unless user request says otherwise):\n${acceptedMealsSummary}\n`
        : '';

    const decisionTabsSection = `\nDecision tabs to read before creating this meal (in order):
1) Specific request for this meal text
2) Time context (time_of_day, day_of_week, meal_period)
3) Hard restrictions (diet, allergies, medical, forbidden ingredients)
4) Soft likes/dislikes + liked_foods/disliked_foods
5) Practical constraints (prep time, cooking skill, equipment)
6) Rule-based preferences (cheat rules, day/meal rules, time notes)
7) Budget preferences
8) Workout context + remaining macro targets
9) Previous accepted meals history\n`;

    return `Generate my next meal now.

Time: ${time_of_day} | Day: ${currentDay} | Period: ${meal_period} | Meals remaining today: ${meals_remaining}

Remaining macros I still need today:
- Calories: ${Math.max(0, remaining.calories)} kcal
- Protein: ${Math.max(0, remaining.protein)}g
- Carbs: ${Math.max(0, remaining.carbs)}g
- Fat: ${Math.max(0, remaining.fat)}g

Target for THIS meal (~${Math.max(0, per_meal_target.calories)} kcal):
- Protein: ~${Math.max(0, per_meal_target.protein)}g
- Carbs: ~${Math.max(0, per_meal_target.carbs)}g
- Fat: ~${Math.max(0, per_meal_target.fat)}g

My liked foods (prefer these):
${likedList || 'Any healthy foods'}

Foods I dislike (avoid): ${dislikedList || 'none'}
${decisionTabsSection}${timeContextSection}${structuredPreferencesSection}${workoutContextSection}${acceptedMealsSection}${nutritionPreferencesSection}${requestPrioritySection}${mealRequestSection}

Respond with this exact JSON structure:
{
  "meal_name": "Creative name for this meal",
  "foods": [
    { "name": "Food name", "portion": "Xg", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
  ],
  "total_calories": 0,
  "total_protein": 0,
  "total_carbs": 0,
  "total_fat": 0,
  "coach_note": "\u05de\u05e9\u05e4\u05d8 \u05de\u05d5\u05d8\u05d9\u05d1\u05e6\u05d9\u05d4 \u05e7\u05e6\u05e8 \u05d1\u05e2\u05d1\u05e8\u05d9\u05ea"
}`;
}

module.exports = { buildMealSystem, buildMealUserMessage };
