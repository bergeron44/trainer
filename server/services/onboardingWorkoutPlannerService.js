const BaseLLMRequest = require('./requests/baseLLMRequest');
const User = require('../models/User');
const Workout = require('../models/Workout');

const DEFAULT_MAX_TOOL_CALLS = 30;
const DEFAULT_MAX_TOOL_ITERATIONS = 8;
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
    const message = String(error?.message || 'Planner failed.');
    return message.length > 400 ? `${message.slice(0, 397)}...` : message;
}

class OnboardingWorkoutPlannerService extends BaseLLMRequest {
    constructor({
        chatBrainService,
        userModel = User,
        workoutModel = Workout,
        logger = console,
        enabled,
    } = {}) {
        super({
            chatBrainService,
            agentType: 'coach',
            personaId: 'scientist_coach',
            temperature: 0.7,
            maxToolCalls: parseIntOrFallback(process.env.ONBOARDING_AI_PLANNER_MAX_TOOL_CALLS, DEFAULT_MAX_TOOL_CALLS),
            maxToolIterations: parseIntOrFallback(process.env.ONBOARDING_AI_PLANNER_MAX_ITERATIONS, DEFAULT_MAX_TOOL_ITERATIONS),
            retryAttempts: parseIntOrFallback(process.env.ONBOARDING_AI_PLANNER_RETRY_ATTEMPTS, DEFAULT_RETRY_ATTEMPTS),
            maxSystemChars: 12000,
            logger,
        });
        this.UserModel = userModel;
        this.WorkoutModel = workoutModel;
        this.enabled = enabled ?? parseBoolean(process.env.ONBOARDING_AI_PLANNER_ENABLED, true);
    }

    isEnabled() {
        return this.enabled;
    }

    shouldGenerateForProfile(profile = {}) {
        if (!profile || profile.onboarding_completed !== true) return false;
        const planChoice = String(profile.plan_choice || 'ai').trim().toLowerCase();
        if (planChoice !== 'ai') return false;
        if (profile.has_existing_plan === true) return false;
        return true;
    }

    getToolAllowlist() {
        return [
            'workouts_get_user_workouts',
            'workouts_get_workout_types',
            'workouts_get_workout_by_type',
            'workouts_create_workout',
            'workouts_edit_workout',
        ];
    }

    buildSystemPrompt({ requestId, profile = {} }) {
        return [
            'You are the onboarding workout planning agent.',
            'You may only use tools made available to you.',
            'Create a personalized starter plan for the next 14 days based on the user profile below.',
            'Respect injuries, environment, experience level, session duration, and weekly frequency.',
            'Do not exceed workout_days_per_week from profile.',
            '',
            'USER PROFILE:',
            JSON.stringify(profile, null, 2),
            '',
            'Every workouts_create_workout call must include idempotencyKey in this format:',
            `"onboarding-${requestId || 'request'}-workout-<index>"`,
            'Avoid duplicate workouts for the same date/type in this planning run.',
            'After tool calls complete, provide a short summary of what was created.',
        ].join('\n');
    }

    buildUserPrompt() {
        return 'Create my personalized onboarding workout plan now.';
    }

    validateResult(result) {
        const count = Array.isArray(result.toolTrace)
            ? result.toolTrace.filter(
                (item) => item?.ok && item?.toolName === 'workouts_create_workout'
            ).length
            : 0;
        if (count < 1) {
            throw new Error('Planner did not create workouts.');
        }
    }

    getContext({ trigger }) {
        return {
            workflow: 'onboarding_workout_planner',
            trigger: trigger || 'unknown',
        };
    }

    async generatePlan({ userId, requestId, trigger, profile }) {
        const result = await this.execute({ userId, requestId, trigger, profile });
        const createdCount = result.toolTrace.filter(
            (item) => item?.ok && item?.toolName === 'workouts_create_workout'
        ).length;
        return { ...result, createdCount };
    }

    async ensurePlanForUser({
        userId,
        requestId,
        trigger = 'onboarding',
        force = false,
    }) {
        if (!userId) {
            return {
                triggered: false,
                status: 'skipped',
                reason: 'missing_user_id',
            };
        }

        const user = await this.UserModel.findById(userId);
        if (!user) {
            return {
                triggered: false,
                status: 'skipped',
                reason: 'user_not_found',
            };
        }

        const profile = user.profile || {};
        if (!force && !this.shouldGenerateForProfile(profile)) {
            return {
                triggered: false,
                status: 'skipped',
                reason: 'profile_not_eligible',
            };
        }

        if (!this.isEnabled()) {
            return {
                triggered: false,
                status: 'skipped',
                reason: 'planner_disabled',
            };
        }

        user.profile = {
            ...profile,
            workout_plan_status: 'generating',
            workout_plan_error: undefined,
            workout_plan_source: 'agent',
        };
        await user.save();

        try {
            const result = await this.generatePlan({
                userId: String(user._id),
                requestId,
                trigger,
                profile,
            });
            const workoutCount = await this.WorkoutModel.countDocuments({
                user: user._id,
                archived: { $ne: true },
            });

            user.profile = {
                ...(user.profile || {}),
                has_existing_plan: true,
                workout_plan_status: 'ready',
                workout_plan_error: undefined,
                workout_plan_generated_at: new Date(),
                workout_plan_source: 'agent',
            };
            await user.save();

            this.logger.info?.('onboarding.plan.ready', {
                requestId,
                userId: String(user._id),
                trigger,
                createdCount: result.createdCount,
                workoutCount,
            });

            return {
                triggered: true,
                status: 'ready',
                createdCount: result.createdCount,
                workoutCount,
                response: result.response,
            };
        } catch (error) {
            const errorMessage = sanitizeErrorMessage(error);
            user.profile = {
                ...(user.profile || {}),
                has_existing_plan: false,
                workout_plan_status: 'failed',
                workout_plan_error: errorMessage,
                workout_plan_source: 'agent',
            };
            await user.save();

            this.logger.error?.('onboarding.plan.failed', {
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

module.exports = OnboardingWorkoutPlannerService;
