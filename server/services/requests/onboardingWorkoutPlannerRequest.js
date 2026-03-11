const BaseRequest = require('./baseRequest');

class OnboardingWorkoutPlannerRequest extends BaseRequest {
    constructor({ chatBrainService, maxOutputTokens, logger } = {}) {
        super({ type: 'onboarding_workout_planner', chatBrainService, logger });
        this._maxOutputTokens = maxOutputTokens || 1800;
    }

    buildSystemPrompt({ requestId } = {}) {
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

    _buildRetrySystemPrompt({ requestId } = {}) {
        return [
            this.buildSystemPrompt({ requestId }),
            'Previous pass failed to create workouts.',
            'Now create at least one workout immediately via workouts_create_workout.',
            'Do not end this pass without at least one successful workouts_create_workout call.',
        ].join('\n');
    }

    getOptions() {
        return { temperature: 0.2, maxTokens: this._maxOutputTokens };
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

    _countCreated(toolTrace) {
        return (toolTrace || []).filter(
            (item) => item?.ok && item?.toolName === 'workouts_create_workout'
        ).length;
    }

    async execute({ userId, requestId, trigger } = {}) {
        if (!this._chatBrainService) {
            throw new Error('OnboardingWorkoutPlannerRequest: chatBrainService is required.');
        }

        const sharedBrainOptions = {
            agentType: 'coach',
            personaId: 'scientist_coach',
            context: { workflow: 'onboarding_workout_planner', trigger: trigger || 'unknown' },
            persistSummary: false,
            memoryLimit: 0,
        };

        // Pass 1: full tool allowlist
        const firstPassResult = await this._chatBrainService.generateResponse({
            userId,
            system: this.buildSystemPrompt({ requestId }),
            messages: [{ role: 'user', content: 'Create my personalized onboarding workout plan now.' }],
            options: this.getOptions(),
            enableTools: true,
            toolAllowlist: this.getPlannerToolAllowlist(),
            metadata: { requestId, workflow: 'onboarding_workout_planner', planner_pass: 'first' },
            ...sharedBrainOptions,
        });

        let mergedToolTrace = Array.isArray(firstPassResult.toolTrace) ? [...firstPassResult.toolTrace] : [];
        let result = firstPassResult;
        let createdCount = this._countCreated(mergedToolTrace);

        // Pass 2: write-focused retry if no workouts created
        if (createdCount < 1) {
            const secondPassResult = await this._chatBrainService.generateResponse({
                userId,
                system: this._buildRetrySystemPrompt({ requestId }),
                messages: [{ role: 'user', content: 'Retry now. Create workouts with valid tool arguments.' }],
                options: { temperature: 0.1, maxTokens: this._maxOutputTokens },
                enableTools: true,
                toolAllowlist: this.getPlannerWriteFocusedAllowlist(),
                metadata: { requestId, workflow: 'onboarding_workout_planner', planner_pass: 'retry_write_focused' },
                ...sharedBrainOptions,
            });

            mergedToolTrace = [
                ...mergedToolTrace,
                ...(Array.isArray(secondPassResult.toolTrace) ? secondPassResult.toolTrace : []),
            ];
            result = secondPassResult;
            createdCount = this._countCreated(mergedToolTrace);
        }

        if (createdCount < 1) {
            const createAttempts = mergedToolTrace.filter((item) => item?.toolName === 'workouts_create_workout');
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

        return { ...result, toolTrace: mergedToolTrace, createdCount };
    }
}

module.exports = OnboardingWorkoutPlannerRequest;
