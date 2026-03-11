/**
 * LLM Chain via llmapi.ai (OpenAI-compatible proxy)
 * Tries models in order: claude-sonnet-4-6 → gpt-4o → gemini-1.5-pro
 * All calls go through a single unified API key (LLMAPI_KEY).
 */

const OpenAI = require('openai');

const LLMAPI_BASE = process.env.LLMAPI_BASE_URL || 'https://api.llmapi.ai/v1';

// Model preference order — first available wins
const MODEL_ORDER = [
    'claude-sonnet-4-6',
    'gpt-4o',
    'gemini-2.5-flash',
];
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.LLM_API_TIMEOUT_MS || '', 10) || 20000;

function getClient() {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) throw new Error('LLM_API_KEY is not set in .env');
    return new OpenAI({ apiKey, baseURL: LLMAPI_BASE });
}

/**
 * Try each model in order. Returns { text, provider }.
 * @param {string} system - System prompt
 * @param {string} userMsg - User message
 * @param {number} maxTokens - Max tokens to generate
 * @param {object} options - Request options
 */
async function callWithFallback(system, userMsg, maxTokens = 1024, options = {}) {
    const client = getClient();
    const errors = [];

    for (const model of MODEL_ORDER) {
        try {
            console.log(`[LLM] 🔄 Trying ${model}...`);
            const request = {
                model,
                max_tokens: maxTokens,
                temperature: options.temperature ?? 0.2,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: userMsg },
                ],
                timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
            };
            if (options.responseFormat) {
                request.response_format = options.responseFormat;
            }

            const res = await client.chat.completions.create(request);
            const text = res.choices[0].message.content;
            console.log(`[LLM] ✅ Success with ${model}`);
            return { text, provider: model };
        } catch (err) {
            console.warn(`[LLM] ❌ ${model} failed: ${err.message}`);
            errors.push({ model, error: err.message });
        }
    }

    throw new Error(`All LLM models failed: ${JSON.stringify(errors)}`);
}

module.exports = { callWithFallback };
