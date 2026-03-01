const test = require('node:test');
const assert = require('node:assert/strict');

const ChatSummary = require('../models/ChatSummary');
const {
    generateResponse,
    getSummaries,
    createSummary,
    setChatBrainServiceForTests,
    resetChatBrainServiceForTests,
} = require('../controllers/chatController');

function createRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

let originalFind;
let originalCreate;

test.beforeEach(() => {
    originalFind = ChatSummary.find;
    originalCreate = ChatSummary.create;
});

test.afterEach(() => {
    ChatSummary.find = originalFind;
    ChatSummary.create = originalCreate;
    resetChatBrainServiceForTests();
});

test('generateResponse returns normalized chat payload on success', async () => {
    let capturedInput;
    setChatBrainServiceForTests({
        async generateResponse(input) {
            capturedInput = input;
            return {
                response: 'coach reply',
                provider: 'mock',
                model: 'mock-model',
                finishReason: 'completed',
                usage: { totalTokens: 10 },
                meta: { context: 'Dashboard' },
            };
        },
    });

    const req = {
        body: { prompt: 'hello' },
        user: { id: 'u1' },
        requestId: 'req-1',
    };
    const res = createRes();

    await generateResponse(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.response, 'coach reply');
    assert.equal(res.body.requestId, 'req-1');
    assert.equal(capturedInput.userId, 'u1');
});

test('generateResponse maps validation errors to 400', async () => {
    setChatBrainServiceForTests({
        async generateResponse() {
            const error = new Error('invalid payload');
            error.name = 'ZodError';
            error.issues = [{ path: ['messages'], message: 'required' }];
            throw error;
        },
    });

    const req = {
        body: {},
        user: { id: 'u1' },
        requestId: 'req-2',
    };
    const res = createRes();

    await generateResponse(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'CHAT_VALIDATION_ERROR');
});

test('getSummaries scopes by authenticated user', async () => {
    let findQuery;
    ChatSummary.find = (query) => {
        findQuery = query;
        return {
            sort() {
                return this;
            },
            limit() {
                return Promise.resolve([{ user_request: 'u', ai_response: 'a' }]);
            },
        };
    };

    const req = {
        query: {},
        user: { id: 'user-42' },
    };
    const res = createRes();

    await getSummaries(req, res, () => {});

    assert.deepEqual(findQuery, { user: 'user-42' });
    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body), true);
});

test('createSummary writes authenticated user id', async () => {
    let createdPayload;
    ChatSummary.create = async (payload) => {
        createdPayload = payload;
        return { _id: 'sum-1', ...payload };
    };

    const req = {
        body: {
            user_request: 'Need a deload plan',
            ai_response: 'Reduce volume by 40% this week.',
            context: { label: 'Workout Session' },
        },
        user: { id: 'user-99' },
    };
    const res = createRes();

    await createSummary(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.equal(createdPayload.user, 'user-99');
    assert.equal(typeof createdPayload.context, 'string');
});
