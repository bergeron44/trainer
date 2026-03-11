const { createChatProvider } = require('../../ai/providers');

class BaseRequest {
    constructor({ type, chatBrainService, logger } = {}) {
        if (!type || typeof type !== 'string') {
            throw new Error('BaseRequest requires a valid type.');
        }
        this.type = type;
        this._chatBrainService = chatBrainService || null;
        this.logger = logger || console;
    }

    // Override to provide a system prompt string (or null)
    buildSystemPrompt(_context = {}) {
        return null;
    }

    // Override to provide the user message string (or null)
    buildUserMessage(_context = {}) {
        return null;
    }

    // Override to provide per-call LLM options (temperature, maxTokens, etc.)
    getOptions(_context = {}) {
        return {};
    }

    // Return a tool config object to activate the tool loop path.
    // Return null (default) to use the direct provider path (no tools, no DB writes).
    // Tool config shape: { allowlist: string[], brainOptions?: object }
    getToolConfig(_context = {}) {
        return null;
    }

    // Override to transform the raw LLM result before returning from execute().
    parseResponse(result, _context) {
        return result;
    }

    async execute(context = {}) {
        const toolConfig = this.getToolConfig(context);

        if (toolConfig) {
            if (!this._chatBrainService) {
                throw new Error(
                    `BaseRequest "${this.type}": chatBrainService is required when getToolConfig() returns a value.`
                );
            }

            const userMessage = this.buildUserMessage(context);
            const result = await this._chatBrainService.generateResponse({
                system: this.buildSystemPrompt(context),
                messages: [{ role: 'user', content: userMessage || '' }],
                options: this.getOptions(context),
                userId: context.userId ? String(context.userId) : undefined,
                enableTools: true,
                toolAllowlist: toolConfig.allowlist,
                ...(toolConfig.brainOptions || {}),
            });

            return this.parseResponse(result, context);
        }

        // Direct provider path — no tools, no DB writes
        const provider = createChatProvider();
        const completion = await provider.generateSafe({
            system: this.buildSystemPrompt(context),
            messages: [{ role: 'user', content: this.buildUserMessage(context) || '' }],
            userId: context.userId ? String(context.userId) : undefined,
            options: this.getOptions(context),
        });

        return this.parseResponse(completion, context);
    }
}

module.exports = BaseRequest;
