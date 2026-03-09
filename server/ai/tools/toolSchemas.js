const { z } = require('zod');

const ToolReadWriteModeSchema = z.enum(['read', 'write']);

const ToolCallSchema = z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    arguments: z.record(z.string(), z.unknown()).optional(),
});

const ToolResultErrorSchema = z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
});

const ToolResultSchema = z.object({
    ok: z.boolean(),
    toolName: z.string().min(1),
    toolCallId: z.string().min(1).optional(),
    requestId: z.string().min(1).optional(),
    data: z.unknown().nullable(),
    error: ToolResultErrorSchema.nullable(),
});

class ToolExecutionError extends Error {
    constructor({ code, message, details, status = 400 }) {
        super(message);
        this.name = 'ToolExecutionError';
        this.code = code || 'TOOL_ERROR';
        this.status = status;
        this.details = details;
    }
}

function normalizeToolError(error) {
    if (error instanceof ToolExecutionError) {
        return {
            code: error.code,
            message: error.message,
            details: error.details,
            status: error.status,
        };
    }

    if (error?.name === 'ZodError') {
        const firstIssue = Array.isArray(error.issues) && error.issues.length > 0
            ? error.issues[0]
            : null;
        const issuePath = Array.isArray(firstIssue?.path) ? firstIssue.path.join('.') : '';
        const issueMessage = typeof firstIssue?.message === 'string' ? firstIssue.message : '';
        const message = [issuePath, issueMessage].filter(Boolean).join(': ');
        return {
            code: 'TOOL_VALIDATION_ERROR',
            message: message ? `Invalid tool arguments. ${message}` : 'Invalid tool arguments.',
            details: error.issues || [],
            status: 400,
        };
    }

    return {
        code: 'TOOL_EXECUTION_ERROR',
        message: error?.message || 'Tool execution failed.',
        details: undefined,
        status: typeof error?.status === 'number' ? error.status : 500,
    };
}

module.exports = {
    ToolReadWriteModeSchema,
    ToolCallSchema,
    ToolResultErrorSchema,
    ToolResultSchema,
    ToolExecutionError,
    normalizeToolError,
};
