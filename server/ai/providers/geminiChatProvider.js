const OpenAIChatProvider = require('./openaiChatProvider');

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_OUTPUT_TOKENS = 500;

function toInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return value;
    return Math.min(max, Math.max(min, value));
}

function toOptionalString(value) {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    return text.length ? text : undefined;
}

class GeminiChatProvider extends OpenAIChatProvider {
    constructor(config = {}) {
        super({
            ...config,
            providerName: 'gemini',
        });
    }

    resolveConfig(config = {}) {
        const apiKey = toOptionalString(
            config.apiKey
            || process.env.GEMINI_API_KEY
            || process.env.GOOGLE_API_KEY
        );

        return {
            apiKey,
            model: toOptionalString(config.model || process.env.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL,
            baseURL: toOptionalString(config.baseURL || process.env.GEMINI_BASE_URL)
                || DEFAULT_GEMINI_BASE_URL,
            timeoutMs: toInt(config.timeoutMs || process.env.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
            maxRetries: toInt(config.maxRetries || process.env.GEMINI_MAX_RETRIES, DEFAULT_MAX_RETRIES),
            defaultTemperature: clampNumber(
                toNumber(config.temperature || process.env.GEMINI_TEMPERATURE, DEFAULT_TEMPERATURE),
                0,
                2
            ),
            defaultMaxOutputTokens: toInt(
                config.maxOutputTokens || process.env.GEMINI_MAX_OUTPUT_TOKENS,
                DEFAULT_MAX_OUTPUT_TOKENS
            ),
            includeRaw: Boolean(config.includeRaw || process.env.GEMINI_INCLUDE_RAW === 'true'),
        };
    }
}

module.exports = GeminiChatProvider;
