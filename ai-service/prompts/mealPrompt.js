const PERSONALITY_DESC = {
    drill_sergeant: 'an intense military drill sergeant - demanding, blunt, no excuses',
    scientist: 'an analytical sports nutritionist - data-driven, precise, evidence-based',
    zen_coach: 'a calm and balanced wellness coach - supportive, mindful, holistic',
};

const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MEAL_PERIODS = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack', 'post_workout', 'other'];
const CONTEXT_NOISE_REGEX = /\b(אני|אוהב|לא אוהב|לאכול|בשבת|ביום|בערב|בבוקר|בצהריים|i|like|dislike|eat|on saturday|breakfast|lunch|dinner|snack|meal)\b/i;

function normalizeDayValue(value) {
    const day = String(value || '').trim().toLowerCase();
    return WEEK_DAYS.includes(day) ? day : '';
}

function normalizeMealPeriodValue(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const normalized = raw.replace(/[\s-]+/g, '_');
    if (normalized === 'mid_morning_snack') return 'morning_snack';
    if (normalized === 'afternoon') return 'afternoon_snack';
    if (normalized === 'evening') return 'evening_snack';
    if (normalized === 'pre_workout_snack') return 'afternoon_snack';
    if (normalized === 'late_night_casein') return 'evening_snack';
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

function buildMealSystem(user, options = {}) {
    const p = user.profile || {};
    const personality = PERSONALITY_DESC[p.trainer_personality] || PERSONALITY_DESC.zen_coach;
    const appLanguage = String(options.app_language || 'en').toLowerCase() === 'he' ? 'he' : 'en';
    const responseLanguageLabel = appLanguage === 'he' ? 'Hebrew' : 'English';

    return `You are NEXUS, ${personality}.

User profile:
- Goal: ${p.goal || 'recomp'}
- Diet: ${p.diet_type || 'everything'}
- Daily targets: ${p.target_calories || 2000} kcal | ${p.protein_goal || 150}g protein | ${p.carbs_goal || 200}g carbs | ${p.fat_goal || 65}g fat
- App language: ${responseLanguageLabel}

Rules:
- Respond ONLY with valid JSON - no markdown, no extra text, no explanation
- Respond in the same language as the app is currently running: ${responseLanguageLabel}
- Every user-visible text field must be in ${responseLanguageLabel}: meal_name, foods[].name, and coach_note
- Give very high weight to the user's free-text meal request
- If the user explicitly asks for a specific ingredient, food, or flavor direction, include it in the meal unless doing so would violate hard restrictions, diet rules, allergies, medical restrictions, or forbidden ingredients
- Do not ignore the user's free-text request just because another option also fits the macros
- Choose real foods that fit the user's diet type
- Obey hard restrictions absolutely. Never include ingredients that conflict with diet, allergies, medical restrictions, or forbidden ingredients
- If the user is vegan, never include meat, chicken, turkey, fish, seafood, eggs, dairy, honey, gelatin, or any other animal product
- If the user is vegetarian, never include meat, chicken, turkey, fish, or seafood
- Training data from the profile/session is important. Use it when deciding meal size, digestion burden, carb level, protein level, meal timing fit, and recovery support
- Portions must be realistic (grams/units)
- Never output empty meals: each meal must have realistic calories and macros
- Never use schedule/context sentences as food names (e.g., do not output phrases like "on saturday ...")
- If request priority is HIGH, prioritize that request unless it conflicts with hard restrictions
- If a web-search tool is available in your runtime and you genuinely need it to verify an unfamiliar food, ingredient, or localized meal name, you may use it. Otherwise do not mention tools
- Return exactly this data in JSON: meal_name, foods[] with ingredient name + amount + calories/protein/carbs/fat for each item, total_calories, total_protein, total_carbs, total_fat, coach_note`;
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
        app_language = 'en',
        meal_slot_label = '',
        meal_slot_id = '',
    } = data;
    const normalizedAppLanguage = String(app_language || 'en').toLowerCase() === 'he' ? 'he' : 'en';
    const responseLanguageLabel = normalizedAppLanguage === 'he' ? 'Hebrew' : 'English';

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
        ? `\nSpecific request for this meal (give this very high weight):\n${mealRequest}\n`
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
        ? `\nTraining data from profile/session:\n${workoutSummary}\n`
        : '';
    const acceptedMealsSection = acceptedMealsSummary
        ? `\nPrevious meals this user accepted/saved (prefer similar patterns unless user request says otherwise):\n${acceptedMealsSummary}\n`
        : '';

    const decisionTabsSection = `\nDecision tabs to read before creating this meal (in order):
1) Specific request for this meal text (highest practical priority unless it conflicts with hard restrictions)
2) Hard restrictions (allergies, medical restrictions, forbidden ingredients, non-negotiable restrictions)
3) Diet type (vegan / vegetarian / keto / paleo / everything)
4) Time context (time_of_day, day_of_week, meal_period)
5) Soft likes/dislikes + liked_foods/disliked_foods
6) Practical constraints (prep time, cooking skill, equipment)
7) Rule-based preferences (cheat rules, day/meal rules, time notes)
8) Budget preferences
9) Training data + remaining macro targets
10) Previous accepted meals history\n`;
    const slotReferenceSection = meal_slot_label
        ? `\nExact app slot for this meal:\n- Slot label in app: ${meal_slot_label}\n- Slot id: ${meal_slot_id || 'unknown'}\n- This meal must feel appropriate for that exact slot, not just for a generic meal period.\n`
        : '';

    return `Generate my next meal now.

Time: ${time_of_day} | Day: ${currentDay} | Period: ${meal_period} | Meals remaining today: ${meals_remaining}
App language for this response: ${responseLanguageLabel}
You must answer in ${responseLanguageLabel}, because that is the language the app is currently running in.

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
${slotReferenceSection}${decisionTabsSection}${timeContextSection}${structuredPreferencesSection}${workoutContextSection}${acceptedMealsSection}${nutritionPreferencesSection}${requestPrioritySection}${mealRequestSection}

Respond with this exact JSON structure:
{
  "meal_name": "Meal name in ${responseLanguageLabel}",
  "foods": [
    { "name": "Ingredient name in ${responseLanguageLabel}", "portion": "Exact amount like 120g / 2 slices / 250ml", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
  ],
  "total_calories": 0,
  "total_protein": 0,
  "total_carbs": 0,
  "total_fat": 0,
  "coach_note": "Short motivational sentence in ${responseLanguageLabel}"
}

Validation before you answer:
- if the user explicitly asked for a food or ingredient, make sure it appears in the meal unless a hard restriction prevents it
- foods must contain the actual ingredients of the meal
- each food item must include a usable amount in portion
- totals must describe the whole meal
- do not include any non-vegan ingredient when the diet or hard restrictions require vegan
- do not include any forbidden ingredient even if it matches liked foods or the specific request`;
} 

function buildMealRecapSystem(user, options = {}) {
    const p = user.profile || {};
    const personality = PERSONALITY_DESC[p.trainer_personality] || PERSONALITY_DESC.zen_coach;
    const appLanguage = String(options.app_language || 'en').toLowerCase() === 'he' ? 'he' : 'en';
    const responseLanguageLabel = appLanguage === 'he' ? 'Hebrew' : 'English';

    return `You are NEXUS, ${personality}.
You are NEXUS, a recipe-book style cooking expert who writes clear, reliable, real-world recipes for this exact meal.

You are turning a selected meal into a practical recipe the user can make.

Rules:
- Respond ONLY with valid JSON
- Respond in the same language as the app is currently running: ${responseLanguageLabel}
- Return only recipe-making content, not nutrition coaching
- Be practical, concrete, and user-facing
- Write like a strong recipe author, not like a chatbot
- The recipe must feel like a real recipe someone can cook from, not a loose suggestion
- The recipe_guide must teach the user exactly what to do with the ingredients step by step
- Explain how to handle each important ingredient: wash, peel, cut, soak, marinate, season, mix, cook, rest, chill, assemble, and serve when relevant
- Include concrete timings, heat level, cookware, order of operations, and doneness cues whenever relevant
- It is OK if the meal macros are not an exact match to the ideal target; small deviations are normal
- Do not criticize a meal just because calories or macros are close instead of exact
- Respect allergies, diet rules, forbidden ingredients, medical restrictions, and practical cooking constraints
- Infer a realistic detailed preparation from the listed foods if the meal is not fully specified
- Keep the recipe closely matched to the selected meal. Use the listed meal name and listed foods as the primary source of truth
- Do not replace the core protein, core carb, or core meal identity unless a restriction makes the original version impossible
- If the selected meal already has foods listed, build the recipe mainly from those same foods and only add small supporting ingredients when needed for a realistic recipe
- The ingredients_rubric must include the actual ingredients used for the recipe, with concrete amounts
- If the selected meal has listed foods, include those foods as the main ingredients of the recipe unless a hard restriction prevents it
- Do not drift into a different dish just because it sounds tastier or easier
- Do not explain why the meal fits the plan
- Do not give motivation or coaching
- Do not invent medical claims
- Return only a recipe the user can actually follow from beginning to end`;
}

function buildMealRecapUserMessage(data) {
    const {
        meal = {},
        current_consumed = {},
        daily_targets = {},
        remaining_before_meal = {},
        updated_macros = {},
        time_of_day = '12:00',
        meal_period = 'Lunch',
        day_of_week = '',
        nutrition_preferences = {},
        workout_context = {},
        accepted_meal_history = [],
        meal_request_note = '',
        meal_request_priority = 'normal',
        previous_recap = '',
        recap_feedback = '',
        variation_request = '',
        app_language = 'en',
    } = data;
    const normalizedAppLanguage = String(app_language || 'en').toLowerCase() === 'he' ? 'he' : 'en';
    const responseLanguageLabel = normalizedAppLanguage === 'he' ? 'Hebrew' : 'English';

    const currentDay = resolveCurrentDay(day_of_week);
    const currentMealPeriod = normalizeMealPeriodValue(meal_period) || 'lunch';
    const structuredPreferences = summarizeStructuredNutritionPreferences(nutrition_preferences);
    const workoutSummary = summarizeWorkoutContext(workout_context);
    const acceptedMealsSummary = summarizeAcceptedMealHistory(accepted_meal_history);
    const timeContextSection = buildContextualTimePreferenceSection(nutrition_preferences, {
        currentDay,
        currentMealPeriod,
    });

    const foods = (Array.isArray(meal.foods) ? meal.foods : [])
        .map((food) => {
            const name = String(food?.name || '').trim();
            if (!name) return '';
            const portion = String(food?.portion || '').trim();
            const calories = Number(food?.calories) || 0;
            return portion ? `${portion} ${name} (${calories} kcal)` : `${name} (${calories} kcal)`;
        })
        .filter(Boolean)
        .join('\n');

    const requestText = String(meal_request_note || '').trim();
    const requestPriority = String(meal_request_priority || 'normal').toLowerCase() === 'high' ? 'HIGH' : 'NORMAL';
    const previousRecap = String(previous_recap || '').trim();
    const recapFeedback = String(recap_feedback || '').trim();
    const variationRequest = String(variation_request || '').trim();
    const previousRecapSection = previousRecap
        ? `\nPrevious recap to avoid repeating too closely:\n${previousRecap}\n`
        : '';
    const recapFeedbackSection = recapFeedback
        ? `\nUser feedback about the previous recap:\n${recapFeedback}\n`
        : '';
    const variationRequestSection = variationRequest
        ? `\nAlternate recap request:\n${variationRequest}\n`
        : '';

    return `Give the user only a recipe for how to make this selected meal.

App language for this response: ${responseLanguageLabel}
You must answer in ${responseLanguageLabel}, because that is the language the app is currently running in.

Selected meal:
- name: ${meal.meal_name || 'Meal'}
- calories: ${Number(meal.total_calories || 0)}
- protein: ${Number(meal.total_protein || 0)}g
- carbs: ${Number(meal.total_carbs || 0)}g
- fat: ${Number(meal.total_fat || 0)}g
- foods:
${foods || '- none listed'}

Current context:
- time: ${time_of_day}
- day: ${currentDay}
- meal_period: ${meal_period}

Daily targets:
- calories: ${Number(daily_targets.calories || 0)}
- protein: ${Number(daily_targets.protein || 0)}g
- carbs: ${Number(daily_targets.carbs || 0)}g
- fat: ${Number(daily_targets.fat || 0)}g

Consumed before this meal:
- calories: ${Number(current_consumed.calories || 0)}
- protein: ${Number(current_consumed.protein || 0)}g
- carbs: ${Number(current_consumed.carbs || 0)}g
- fat: ${Number(current_consumed.fat || 0)}g

Remaining before this meal:
- calories: ${Number(remaining_before_meal.calories || 0)}
- protein: ${Number(remaining_before_meal.protein || 0)}g
- carbs: ${Number(remaining_before_meal.carbs || 0)}g
- fat: ${Number(remaining_before_meal.fat || 0)}g

Updated totals after this meal:
- calories_after_meal: ${Number(updated_macros.consumed_after_meal?.calories || 0)}
- protein_after_meal: ${Number(updated_macros.consumed_after_meal?.protein || 0)}g
- carbs_after_meal: ${Number(updated_macros.consumed_after_meal?.carbs || 0)}g
- fat_after_meal: ${Number(updated_macros.consumed_after_meal?.fat || 0)}g
- remaining_calories_after_meal: ${Number(updated_macros.remaining_after_meal?.calories || 0)}
- remaining_protein_after_meal: ${Number(updated_macros.remaining_after_meal?.protein || 0)}g
- remaining_carbs_after_meal: ${Number(updated_macros.remaining_after_meal?.carbs || 0)}g
- remaining_fat_after_meal: ${Number(updated_macros.remaining_after_meal?.fat || 0)}g

Structured nutrition preferences:
${structuredPreferences || 'none'}
${timeContextSection}
Workout context:
${workoutSummary || 'none'}

Recent accepted meals:
${acceptedMealsSummary || 'none'}

Specific meal request text:
${requestText || 'none'}

Request priority:
${requestPriority}
${previousRecapSection}${recapFeedbackSection}${variationRequestSection}

If a previous recap is provided, return a noticeably different recipe version or preparation angle and avoid repeating the same wording.

Important:
- The recipe should closely match the selected meal and the user's restrictions
- Keep the same core meal identity as the selected meal
- Use the listed foods from the selected meal as the main basis of the recipe
- Do not swap the main protein or main carb for a different one unless a hard restriction makes that necessary
- If the selected meal lists ingredients, those ingredients should appear in the ingredients_rubric and be actively used in the recipe_guide
- The recap should read like a real recipe for this exact meal, not a general meal idea
- Calories/protein/carbs/fat do NOT need to match the original meal exactly
- Small ingredient or preparation adjustments are acceptable if they respect the user context
- Output only recipe-making information, not meal-fit explanations
- Return a clear ingredients rubric first, then one detailed guide from beginning to end
- The ingredients rubric must list concrete ingredients and amounts the user should prepare
- The recipe guide must be detailed and specific, not generic
- The recipe guide must tell the user exactly what to do, in order, from the first preparation step until serving
- Explain how to treat the ingredients, not just list actions. For example: how to wash them, how to cut them, when to season them, when to stir them, when to lower or raise heat, and how long each stage should take
- When useful, describe texture, color, or doneness cues so the user knows when to move to the next step
- Include timings inside the recipe guide where useful
- Include soaking, marinating, preheating, baking, resting, chilling, or serving details when relevant
- Be explicit and practical, for example: "Soak the beans in water for 3 hours" or "Preheat the oven to 190C"
- Do not return separate notes or separate timing sections
- Do not write vague phrases like "prepare the ingredients" unless you explain exactly what to do
- If the meal is mainly raw or assembly-based, explain exactly how to wash, cut, mix, season, chill, and serve it
- If the meal is cooked, explain the cooking order, cookware, heat level, and timing clearly
- The user should be able to follow the recipe_guide without guessing missing steps
- Write the recipe_guide as a clear step-by-step flow inside one string, using numbered steps like "1. ... 2. ... 3. ..."
- Include what the cook should be doing at each stage, not just the result
- Mention exact prep actions, cooking actions, waiting actions, and serving actions when relevant
- If an ingredient needs trimming, peeling, slicing, dicing, rinsing, draining, seasoning, or preheating around it, say so explicitly
- If the selected meal is simple, still write a complete usable recipe rather than a short summary

Respond with this exact JSON structure:
{
  "recipe_title": "Detailed recipe title",
  "ingredients_rubric": ["Ingredient with amount", "Ingredient with amount"],
  "recipe_guide": "One detailed recipe guide that explains exactly how to make the meal from beginning to end, including how to handle the ingredients, preparation, cooking, timings, heat, sequencing, and serving."
}`;
}

module.exports = {
    buildMealSystem,
    buildMealUserMessage,
    buildMealRecapSystem,
    buildMealRecapUserMessage,
};
