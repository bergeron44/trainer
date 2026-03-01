const { z } = require('zod');

const ChatRoleSchema = z.enum(['system', 'user', 'assistant']);

const ChatMessageSchema = z.object({
    role: ChatRoleSchema,
    content: z.string().min(1),
    name: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

const ChatGenerateOptionsSchema = z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    stop: z.array(z.string().min(1)).optional(),
}).optional();

const ChatGenerateInputSchema = z.object({
    system: z.string().min(1).optional(),
    messages: z.array(ChatMessageSchema).min(1),
    context: z.record(z.string(), z.unknown()).optional(),
    userId: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    options: ChatGenerateOptionsSchema,
});

const ChatUsageSchema = z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
}).optional();

const ChatGenerateOutputSchema = z.object({
    text: z.string(),
    provider: z.string().min(1),
    model: z.string().min(1),
    finishReason: z.string().min(1).optional(),
    usage: ChatUsageSchema,
    raw: z.unknown().optional(),
});

function validateChatGenerateInput(payload) {
    return ChatGenerateInputSchema.parse(payload);
}

function validateChatGenerateOutput(payload) {
    return ChatGenerateOutputSchema.parse(payload);
}

module.exports = {
    ChatRoleSchema,
    ChatMessageSchema,
    ChatGenerateOptionsSchema,
    ChatGenerateInputSchema,
    ChatUsageSchema,
    ChatGenerateOutputSchema,
    validateChatGenerateInput,
    validateChatGenerateOutput,
};
