const { z } = require('zod');
const ChatSummary = require('../models/ChatSummary');
const { createChatProvider } = require('../ai/providers');
const { assertChatProvider } = require('../ai/core/chatProvider');

const DEFAULT_PERSONA = 'default';
const DEFAULT_MEMORY_LIMIT = 5;
const DEFAULT_MAX_MESSAGES = 20;
const DEFAULT_MAX_MESSAGE_CHARS = 2000;
const DEFAULT_MAX_SYSTEM_CHARS = 3500;
const DEFAULT_MAX_INPUT_TOKENS = 6000;
const MIN_MESSAGES_TO_KEEP = 2;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_BACKOFF_MS = 250;

const PERSONA_LIBRARY = {
    default: {
        style: 'Balanced, practical fitness coach. Supportive and direct.',
        directives: [
            'Give clear, actionable coaching.',
            'Use short responses by default (2-4 sentences).',
            'Prioritize user safety and sustainable progress.',
        ],
    },
    motivational: {
        style: 'Positive and energetic coach.',
        directives: [
            'Encourage the user and celebrate progress.',
            'Keep tone warm and motivating.',
        ],
    },
    spicy: {
        style: 'Direct, tough-love coach.',
        directives: [
            'Be blunt but constructive.',
            'Push for accountability without being insulting.',
        ],
    },
    hardcore: {
        style: 'High-intensity no-excuses coach.',
        directives: [
            'Use punchy, disciplined language.',
            'Demand consistency and effort.',
        ],
    },
    drill_sergeant: {
        style: 'Aggressive but caring performance coach.',
        directives: [
            'Short, high-energy instructions.',
            'Drive intensity and commitment.',
        ],
    },
    scientist: {
        style: 'Evidence-based and analytical coach.',
        directives: [
            'Explain decisions briefly with training rationale.',
            'Reference recovery, workload, and progression clearly.',
        ],
    },
    zen_coach: {
        style: 'Calm and mindful long-term coach.',
        directives: [
            'Promote consistency and body awareness.',
            'Use a supportive, steady tone.',
        ],
    },
};

const BrainMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1),
});

const BrainInputSchema = z.object({
    system: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    messages: z.array(BrainMessageSchema).optional(),
    context: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    personaId: z.string().min(1).optional(),
    coachStyle: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    options: z.object({
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().positive().optional(),
        topP: z.number().min(0).max(1).optional(),
        stop: z.array(z.string().min(1)).optional(),
    }).optional(),
    persistSummary: z.boolean().optional(),
    memoryLimit: z.number().int().min(0).max(20).optional(),
});

function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(String(text).length / 4);
}

function truncateText(text, maxChars) {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 3)}...`;
}

function safeContextLabel(context) {
    if (!context) return 'General';
    if (typeof context === 'string') return truncateText(context.trim(), 120) || 'General';
    if (typeof context === 'object') {
        const candidates = [
            context.label,
            context.name,
            context.page,
            context.mode,
            context.type,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                return truncateText(candidate.trim(), 120);
            }
        }
        return 'General';
    }
    return 'General';
}

function isTransientProviderError(error) {
    const status = Number(error?.status);
    if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
        return true;
    }

    const transientCodes = new Set([
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'EAI_AGAIN',
        'ENOTFOUND',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_SOCKET',
    ]);
    if (transientCodes.has(error?.code)) {
        return true;
    }

    const message = String(error?.message || '').toLowerCase();
    if (
        message.includes('timeout') ||
        message.includes('temporar') ||
        message.includes('rate limit') ||
        message.includes('too many requests')
    ) {
        return true;
    }

    return false;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class ChatBrainService {
    constructor({
        provider,
        chatSummaryModel = ChatSummary,
        config = {},
        hooks = {},
    } = {}) {
        this.provider = provider
            ? assertChatProvider(provider)
            : createChatProvider();
        this.ChatSummaryModel = chatSummaryModel;
        this.config = {
            defaultMemoryLimit: config.defaultMemoryLimit || DEFAULT_MEMORY_LIMIT,
            maxMessages: config.maxMessages || DEFAULT_MAX_MESSAGES,
            maxMessageChars: config.maxMessageChars || DEFAULT_MAX_MESSAGE_CHARS,
            maxSystemChars: config.maxSystemChars || DEFAULT_MAX_SYSTEM_CHARS,
            maxInputTokens: config.maxInputTokens || DEFAULT_MAX_INPUT_TOKENS,
            retryAttempts: config.retryAttempts
                || Number.parseInt(process.env.CHAT_PROVIDER_RETRY_ATTEMPTS || '', 10)
                || DEFAULT_RETRY_ATTEMPTS,
            retryBackoffMs: config.retryBackoffMs
                || Number.parseInt(process.env.CHAT_PROVIDER_RETRY_BACKOFF_MS || '', 10)
                || DEFAULT_RETRY_BACKOFF_MS,
        };
        this.hooks = {
            beforeGenerate: hooks.beforeGenerate,
            afterGenerate: hooks.afterGenerate,
            onPersistError: hooks.onPersistError,
        };
    }

    resolvePersona(personaId) {
        const key = String(personaId || DEFAULT_PERSONA).trim().toLowerCase();
        return {
            key,
            profile: PERSONA_LIBRARY[key] || PERSONA_LIBRARY[DEFAULT_PERSONA],
        };
    }

    normalizeMessages(input) {
        if (Array.isArray(input.messages) && input.messages.length) {
            return input.messages.map((message) => ({
                role: message.role,
                content: truncateText(message.content.trim(), this.config.maxMessageChars),
            }));
        }

        if (input.prompt) {
            return [{
                role: 'user',
                content: truncateText(input.prompt.trim(), this.config.maxMessageChars),
            }];
        }

        throw new Error('ChatBrainService requires either messages[] or prompt.');
    }

    pruneMessages(messages) {
        const maxMessages = this.config.maxMessages;
        let pruned = messages.slice(-maxMessages);

        // Keep the latest messages within the approximate token budget.
        while (
            pruned.length > MIN_MESSAGES_TO_KEEP &&
            this.estimateMessageTokens(pruned) > this.config.maxInputTokens
        ) {
            pruned.shift();
        }

        return pruned;
    }

    estimateMessageTokens(messages) {
        return messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
    }

    async loadMemories({ userId, limit }) {
        if (!userId || !limit) return [];

        const memories = await this.ChatSummaryModel.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return memories;
    }

    formatMemoryBlock(memories) {
        if (!memories.length) return '';

        const lines = memories.map((item, idx) => {
            const userRequest = truncateText(item.user_request || '', 160);
            const aiResponse = truncateText(item.ai_response || '', 200);
            return `${idx + 1}. User: ${userRequest} | Coach: ${aiResponse}`;
        });

        return `Recent relevant memory:\n${lines.join('\n')}`;
    }

    buildSystemPrompt({ input, personaProfile, contextLabel, memoryBlock }) {
        const directives = [
            `Coach persona: ${personaProfile.style}`,
            ...personaProfile.directives,
            `Current context: ${contextLabel}`,
            'If injury or pain is mentioned, recommend safe alternatives and reducing intensity.',
        ];

        if (input.system) {
            directives.push(`Additional system guidance: ${input.system}`);
        }

        if (memoryBlock) {
            directives.push(memoryBlock);
        }

        const prompt = directives.join('\n');
        return truncateText(prompt, this.config.maxSystemChars);
    }

    async persistSummary({
        userId,
        contextLabel,
        userMessage,
        assistantMessage,
    }) {
        if (!userId || !userMessage || !assistantMessage) return;

        try {
            await this.ChatSummaryModel.create({
                user: userId,
                user_request: truncateText(userMessage, 1200),
                ai_response: truncateText(assistantMessage, 4000),
                context: contextLabel,
            });
        } catch (error) {
            if (typeof this.hooks.onPersistError === 'function') {
                await this.hooks.onPersistError(error);
                return;
            }
            console.error('ChatBrainService: failed to persist summary', error);
        }
    }

    getLastUserMessage(messages) {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i].role === 'user') return messages[i].content;
        }
        return '';
    }

    async generateWithRetry(providerPayload) {
        const maxAttempts = Math.max(1, this.config.retryAttempts);
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await this.provider.generateSafe({
                    ...providerPayload,
                    metadata: {
                        ...(providerPayload.metadata || {}),
                        retry_attempt: attempt,
                    },
                });
            } catch (error) {
                lastError = error;
                if (attempt >= maxAttempts || !isTransientProviderError(error)) {
                    throw error;
                }

                const delayMs = this.config.retryBackoffMs * attempt;
                await sleep(delayMs);
            }
        }

        throw lastError;
    }

    async generateResponse(rawInput) {
        const input = BrainInputSchema.parse(rawInput || {});
        const normalizedMessages = this.pruneMessages(this.normalizeMessages(input));
        const { key: personaKey, profile: personaProfile } = this.resolvePersona(
            input.personaId || input.coachStyle
        );
        const contextLabel = safeContextLabel(input.context);
        const memoryLimit = input.memoryLimit ?? this.config.defaultMemoryLimit;
        const memories = await this.loadMemories({
            userId: input.userId,
            limit: memoryLimit,
        });
        const memoryBlock = this.formatMemoryBlock(memories);
        const systemPrompt = this.buildSystemPrompt({
            input,
            personaProfile,
            contextLabel,
            memoryBlock,
        });

        const providerPayload = {
            system: systemPrompt,
            messages: normalizedMessages,
            context: typeof input.context === 'object'
                ? input.context
                : { label: contextLabel },
            userId: input.userId,
            metadata: {
                ...(input.metadata || {}),
                context_label: contextLabel,
                persona: personaKey,
                memory_count: memories.length,
            },
            options: input.options,
        };

        if (typeof this.hooks.beforeGenerate === 'function') {
            await this.hooks.beforeGenerate(providerPayload);
        }

        const providerResult = await this.generateWithRetry(providerPayload);

        if (typeof this.hooks.afterGenerate === 'function') {
            await this.hooks.afterGenerate({
                input: providerPayload,
                output: providerResult,
            });
        }

        const shouldPersist = input.persistSummary !== false;
        if (shouldPersist) {
            await this.persistSummary({
                userId: input.userId,
                contextLabel,
                userMessage: this.getLastUserMessage(normalizedMessages),
                assistantMessage: providerResult.text,
            });
        }

        return {
            response: providerResult.text,
            provider: providerResult.provider,
            model: providerResult.model,
            finishReason: providerResult.finishReason,
            usage: providerResult.usage,
            meta: {
                persona: personaKey,
                context: contextLabel,
                memoryUsed: memories.length,
                messageCount: normalizedMessages.length,
            },
        };
    }
}

module.exports = ChatBrainService;
