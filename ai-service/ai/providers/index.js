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
    return normalizeProviderName(process.env.LLM_PROVIDER) || 'fallback';
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

    registerChatProvider('gemini', (config) => {
        const GeminiChatProvider = require('./geminiChatProvider');
        return new GeminiChatProvider(config);
    });
    registerChatProvider('google', (config) => {
        const GeminiChatProvider = require('./geminiChatProvider');
        return new GeminiChatProvider(config);
    });
    registerChatProvider('gimini', (config) => {
        const GeminiChatProvider = require('./geminiChatProvider');
        return new GeminiChatProvider(config);
    });

    registerChatProvider('anthropic', (config) => {
        const AnthropicChatProvider = require('./anthropicChatProvider');
        return new AnthropicChatProvider(config);
    });

    // OpenRouter — OpenAI-compatible proxy that supports many models
    registerChatProvider('openrouter', (config) => {
        const OpenAIChatProvider = require('./openaiChatProvider');
        return new OpenAIChatProvider({
            ...config,
            providerName: 'openrouter',
            apiKey: config.apiKey || process.env.OPEN_ROUTER,
            baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
            model: config.model || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-pro-exp-03-25:free',
        });
    });

    // Gemini with secondary API key
    registerChatProvider('gemini2', (config) => {
        const GeminiChatProvider = require('./geminiChatProvider');
        return new GeminiChatProvider({
            ...config,
            apiKey: config.apiKey || process.env.GEMINI_API_KEY_2,
        });
    });

    // LLM Gateway (llmapi.ai) — OpenAI-compatible proxy with LLM_API_KEY
    registerChatProvider('llmgateway', (config) => {
        const OpenAIChatProvider = require('./openaiChatProvider');
        return new OpenAIChatProvider({
            ...config,
            providerName: 'llmgateway',
            apiKey: config.apiKey || process.env.LLM_API_KEY,
            baseURL: config.baseURL || process.env.LLMAPI_BASE_URL || 'https://api.llmapi.ai/v1',
            model: config.model || 'gpt-4o',
        });
    });

    registerChatProvider('fallback', (config) => {
        const FallbackChatProvider = require('./fallbackChatProvider');
        return new FallbackChatProvider(config);
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
