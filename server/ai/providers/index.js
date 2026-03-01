const { assertChatProvider } = require('../core/chatProvider');

const providerRegistry = new Map();

function normalizeProviderName(name) {
    return String(name || '').trim().toLowerCase();
}

function registerChatProvider(name, providerFactory) {
    const normalized = normalizeProviderName(name);
    if (!normalized) {
        throw new Error('Provider name is required for registration.');
    }
    if (typeof providerFactory !== 'function') {
        throw new Error(`Provider factory for "${normalized}" must be a function.`);
    }
    providerRegistry.set(normalized, providerFactory);
}

function listChatProviders() {
    return Array.from(providerRegistry.keys());
}

function getConfiguredProviderName() {
    return normalizeProviderName(process.env.LLM_PROVIDER) || 'openai';
}

function createChatProvider({ providerName, config } = {}) {
    const selectedProvider = normalizeProviderName(providerName) || getConfiguredProviderName();
    const factory = providerRegistry.get(selectedProvider);

    if (!factory) {
        const available = listChatProviders();
        const availableText = available.length ? available.join(', ') : 'none';
        throw new Error(
            `No chat provider registered for "${selectedProvider}". Available providers: ${availableText}.`
        );
    }

    const provider = factory(config || {});
    return assertChatProvider(provider);
}

function clearChatProviderRegistryForTests() {
    providerRegistry.clear();
}

function registerBuiltInProviders() {
    registerChatProvider('openai', (config) => {
        const OpenAIChatProvider = require('./openaiChatProvider');
        return new OpenAIChatProvider(config);
    });
}

registerBuiltInProviders();

module.exports = {
    registerChatProvider,
    listChatProviders,
    getConfiguredProviderName,
    createChatProvider,
    clearChatProviderRegistryForTests,
};
