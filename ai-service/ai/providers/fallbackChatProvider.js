const { ChatProvider } = require('../core/chatProvider');
const { createChatProvider } = require('./index');

/**
 * FallbackChatProvider — tries multiple LLM providers in order.
 *
 * When the primary provider fails (e.g. quota exceeded, network error),
 * it silently falls back to the next provider in the chain.
 * All providers share the same ChatProvider interface, so tool calling
 * and database access work identically regardless of which provider responds.
 *
 * Default order: OpenAI → Gemini → Anthropic
 * Override via env: FALLBACK_PROVIDER_ORDER=gemini,openai,anthropic
 */

const DEFAULT_PROVIDER_ORDER = ['openai', 'gemini', 'gemini2', 'openrouter', 'llmgateway', 'anthropic'];

function getProviderOrder() {
    const envOrder = process.env.FALLBACK_PROVIDER_ORDER;
    if (envOrder && typeof envOrder === 'string') {
        const parsed = envOrder
            .split(',')
            .map((name) => name.trim().toLowerCase())
            .filter(Boolean);
        if (parsed.length) return parsed;
    }
    return DEFAULT_PROVIDER_ORDER;
}

class FallbackChatProvider extends ChatProvider {
    constructor(config = {}) {
        super({ providerName: 'fallback' });
        this.providerOrder = config.providerOrder || getProviderOrder();
        this._providers = new Map();
    }

    /**
     * Lazily create and cache each sub-provider.
     * If a provider can't be instantiated (e.g. missing API key),
     * we catch the error here so it doesn't block the chain.
     */
    _getProvider(name) {
        if (this._providers.has(name)) {
            return this._providers.get(name);
        }

        try {
            // Use the main registry to create the provider (but skip 'fallback' to avoid recursion)
            if (name === 'fallback') return null;
            const provider = createChatProvider({ providerName: name });
            this._providers.set(name, provider);
            return provider;
        } catch (err) {
            console.warn(`[FallbackChatProvider] ⚠️  Cannot create provider "${name}": ${err.message}`);
            this._providers.set(name, null); // Cache the failure so we don't retry
            return null;
        }
    }

    async generate(input) {
        const errors = [];

        for (const providerName of this.providerOrder) {
            const provider = this._getProvider(providerName);
            if (!provider) {
                continue; // Skip unconfigured providers
            }

            try {
                console.log(`[FallbackChatProvider] 🔄 Trying "${providerName}"...`);
                const result = await provider.generate(input);
                console.log(`[FallbackChatProvider] ✅ Success with "${providerName}" (model: ${result.model || '?'})`);
                return {
                    ...result,
                    provider: providerName,
                    fallbackChain: this.providerOrder,
                };
            } catch (err) {
                const statusCode = err.status || err.statusCode || '';
                console.warn(
                    `[FallbackChatProvider] ❌ "${providerName}" failed` +
                    `${statusCode ? ` (HTTP ${statusCode})` : ''}: ${err.message}`
                );
                errors.push({ provider: providerName, error: err.message, status: statusCode });
            }
        }

        // All providers failed
        const summary = errors
            .map((e) => `${e.provider}: ${e.error}`)
            .join(' | ');
        const finalError = new Error(`All LLM providers failed. ${summary}`);
        finalError.code = 'ALL_PROVIDERS_FAILED';
        finalError.providerErrors = errors;
        throw finalError;
    }
}

module.exports = FallbackChatProvider;
