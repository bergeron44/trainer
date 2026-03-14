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

test('OnboardingWorkoutPlannerService exposes optional web search to the coach planner', async () => {
    let capturedInput;

    const service = new OnboardingWorkoutPlannerService({
        enabled: true,
        userModel: {
            async findById() {
                return createUserDoc({
                    onboarding_completed: true,
                    plan_choice: 'ai',
                    has_existing_plan: false,
                    workout_days_per_week: 4,
                });
            },
        },
        workoutModel: {
            async countDocuments() {
                return 1;
            },
        },
        chatBrainService: {
            async generateResponse(input) {
                capturedInput = input;
                return {
                    response: 'Created plan.',
                    toolTrace: [
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

    await service.ensurePlanForUser({
        userId: 'u1',
        requestId: 'req-3',
        trigger: 'test',
    });

    assert.deepEqual(capturedInput.toolAllowlist, [
        'workouts_get_user_workouts',
        'workouts_get_workout_types',
        'workouts_get_workout_by_type',
        'workouts_create_workout',
        'workouts_edit_workout',
        'nutrition_web_search',
    ]);
    assert.match(capturedInput.system, /nutrition_web_search/i);
    assert.match(capturedInput.system, /Do not use nutrition_web_search by default/i);
});
