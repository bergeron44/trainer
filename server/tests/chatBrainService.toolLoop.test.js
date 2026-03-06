const test = require('node:test');
const assert = require('node:assert/strict');

const ChatBrainService = require('../services/chatBrainService');

function buildSummaryModel({ onCreate } = {}) {
    return {
        find() {
            return {
                sort() {
                    return this;
                },
                limit() {
                    return this;
                },
                lean() {
                    return Promise.resolve([]);
                },
            };
        },
        create(payload) {
            if (onCreate) onCreate(payload);
            return Promise.resolve(payload);
        },
    };
}

test('ChatBrainService executes tool calls and performs a follow-up provider response', async () => {
    const providerInputs = [];
    let providerRound = 0;
    let persistedSummary;

    const service = new ChatBrainService({
        provider: {
            async generateSafe(input) {
                providerInputs.push(input);
                providerRound += 1;

                if (providerRound === 1) {
                    return {
                        text: '',
                        toolCalls: [
                            {
                                id: 'tool-call-1',
                                name: 'user_get_profile',
                                arguments: {},
                            },
                        ],
                        provider: 'mock',
                        model: 'mock-model',
                        finishReason: 'tool_calls',
                    };
                }

                return {
                    text: 'Updated your plan using your profile and current targets.',
                    provider: 'mock',
                    model: 'mock-model',
                    finishReason: 'stop',
                };
            },
        },
        toolExecutor: {
            listToolsForModel() {
                return [
                    {
                        name: 'user_get_profile',
                        description: 'Get user profile.',
                        inputSchema: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {},
                        },
                    },
                ];
            },
            async executeToolCalls({ toolCalls, context }) {
                assert.equal(toolCalls.length, 1);
                assert.equal(toolCalls[0].name, 'user_get_profile');
                assert.equal(context.userId, 'u1');
                return [
                    {
                        ok: true,
                        toolName: 'user_get_profile',
                        toolCallId: toolCalls[0].id,
                        requestId: context.requestId,
                        data: {
                            profile: {
                                goal: 'muscle_gain',
                                trainer_personality: 'scientist_coach',
                            },
                        },
                        error: null,
                    },
                ];
            },
        },
        chatSummaryModel: buildSummaryModel({
            onCreate(payload) {
                persistedSummary = payload;
            },
        }),
        config: {
            maxToolIterations: 4,
            maxToolCallsPerResponse: 3,
            retryAttempts: 1,
        },
    });

    const result = await service.generateResponse({
        userId: 'u1',
        personaId: 'scientist_coach',
        metadata: { requestId: 'req-1' },
        messages: [
            {
                role: 'user',
                content: 'Can you adjust my workout based on my profile?',
            },
        ],
    });

    assert.equal(providerInputs.length, 2);
    assert.equal(result.response, 'Updated your plan using your profile and current targets.');
    assert.equal(result.meta.agentType, 'coach');
    assert.equal(result.meta.toolCallsExecuted, 1);
    assert.equal(result.toolTrace.length, 1);
    assert.equal(persistedSummary.user, 'u1');
    assert.equal(persistedSummary.agent_type, 'coach');

    const secondRoundMessages = providerInputs[1].messages;
    assert.equal(secondRoundMessages[1].role, 'assistant');
    assert.equal(secondRoundMessages[1].toolCalls[0].name, 'user_get_profile');
    assert.equal(secondRoundMessages[2].role, 'tool');
    assert.equal(secondRoundMessages[2].name, 'user_get_profile');
});

test('ChatBrainService passes tool allowlist to tool executor', async () => {
    let capturedAllowlist;
    const service = new ChatBrainService({
        provider: {
            async generateSafe() {
                return {
                    text: 'Planner completed.',
                    provider: 'mock',
                    model: 'mock-model',
                    finishReason: 'stop',
                };
            },
        },
        toolExecutor: {
            listToolsForModel({ names } = {}) {
                capturedAllowlist = names;
                return [];
            },
            async executeToolCalls() {
                return [];
            },
        },
        chatSummaryModel: buildSummaryModel(),
        config: {
            retryAttempts: 1,
        },
    });

    const result = await service.generateResponse({
        userId: 'u1',
        prompt: 'create my onboarding plan',
        toolAllowlist: ['user_get_profile', 'workouts_create_workout'],
        persistSummary: false,
    });

    assert.equal(result.response, 'Planner completed.');
    assert.deepEqual(capturedAllowlist, ['user_get_profile', 'workouts_create_workout']);
});
