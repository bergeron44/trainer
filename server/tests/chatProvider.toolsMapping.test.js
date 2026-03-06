const test = require('node:test');
const assert = require('node:assert/strict');

const OpenAIChatProvider = require('../ai/providers/openaiChatProvider');
const AnthropicChatProvider = require('../ai/providers/anthropicChatProvider');

test('OpenAIChatProvider maps internal tools/messages and parses tool calls', async () => {
    let capturedRequest;
    const provider = new OpenAIChatProvider({
        apiKey: 'test-key',
        model: 'gpt-test',
        includeRaw: true,
    });

    provider.client = {
        chat: {
            completions: {
                async create(request) {
                    capturedRequest = request;
                    return {
                        model: 'gpt-test',
                        choices: [
                            {
                                finish_reason: 'tool_calls',
                                message: {
                                    content: null,
                                    tool_calls: [
                                        {
                                            id: 'call_1',
                                            type: 'function',
                                            function: {
                                                name: 'workouts_get_workout_types',
                                                arguments: '{"includeArchived":false}',
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                        usage: {
                            prompt_tokens: 10,
                            completion_tokens: 3,
                            total_tokens: 13,
                        },
                    };
                },
            },
        },
    };

    const result = await provider.generateSafe({
        system: 'You are a coach.',
        messages: [
            { role: 'user', content: 'What workout types do I have?' },
        ],
        tools: [
            {
                name: 'workouts_get_workout_types',
                description: 'List workout types',
                inputSchema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        includeArchived: { type: 'boolean' },
                    },
                },
            },
        ],
    });

    assert.equal(capturedRequest.tools[0].function.name, 'workouts_get_workout_types');
    assert.equal(capturedRequest.tool_choice, 'auto');
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].name, 'workouts_get_workout_types');
    assert.deepEqual(result.toolCalls[0].arguments, { includeArchived: false });
    assert.equal(result.usage.totalTokens, 13);
});

test('AnthropicChatProvider maps tools and parses tool_use blocks', async () => {
    const originalFetch = global.fetch;
    let capturedBody;

    global.fetch = async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return {
            ok: true,
            status: 200,
            async text() {
                return JSON.stringify({
                    model: 'claude-test',
                    stop_reason: 'tool_use',
                    content: [
                        {
                            type: 'tool_use',
                            id: 'toolu_1',
                            name: 'user_get_profile',
                            input: {},
                        },
                    ],
                    usage: {
                        input_tokens: 12,
                        output_tokens: 2,
                    },
                });
            },
        };
    };

    const provider = new AnthropicChatProvider({
        apiKey: 'test-key',
        model: 'claude-test',
        baseURL: 'https://api.anthropic.com',
    });

    try {
        const result = await provider.generateSafe({
            system: 'System prompt',
            messages: [
                { role: 'user', content: 'Check my profile.' },
            ],
            tools: [
                {
                    name: 'user_get_profile',
                    description: 'Get user profile.',
                    inputSchema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {},
                    },
                },
            ],
        });

        assert.equal(capturedBody.tools[0].name, 'user_get_profile');
        assert.equal(result.toolCalls.length, 1);
        assert.equal(result.toolCalls[0].name, 'user_get_profile');
        assert.equal(result.usage.totalTokens, 14);
    } finally {
        global.fetch = originalFetch;
    }
});
