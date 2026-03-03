class BaseAgent {
    constructor({
        type,
        defaultPersonaId,
        personaLibrary = {},
        agentDirectives = [],
    } = {}) {
        if (!type || typeof type !== 'string') {
            throw new Error('BaseAgent requires a valid type.');
        }
        if (!defaultPersonaId || typeof defaultPersonaId !== 'string') {
            throw new Error('BaseAgent requires a valid defaultPersonaId.');
        }
        if (!personaLibrary[defaultPersonaId]) {
            throw new Error(`BaseAgent missing default persona definition: ${defaultPersonaId}`);
        }

        this.type = type;
        this.defaultPersonaId = defaultPersonaId;
        this.personaLibrary = personaLibrary;
        this.agentDirectives = Array.isArray(agentDirectives) ? agentDirectives : [];
    }

    normalizePersonaId(personaId) {
        return String(personaId || '').trim().toLowerCase();
    }

    supportsPersona(personaId) {
        const key = this.normalizePersonaId(personaId);
        return Boolean(key && this.personaLibrary[key]);
    }

    resolvePersona(personaId) {
        const key = this.normalizePersonaId(personaId);
        const resolvedKey = this.personaLibrary[key] ? key : this.defaultPersonaId;
        return {
            key: resolvedKey,
            profile: this.personaLibrary[resolvedKey],
        };
    }

    getSystemDirectives() {
        return this.agentDirectives;
    }
}

module.exports = BaseAgent;
