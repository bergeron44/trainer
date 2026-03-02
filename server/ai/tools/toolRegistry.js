class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    register(toolDefinition) {
        if (!toolDefinition || typeof toolDefinition !== 'object') {
            throw new Error('Tool definition must be an object.');
        }

        const {
            name,
            description,
            inputSchema,
            jsonSchema,
            handler,
            readWriteMode,
            idempotent,
            timeoutMs,
        } = toolDefinition;

        if (!name || typeof name !== 'string') {
            throw new Error('Tool definition requires a string name.');
        }
        if (typeof description !== 'string' || !description.trim()) {
            throw new Error(`Tool "${name}" requires a non-empty description.`);
        }
        if (!inputSchema || typeof inputSchema.parse !== 'function') {
            throw new Error(`Tool "${name}" requires a Zod inputSchema.`);
        }
        if (!jsonSchema || typeof jsonSchema !== 'object') {
            throw new Error(`Tool "${name}" requires a JSON schema object.`);
        }
        if (typeof handler !== 'function') {
            throw new Error(`Tool "${name}" requires a handler function.`);
        }
        if (!['read', 'write'].includes(readWriteMode)) {
            throw new Error(`Tool "${name}" readWriteMode must be "read" or "write".`);
        }

        this.tools.set(name, {
            name,
            description,
            inputSchema,
            jsonSchema,
            handler,
            readWriteMode,
            idempotent: Boolean(idempotent),
            timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 7000,
        });
    }

    get(name) {
        return this.tools.get(String(name || '').trim());
    }

    list() {
        return Array.from(this.tools.values());
    }

    listForModel({ names } = {}) {
        let tools = this.list();
        if (Array.isArray(names) && names.length) {
            const allowed = new Set(
                names
                    .map((item) => String(item || '').trim())
                    .filter(Boolean)
            );
            tools = tools.filter((tool) => allowed.has(tool.name));
        }

        return tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.jsonSchema,
        }));
    }
}

module.exports = ToolRegistry;
