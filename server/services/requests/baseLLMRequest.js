const ChatBrainService = require('../chatBrainService');

class BaseLLMRequest {
    constructor({
        chatBrainService,
        agentType = 'coach',
        personaId = '',
        temperature = 0.3,
        maxToolCalls,
        maxToolIterations,
        retryAttempts,
        maxSystemChars,
        logger = console,
    } = {}) {
        this.logger = logger;
        this.agentType = agentType;
        this.personaId = personaId;
        this.temperature = temperature;
        this.chatBrainService = chatBrainService || new ChatBrainService({
            config: {
                maxToolCallsPerResponse: maxToolCalls,
                maxToolIterations,
                retryAttempts,
                maxSystemChars,
            },
        });
    }

    buildSystemPrompt(params) {
        throw new Error('BaseLLMRequest: subclass must implement buildSystemPrompt()');
    }

    buildUserPrompt(params) {
        throw new Error('BaseLLMRequest: subclass must implement buildUserPrompt()');
    }

    getToolAllowlist() {
        return [];
    }

    validateResult(result) {}

    getContext(params) {
        return { workflow: this.constructor.name };
    }

    async execute({ userId, requestId, ...params }) {
        const system = this.buildSystemPrompt({ userId, requestId, ...params });
        const userPrompt = this.buildUserPrompt({ userId, requestId, ...params });
        const allowlist = this.getToolAllowlist();

        const result = await this.chatBrainService.generateResponse({
            userId,
            agentType: this.agentType,
            personaId: this.personaId,
            system,
            messages: [{ role: 'user', content: userPrompt }],
            context: this.getContext({ userId, requestId, ...params }),
            metadata: { requestId, workflow: this.constructor.name },
            options: { temperature: this.temperature },
            persistSummary: false,
            memoryLimit: 0,
            enableTools: allowlist.length > 0,
            toolAllowlist: allowlist,
        });

        this.validateResult(result);
        return result;
    }
}

module.exports = BaseLLMRequest;
