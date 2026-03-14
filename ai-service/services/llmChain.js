const OpenAI = require('openai');

const LLMAPI_BASE = process.env.LLMAPI_BASE_URL || 'https://api.llmapi.ai/v1';
const MODEL_ORDER = [
    'claude-sonnet-4-6',
    'gpt-4o',
    'gemini-2.5-flash',
];

function getProxyClient() {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) return null;
    return new OpenAI({ apiKey, baseURL: LLMAPI_BASE });
}

async function callViaProxy(system, userMsg, maxTokens = 1024) {
    const client = getProxyClient();
    if (!client) {
        throw new Error('LLM_API_KEY is not set in .env');
    }

    const errors = [];

    for (const model of MODEL_ORDER) {
        try {
            console.log(`[LLM] Trying proxy model ${model}...`);
            const res = await client.chat.completions.create({
                model,
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: userMsg },
                ],
            });
            const text = res.choices?.[0]?.message?.content;
            if (!text) throw new Error('Empty completion');
            console.log(`[LLM] Proxy success with ${model}`);
            return { text, provider: model };
        } catch (err) {
            console.warn(`[LLM] Proxy ${model} failed: ${err.message}`);
            errors.push({ model, error: err.message });
        }
    }

    throw new Error(`All proxy models failed: ${JSON.stringify(errors)}`);
}

async function callViaGemini(system, userMsg, maxTokens = 1024) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in .env');
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    console.log(`[LLM] Trying Gemini direct ${modelName}...`);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: String(system || '') }],
            },
            contents: [{
                role: 'user',
                parts: [{ text: String(userMsg || '') }],
            }],
            generationConfig: {
                maxOutputTokens: maxTokens,
            },
        }),
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
        error.code = parsed?.error?.status || 'GEMINI_API_ERROR';
        throw error;
    }

    const text = Array.isArray(parsed?.candidates?.[0]?.content?.parts)
        ? parsed.candidates[0].content.parts
            .map((part) => String(part?.text || '').trim())
            .filter(Boolean)
            .join('\n')
            .trim()
        : '';

    if (!text) {
        throw new Error('Gemini returned empty text');
    }

    console.log(`[LLM] Gemini direct success with ${modelName}`);
    return { text, provider: modelName };
}

async function callWithFallback(system, userMsg, maxTokens = 1024) {
    const proxyClient = getProxyClient();
    if (proxyClient) {
        return callViaProxy(system, userMsg, maxTokens);
    }

    return callViaGemini(system, userMsg, maxTokens);
}

module.exports = { callWithFallback };
