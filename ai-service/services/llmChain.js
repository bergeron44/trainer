/**
 * LLM Fallback Chain
 * Order: Claude (Anthropic) → GPT-4o (OpenAI) → Gemini (Google)
 * Skips any provider with a missing/empty API key.
 * Throws only if ALL providers fail.
 */

const PROVIDERS = [
    {
        name: 'claude-sonnet-4-6',
        available: () => !!process.env.ANTHROPIC_API_KEY,
        call: async (system, userMsg, maxTokens) => {
            const Anthropic = require('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const res = await client.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: maxTokens,
                system,
                messages: [{ role: 'user', content: userMsg }],
            });
            return res.content[0].text;
        }
    },
    {
        name: 'gpt-4o',
        available: () => !!process.env.OPENAI_API_KEY,
        call: async (system, userMsg, maxTokens) => {
            const OpenAI = require('openai');
            const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const res = await client.chat.completions.create({
                model: 'gpt-4o',
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: userMsg }
                ],
            });
            return res.choices[0].message.content;
        }
    },
    {
        name: 'gemini-1.5-pro',
        available: () => !!process.env.GEMINI_API_KEY,
        call: async (system, userMsg, maxTokens) => {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-pro',
                systemInstruction: system,
                generationConfig: { maxOutputTokens: maxTokens }
            });
            const result = await model.generateContent(userMsg);
            return result.response.text();
        }
    }
];

/**
 * Try each provider in order. Returns { text, provider }.
 * @param {string} system - System prompt
 * @param {string} userMsg - User message
 * @param {number} maxTokens - Max tokens to generate
 */
async function callWithFallback(system, userMsg, maxTokens = 1024) {
    const errors = [];

    for (const provider of PROVIDERS) {
        if (!provider.available()) {
            console.log(`[LLM] ⏭  Skipping ${provider.name} — no API key`);
            continue;
        }

        try {
            console.log(`[LLM] 🔄 Trying ${provider.name}...`);
            const text = await provider.call(system, userMsg, maxTokens);
            console.log(`[LLM] ✅ Success with ${provider.name}`);
            return { text, provider: provider.name };
        } catch (err) {
            console.warn(`[LLM] ❌ ${provider.name} failed: ${err.message}`);
            errors.push({ provider: provider.name, error: err.message });
        }
    }

    throw new Error(`All LLM providers failed: ${JSON.stringify(errors)}`);
}

module.exports = { callWithFallback };
