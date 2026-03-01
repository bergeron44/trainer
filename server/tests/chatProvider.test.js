const test = require('node:test');
const assert = require('node:assert/strict');
const { ChatProvider } = require('../ai/core/chatProvider');

class ValidProvider extends ChatProvider {
    async generate(input) {
        return {
            text: `echo:${input.messages[0].content}`,
            provider: 'valid',
            model: 'valid-model',
            finishReason: 'completed',
            usage: {
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2,
            },
        };
    }
}

class InvalidOutputProvider extends ChatProvider {
    async generate() {
        return {
            text: 'missing required fields',
        };
    }
}

test('ChatProvider.generateSafe validates valid input/output', async () => {
    const provider = new ValidProvider({ providerName: 'valid' });
    const result = await provider.generateSafe({
        messages: [{ role: 'user', content: 'hello' }],
    });

    assert.equal(result.text, 'echo:hello');
    assert.equal(result.provider, 'valid');
    assert.equal(result.model, 'valid-model');
});

test('ChatProvider.generateSafe rejects invalid input', async () => {
    const provider = new ValidProvider({ providerName: 'valid' });
    await assert.rejects(
        provider.generateSafe({ messages: [] }),
        /too small|at least|>=\s*1/i
    );
});

test('ChatProvider.generateSafe rejects invalid output shape', async () => {
    const provider = new InvalidOutputProvider({ providerName: 'invalid-output' });
    await assert.rejects(
        provider.generateSafe({
            messages: [{ role: 'user', content: 'hello' }],
        }),
        /invalid_type|required/i
    );
});
