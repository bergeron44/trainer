const BaseLLMRequest = require('./requests/baseLLMRequest');
const User = require('../models/User');
const MealPlan = require('../models/MealPlan');
const NutritionLog = require('../models/NutritionLog');

const DEFAULT_MAX_TOOL_CALLS = 5;
const DEFAULT_MAX_TOOL_ITERATIONS = 3;
const DEFAULT_RETRY_ATTEMPTS = 1;
const RECENT_MEAL_HISTORY_LIMIT = 20;

function parseBoolean(value, fallback = true) {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value).trim().toLowerCase() === 'true';
}

function parseIntOrFallback(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeErrorMessage(error) {
    const message = String(error?.message || 'Menu planner failed.');
    return message.length > 400 ? `${message.slice(0, 397)}...` : message;
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
    pushIfValue(lines, 'sleep_hours', profile.sleep_hours);
    pushIfValue(lines, 'past_obstacles', profile.past_obstacles);
    pushIfValue(lines, 'motivation_source', profile.motivation_source);
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
    if (Array.isArray(budget.expensive_days) && budget.expensive_days.length) {
        const expensiveDays = budget.expensive_days
            .map((entry) => {
                const day = String(entry?.day_of_week || '').trim();
                const cap = entry?.budget_cap !== undefined ? `cap=${entry.budget_cap}` : '';
                const note = String(entry?.note || '').trim();
                return [day, cap, note].filter(Boolean).join(' ');
            })
            .filter(Boolean);
        pushIfValue(budgetLines, 'expensive_days', expensiveDays, listOrNone);
    }
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
    if (rules.time_notes && typeof rules.time_notes === 'object') {
        const byDay = Object.entries(rules.time_notes.by_day || {})
            .filter(([, note]) => String(note || '').trim())
            .map(([day, note]) => `${day}: ${String(note).trim()}`);
        const byMeal = Object.entries(rules.time_notes.by_meal_period || {})
            .filter(([, note]) => String(note || '').trim())
            .map(([period, note]) => `${period}: ${String(note).trim()}`);
        pushIfValue(ruleLines, 'time_notes.by_day', byDay, listOrNone);
        pushIfValue(ruleLines, 'time_notes.by_meal_period', byMeal, listOrNone);
    }
    pushIfValue(ruleLines, 'special_rules', rules.special_rules, listOrNone);
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

function buildPlannerMetadata({ user, recentAcceptedMeals }) {
    return {
        agent: 'nutritionist',
        agent_service: 'OnboardingMenuPlannerService',
        prompt_priority: [
            'hard_restrictions',
            'structured_nutrition_preferences',
            'macro_targets_and_goal',
            'training_context',
            'accepted_meal_history',
            'liked_and_disliked_food_lists',
            'legacy_menu_preferences',
        ],
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

class OnboardingMenuPlannerService extends BaseLLMRequest {
    constructor({
        chatBrainService,
        userModel = User,
        mealPlanModel = MealPlan,
        nutritionLogModel = NutritionLog,
        logger = console,
        enabled,
    } = {}) {
        super({
            chatBrainService,
            agentType: 'nutritionist',
            personaId: 'nutritionist',
            temperature: 0.7,
            maxToolCalls: parseIntOrFallback(process.env.ONBOARDING_AI_MENU_PLANNER_MAX_TOOL_CALLS, DEFAULT_MAX_TOOL_CALLS),
            maxToolIterations: parseIntOrFallback(process.env.ONBOARDING_AI_MENU_PLANNER_MAX_ITERATIONS, DEFAULT_MAX_TOOL_ITERATIONS),
            retryAttempts: parseIntOrFallback(process.env.ONBOARDING_AI_MENU_PLANNER_RETRY_ATTEMPTS, DEFAULT_RETRY_ATTEMPTS),
            logger,
        });
        this.UserModel = userModel;
        this.MealPlanModel = mealPlanModel;
        this.NutritionLogModel = nutritionLogModel;
        this.enabled = enabled ?? parseBoolean(process.env.ONBOARDING_AI_MENU_PLANNER_ENABLED, true);
    }

    isEnabled() {
        return this.enabled;
    }

    shouldGenerateForProfile(profile = {}) {
        if (!profile || profile.onboarding_completed !== true) return false;
        if (String(profile.menu_choice || '').trim().toLowerCase() !== 'ai') return false;
        if (profile.has_existing_menu === true) return false;
        return true;
    }

    getToolAllowlist() {
        return ['menu_plan_save', 'nutrition_web_search'];
    }

    buildSystemPrompt({ requestId, user, planningContext = {} }) {
        const profileSummary = summarizeProfile(user?.profile || {});
        const nutritionPreferencesSummary = summarizeStructuredNutritionPreferences(user?.nutrition_preferences || {});
        const likedFoodsSummary = summarizeLikedFoods(user?.liked_foods || []);
        const dislikedFoodsSummary = summarizeDislikedFoods(user?.disliked_foods || []);
        const legacyMenuPreferences = summarizeLegacyMenuPreferences(user?.profile?.menu_ai_preferences || {});
        const acceptedMealsSummary = summarizeAcceptedMealHistory(planningContext.recentAcceptedMeals || []);

        return [
            'You are the nutritionist agent responsible for building the active daily meal plan.',
            'Use the full user snapshot below. Do NOT call profile or nutrition lookup tools.',
            'You may optionally use nutrition_web_search if the current user snapshot is not enough to produce strong meal ideas or you need minimal recipe inspiration/ingredient validation.',
            'Do not use nutrition_web_search by default. Prefer the user snapshot first and keep search usage minimal.',
            '',
            'Priority order for decisions:',
            '1. Hard restrictions: diet type, allergies, medical restrictions, forbidden ingredients.',
            '2. Structured nutrition preferences: soft likes/dislikes, rule-based preferences, time-context notes, budget, practical constraints.',
            '3. Macro targets and body-composition goal.',
            '4. Training context: activity level, workout frequency, session duration, environment, injuries, plan status/source.',
            '5. Previous accepted/saved meals for adherence and pattern matching.',
            '6. liked_foods / disliked_foods lists.',
            '7. Legacy menu_ai_preferences free-text hints only when they do not conflict with higher-priority data.',
            '',
            'User profile summary:',
            profileSummary,
            '',
            'Structured nutrition preferences snapshot:',
            nutritionPreferencesSummary,
            '',
            'liked_foods snapshot:',
            likedFoodsSummary,
            '',
            'disliked_foods snapshot:',
            dislikedFoodsSummary,
            '',
            'Legacy menu_ai_preferences snapshot:',
            legacyMenuPreferences,
            '',
            'Recent accepted/saved meal history:',
            acceptedMealsSummary,
            '',
            'Create one active daily meal plan for today. This is a full-day plan regeneration, not a single next-meal response.',
            'First decide the optimal number of meals per day from the full context above (typically 3-6). Use meal_frequency or practical_constraints.meals_per_day as hints, but override them if the user context clearly requires a better structure.',
            'For EACH meal slot generate EXACTLY 4 different dish options so the user can pick their favourite.',
            'Each option is a separate entry in the meals array with the same meal_type but a different meal_name and foods.',
            'All 4 options for the same slot should have similar calories so any choice hits the daily targets.',
            'For each meal entry include: meal_name, meal_type (breakfast/morning_snack/lunch/afternoon_snack/dinner/evening_snack/post_workout/other), foods (array with name, portion, calories, protein, carbs, fat), and meal-level macro totals.',
            'Macro totals across one representative option per slot should sum close to the daily targets.',
            'Food names must be in English. Keep the meals realistic, adherent, and consistent with recent accepted meal history unless higher-priority data says otherwise.',
            'Only search when the internal user context is not enough or when you need to sanity-check a recipe pattern. At most 2 searches before saving.',
            'Call menu_plan_save exactly once with the complete meals array (all options for all slots).',
            `Use idempotencyKey: "onboarding-${requestId || 'request'}-menu"`,
            'After saving, provide a short summary of the plan.',
        ].join('\n');
    }

    buildUserPrompt({ planningContext = {} }) {
        const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const historyCount = Array.isArray(planningContext.recentAcceptedMeals)
            ? planningContext.recentAcceptedMeals.length
            : 0;
        return [
            'Create my personalized active daily meal plan now.',
            `Today is ${currentDay}.`,
            `Recent accepted meal history count available: ${historyCount}.`,
            'Use the latest user nutrition and training data first, then shape the meals for adherence.',
        ].join(' ');
    }

    validateResult(result) {
        const saved = Array.isArray(result.toolTrace)
            ? result.toolTrace.filter(
                (item) => item?.ok && item?.toolName === 'menu_plan_save'
            ).length
            : 0;
        if (saved < 1) {
            throw new Error('Menu planner did not save a plan.');
        }
    }

    getContext({ trigger }) {
        return {
            workflow: 'onboarding_menu_planner',
            trigger: trigger || 'unknown',
        };
    }

    async buildPlanningContext({ userId }) {
        const logs = await this.NutritionLogModel.find({
            user: userId,
            archived: { $ne: true },
        })
            .sort({ createdAt: -1 })
            .limit(RECENT_MEAL_HISTORY_LIMIT);

        return {
            recentAcceptedMeals: normalizeRecentMeals(logs),
        };
    }

    async archiveOlderAgentPlans(userId) {
        const activePlans = await this.MealPlanModel.find({
            user: userId,
            source: 'agent',
            archived: false,
        }).sort({ createdAt: -1 });

        if (!Array.isArray(activePlans) || activePlans.length <= 1) {
            return 0;
        }

        const idsToArchive = activePlans
            .slice(1)
            .map((plan) => plan?._id)
            .filter(Boolean);

        if (!idsToArchive.length) return 0;

        const result = await this.MealPlanModel.updateMany(
            { _id: { $in: idsToArchive } },
            { $set: { archived: true } }
        );

        return Number(result?.modifiedCount || result?.nModified || 0);
    }

    async getLatestActivePlan(userId) {
        return this.MealPlanModel.findOne({
            user: userId,
            source: 'agent',
            archived: false,
        }).sort({ createdAt: -1 });
    }

    async generatePlan({ userId, requestId, trigger, user, planningContext }) {
        const result = await this.execute({ userId, requestId, trigger, user, planningContext });
        const savedCount = result.toolTrace.filter(
            (item) => item?.ok && item?.toolName === 'menu_plan_save'
        ).length;
        return { ...result, savedCount };
    }

    async ensurePlanForUser({
        userId,
        requestId,
        trigger = 'onboarding',
        force = false,
    }) {
        if (!userId) {
            return { triggered: false, status: 'skipped', reason: 'missing_user_id' };
        }

        const user = await this.UserModel.findById(userId);
        if (!user) {
            return { triggered: false, status: 'skipped', reason: 'user_not_found' };
        }

        const profile = user.profile || {};
        if (!force && !this.shouldGenerateForProfile(profile)) {
            return { triggered: false, status: 'skipped', reason: 'profile_not_eligible' };
        }

        if (!this.isEnabled()) {
            return { triggered: false, status: 'skipped', reason: 'planner_disabled' };
        }

        user.profile = {
            ...profile,
            menu_plan_status: 'generating',
            menu_plan_error: undefined,
            menu_plan_source: 'agent',
        };
        await user.save();

        try {
            const planningContext = await this.buildPlanningContext({
                userId: String(user._id),
            });
            const result = await this.generatePlan({
                userId: String(user._id),
                requestId,
                trigger,
                user,
                planningContext,
            });
            const archivedPlanCount = await this.archiveOlderAgentPlans(String(user._id));
            const activePlan = await this.getLatestActivePlan(String(user._id));
            const plannerMetadata = buildPlannerMetadata({
                user,
                recentAcceptedMeals: planningContext.recentAcceptedMeals,
            });

            user.profile = {
                ...(user.profile || {}),
                has_existing_menu: true,
                menu_plan_status: 'ready',
                menu_plan_error: undefined,
                menu_plan_generated_at: new Date(),
                menu_plan_source: 'agent',
            };
            await user.save();

            this.logger.info?.('onboarding.menu.ready', {
                requestId,
                userId: String(user._id),
                trigger,
                savedCount: result.savedCount,
                archivedPlanCount,
            });

            return {
                triggered: true,
                status: 'ready',
                savedCount: result.savedCount,
                archivedPlanCount,
                plannerMetadata,
                activePlan,
                response: result.response,
            };
        } catch (error) {
            const errorMessage = sanitizeErrorMessage(error);
            user.profile = {
                ...(user.profile || {}),
                has_existing_menu: false,
                menu_plan_status: 'failed',
                menu_plan_error: errorMessage,
                menu_plan_source: 'agent',
            };
            await user.save();

            this.logger.error?.('onboarding.menu.failed', {
                requestId,
                userId: String(user._id),
                trigger,
                error: errorMessage,
            });

            return {
                triggered: true,
                status: 'failed',
                error: errorMessage,
            };
        }
    }
}

module.exports = OnboardingMenuPlannerService;
