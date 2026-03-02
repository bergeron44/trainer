const {
    ToolCallSchema,
    ToolResultSchema,
    ToolExecutionError,
    normalizeToolError,
} = require('./toolSchemas');

function withTimeout(promise, timeoutMs, toolName) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return promise;
    }

    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new ToolExecutionError({
                    code: 'TOOL_TIMEOUT',
                    message: `Tool \"${toolName}\" timed out after ${timeoutMs}ms.`,
                    status: 504,
                }));
            }, timeoutMs);
        }),
    ]);
}

function toSerializable(value) {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return String(value);
    }
}

class ToolExecutor {
    constructor({
        registry,
        toolExecutionAuditModel,
        toolIdempotencyRecordModel,
        defaultTimeoutMs = 7000,
    } = {}) {
        this.registry = registry;
        this.ToolExecutionAuditModel = toolExecutionAuditModel;
        this.ToolIdempotencyRecordModel = toolIdempotencyRecordModel;
        this.defaultTimeoutMs = defaultTimeoutMs;
    }

    listToolsForModel() {
        if (!this.registry) return [];
        return this.registry.listForModel();
    }

    async executeToolCalls({ toolCalls, context = {}, maxCalls = 3 }) {
        if (!Array.isArray(toolCalls) || !toolCalls.length) return [];

        const cappedCalls = toolCalls.slice(0, Math.max(0, maxCalls));
        const results = [];
        for (const toolCall of cappedCalls) {
            // Serialize execution to keep DB write order deterministic.
            // This also avoids race conditions on idempotency keys.
            const result = await this.executeToolCall({ toolCall, context });
            results.push(result);
        }
        return results;
    }

    async executeToolCall({ toolCall, context = {} }) {
        const startedAt = Date.now();
        const parsedCall = ToolCallSchema.parse(toolCall);
        const tool = this.registry.get(parsedCall.name);

        if (!tool) {
            return this.buildErrorResult({
                toolCall: parsedCall,
                context,
                startedAt,
                error: new ToolExecutionError({
                    code: 'TOOL_NOT_FOUND',
                    message: `Unknown tool: ${parsedCall.name}`,
                    status: 400,
                }),
            });
        }

        try {
            const args = tool.inputSchema.parse(parsedCall.arguments || {});
            const idempotencyKey = tool.idempotent ? String(args.idempotencyKey || '').trim() : '';

            if (tool.readWriteMode === 'write' && tool.idempotent && !idempotencyKey) {
                throw new ToolExecutionError({
                    code: 'TOOL_IDEMPOTENCY_KEY_REQUIRED',
                    message: `Tool \"${tool.name}\" requires idempotencyKey.`,
                    status: 400,
                });
            }

            if (tool.readWriteMode === 'write' && tool.idempotent) {
                const replay = await this.getReplay({
                    userId: context.userId,
                    toolName: tool.name,
                    idempotencyKey,
                });
                if (replay) {
                    const replayResult = {
                        ...replay,
                        toolCallId: parsedCall.id,
                        requestId: context.requestId,
                    };
                    await this.audit({
                        context,
                        toolCall: parsedCall,
                        tool,
                        status: 'replay',
                        latencyMs: Date.now() - startedAt,
                        input: args,
                        output: replayResult,
                        idempotencyKey,
                    });
                    return ToolResultSchema.parse(replayResult);
                }
            }

            const handlerOutput = await withTimeout(
                Promise.resolve(tool.handler({ args, context })),
                tool.timeoutMs || this.defaultTimeoutMs,
                tool.name
            );

            const data = handlerOutput && typeof handlerOutput === 'object' && 'data' in handlerOutput
                ? handlerOutput.data
                : handlerOutput;
            const changedFields = Array.isArray(handlerOutput?.changedFields)
                ? handlerOutput.changedFields
                : [];

            const successResult = ToolResultSchema.parse({
                ok: true,
                toolName: tool.name,
                toolCallId: parsedCall.id,
                requestId: context.requestId,
                data: data ?? null,
                error: null,
            });

            if (tool.readWriteMode === 'write' && tool.idempotent) {
                await this.saveReplay({
                    userId: context.userId,
                    toolName: tool.name,
                    idempotencyKey,
                    result: successResult,
                });
            }

            await this.audit({
                context,
                toolCall: parsedCall,
                tool,
                status: 'success',
                latencyMs: Date.now() - startedAt,
                input: args,
                output: successResult,
                changedFields,
                idempotencyKey,
            });

            return successResult;
        } catch (error) {
            return this.buildErrorResult({
                toolCall: parsedCall,
                context,
                tool,
                startedAt,
                error,
            });
        }
    }

    async getReplay({ userId, toolName, idempotencyKey }) {
        if (!this.ToolIdempotencyRecordModel || !userId || !idempotencyKey) return null;

        const query = this.ToolIdempotencyRecordModel.findOne({
            user: userId,
            tool_name: toolName,
            key: idempotencyKey,
        });
        const existing = typeof query?.lean === 'function'
            ? await query.lean()
            : await query;

        return existing?.result || null;
    }

    async saveReplay({ userId, toolName, idempotencyKey, result }) {
        if (!this.ToolIdempotencyRecordModel || !userId || !idempotencyKey) return;

        try {
            await this.ToolIdempotencyRecordModel.create({
                user: userId,
                tool_name: toolName,
                key: idempotencyKey,
                result,
            });
        } catch (error) {
            if (error?.code !== 11000) {
                throw error;
            }
        }
    }

    async audit({
        context,
        toolCall,
        tool,
        status,
        latencyMs,
        input,
        output,
        changedFields,
        idempotencyKey,
        error,
    }) {
        if (!this.ToolExecutionAuditModel || !context.userId || !tool) return;

        const payload = {
            user: context.userId,
            request_id: context.requestId,
            tool_call_id: toolCall.id,
            tool_name: tool.name,
            mode: tool.readWriteMode,
            status,
            idempotency_key: idempotencyKey || undefined,
            changed_fields: changedFields,
            latency_ms: latencyMs,
            input: toSerializable(input),
            output: toSerializable(output),
            error_code: error?.code,
            error_message: error?.message,
        };

        try {
            await this.ToolExecutionAuditModel.create(payload);
        } catch (auditError) {
            console.error('ToolExecutor: failed to write audit event', auditError);
        }
    }

    async buildErrorResult({ toolCall, context, tool, startedAt, error }) {
        const normalized = normalizeToolError(error);
        const result = ToolResultSchema.parse({
            ok: false,
            toolName: tool?.name || toolCall.name,
            toolCallId: toolCall.id,
            requestId: context.requestId,
            data: null,
            error: {
                code: normalized.code,
                message: normalized.message,
                details: normalized.details,
            },
        });

        await this.audit({
            context,
            toolCall,
            tool: tool || {
                name: toolCall.name,
                readWriteMode: 'read',
            },
            status: 'error',
            latencyMs: Date.now() - startedAt,
            input: toolCall.arguments,
            output: result,
            error: normalized,
        });

        return result;
    }
}

module.exports = ToolExecutor;
