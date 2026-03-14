const BaseLLMRequest = require('./requests/baseLLMRequest');

class ExerciseMatcherService extends BaseLLMRequest {
    constructor({ logger = console } = {}) {
        super({
            agentType: 'coach',
            personaId: 'scientist_coach',
            temperature: 0,
            maxToolCalls: 2,
            maxToolIterations: 2,
            retryAttempts: 1,
            maxSystemChars: 20000,
            logger,
        });
    }

    getToolAllowlist() {
        return ['workouts_submit_corrected_plan'];
    }

    buildSystemPrompt({ draftSequence, exercises }) {
        const exerciseList = exercises
            .map((ex) => `  ${ex.name} (${ex.muscle_group})`)
            .join('\n');

        return [
            'You are an exercise name resolver.',
            'You will receive a draft workout plan with exercise names that may not exactly match the database.',
            '',
            'YOUR TASK:',
            'Replace each exercise name in the draft with the best matching name from AVAILABLE EXERCISES.',
            'Rules:',
            '  - Preserve the overall intent (e.g. "Squat" → closest squat variation appropriate for the user context)',
            '  - Keep all other fields (sets, reps, rest_seconds, notes) exactly as-is',
            '  - Keep the sequence structure (workout/rest steps) exactly as-is',
            '  - Every exercise name in your output must be an exact string from the AVAILABLE EXERCISES list',
            '',
            'DRAFT PLAN:',
            JSON.stringify(draftSequence, null, 2),
            '',
            'AVAILABLE EXERCISES:',
            exerciseList,
            '',
            'Call workouts_submit_corrected_plan with the corrected sequence.',
        ].join('\n');
    }

    buildUserPrompt() {
        return 'Resolve the exercise names and submit the corrected plan.';
    }

    validateResult(result) {
        const submitted = Array.isArray(result.toolTrace)
            && result.toolTrace.some(
                (item) => item?.ok && item?.toolName === 'workouts_submit_corrected_plan'
            );
        if (!submitted) {
            throw new Error('Exercise matcher did not submit a corrected plan.');
        }
    }

    async matchExercises({ userId, requestId, draftSequence, exercises }) {
        const result = await this.execute({ userId, requestId, draftSequence, exercises });
        const submitResult = result.toolTrace.find(
            (item) => item?.ok && item?.toolName === 'workouts_submit_corrected_plan'
        );
        return {
            sequence: submitResult.result.data.sequence,
            weeks: submitResult.result.data.weeks,
        };
    }
}

module.exports = ExerciseMatcherService;
