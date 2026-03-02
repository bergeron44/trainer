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

test('createDefaultToolRegistry registers the 10 MVP tools', () => {
    const registry = createDefaultToolRegistry({
        models: {
            Workout: {},
            User: {},
            NutritionLog: {},
        },
    });

    const names = registry.list().map((tool) => tool.name).sort();
    assert.deepEqual(names, [
        'meals_edit_meal',
        'meals_get_user_meals',
        'nutrition_edit_user_data',
        'nutrition_get_user_data',
        'user_edit_profile',
        'user_get_profile',
        'workouts_edit_workout',
        'workouts_get_user_workouts',
        'workouts_get_workout_by_type',
        'workouts_get_workout_types',
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
