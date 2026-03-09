const ChatBrainService = require('./chatBrainService');
const User = require('../models/User');
const Workout = require('../models/Workout');

const DEFAULT_MAX_TOOL_CALLS = 30;
const DEFAULT_MAX_TOOL_ITERATIONS = 8;
const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_MAX_OUTPUT_TOKENS = 1800;
const DEFAULT_RATE_LIMIT_RETRY_DELAY_MS = 15000;
const DEFAULT_RATE_LIMIT_MAX_RETRIES = 2;

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

function isRateLimitError(error) {
    if (Number(error?.status) === 429) return true;
    const message = String(error?.message || '').toLowerCase();
    return (
        message.includes('429')
        || message.includes('rate limit')
        || message.includes('too many requests')
    );
}

class OnboardingWorkoutPlannerService {
    constructor({
        chatBrainService,
        userModel = User,
        workoutModel = Workout,
        logger = console,
        enabled,
    } = {}) {
        this.logger = logger;
        this.UserModel = userModel;
        this.WorkoutModel = workoutModel;
        this.enabled = enabled ?? parseBoolean(process.env.ONBOARDING_AI_PLANNER_ENABLED, true);
        this.inFlightByUser = new Map();
        this.retryTimersByUser = new Map();
        this.maxOutputTokens = parseIntOrFallback(
            process.env.ONBOARDING_AI_PLANNER_MAX_OUTPUT_TOKENS,
            DEFAULT_MAX_OUTPUT_TOKENS
        );
        this.rateLimitRetryDelayMs = parseIntOrFallback(
            process.env.ONBOARDING_AI_PLANNER_RATE_LIMIT_RETRY_DELAY_MS,
            DEFAULT_RATE_LIMIT_RETRY_DELAY_MS
        );
        this.maxRateLimitRetries = parseIntOrFallback(
            process.env.ONBOARDING_AI_PLANNER_RATE_LIMIT_MAX_RETRIES,
            DEFAULT_RATE_LIMIT_MAX_RETRIES
        );
        this.chatBrainService = chatBrainService || new ChatBrainService({
            config: {
                maxToolCallsPerResponse: parseIntOrFallback(
                    process.env.ONBOARDING_AI_PLANNER_MAX_TOOL_CALLS,
                    DEFAULT_MAX_TOOL_CALLS
                ),
                maxToolIterations: parseIntOrFallback(
                    process.env.ONBOARDING_AI_PLANNER_MAX_ITERATIONS,
                    DEFAULT_MAX_TOOL_ITERATIONS
                ),
                retryAttempts: parseIntOrFallback(
                    process.env.ONBOARDING_AI_PLANNER_RETRY_ATTEMPTS,
                    DEFAULT_RETRY_ATTEMPTS
                ),
            },
        });
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

    clearScheduledRetry(userId) {
        const userKey = String(userId || '').trim();
        const timer = this.retryTimersByUser.get(userKey);
        if (timer) {
            clearTimeout(timer);
            this.retryTimersByUser.delete(userKey);
        }
    }

    scheduleRateLimitRetry({ userId, requestId, trigger, attempt }) {
        const userKey = String(userId || '').trim();
        if (!userKey) return false;
        if (attempt > this.maxRateLimitRetries) return false;
        if (this.retryTimersByUser.has(userKey)) return true;

        const delayMs = this.rateLimitRetryDelayMs * attempt;
        const timer = setTimeout(async () => {
            this.retryTimersByUser.delete(userKey);
            try {
                await this.ensurePlanForUser({
                    userId: userKey,
                    requestId,
                    trigger: `${trigger || 'onboarding'}_rate_limit_retry_${attempt}`,
                    force: true,
                    rateLimitAttempt: attempt,
                });
            } catch (error) {
                this.logger.error?.('onboarding.plan.retry_unhandled', {
                    requestId,
                    userId: userKey,
                    trigger,
                    attempt,
                    error: sanitizeErrorMessage(error),
                });
            }
        }, delayMs);

        this.retryTimersByUser.set(userKey, timer);
        this.logger.info?.('onboarding.plan.retry_scheduled', {
            requestId,
            userId: userKey,
            trigger,
            attempt,
            delayMs,
        });
        return true;
    }

    getPlannerToolAllowlist() {
        return [
            'user_get_profile',
            'workouts_get_user_workouts',
            'workouts_get_workout_types',
            'workouts_get_workout_by_type',
            'workouts_create_workout',
            'workouts_edit_workout',
        ];
    }

    getPlannerWriteFocusedAllowlist() {
        return [
            'user_get_profile',
            'workouts_create_workout',
            'workouts_edit_workout',
        ];
    }

    buildPlannerSystemPrompt({ requestId }) {
        return [
            'You are the onboarding workout planning agent.',
            'You must call user_get_profile first before creating workouts.',
            'You may only use tools made available to you.',
            'Create a personalized starter plan for the next 14 days based on the user profile.',
            'Respect injuries, environment, experience level, session duration, and weekly frequency.',
            'Do not exceed workout_days_per_week from profile.',
            'Minimum success criteria: create at least one workout via workouts_create_workout.',
            'Every workouts_create_workout call must include idempotencyKey in this format:',
            `"onboarding-${requestId || 'request'}-workout-<index>"`,
            'Avoid duplicate workouts for the same date/type in this planning run.',
            'After tool calls complete, provide a short summary of what was created.',
        ].join('\n');
    }

    async generatePlan({ userId, requestId, trigger }) {
        const firstPassResult = await this.chatBrainService.generateResponse({
            userId,
            agentType: 'coach',
            personaId: 'scientist_coach',
            system: this.buildPlannerSystemPrompt({ requestId }),
            messages: [{
                role: 'user',
                content: 'Create my personalized onboarding workout plan now.',
            }],
            context: {
                workflow: 'onboarding_workout_planner',
                trigger: trigger || 'unknown',
            },
            metadata: {
                requestId,
                workflow: 'onboarding_workout_planner',
                planner_pass: 'first',
            },
            options: {
                temperature: 0.2,
                maxTokens: this.maxOutputTokens,
            },
            persistSummary: false,
            memoryLimit: 0,
            enableTools: true,
            toolAllowlist: this.getPlannerToolAllowlist(),
        });

        let mergedToolTrace = Array.isArray(firstPassResult.toolTrace) ? [...firstPassResult.toolTrace] : [];
        let result = firstPassResult;

        let createdCount = mergedToolTrace.filter(
            (item) => item?.ok && item?.toolName === 'workouts_create_workout'
        ).length;

        if (createdCount < 1) {
            const secondPassResult = await this.chatBrainService.generateResponse({
                userId,
                agentType: 'coach',
                personaId: 'scientist_coach',
                system: [
                    this.buildPlannerSystemPrompt({ requestId }),
                    'Previous pass failed to create workouts.',
                    'Now create at least one workout immediately via workouts_create_workout.',
                    'Do not end this pass without at least one successful workouts_create_workout call.',
                ].join('\n'),
                messages: [{
                    role: 'user',
                    content: 'Retry now. Create workouts with valid tool arguments.',
                }],
                context: {
                    workflow: 'onboarding_workout_planner',
                    trigger: trigger || 'unknown',
                },
                metadata: {
                    requestId,
                    workflow: 'onboarding_workout_planner',
                    planner_pass: 'retry_write_focused',
                },
                options: {
                    temperature: 0.1,
                    maxTokens: this.maxOutputTokens,
                },
                persistSummary: false,
                memoryLimit: 0,
                enableTools: true,
                toolAllowlist: this.getPlannerWriteFocusedAllowlist(),
            });

            mergedToolTrace = [
                ...mergedToolTrace,
                ...(Array.isArray(secondPassResult.toolTrace) ? secondPassResult.toolTrace : []),
            ];
            result = secondPassResult;
            createdCount = mergedToolTrace.filter(
                (item) => item?.ok && item?.toolName === 'workouts_create_workout'
            ).length;
        }

        if (createdCount < 1) {
            const createAttempts = mergedToolTrace.filter(
                (item) => item?.toolName === 'workouts_create_workout'
            );
            const failedCreateAttempts = createAttempts
                .filter((item) => !item?.ok)
                .map((item) => String(item?.error?.message || item?.error || 'unknown_error'))
                .slice(0, 3)
                .join(' | ');
            throw new Error(
                `Planner did not create workouts. provider=${result.provider || 'unknown'} `
                + `model=${result.model || 'unknown'} totalToolCalls=${mergedToolTrace.length} `
                + `createAttempts=${createAttempts.length} failedCreateAttempts=${failedCreateAttempts || 'none'}`
            );
        }

        return {
            ...result,
            toolTrace: mergedToolTrace,
            createdCount,
        };
    }

    async ensurePlanForUser(params = {}) {
        const userKey = String(params.userId || '').trim();
        if (!userKey) {
            return this.ensurePlanForUserInternal(params);
        }

        if (this.inFlightByUser.has(userKey)) {
            return this.inFlightByUser.get(userKey);
        }

        const promise = this.ensurePlanForUserInternal(params)
            .finally(() => {
                this.inFlightByUser.delete(userKey);
            });

        this.inFlightByUser.set(userKey, promise);
        return promise;
    }

    async ensurePlanForUserInternal({
        userId,
        requestId,
        trigger = 'onboarding',
        force = false,
        rateLimitAttempt = 0,
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
            this.clearScheduledRetry(user._id);

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
            if (isRateLimitError(error)) {
                const nextAttempt = rateLimitAttempt + 1;
                const retryScheduled = this.scheduleRateLimitRetry({
                    userId: user._id,
                    requestId,
                    trigger,
                    attempt: nextAttempt,
                });
                user.profile = {
                    ...(user.profile || {}),
                    has_existing_plan: false,
                    workout_plan_status: 'pending',
                    workout_plan_error: retryScheduled
                        ? `Planner rate-limited (429). Retrying automatically (${nextAttempt}/${this.maxRateLimitRetries}).`
                        : 'Planner rate-limited (429). Retry shortly.',
                    workout_plan_source: 'agent',
                };
                await user.save();

                this.logger.warn?.('onboarding.plan.rate_limited', {
                    requestId,
                    userId: String(user._id),
                    trigger,
                    error: errorMessage,
                    retryScheduled,
                    nextAttempt: retryScheduled ? nextAttempt : null,
                });

                return {
                    triggered: true,
                    status: 'pending',
                    error: errorMessage,
                    retryable: true,
                    retryScheduled,
                };
            }

            this.clearScheduledRetry(user._id);
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
