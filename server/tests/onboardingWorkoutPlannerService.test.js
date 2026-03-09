const test = require('node:test');
const assert = require('node:assert/strict');

const OnboardingWorkoutPlannerService = require('../services/onboardingWorkoutPlannerService');

function createUserDoc(profile = {}) {
    return {
        _id: 'u1',
        profile: { ...profile },
        async save() {
            return this;
        },
    };
}

test('OnboardingWorkoutPlannerService ensures plan and marks profile ready', async () => {
    const userDoc = createUserDoc({
        onboarding_completed: true,
        plan_choice: 'ai',
        has_existing_plan: false,
    });

    const service = new OnboardingWorkoutPlannerService({
        enabled: true,
        userModel: {
            async findById() {
                return userDoc;
            },
        },
        workoutModel: {
            async countDocuments() {
                return 5;
            },
        },
        chatBrainService: {
            async generateResponse() {
                return {
                    response: 'Created plan.',
                    toolTrace: [
                        { ok: true, toolName: 'workouts_create_workout' },
                        { ok: true, toolName: 'workouts_create_workout' },
                    ],
                };
            },
        },
        logger: {
            info() {},
            error() {},
        },
    });

    const outcome = await service.ensurePlanForUser({
        userId: 'u1',
        requestId: 'req-1',
        trigger: 'test',
    });

    assert.equal(outcome.status, 'ready');
    assert.equal(outcome.createdCount, 2);
    assert.equal(userDoc.profile.has_existing_plan, true);
    assert.equal(userDoc.profile.workout_plan_status, 'ready');
});

test('OnboardingWorkoutPlannerService marks profile failed when planner returns no created workouts', async () => {
    const userDoc = createUserDoc({
        onboarding_completed: true,
        plan_choice: 'ai',
        has_existing_plan: false,
    });

    const service = new OnboardingWorkoutPlannerService({
        enabled: true,
        userModel: {
            async findById() {
                return userDoc;
            },
        },
        workoutModel: {
            async countDocuments() {
                return 0;
            },
        },
        chatBrainService: {
            async generateResponse() {
                return {
                    response: 'No tools used.',
                    toolTrace: [],
                };
            },
        },
        logger: {
            info() {},
            error() {},
        },
    });

    const outcome = await service.ensurePlanForUser({
        userId: 'u1',
        requestId: 'req-2',
        trigger: 'test',
    });

    assert.equal(outcome.status, 'failed');
    assert.equal(userDoc.profile.has_existing_plan, false);
    assert.equal(userDoc.profile.workout_plan_status, 'failed');
});

test('OnboardingWorkoutPlannerService keeps plan pending and schedules retry on rate limit', async () => {
    const userDoc = createUserDoc({
        onboarding_completed: true,
        plan_choice: 'ai',
        has_existing_plan: false,
    });

    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;

    try {
        global.setTimeout = () => ({ fake: true });
        global.clearTimeout = () => {};

        const service = new OnboardingWorkoutPlannerService({
            enabled: true,
            userModel: {
                async findById() {
                    return userDoc;
                },
            },
            workoutModel: {
                async countDocuments() {
                    return 0;
                },
            },
            chatBrainService: {
                async generateResponse() {
                    const error = new Error('429 status code (no body)');
                    error.status = 429;
                    throw error;
                },
            },
            logger: {
                info() {},
                warn() {},
                error() {},
            },
        });

        const outcome = await service.ensurePlanForUser({
            userId: 'u1',
            requestId: 'req-3',
            trigger: 'test',
        });

        assert.equal(outcome.status, 'pending');
        assert.equal(outcome.retryable, true);
        assert.equal(outcome.retryScheduled, true);
        assert.equal(userDoc.profile.workout_plan_status, 'pending');
        assert.match(userDoc.profile.workout_plan_error, /Retrying automatically/);
    } finally {
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
    }
});
