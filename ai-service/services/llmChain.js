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
 */
async function callWithFallback(system, userMsg, maxTokens = 1024) {
    const client = getClient();
    const errors = [];

    for (const model of MODEL_ORDER) {
        try {
            console.log(`[LLM] 🔄 Trying ${model}...`);
            const res = await client.chat.completions.create({
                model,
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: userMsg },
                ],
            });
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
