const { createChatProvider } = require('../../ai/providers');
const { EDITOR_AGENT_SCHEMA_CONTRACT } = require('./editorAgentSchemaContract');

function toObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function toText(value) {
    return String(value || '').trim();
}

function isEditorEnabled() {
    const raw = String(process.env.NUTRITION_EDITOR_ENABLED || 'true').trim().toLowerCase();
    return !['0', 'false', 'no', 'off'].includes(raw);
}

function stripCodeFences(value) {
    const text = toText(value);
    if (!text) return '';
    return text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function safeJsonParse(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch (_error) {
        return fallback;
    }
}

function normalizeTargetedQuestions(items = []) {
    const output = [];
    const seen = new Set();

    toArray(items).forEach((item, idx) => {
        const question = toText(item?.question);
        if (!question) return;
        const fieldPath = toText(item?.field_path) || 'nutrition_preferences';
        const unclearTextSpan = toText(item?.unclear_text_span);
        const key = `${fieldPath}:${question}`.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        output.push({
            id: toText(item?.id) || `q_${idx + 1}`,
            field_path: fieldPath,
            unclear_text_span: unclearTextSpan,
            question,
            choices: toArray(item?.choices).map((choice) => toText(choice)).filter(Boolean).slice(0, 5),
        });
    });

    return output;
}

function sanitizeDecision(rawDecision) {
    const decision = toText(rawDecision).toUpperCase();
    if (decision === 'ASK_USER' || decision === 'DO_NOT_SAVE' || decision === 'SAVE') return decision;
    return 'SAVE';
}

function sanitizeEditorResult(raw, extractorPartialUpdate) {
    const source = toObject(raw);
    const editedUpdate = toObject(source.edited_update_json);
    const fallbackEditedUpdate = toObject(extractorPartialUpdate);

    const normalizedEditedUpdate = Object.keys(editedUpdate).length ? editedUpdate : fallbackEditedUpdate;
    const targetedQuestions = normalizeTargetedQuestions(source.targeted_questions);
    const decision = sanitizeDecision(source.decision);
    const confidenceRaw = Number(source.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0.8;

    return {
        decision: targetedQuestions.length && decision === 'SAVE' ? 'ASK_USER' : decision,
        edited_update_json: normalizedEditedUpdate,
        edits_made: toArray(source.edits_made),
        targeted_questions: targetedQuestions,
        confidence,
        reasons: toArray(source.reasons).map((reason) => toText(reason)).filter(Boolean),
    };
}

function buildSystemPrompt() {
    return [
        'You are a Nutrition Preference JSON Editor.',
        'You are NOT an autonomous agent and you do NOT save to database.',
        'Your task: refine extractor JSON with high reliability.',
        '',
        'Important behavior:',
        '- Prefer SAVE for clear cases.',
        '- Ask user ONLY for specific unresolved ambiguity.',
        '- Never ask generic clarification.',
        '- If ambiguity is minor, store it in notes and continue with SAVE.',
        '- Do not invent facts or numbers.',
        '- Keep schema shape exactly as contract.',
        '- Do not add unknown fields.',
        '',
        'Output MUST be JSON only with this exact shape:',
        JSON.stringify({
            decision: 'SAVE',
            edited_update_json: {},
            edits_made: [],
            targeted_questions: [],
            confidence: 0.0,
            reasons: [],
        }, null, 2),
    ].join('\n');
}

function buildUserPrompt({
    rawText,
    extractorPartialUpdate,
    existingNutritionPreferences,
    conflicts = [],
}) {
    return [
        'raw_text:',
        rawText,
        '',
        'extractor_partial_update_json:',
        JSON.stringify(toObject(extractorPartialUpdate), null, 2),
        '',
        'existing_saved_nutrition_preferences:',
        JSON.stringify(toObject(existingNutritionPreferences), null, 2),
        '',
        'detected_conflicts:',
        JSON.stringify(toArray(conflicts), null, 2),
        '',
        'schema_contract_allowed_fields:',
        JSON.stringify(EDITOR_AGENT_SCHEMA_CONTRACT, null, 2),
        '',
        'Return JSON only.',
    ].join('\n');
}

async function runNutritionEditorAgent({
    rawText,
    extractorPartialUpdate = {},
    existingNutritionPreferences = {},
    conflicts = [],
}) {
    if (!isEditorEnabled()) {
        return {
            enabled: false,
            decision: 'SAVE',
            edited_update_json: toObject(extractorPartialUpdate),
            edits_made: [],
            targeted_questions: [],
            confidence: 1,
            reasons: ['Editor agent disabled by feature flag'],
        };
    }

    let provider;
    try {
        provider = createChatProvider();
    } catch (error) {
        return {
            enabled: true,
            decision: 'SAVE',
            edited_update_json: toObject(extractorPartialUpdate),
            edits_made: [],
            targeted_questions: [],
            confidence: 0.7,
            reasons: [`Editor agent unavailable: ${error?.message || 'provider initialization failed'}`],
        };
    }

    try {
        const system = buildSystemPrompt();
        const user = buildUserPrompt({
            rawText,
            extractorPartialUpdate,
            existingNutritionPreferences,
            conflicts,
        });

        const providerResult = await provider.generateSafe({
            system,
            messages: [{ role: 'user', content: user }],
            options: {
                temperature: 0.1,
                maxTokens: 2000,
            },
            metadata: {
                task: 'nutrition_editor_agent',
            },
        });

        const parsed = safeJsonParse(stripCodeFences(providerResult?.text), null);
        if (!parsed || typeof parsed !== 'object') {
            return {
                enabled: true,
                decision: 'SAVE',
                edited_update_json: toObject(extractorPartialUpdate),
                edits_made: [],
                targeted_questions: [],
                confidence: 0.65,
                reasons: ['Editor agent returned non-JSON response'],
            };
        }

        return {
            enabled: true,
            ...sanitizeEditorResult(parsed, extractorPartialUpdate),
        };
    } catch (error) {
        return {
            enabled: true,
            decision: 'SAVE',
            edited_update_json: toObject(extractorPartialUpdate),
            edits_made: [],
            targeted_questions: [],
            confidence: 0.6,
            reasons: [`Editor agent failed: ${error?.message || 'unknown error'}`],
        };
    }
}

module.exports = {
    runNutritionEditorAgent,
    isEditorEnabled,
};
