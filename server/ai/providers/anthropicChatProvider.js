const { ChatProvider } = require('../core/chatProvider');

const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_API_VERSION = '2023-06-01';

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

function formatAnthropicMessages(input) {
    const messages = [];

    for (const message of input.messages) {
        if (message.role === 'system') continue;

        if (message.role === 'tool') {
            messages.push({
                role: 'user',
                content: [{
                    type: 'tool_result',
                    tool_use_id: message.toolCallId,
                    content: message.content,
                }],
            });
            continue;
        }

        if (message.role === 'assistant' && Array.isArray(message.toolCalls) && message.toolCalls.length) {
            const content = [];
            if (message.content) {
                content.push({ type: 'text', text: message.content });
            }

            for (const call of message.toolCalls) {
                content.push({
                    type: 'tool_use',
                    id: call.id,
                    name: call.name,
                    input: call.arguments || {},
                });
            }

            messages.push({ role: 'assistant', content });
            continue;
        }

        messages.push({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
        });
    }

    if (!messages.length) {
        messages.push({
            role: 'user',
            content: 'Hello',
        });
    }

    return messages;
}

function extractSystemPrompt(input) {
    const parts = [];
    if (input.system) parts.push(input.system);
    for (const message of input.messages) {
        if (message.role === 'system') parts.push(message.content);
    }
    return parts.length ? parts.join('\n\n') : undefined;
}

function extractText(responseJson) {
    if (!Array.isArray(responseJson?.content)) return '';
    const textBlocks = responseJson.content
        .filter((block) => block?.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text);
    return textBlocks.join('\n').trim();
}

function extractToolCalls(responseJson) {
    if (!Array.isArray(responseJson?.content)) return undefined;
    const toolCalls = responseJson.content
        .filter((block) => block?.type === 'tool_use' && typeof block.name === 'string')
        .map((block) => ({
            id: block.id,
            name: block.name,
            arguments: block.input || {},
        }));

    return toolCalls.length ? toolCalls : undefined;
}

class AnthropicChatProvider extends ChatProvider {
    constructor(config = {}) {
        super({ providerName: 'anthropic' });
        this.config = this.resolveConfig(config);
    }

    resolveConfig(config = {}) {
        return {
            apiKey: toOptionalString(config.apiKey || process.env.ANTHROPIC_API_KEY),
            model: toOptionalString(config.model || process.env.ANTHROPIC_MODEL) || DEFAULT_MODEL,
            baseURL: toOptionalString(config.baseURL || process.env.ANTHROPIC_BASE_URL) || DEFAULT_BASE_URL,
            timeoutMs: toInt(config.timeoutMs || process.env.ANTHROPIC_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
            temperature: clampNumber(
                toNumber(config.temperature || process.env.ANTHROPIC_TEMPERATURE, DEFAULT_TEMPERATURE),
                0,
                1
            ),
            maxTokens: toInt(config.maxTokens || process.env.ANTHROPIC_MAX_TOKENS, DEFAULT_MAX_TOKENS),
            apiVersion: toOptionalString(config.apiVersion || process.env.ANTHROPIC_VERSION)
                || DEFAULT_API_VERSION,
            includeRaw: Boolean(config.includeRaw || process.env.ANTHROPIC_INCLUDE_RAW === 'true'),
        };
    }

    assertConfigured() {
        if (!this.config.apiKey) {
            throw new Error(
                'anthropic provider is not configured. Set ANTHROPIC_API_KEY or provide apiKey in provider config.'
            );
        }
    }

    async generate(input) {
        this.assertConfigured();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
        const system = extractSystemPrompt(input);
        const options = input.options || {};

        const body = {
            model: this.config.model,
            system,
            messages: formatAnthropicMessages(input),
            tools: Array.isArray(input.tools) && input.tools.length
                ? input.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    input_schema: tool.inputSchema,
                }))
                : undefined,
            temperature: clampNumber(
                toNumber(options.temperature, this.config.temperature),
                0,
                1
            ),
            max_tokens: toInt(options.maxTokens, this.config.maxTokens),
            top_p: options.topP !== undefined
                ? clampNumber(toNumber(options.topP, 1), 0, 1)
                : undefined,
            stop_sequences: Array.isArray(options.stop) ? options.stop : undefined,
            metadata: input.userId
                ? { user_id: String(input.userId).slice(0, 128) }
                : undefined,
        };

        try {
            const response = await fetch(`${this.config.baseURL.replace(/\/$/, '')}/v1/messages`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': this.config.apiVersion,
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
                const error = new Error(parsed?.error?.message || rawText || 'Anthropic API request failed');
                error.status = response.status;
                error.code = parsed?.error?.type || 'anthropic_api_error';
                throw error;
            }

            const usage = parsed?.usage
                ? {
                    inputTokens: parsed.usage.input_tokens,
                    outputTokens: parsed.usage.output_tokens,
                    totalTokens: (parsed.usage.input_tokens || 0) + (parsed.usage.output_tokens || 0),
                }
                : undefined;

            return {
                text: extractText(parsed),
                toolCalls: extractToolCalls(parsed),
                provider: 'anthropic',
                model: parsed?.model || this.config.model,
                finishReason: parsed?.stop_reason || parsed?.stop_sequence || undefined,
                usage,
                raw: this.config.includeRaw ? parsed : undefined,
            };
        } finally {
            clearTimeout(timeout);
        }
    }
}

module.exports = AnthropicChatProvider;
