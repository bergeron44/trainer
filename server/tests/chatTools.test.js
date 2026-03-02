const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');

const {
    createDefaultToolRegistry,
    ToolRegistry,
    ToolExecutor,
} = require('../ai/tools');

function createChainResult(items) {
    return {
        sort() {
            return this;
        },
        limit() {
            return Promise.resolve(items);
        },
    };
}

test('createDefaultToolRegistry registers MVP + additional tools', () => {
    const registry = createDefaultToolRegistry({
        models: {
            Workout: {},
            WorkoutLog: {},
            Exercise: {},
            User: {},
            NutritionLog: {},
        },
    });

    const names = registry.list().map((tool) => tool.name).sort();
    assert.deepEqual(names, [
        'meals_create_meal',
        'meals_delete_meal',
        'meals_edit_meal',
        'meals_get_user_meals',
        'nutrition_edit_user_data',
        'nutrition_get_user_data',
        'nutrition_log_intake',
        'nutrition_set_daily_targets',
        'user_edit_profile',
        'user_get_profile',
        'workouts_create_workout',
        'workouts_edit_workout',
        'workouts_get_user_workouts',
        'workouts_get_workout_by_type',
        'workouts_get_workout_types',
        'workouts_log_session_result',
        'workouts_swap_exercise',
    ]);
});

test('ToolExecutor runs workouts_get_workout_types and returns normalized envelope', async () => {
    const registry = createDefaultToolRegistry({
        models: {
            Workout: {
                aggregate: async () => ([
                    { type: 'A', count: 4 },
                    { type: 'full-body', count: 2 },
                ]),
            },
            WorkoutLog: {},
            Exercise: {},
            User: {},
            NutritionLog: {},
        },
    });

    const audits = [];
    const executor = new ToolExecutor({
        registry,
        toolExecutionAuditModel: {
            async create(payload) {
                audits.push(payload);
            },
        },
    });

    const result = await executor.executeToolCall({
        toolCall: {
            id: 'tc-1',
            name: 'workouts_get_workout_types',
            arguments: {},
        },
        context: {
            userId: '507f191e810c19729de860ea',
            requestId: 'req-123',
        },
    });

    assert.equal(result.ok, true);
    assert.equal(result.toolName, 'workouts_get_workout_types');
    assert.equal(result.requestId, 'req-123');
    assert.equal(result.data.count, 2);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].status, 'success');
});

test('ToolExecutor replays idempotent writes using idempotency records', async () => {
    const storage = new Map();
    let handlerInvocations = 0;

    const registry = new ToolRegistry();
    registry.register({
        name: 'fake_write_tool',
        description: 'Fake write tool for idempotency test.',
        readWriteMode: 'write',
        idempotent: true,
        timeoutMs: 2000,
        inputSchema: z.object({
            idempotencyKey: z.string().min(1),
            value: z.string().min(1),
        }).strict(),
        jsonSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['idempotencyKey', 'value'],
            properties: {
                idempotencyKey: { type: 'string' },
                value: { type: 'string' },
            },
        },
        async handler({ args }) {
            handlerInvocations += 1;
            return {
                changedFields: ['value'],
                data: { stored: args.value },
            };
        },
    });

    const executor = new ToolExecutor({
        registry,
        toolIdempotencyRecordModel: {
            async findOne(query) {
                const key = `${query.user}:${query.tool_name}:${query.key}`;
                return storage.get(key) || null;
            },
            async create(payload) {
                const key = `${payload.user}:${payload.tool_name}:${payload.key}`;
                storage.set(key, { result: payload.result });
            },
        },
        toolExecutionAuditModel: {
            async create() {
                return null;
            },
        },
    });

    const first = await executor.executeToolCall({
        toolCall: {
            id: 'c1',
            name: 'fake_write_tool',
            arguments: { idempotencyKey: 'k1', value: 'abc' },
        },
        context: { userId: 'u1', requestId: 'r1' },
    });

    const second = await executor.executeToolCall({
        toolCall: {
            id: 'c2',
            name: 'fake_write_tool',
            arguments: { idempotencyKey: 'k1', value: 'abc' },
        },
        context: { userId: 'u1', requestId: 'r2' },
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(handlerInvocations, 1);
    assert.deepEqual(second.data, first.data);
});

test('workouts_get_workout_by_type filters by user + type and returns items', async () => {
    let capturedQuery;

    const registry = createDefaultToolRegistry({
        models: {
            Workout: {
                find(query) {
                    capturedQuery = query;
                    return createChainResult([
                        {
                            _id: 'w1',
                            date: new Date('2026-02-10T00:00:00.000Z'),
                            muscle_group: 'A',
                            exercises: [],
                            status: 'planned',
                            createdAt: new Date('2026-02-01T00:00:00.000Z'),
                            updatedAt: new Date('2026-02-01T00:00:00.000Z'),
                            toObject() {
                                return this;
                            },
                        },
                    ]);
                },
            },
            WorkoutLog: {},
            Exercise: {},
            User: {},
            NutritionLog: {},
        },
    });

    const executor = new ToolExecutor({
        registry,
    });

    const result = await executor.executeToolCall({
        toolCall: {
            name: 'workouts_get_workout_by_type',
            arguments: { type: 'A', limit: 10 },
        },
        context: { userId: 'u1', requestId: 'r1' },
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.count, 1);
    assert.equal(capturedQuery.user, 'u1');
    assert.equal(capturedQuery.muscle_group.$options, 'i');
});

test('workouts_log_session_result writes set logs for owned workout', async () => {
    const insertedDocs = [];
    const registry = createDefaultToolRegistry({
        models: {
            Workout: {
                findOne() {
                    return {
                        lean() {
                            return Promise.resolve({ _id: 'w1', user: 'u1' });
                        },
                    };
                },
            },
            WorkoutLog: {
                async insertMany(docs) {
                    insertedDocs.push(...docs.map((doc, idx) => ({
                        _id: `l${idx + 1}`,
                        ...doc,
                        createdAt: new Date(),
                    })));
                    return insertedDocs;
                },
            },
            Exercise: {},
            User: {},
            NutritionLog: {},
        },
    });

    const executor = new ToolExecutor({ registry });
    const result = await executor.executeToolCall({
        toolCall: {
            name: 'workouts_log_session_result',
            arguments: {
                workoutId: 'w1',
                idempotencyKey: 'log-1',
                entries: [{
                    exercise_name: 'Back Squat',
                    set_number: 1,
                    reps_completed: 5,
                    weight_used: 100,
                    rpe: 8.5,
                }],
            },
        },
        context: { userId: 'u1', requestId: 'r1' },
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.count, 1);
    assert.equal(insertedDocs.length, 1);
    assert.equal(insertedDocs[0].user, 'u1');
});

test('workouts_create_workout persists a new workout for the authenticated user', async () => {
    let createdPayload;
    const createdDoc = {
        _id: 'w-new',
        date: new Date('2026-03-03T00:00:00.000Z'),
        muscle_group: 'Full Body',
        exercises: [{ name: 'Goblet Squat', sets: 3, reps: '10' }],
        status: 'planned',
        archived: false,
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
        toObject() {
            return this;
        },
    };

    const registry = createDefaultToolRegistry({
        models: {
            Workout: {
                async create(payload) {
                    createdPayload = payload;
                    return {
                        ...createdDoc,
                        ...payload,
                    };
                },
            },
            WorkoutLog: {},
            Exercise: {},
            User: {},
            NutritionLog: {},
        },
    });

    const executor = new ToolExecutor({ registry });
    const result = await executor.executeToolCall({
        toolCall: {
            name: 'workouts_create_workout',
            arguments: {
                date: '2026-03-03T00:00:00.000Z',
                muscle_group: 'Full Body',
                exercises: [{ name: 'Goblet Squat', sets: 3, reps: '10' }],
                idempotencyKey: 'create-1',
            },
        },
        context: { userId: 'u1', requestId: 'r-create' },
    });

    assert.equal(result.ok, true);
    assert.equal(createdPayload.user, 'u1');
    assert.equal(createdPayload.muscle_group, 'Full Body');
    assert.equal(result.data.created.muscle_group, 'Full Body');
});

test('nutrition_set_daily_targets updates allowlisted macro fields', async () => {
    const saved = { count: 0 };
    const userDoc = {
        profile: { target_calories: 2000 },
        async save() {
            saved.count += 1;
            return this;
        },
    };

    const registry = createDefaultToolRegistry({
        models: {
            Workout: {},
            WorkoutLog: {},
            Exercise: {},
            User: {
                async findById() {
                    return userDoc;
                },
            },
            NutritionLog: {},
        },
    });

    const executor = new ToolExecutor({ registry });
    const result = await executor.executeToolCall({
        toolCall: {
            name: 'nutrition_set_daily_targets',
            arguments: {
                target_calories: 2300,
                protein_goal: 170,
                idempotencyKey: 'tgt-1',
            },
        },
        context: { userId: 'u1', requestId: 'r2' },
    });

    assert.equal(result.ok, true);
    assert.equal(saved.count, 1);
    assert.equal(userDoc.profile.target_calories, 2300);
    assert.equal(userDoc.profile.protein_goal, 170);
});

test('meals_delete_meal archives meal by default', async () => {
    const meal = {
        archived: false,
        async save() {
            return this;
        },
    };

    const registry = createDefaultToolRegistry({
        models: {
            Workout: {},
            WorkoutLog: {},
            Exercise: {},
            User: {},
            NutritionLog: {
                async findOne() {
                    return meal;
                },
                async deleteOne() {
                    throw new Error('deleteOne should not be called for soft delete');
                },
            },
        },
    });

    const executor = new ToolExecutor({ registry });
    const result = await executor.executeToolCall({
        toolCall: {
            name: 'meals_delete_meal',
            arguments: {
                mealId: 'm1',
                idempotencyKey: 'del-1',
            },
        },
        context: { userId: 'u1', requestId: 'r3' },
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.archived, true);
    assert.equal(meal.archived, true);
});
