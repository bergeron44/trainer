const {
    validateChatGenerateInput,
    validateChatGenerateOutput,
} = require('./chatSchemas');

class ChatProvider {
    constructor({ providerName } = {}) {
        this.providerName = providerName || 'unknown';
    }

    // Providers must override this method.
    // Input and output shapes are validated by generateSafe.
    async generate(_input) {
        throw new Error(`${this.constructor.name} must implement generate(input).`);
    }

    async generateSafe(input) {
        const validatedInput = validateChatGenerateInput(input);
        const result = await this.generate(validatedInput);
        return validateChatGenerateOutput(result);
    }
}

function assertChatProvider(provider) {
    if (!provider || typeof provider.generateSafe !== 'function') {
        throw new Error('Provider must implement generateSafe(input).');
    }
    return provider;
}

module.exports = {
    ChatProvider,
    assertChatProvider,
};
