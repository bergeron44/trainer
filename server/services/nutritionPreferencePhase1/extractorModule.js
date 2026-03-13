const { canonicalizeString } = require('../nutritionPreferences/normalizationService');
const { SCHEMA_CONTRACT, EXTRACTOR_OUTPUT_CONTRACT } = require('./schemaContract');
const { LlmStructuredJsonClient } = require('./llmStructuredJsonClient');
const { extractNutritionPreferencesFromText } = require('../nutritionPreferences/extractionService');

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function toObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeExtractorOutput(output, fallbackText) {
    const candidate = toObject(output);
    const proposedUpdate = toObject(candidate.proposed_update);

    return {
        raw_text: canonicalizeString(candidate.raw_text || fallbackText),
        proposed_update: proposedUpdate,
        uncertain_items: toArray(candidate.uncertain_items),
        conflicts_detected: toArray(candidate.conflicts_detected),
        delete_requests: toArray(candidate.delete_requests),
    };
}

function buildDeterministicFallbackOutput(rawText, reason = '') {
    const extracted = extractNutritionPreferencesFromText(rawText);
    const hasExtractedFields = extracted && typeof extracted === 'object' && Object.keys(extracted).length > 0;

    return {
        raw_text: canonicalizeString(rawText),
        proposed_update: hasExtractedFields
            ? { nutrition_preferences: extracted }
            : {},
        uncertain_items: hasExtractedFields
            ? []
            : ['Fallback parser could not extract structured preferences from this text.'],
        conflicts_detected: [],
        delete_requests: [],
        ...(reason ? { fallback_reason: reason } : {}),
    };
}

function buildFewShotSection(fewShotExamples = []) {
    if (!Array.isArray(fewShotExamples) || !fewShotExamples.length) return '';

    const sliced = fewShotExamples.slice(0, 3);
    const lines = sliced.map((example, index) => {
        const input = canonicalizeString(example?.input || '');
        const output = JSON.stringify(example?.output || {}, null, 2);
        return `Example ${index + 1}\nInput: ${input}\nOutput:\n${output}`;
    });

    return `\nFew-shot examples:\n${lines.join('\n\n')}`;
}

function buildExtractorSystemPrompt({ schemaContract, promptClarifications, fewShotExamples }) {
    const clarifications = Array.isArray(promptClarifications) ? promptClarifications : [];
    const clarificationLines = clarifications.map((line, index) => `${index + 1}. ${line}`).join('\n');
    const fewShotSection = buildFewShotSection(fewShotExamples);

    return [
        'You are a nutrition preference extractor module. You are not an autonomous agent.',
        'Return JSON ONLY and strictly follow the requested shape.',
        'Do not include markdown and do not include additional keys.',
        'Do not invent facts and do not infer numeric values unless explicitly provided.',
        'Extract only nutrition_preferences partial update fields from the text.',
        'Never save data and never mention database operations.',
        '',
        'Schema contract:',
        JSON.stringify(schemaContract, null, 2),
        '',
        'Required output shape:',
        JSON.stringify(EXTRACTOR_OUTPUT_CONTRACT, null, 2),
        '',
        'Clarifications:',
        clarificationLines || '1. Keep extraction conservative.',
        fewShotSection,
    ].join('\n');
}

function buildExtractorUserPrompt({ rawText, existingPreferences }) {
    return [
        'Extract a partial update from this user text.',
        'Input text:',
        rawText,
        '',
        'Existing saved nutrition preferences (for conflict hints only):',
        JSON.stringify(existingPreferences || {}, null, 2),
        '',
        'Return JSON only.',
    ].join('\n');
}

function createExtractorModule(config = {}) {
    const llmClient = config.llmClient || new LlmStructuredJsonClient({
        model: config.model,
        temperature: Number.isFinite(config.temperature) ? config.temperature : 0.1,
        maxTokens: config.maxTokens,
    });

    return {
        isConfigured: () => llmClient.isConfigured(),
        async extract({ rawText, existingPreferences, safeRuleLayer, schemaContract = SCHEMA_CONTRACT }) {
            const inputText = canonicalizeString(rawText);
            if (!inputText) {
                return sanitizeExtractorOutput({
                    raw_text: '',
                    proposed_update: {},
                    uncertain_items: ['Empty user text.'],
                    conflicts_detected: [],
                    delete_requests: [],
                }, '');
            }

            if (!llmClient.isConfigured()) {
                return buildDeterministicFallbackOutput(inputText, 'llm_not_configured');
            }

            const system = buildExtractorSystemPrompt({
                schemaContract,
                promptClarifications: safeRuleLayer?.promptClarifications || [],
                fewShotExamples: safeRuleLayer?.fewShotExamples || [],
            });
            const user = buildExtractorUserPrompt({
                rawText: inputText,
                existingPreferences,
            });

            try {
                const raw = await llmClient.completeJson({
                    system,
                    user,
                    temperature: 0.1,
                    maxTokens: 1400,
                });

                return sanitizeExtractorOutput(raw, inputText);
            } catch (error) {
                return buildDeterministicFallbackOutput(
                    inputText,
                    `llm_failed:${error?.message || 'unknown'}`
                );
            }
        },
    };
}

module.exports = {
    createExtractorModule,
    sanitizeExtractorOutput,
};
