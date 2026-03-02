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

function parseJson(value, fallback = {}) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (_error) {
        return fallback;
    }
}

function extractTextFromContent(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    const chunks = [];
    for (const part of content) {
        if (typeof part?.text === 'string') {
            chunks.push(part.text);
        }
    }
    return chunks.join('\n').trim();
}

function extractUsage(usage) {
    if (!usage) return undefined;
    return {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
    };
}

class OpenAIChatProvider extends ChatProvider {
    constructor(config = {}) {
        super({ providerName: config.providerName || 'openai' });
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
                `${this.providerName} provider is not configured. Set API key env vars or provide apiKey in provider config.`
            );
        }
        if (!this.client) {
            this.client = this.createClient();
        }
    }

    buildTools(input) {
        if (!Array.isArray(input.tools) || !input.tools.length) {
            return undefined;
        }

        return input.tools.map((tool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
            },
        }));
    }

    buildMessages(input) {
        const messages = [];

        if (input.system) {
            messages.push({ role: 'system', content: input.system });
        }

        for (const message of input.messages) {
            if (message.role === 'system') {
                messages.push({ role: 'system', content: message.content });
                continue;
            }

            if (message.role === 'tool') {
                messages.push({
                    role: 'tool',
                    tool_call_id: message.toolCallId,
                    content: message.content,
                    name: message.name,
                });
                continue;
            }

            if (message.role === 'assistant' && Array.isArray(message.toolCalls) && message.toolCalls.length) {
                messages.push({
                    role: 'assistant',
                    content: message.content || '',
                    tool_calls: message.toolCalls.map((call) => ({
                        id: call.id,
                        type: 'function',
                        function: {
                            name: call.name,
                            arguments: JSON.stringify(call.arguments || {}),
                        },
                    })),
                });
                continue;
            }

            messages.push({
                role: message.role === 'assistant' ? 'assistant' : 'user',
                content: message.content,
            });
        }

        if (!messages.length) {
            messages.push({ role: 'user', content: 'Hello' });
        }

        return messages;
    }

    buildRequest(input) {
        const options = input.options || {};
        const tools = this.buildTools(input);

        return {
            model: this.config.model,
            messages: this.buildMessages(input),
            tools,
            tool_choice: tools?.length ? 'auto' : undefined,
            temperature: clampNumber(
                toNumber(options.temperature, this.config.defaultTemperature),
                0,
                2
            ),
            max_tokens: toInt(options.maxTokens, this.config.defaultMaxOutputTokens),
            top_p: options.topP !== undefined
                ? clampNumber(toNumber(options.topP, 1), 0, 1)
                : undefined,
            stop: Array.isArray(options.stop) ? options.stop : undefined,
            user: toOptionalString(input.userId)?.slice(0, 64),
        };
    }

    async generate(input) {
        this.assertConfigured();
        const request = this.buildRequest(input);

        const completion = await this.client.chat.completions.create(request, {
            timeout: this.config.timeoutMs,
        });

        const choice = completion?.choices?.[0] || {};
        const message = choice?.message || {};
        const toolCalls = Array.isArray(message.tool_calls)
            ? message.tool_calls.map((call) => ({
                id: call.id,
                name: call.function?.name,
                arguments: parseJson(call.function?.arguments, {}),
            })).filter((call) => call.name)
            : undefined;

        return {
            text: extractTextFromContent(message.content),
            toolCalls,
            provider: this.providerName,
            model: completion?.model || this.config.model,
            finishReason: choice?.finish_reason || undefined,
            usage: extractUsage(completion?.usage),
            raw: this.config.includeRaw ? completion : undefined,
        };
    }
}

module.exports = OpenAIChatProvider;
