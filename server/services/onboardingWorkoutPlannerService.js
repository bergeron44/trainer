const BaseLLMRequest = require('./requests/baseLLMRequest');
const User = require('../models/User');
const Workout = require('../models/Workout');
const Exercise = require('../models/Exercise');

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
            maxSystemChars: 24000,
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
            'workouts_set_sequence',
        ];
    }

    buildSystemPrompt({ requestId, profile = {}, exercises = [] }) {
        const exerciseList = exercises.length > 0
            ? exercises.map((ex) => `  ${ex.name} (${ex.muscle_group})`).join('\n')
            : '  (no exercises available)';

        return [
            'You are the onboarding workout planning agent.',
            'You may only use tools made available to you.',
            '',
            'YOUR TASK: Create a personalized repeating workout cycle for this user.',
            '',
            'Call workouts_set_sequence with a cycle of workout and rest steps.',
            'The sequence is a repeating cycle (1–14 days). It will auto-generate 12 weeks of workouts.',
            '  - Workout steps: { type: "workout", name: string, exercises: [...] }',
            '  - Rest steps:    { type: "rest" }',
            'Design the cycle so workout days per week matches workout_days_per_week from the profile.',
            'For example, for 3 days/week use a 7-day cycle: [workout, rest, workout, rest, workout, rest, rest].',
            'Respect injuries, equipment, environment, experience level, and session duration.',
            '',
            'AVAILABLE EXERCISES (you must only use names from this list exactly as written):',
            exerciseList,
            '',
            'USER PROFILE:',
            JSON.stringify(profile, null, 2),
            '',
            `workouts_set_sequence must include idempotencyKey: "onboarding-${requestId || 'request'}-sequence"`,
            'If the tool returns validated: false, replace only the listed names with exact names from AVAILABLE EXERCISES and retry.',
            'After the sequence is saved successfully, provide a short plain-language summary of the plan.',
        ].join('\n');
    }

    buildUserPrompt() {
        return 'Create my personalized onboarding workout plan now.';
    }

    validateResult(result) {
        const saved = Array.isArray(result.toolTrace)
            && result.toolTrace.some(
                (item) => item?.ok
                    && item?.toolName === 'workouts_set_sequence'
                    && item?.result?.data?.validated !== false
            );
        if (!saved) {
            throw new Error('Planner did not save a valid workout sequence.');
        }
    }

    getContext({ trigger }) {
        return {
            workflow: 'onboarding_workout_planner',
            trigger: trigger || 'unknown',
        };
    }

    async generatePlan({ userId, requestId, trigger, profile }) {
        const exercises = await Exercise.find({})
            .select('name muscle_group')
            .sort({ muscle_group: 1, name: 1 })
            .lean();
        const result = await this.execute({ userId, requestId, trigger, profile, exercises });
        const sequenceResult = result.toolTrace.find(
            (item) => item?.ok
                && item?.toolName === 'workouts_set_sequence'
                && item?.result?.data?.validated !== false
        );
        const createdCount = sequenceResult?.result?.data?.count ?? 0;
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
