const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const MealPlan = require('../models/MealPlan');

const DEFAULT_MAX_TOOL_CALLS = 5;
const DEFAULT_MAX_TOOL_ITERATIONS = 3;
const DEFAULT_RETRY_ATTEMPTS = 1;

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

/**
 * Mint a short-lived JWT for internal server → ai-service calls.
 * The ai-service auth middleware verifies it the same way as user tokens.
 */
function mintServiceToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

class OnboardingMenuPlannerService {
    constructor({
        userModel = User,
        mealPlanModel = MealPlan,
        logger = console,
        enabled,
    } = {}) {
        this.UserModel = userModel;
        this.MealPlanModel = mealPlanModel;
        this.enabled = enabled ?? parseBoolean(process.env.ONBOARDING_AI_MENU_PLANNER_ENABLED, true);
        this.logger = logger;
        this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:5002';
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
        return ['menu_plan_save'];
    }

    buildSystemPrompt({ requestId, user }) {
        const p = user?.profile || {};
        const prefs = p.menu_ai_preferences || {};
        return [
            'You are the onboarding meal planning agent.',
            'The user profile is provided below — do NOT call any profile tool.',
            `Goal: ${p.goal || 'not specified'}`,
            `Daily calories target: ${p.target_calories || p.tdee || 'not specified'} kcal`,
            `Protein: ${p.protein_goal || '?'}g  Carbs: ${p.carbs_goal || '?'}g  Fat: ${p.fat_goal || '?'}g`,
            `Diet type: ${p.diet_type || 'everything'}`,
            `Allergies: ${p.allergies || 'none'}`,
            `User's preferred meal frequency (hint only): ${p.meal_frequency || 'not specified'}`,
            `Activity level: ${p.activity_level || 'not specified'}`,
            `Foods they love: ${prefs.likes || 'not specified'}`,
            `Foods they dislike: ${prefs.dislikes || 'none'}`,
            '',
            'First, decide the optimal number of meals per day for this user based on their goal, activity level, calorie target, and diet type (typically 3–6). You may use the preferred meal frequency as a hint but override it if their profile warrants it.',
            'Create a daily meal plan (one typical day) using the number of meals you determined.',
            'For EACH meal slot (breakfast, lunch, etc.) generate EXACTLY 4 different dish options so the user can pick their favourite.',
            'Each option is a separate entry in the meals array with the same meal_type but a different meal_name and foods.',
            'All 4 options for the same slot should have similar calories so any choice hits the daily targets.',
            'For each meal entry include: meal_name, meal_type (breakfast/morning_snack/lunch/afternoon_snack/dinner/evening_snack/post_workout/other), foods (array with name, portion, calories, protein, carbs, fat), and meal-level macro totals.',
            'Macro totals across one representative option per slot should sum close to the daily targets above.',
            'Call menu_plan_save exactly once with the complete meals array (all options for all slots).',
            `Use idempotencyKey: "onboarding-${requestId || 'request'}-menu"`,
            'After saving, provide a short summary of the plan.',
        ].join('\n');
    }

    async generatePlan({ userId, requestId, trigger, user }) {
        const token = mintServiceToken(userId);

        const { data: result } = await axios.post(
            `${this.aiServiceUrl}/ai/chat/response`,
            {
                agentType: 'nutritionist',
                personaId: 'nutritionist',
                system: this.buildSystemPrompt({ requestId, user }),
                messages: [{
                    role: 'user',
                    content: 'Create my personalized daily meal plan now.',
                }],
                context: {
                    workflow: 'onboarding_menu_planner',
                    trigger: trigger || 'unknown',
                },
                metadata: {
                    requestId,
                    workflow: 'onboarding_menu_planner',
                },
                options: { temperature: 0.2 },
                persistSummary: false,
                memoryLimit: 0,
                enableTools: true,
                toolAllowlist: this.getToolAllowlist(),
            },
            {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 120000,
            }
        );

        const savedCount = Array.isArray(result.toolTrace)
            ? result.toolTrace.filter(
                (item) => item?.ok && item?.toolName === 'menu_plan_save'
            ).length
            : 0;

        if (savedCount < 1) {
            throw new Error('Menu planner did not save a plan.');
        }

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
            const result = await this.generatePlan({
                userId: String(user._id),
                requestId,
                trigger,
                user,
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
            });

            return {
                triggered: true,
                status: 'ready',
                savedCount: result.savedCount,
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
