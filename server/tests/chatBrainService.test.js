const test = require('node:test');
const assert = require('node:assert/strict');
const ChatBrainService = require('../services/chatBrainService');

function buildSummaryModel({
    memories = [],
    onCreate,
    onFind,
} = {}) {
    return {
        find(query) {
            if (onFind) onFind(query);
            return {
                sort() {
                    return this;
                },
                limit() {
                    return this;
                },
                lean() {
                    return Promise.resolve(memories);
                },
            };
        },
        create(payload) {
            if (onCreate) onCreate(payload);
            return Promise.resolve(payload);
        },
    };
}

test('ChatBrainService composes persona + memory context and persists summaries', async () => {
    let capturedInput;
    let persisted;
    const service = new ChatBrainService({
        provider: {
            async generateSafe(input) {
                capturedInput = input;
                return {
                    text: 'Try lowering load by 5% and keep RPE around 8.',
                    provider: 'mock',
                    model: 'mock-model',
                    finishReason: 'completed',
                    usage: { inputTokens: 11, outputTokens: 9, totalTokens: 20 },
                };
            },
        },
        chatSummaryModel: buildSummaryModel({
            memories: [
                {
                    user_request: 'Squat felt unstable',
                    ai_response: 'Use a slower eccentric and brace harder',
                },
            ],
            onCreate(payload) {
                persisted = payload;
            },
        }),
    });

    const result = await service.generateResponse({
        userId: 'u1',
        personaId: 'scientist_coach',
        context: { page: 'Workout Session' },
        messages: [{ role: 'user', content: 'RPE was too high on set 2' }],
    });

    assert.equal(result.provider, 'mock');
    assert.equal(result.meta.persona, 'scientist_coach');
    assert.equal(result.meta.agentType, 'coach');
    assert.equal(result.meta.memoryUsed, 1);
    assert.match(capturedInput.system, /Coach persona:/);
    assert.match(capturedInput.system, /Recent relevant memory:/);
    assert.equal(persisted.user, 'u1');
    assert.equal(persisted.agent_type, 'coach');
    assert.equal(persisted.context, 'Workout Session');
});

test('ChatBrainService uses nutritionist agent for nutrition context', async () => {
    let capturedInput;
    let memoryFindQuery;
    const service = new ChatBrainService({
        provider: {
            async generateSafe(input) {
                capturedInput = input;
                return {
                    text: 'Aim for 35g protein in dinner and stay near your calorie target.',
                    provider: 'mock',
                    model: 'mock-model',
                    finishReason: 'completed',
                };
            },
        },
        chatSummaryModel: buildSummaryModel({
            onFind(query) {
                memoryFindQuery = query;
            },
        }),
    });

    const result = await service.generateResponse({
        userId: 'u1',
        personaId: 'motivational',
        context: 'Nutrition',
        prompt: 'What should I eat for dinner?',
        persistSummary: false,
    });

    assert.equal(result.meta.agentType, 'nutritionist');
    assert.equal(result.meta.persona, 'nutritionist');
    assert.match(capturedInput.system, /Primary focus: nutrition strategy/i);
    assert.equal(memoryFindQuery.agent_type, 'nutritionist');
});

test('ChatBrainService retries transient provider failures', async () => {
    let attempts = 0;
    const service = new ChatBrainService({
        provider: {
            async generateSafe() {
                attempts += 1;
                if (attempts === 1) {
                    const error = new Error('temporary timeout');
                    error.status = 503;
                    throw error;
                }
                return {
                    text: 'Recovered on retry',
                    provider: 'mock',
                    model: 'mock-model',
                    finishReason: 'completed',
                };
            },
        },
        chatSummaryModel: buildSummaryModel(),
        config: {
            retryAttempts: 2,
            retryBackoffMs: 1,
        },
    });

    const result = await service.generateResponse({
        userId: 'u1',
        prompt: 'hello',
        persistSummary: false,
    });

    assert.equal(result.response, 'Recovered on retry');
    assert.equal(attempts, 2);
});
