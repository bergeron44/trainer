const axios = require('axios');
const { z } = require('zod');
const { ToolExecutionError } = require('../toolSchemas');

const searchWebInputSchema = z.object({
    query: z.string().min(3).max(200),
    maxResults: z.number().int().min(1).max(5).optional(),
}).strict();

function decodeHtml(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/<[^>]+>/g, '')
        .trim();
}

function decodeDuckDuckGoRedirect(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const absolute = raw.startsWith('http')
            ? raw
            : `https:${raw}`;
        const parsed = new URL(absolute);
        const redirect = parsed.searchParams.get('uddg');
        return redirect ? decodeURIComponent(redirect) : absolute;
    } catch (_) {
        return raw;
    }
}

function mapSerpApiResults(payload = {}, maxResults = 3) {
    const organic = Array.isArray(payload.organic_results) ? payload.organic_results : [];
    return organic
        .slice(0, maxResults)
        .map((item) => ({
            title: decodeHtml(item?.title),
            url: String(item?.link || '').trim(),
            snippet: decodeHtml(item?.snippet || item?.rich_snippet?.top?.detected_extensions?.description || ''),
        }))
        .filter((item) => item.title && item.url);
}

function parseDuckDuckGoHtml(html = '', maxResults = 3) {
    const results = [];
    const blockRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = blockRegex.exec(html)) && results.length < maxResults) {
        results.push({
            title: decodeHtml(match[2]),
            url: decodeDuckDuckGoRedirect(match[1]),
            snippet: '',
        });
    }
    return results.filter((item) => item.title && item.url);
}

function mapDuckDuckGoInstantResults(payload = {}, maxResults = 3) {
    const results = [];
    if (payload?.AbstractText && payload?.AbstractURL) {
        results.push({
            title: decodeHtml(payload.Heading || payload.AbstractSource || 'Result'),
            url: String(payload.AbstractURL || '').trim(),
            snippet: decodeHtml(payload.AbstractText),
        });
    }

    const queue = Array.isArray(payload?.RelatedTopics) ? [...payload.RelatedTopics] : [];
    while (queue.length && results.length < maxResults) {
        const item = queue.shift();
        if (Array.isArray(item?.Topics)) {
            queue.push(...item.Topics);
            continue;
        }

        const text = decodeHtml(item?.Text || '');
        const url = String(item?.FirstURL || '').trim();
        if (!text || !url) continue;

        const [title, ...rest] = text.split(' - ');
        results.push({
            title: title || text,
            url,
            snippet: rest.join(' - ') || '',
        });
    }

    return results.slice(0, maxResults);
}

async function searchWithSerpApi({ httpClient, query, maxResults }) {
    const apiKey = String(process.env.SERPAPI_KEY || '').trim();
    if (!apiKey) return [];

    const response = await httpClient.get('https://serpapi.com/search.json', {
        params: {
            engine: 'google',
            q: query,
            num: maxResults,
            api_key: apiKey,
        },
        timeout: 8000,
        headers: {
            'User-Agent': 'TrainerApp/1.0',
        },
    });

    return mapSerpApiResults(response?.data, maxResults);
}

async function searchWithDuckDuckGoHtml({ httpClient, query, maxResults }) {
    const response = await httpClient.get('https://html.duckduckgo.com/html/', {
        params: { q: query },
        timeout: 8000,
        headers: {
            'User-Agent': 'TrainerApp/1.0',
        },
    });

    return parseDuckDuckGoHtml(String(response?.data || ''), maxResults);
}

async function searchWithDuckDuckGoInstant({ httpClient, query, maxResults }) {
    const response = await httpClient.get('https://api.duckduckgo.com/', {
        params: {
            q: query,
            format: 'json',
            no_html: 1,
            skip_disambig: 1,
        },
        timeout: 8000,
        headers: {
            'User-Agent': 'TrainerApp/1.0',
        },
    });

    return mapDuckDuckGoInstantResults(response?.data, maxResults);
}

function createResearchTools({ services = {} } = {}) {
    const httpClient = services.httpClient || axios;

    return [
        {
            name: 'nutrition_web_search',
            description: 'Search the web for meal, ingredient, or recipe inspiration when the existing user context is not enough.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 9000,
            inputSchema: searchWebInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['query'],
                properties: {
                    query: { type: 'string', minLength: 3, maxLength: 200 },
                    maxResults: { type: 'integer', minimum: 1, maximum: 5 },
                },
            },
            async handler({ args }) {
                const query = String(args.query || '').trim();
                const maxResults = Math.max(1, Math.min(5, Number(args.maxResults) || 3));

                const attempts = [
                    { source: 'serpapi', fn: searchWithSerpApi },
                    { source: 'duckduckgo_html', fn: searchWithDuckDuckGoHtml },
                    { source: 'duckduckgo_instant', fn: searchWithDuckDuckGoInstant },
                ];

                const errors = [];
                for (const attempt of attempts) {
                    try {
                        const results = await attempt.fn({ httpClient, query, maxResults });
                        if (Array.isArray(results) && results.length) {
                            return {
                                data: {
                                    query,
                                    source: attempt.source,
                                    results,
                                },
                            };
                        }
                    } catch (error) {
                        errors.push(`${attempt.source}: ${error?.message || 'unknown error'}`);
                    }
                }

                if (!errors.length) {
                    return {
                        data: {
                            query,
                            source: 'none',
                            results: [],
                        },
                    };
                }

                {
                    throw new ToolExecutionError({
                        code: 'TOOL_SEARCH_FAILED',
                        message: `Web search failed: ${errors.join(' | ')}`,
                        status: 502,
                    });
                }
            },
        },
    ];
}

module.exports = {
    createResearchTools,
};
