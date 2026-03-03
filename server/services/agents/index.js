const CoachAgent = require('./coachAgent');
const NutritionistAgent = require('./nutritionistAgent');

const AGENT_TYPE = Object.freeze({
    COACH: 'coach',
    NUTRITIONIST: 'nutritionist',
});

function normalizeAgentType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === AGENT_TYPE.COACH || normalized === AGENT_TYPE.NUTRITIONIST) {
        return normalized;
    }
    return '';
}

function createAgentRegistry() {
    const coachAgent = new CoachAgent();
    const nutritionistAgent = new NutritionistAgent();

    const byType = {
        [AGENT_TYPE.COACH]: coachAgent,
        [AGENT_TYPE.NUTRITIONIST]: nutritionistAgent,
    };

    return {
        byType,
        resolveByType(agentType) {
            const normalized = normalizeAgentType(agentType);
            return byType[normalized] || byType[AGENT_TYPE.COACH];
        },
        inferUniqueTypeByPersona(personaId) {
            const matches = Object.values(byType).filter((agent) => agent.supportsPersona(personaId));
            if (matches.length === 1) {
                return matches[0].type;
            }
            return '';
        },
    };
}

module.exports = {
    AGENT_TYPE,
    normalizeAgentType,
    createAgentRegistry,
};
