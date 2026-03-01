const OpenAI = require('openai');
const { ChatProvider } = require('../core/chatProvider');

const DEFAULT_MODEL = 'gpt-4o-mini';
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

function toOpenAIMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return undefined;
    }

    const entries = Object.entries(metadata).slice(0, 16);
    if (!entries.length) return undefined;

    const result = {};
    for (const [rawKey, rawValue] of entries) {
        const key = String(rawKey).slice(0, 64);
        if (!key) continue;

        let value;
        if (rawValue === null || rawValue === undefined) {
            value = '';
        } else if (typeof rawValue === 'string') {
            value = rawValue;
        } else if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
            value = String(rawValue);
        } else {
            value = JSON.stringify(rawValue);
        }

        result[key] = value.slice(0, 512);
    }

    return Object.keys(result).length ? result : undefined;
}

function extractOutputText(response) {
    if (typeof response?.output_text === 'string' && response.output_text.trim()) {
        return response.output_text;
    }

    if (!Array.isArray(response?.output)) {
        return '';
    }

    const parts = [];
    for (const item of response.output) {
        if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
        for (const block of item.content) {
            if (block?.type === 'output_text' && typeof block.text === 'string') {
                parts.push(block.text);
            }
        }
    }

    return parts.join('\n').trim();
}

function extractUsage(usage) {
    if (!usage) return undefined;
    return {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
    };
}

function deriveFinishReason(response) {
    if (response?.incomplete_details?.reason) {
        return response.incomplete_details.reason;
    }
    if (response?.status) {
        return response.status;
    }
    return undefined;
}

class OpenAIChatProvider extends ChatProvider {
    constructor(config = {}) {
        super({ providerName: 'openai' });
        this.config = this.resolveConfig(config);
        this.client = null;
        if (this.config.apiKey) {
            this.client = this.createClient();
        }
    }

    createClient() {
        return new OpenAI({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseURL,
            timeout: this.config.timeoutMs,
            maxRetries: this.config.maxRetries,
        });
    }

    resolveConfig(config = {}) {
        const apiKey = toOptionalString(config.apiKey || process.env.OPENAI_API_KEY);
        return {
            apiKey,
            model: toOptionalString(config.model || process.env.OPENAI_MODEL) || DEFAULT_MODEL,
            baseURL: toOptionalString(config.baseURL || process.env.OPENAI_BASE_URL),
            timeoutMs: toInt(config.timeoutMs || process.env.OPENAI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
            maxRetries: toInt(config.maxRetries || process.env.OPENAI_MAX_RETRIES, DEFAULT_MAX_RETRIES),
            defaultTemperature: clampNumber(
                toNumber(config.temperature || process.env.OPENAI_TEMPERATURE, DEFAULT_TEMPERATURE),
                0,
                2
            ),
            defaultMaxOutputTokens: toInt(
                config.maxOutputTokens || process.env.OPENAI_MAX_OUTPUT_TOKENS,
                DEFAULT_MAX_OUTPUT_TOKENS
            ),
            includeRaw: Boolean(config.includeRaw || process.env.OPENAI_INCLUDE_RAW === 'true'),
        };
    }

    assertConfigured() {
        if (!this.config.apiKey) {
            throw new Error(
                'OpenAI provider is not configured. Set OPENAI_API_KEY or provide apiKey in provider config.'
            );
        }
        if (!this.client) {
            this.client = this.createClient();
        }
    }

    buildInstructions(input) {
        const instructions = [];
        if (input.system) {
            instructions.push(input.system);
        }

        for (const message of input.messages) {
            if (message.role === 'system') {
                instructions.push(message.content);
            }
        }

        return instructions.length ? instructions.join('\n\n') : undefined;
    }

    buildInputMessages(input) {
        return input.messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
                type: 'message',
                role: message.role === 'assistant' ? 'assistant' : 'user',
                content: message.content,
            }));
    }

    buildRequest(input) {
        const instructions = this.buildInstructions(input);
        const mappedMessages = this.buildInputMessages(input);
        const options = input.options || {};

        const temperature = clampNumber(
            toNumber(options.temperature, this.config.defaultTemperature),
            0,
            2
        );
        const maxOutputTokens = toInt(
            options.maxTokens,
            this.config.defaultMaxOutputTokens
        );
        const topP = options.topP !== undefined
            ? clampNumber(toNumber(options.topP, 1), 0, 1)
            : undefined;

        const request = {
            model: this.config.model,
            instructions,
            input: mappedMessages.length ? mappedMessages : undefined,
            temperature,
            max_output_tokens: maxOutputTokens,
            top_p: topP,
            metadata: toOpenAIMetadata(input.metadata),
            safety_identifier: toOptionalString(input.userId)?.slice(0, 64),
        };

        return request;
    }

    async generate(input) {
        this.assertConfigured();
        const request = this.buildRequest(input);
        const response = await this.client.responses.create(request, {
            timeout: this.config.timeoutMs,
        });

        return {
            text: extractOutputText(response),
            provider: 'openai',
            model: response.model || this.config.model,
            finishReason: deriveFinishReason(response),
            usage: extractUsage(response.usage),
            raw: this.config.includeRaw ? response : undefined,
        };
    }
}

module.exports = OpenAIChatProvider;
