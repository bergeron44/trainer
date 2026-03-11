const ChatBrainService = require('./chatBrainService');
const User = require('../models/User');
const Workout = require('../models/Workout');
const { OnboardingWorkoutPlannerRequest } = require('./requests');

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
        this.plannerRequest = new OnboardingWorkoutPlannerRequest({
            chatBrainService: this.chatBrainService,
            maxOutputTokens: this.maxOutputTokens,
            logger: this.logger,
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

    async generatePlan({ userId, requestId, trigger }) {
        return this.plannerRequest.execute({ userId, requestId, trigger });
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
                    workout_plan_status: retryScheduled ? 'pending' : 'failed',
                    workout_plan_error: retryScheduled
                        ? `Planner rate-limited (429). Retrying automatically (${nextAttempt}/${this.maxRateLimitRetries}).`
                        : 'Planner rate-limited (429). Max retries exceeded.',
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
