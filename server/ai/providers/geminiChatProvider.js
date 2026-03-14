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

function buildDirectGeminiUserText(input = {}) {
    const segments = [];
    for (const message of Array.isArray(input.messages) ? input.messages : []) {
        if (!message || message.role === 'system') continue;
        const role = message.role === 'assistant' ? 'Assistant' : message.role === 'tool' ? 'Tool' : 'User';
        const content = String(message.content || '').trim();
        if (!content) continue;
        segments.push(`${role}:\n${content}`);
    }
    return segments.length ? segments.join('\n\n') : 'User:\nHello';
}

function extractDirectGeminiText(payload = {}) {
    const parts = Array.isArray(payload?.candidates?.[0]?.content?.parts)
        ? payload.candidates[0].content.parts
        : [];
    return parts
        .map((part) => String(part?.text || '').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

function extractDirectGeminiUsage(payload = {}) {
    const usage = payload?.usageMetadata;
    if (!usage) return undefined;
    return {
        inputTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
        totalTokens: usage.totalTokenCount,
    };
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

    async generateViaDirectGemini(input) {
        const system = toOptionalString(input.system);
        const options = input.options || {};
        const body = {
            contents: [{
                role: 'user',
                parts: [{
                    text: buildDirectGeminiUserText(input),
                }],
            }],
            generationConfig: {
                temperature: clampNumber(
                    toNumber(options.temperature, this.config.defaultTemperature),
                    0,
                    2
                ),
                topP: options.topP !== undefined
                    ? clampNumber(toNumber(options.topP, 1), 0, 1)
                    : undefined,
                maxOutputTokens: toInt(options.maxTokens, this.config.defaultMaxOutputTokens),
                stopSequences: Array.isArray(options.stop) ? options.stop : undefined,
            },
        };

        if (system) {
            body.systemInstruction = {
                parts: [{ text: system }],
            };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            const rawText = await response.text();
            let parsed = null;
            try {
                parsed = rawText ? JSON.parse(rawText) : null;
            } catch (_error) {
                parsed = null;
            }

            if (!response.ok) {
                const message = parsed?.error?.message || rawText || 'Gemini direct API request failed';
                const error = new Error(message);
                error.status = response.status;
                error.code = parsed?.error?.status || 'gemini_direct_api_error';
                throw error;
            }

            return {
                text: extractDirectGeminiText(parsed),
                toolCalls: undefined,
                provider: 'gemini',
                model: parsed?.modelVersion || this.config.model,
                finishReason: parsed?.candidates?.[0]?.finishReason || undefined,
                usage: extractDirectGeminiUsage(parsed),
                raw: this.config.includeRaw ? parsed : undefined,
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    async generate(input) {
        if (!Array.isArray(input.tools) || !input.tools.length) {
            return this.generateViaDirectGemini(input);
        }

        return super.generate(input);
    }
}

module.exports = GeminiChatProvider;
