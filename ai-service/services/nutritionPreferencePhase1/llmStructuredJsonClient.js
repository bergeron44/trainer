const OpenAI = require('openai');

const DEFAULT_MODEL = process.env.NUTRITION_EXTRACTOR_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

function stripCodeFences(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function safeJsonParse(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch (_error) {
        return fallback;
    }
}

class LlmStructuredJsonClient {
    constructor(config = {}) {
        this.model = String(config.model || DEFAULT_MODEL);
        this.temperature = Number.isFinite(config.temperature) ? config.temperature : 0.1;
        this.maxTokens = Number.isFinite(config.maxTokens) ? config.maxTokens : 1200;
        this.client = config.client || null;

        if (!this.client && process.env.OPENAI_API_KEY) {
            this.client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                baseURL: process.env.OPENAI_BASE_URL,
                timeout: Number.parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
                maxRetries: 1,
            });
        }
    }

    isConfigured() {
        return Boolean(this.client);
    }

    async completeJson({ system, user, temperature, maxTokens }) {
        if (!this.client) {
            throw new Error('LLM client is not configured');
        }

        const response = await this.client.chat.completions.create({
            model: this.model,
            temperature: Number.isFinite(temperature) ? temperature : this.temperature,
            max_tokens: Number.isFinite(maxTokens) ? maxTokens : this.maxTokens,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
        });

        const content = response?.choices?.[0]?.message?.content;
        const text = stripCodeFences(content);
        const parsed = safeJsonParse(text, null);

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('LLM did not return valid JSON object');
        }

        return parsed;
    }
}

module.exports = {
    LlmStructuredJsonClient,
};
