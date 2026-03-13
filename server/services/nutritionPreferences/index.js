const { extractNutritionPreferencesFromText, extractPreferenceSignalsFromText } = require('./extractionService');
const { normalizeExtractedPreferences } = require('./normalizationLayer');
const { detectNutritionPreferenceConflicts } = require('./conflictDetector');
const { validateNutritionPreferencesUpdate } = require('./validator');
const { mergeNutritionPreferences } = require('./mergeService');
const { compactObject, canonicalizeString } = require('./normalizationService');
const { runNutritionEditorAgent } = require('./editorAgent');

const FOOD_CANONICAL_ALIASES = new Map([
    ['tofu', 'tofu'],
    ['\u05d8\u05d5\u05e4\u05d5', 'tofu'],
    ['avocado', 'avocado'],
    ['\u05d0\u05d1\u05d5\u05e7\u05d3\u05d5', 'avocado'],
    ['chocolate', 'chocolate'],
    ['\u05e9\u05d5\u05e7\u05d5\u05dc\u05d3', 'chocolate'],
]);

function normalizeFoodName(value) {
    const key = canonicalizeString(value).toLowerCase();
    return FOOD_CANONICAL_ALIASES.get(key) || key;
}

function dedupeNameObjects(items = []) {
    const seen = new Set();
    const output = [];

    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const key = normalizeFoodName(item.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        output.push(item);
    }

    return output;
}

function dedupeNameStrings(items = []) {
    const seen = new Set();
    const output = [];

    for (const item of items) {
        const value = canonicalizeString(item);
        const key = normalizeFoodName(value);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        output.push(value);
    }

    return output;
}

function buildClarificationQuestionFromConflict(conflict) {
    const existing = canonicalizeString(conflict?.existing);
    const incoming = canonicalizeString(conflict?.incoming);
    if (!existing || !incoming) return null;

    const path = String(conflict?.path || '');
    const incomingIsDislike = path.includes('soft_dislikes');
    const incomingIsLike = path.includes('soft_likes');
    const incomingDislikeFromLikedFoods = path === 'liked_foods';
    const incomingLikeFromDislikedFoods = path === 'disliked_foods';
    let question;

    if (incomingIsDislike || incomingDislikeFromLikedFoods) {
        question = `You previously said you like "${existing}" and now you said you don't like it. What is your final preference?`;
    } else if (incomingIsLike || incomingLikeFromDislikedFoods) {
        question = `You previously said you don't like "${existing}" and now you said you like it. What is your final preference?`;
    } else {
        question = `You gave conflicting preferences for "${incoming}". What is your final preference?`;
    }

    return {
        type: 'preference_conflict',
        item: incoming,
        question,
    };
}

function buildClarificationQuestions({ conflicts = [], ambiguousItems = [] }) {
    const questions = [];

    for (const conflict of conflicts) {
        const path = String(conflict?.path || '');
        if (
            !path.includes('soft_') &&
            !path.includes('liked_foods') &&
            !path.includes('disliked_foods')
        ) {
            continue;
        }
        const question = buildClarificationQuestionFromConflict(conflict);
        if (question) questions.push(question);
    }

    for (const ambiguous of ambiguousItems) {
        const value = canonicalizeString(ambiguous?.value);
        if (!value) continue;
        const resolvedTo = ambiguous?.resolved_to === 'like' ? 'like' : 'dislike';
        questions.push({
            type: 'same_text_conflict',
            item: value,
            question: `In your latest message, you both liked and disliked "${value}". I applied "${resolvedTo}" as the latest preference. Please confirm your final preference.`,
            resolved_to: resolvedTo,
        });
    }

    const deduped = [];
    const seen = new Set();
    for (const question of questions) {
        const key = `${question.type}:${normalizeFoodName(question.item)}:${question.resolved_to || ''}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(question);
    }

    return deduped;
}

function extractIncomingFoodPreferenceNames(incomingPreferences = {}) {
    return {
        likes: dedupeNameStrings(incomingPreferences.soft_likes?.foods || []),
        dislikes: dedupeNameStrings(incomingPreferences.soft_dislikes?.foods || []),
    };
}

function mergeFoodPreferenceLists({
    existingLikedFoods = [],
    existingDislikedFoods = [],
    incomingLikedNames = [],
    incomingDislikedNames = [],
}) {
    const liked = dedupeNameObjects(existingLikedFoods);
    const disliked = dedupeNameObjects(existingDislikedFoods);

    const incomingLikeKeys = new Set(incomingLikedNames.map((name) => normalizeFoodName(name)).filter(Boolean));
    const incomingDislikeKeys = new Set(incomingDislikedNames.map((name) => normalizeFoodName(name)).filter(Boolean));

    let mergedLiked = liked.filter((item) => !incomingDislikeKeys.has(normalizeFoodName(item.name)));
    let mergedDisliked = disliked.filter((item) => !incomingLikeKeys.has(normalizeFoodName(item.name)));

    // Free-text extraction must not add new items into game lists.
    // It may only remove conflicting items from opposite lists.

    // Final overlap cleanup: latest incoming side wins, else keep in disliked by default.
    const mergedLikeKeys = new Set(mergedLiked.map((item) => normalizeFoodName(item.name)));
    const mergedDislikeKeys = new Set(mergedDisliked.map((item) => normalizeFoodName(item.name)));
    const overlap = [...mergedLikeKeys].filter((key) => mergedDislikeKeys.has(key));

    if (overlap.length) {
        mergedLiked = mergedLiked.filter((item) => {
            const key = normalizeFoodName(item.name);
            if (!overlap.includes(key)) return true;
            if (incomingLikeKeys.has(key)) return true;
            if (incomingDislikeKeys.has(key)) return false;
            return false;
        });

        mergedDisliked = mergedDisliked.filter((item) => {
            const key = normalizeFoodName(item.name);
            if (!overlap.includes(key)) return true;
            if (incomingDislikeKeys.has(key)) return true;
            if (incomingLikeKeys.has(key)) return false;
            return true;
        });
    }

    return {
        mergedLikedFoods: dedupeNameObjects(mergedLiked),
        mergedDislikedFoods: dedupeNameObjects(mergedDisliked),
    };
}

function detectFoodListConflicts({
    existingLikedFoods = [],
    existingDislikedFoods = [],
    incomingLikedNames = [],
    incomingDislikedNames = [],
}) {
    const conflicts = [];
    const existingLikeSet = new Set(
        dedupeNameObjects(existingLikedFoods).map((item) => normalizeFoodName(item.name)).filter(Boolean)
    );
    const existingDislikeSet = new Set(
        dedupeNameObjects(existingDislikedFoods).map((item) => normalizeFoodName(item.name)).filter(Boolean)
    );

    for (const name of incomingDislikedNames) {
        const key = normalizeFoodName(name);
        if (!key || !existingLikeSet.has(key)) continue;
        conflicts.push({
            path: 'liked_foods',
            existing: name,
            incoming: name,
            message: `Incoming dislike "${name}" conflicts with existing liked_foods.`,
            severity: 'warning',
        });
    }

    for (const name of incomingLikedNames) {
        const key = normalizeFoodName(name);
        if (!key || !existingDislikeSet.has(key)) continue;
        conflicts.push({
            path: 'disliked_foods',
            existing: name,
            incoming: name,
            message: `Incoming like "${name}" conflicts with existing disliked_foods.`,
            severity: 'warning',
        });
    }

    return conflicts;
}

function buildPipelineFromNormalized({
    compactNormalized = {},
    preferenceSignals = {},
    existingNutritionPreferences = {},
    existingLikedFoods = [],
    existingDislikedFoods = [],
}) {
    const partialUpdate = Object.keys(compactNormalized).length
        ? { nutrition_preferences: compactNormalized }
        : {};

    if (!Object.keys(partialUpdate).length) {
        return {
            partialUpdate: {},
            mergedNutritionPreferences: existingNutritionPreferences || {},
            mergedLikedFoods: existingLikedFoods || [],
            mergedDislikedFoods: existingDislikedFoods || [],
            conflicts: [],
            clarificationQuestions: [],
            extracted: {},
        };
    }

    const partialValidation = validateNutritionPreferencesUpdate(partialUpdate);
    if (!partialValidation.isValid) {
        const error = new Error('Invalid partial nutrition preference update');
        error.validationErrors = partialValidation.errors;
        throw error;
    }

    const nutritionConflicts = detectNutritionPreferenceConflicts(
        existingNutritionPreferences || {},
        compactNormalized
    );

    const mergedNutritionPreferences = mergeNutritionPreferences(
        existingNutritionPreferences || {},
        compactNormalized
    );

    const incomingFoodPreferences = extractIncomingFoodPreferenceNames(compactNormalized);
    const foodListConflicts = detectFoodListConflicts({
        existingLikedFoods,
        existingDislikedFoods,
        incomingLikedNames: incomingFoodPreferences.likes,
        incomingDislikedNames: incomingFoodPreferences.dislikes,
    });

    const conflicts = [...nutritionConflicts, ...foodListConflicts];

    const {
        mergedLikedFoods,
        mergedDislikedFoods,
    } = mergeFoodPreferenceLists({
        existingLikedFoods,
        existingDislikedFoods,
        incomingLikedNames: incomingFoodPreferences.likes,
        incomingDislikedNames: incomingFoodPreferences.dislikes,
    });

    const clarificationQuestions = buildClarificationQuestions({
        conflicts,
        ambiguousItems: preferenceSignals.ambiguousItems || [],
    });

    const mergedValidation = validateNutritionPreferencesUpdate({
        nutrition_preferences: mergedNutritionPreferences,
    });
    if (!mergedValidation.isValid) {
        const error = new Error('Invalid merged nutrition preference update');
        error.validationErrors = mergedValidation.errors;
        throw error;
    }

    return {
        partialUpdate,
        mergedNutritionPreferences,
        mergedLikedFoods,
        mergedDislikedFoods,
        conflicts,
        clarificationQuestions,
        extracted: compactNormalized,
    };
}

function buildNutritionPreferenceUpdate({
    text,
    existingNutritionPreferences = {},
    existingLikedFoods = [],
    existingDislikedFoods = [],
}) {
    const preferenceSignals = extractPreferenceSignalsFromText(text);
    const extracted = extractNutritionPreferencesFromText(text);
    const normalized = normalizeExtractedPreferences(extracted);
    const compactNormalized = compactObject(normalized) || {};

    return buildPipelineFromNormalized({
        compactNormalized,
        preferenceSignals,
        existingNutritionPreferences,
        existingLikedFoods,
        existingDislikedFoods,
    });
}

async function buildNutritionPreferenceUpdateWithEditor({
    text,
    existingNutritionPreferences = {},
    existingLikedFoods = [],
    existingDislikedFoods = [],
}) {
    const preferenceSignals = extractPreferenceSignalsFromText(text);
    const extracted = extractNutritionPreferencesFromText(text);
    const normalized = normalizeExtractedPreferences(extracted);
    const compactNormalized = compactObject(normalized) || {};
    const extractorPartialUpdate = Object.keys(compactNormalized).length
        ? { nutrition_preferences: compactNormalized }
        : {};

    let editorOutput = {
        enabled: false,
        decision: 'SAVE',
        edited_update_json: extractorPartialUpdate,
        edits_made: [],
        targeted_questions: [],
        confidence: 1,
        reasons: ['Editor agent not invoked'],
    };

    try {
        editorOutput = await runNutritionEditorAgent({
            rawText: text,
            extractorPartialUpdate,
            existingNutritionPreferences,
            conflicts: detectNutritionPreferenceConflicts(existingNutritionPreferences || {}, compactNormalized),
        });
    } catch (_error) {
        // Fallback to extractor-only output when editor fails.
        editorOutput = {
            enabled: true,
            decision: 'SAVE',
            edited_update_json: extractorPartialUpdate,
            edits_made: [],
            targeted_questions: [],
            confidence: 0.5,
            reasons: ['Editor agent crashed; fallback to extractor output'],
        };
    }

    const candidateUpdate = editorOutput?.edited_update_json && typeof editorOutput.edited_update_json === 'object'
        ? editorOutput.edited_update_json
        : extractorPartialUpdate;
    const candidatePreferences = candidateUpdate?.nutrition_preferences && typeof candidateUpdate.nutrition_preferences === 'object'
        ? candidateUpdate.nutrition_preferences
        : compactNormalized;

    const reNormalizedCandidate = compactObject(normalizeExtractedPreferences(candidatePreferences)) || {};

    let pipelineResult;
    try {
        pipelineResult = buildPipelineFromNormalized({
            compactNormalized: reNormalizedCandidate,
            preferenceSignals,
            existingNutritionPreferences,
            existingLikedFoods,
            existingDislikedFoods,
        });
    } catch (_error) {
        pipelineResult = buildPipelineFromNormalized({
            compactNormalized,
            preferenceSignals,
            existingNutritionPreferences,
            existingLikedFoods,
            existingDislikedFoods,
        });
    }

    const targetedQuestions = Array.isArray(editorOutput?.targeted_questions)
        ? editorOutput.targeted_questions
            .map((q) => ({
                type: 'editor_uncertainty',
                item: canonicalizeString(q?.unclear_text_span || q?.field_path || q?.id || ''),
                question: canonicalizeString(q?.question),
                field_path: canonicalizeString(q?.field_path),
                choices: Array.isArray(q?.choices) ? q.choices.map((choice) => canonicalizeString(choice)).filter(Boolean) : [],
            }))
            .filter((q) => q.question)
        : [];

    const mergedClarificationQuestions = [
        ...(pipelineResult.clarificationQuestions || []),
        ...targetedQuestions,
    ];

    const dedupedClarificationQuestions = [];
    const seenQuestionKeys = new Set();
    for (const question of mergedClarificationQuestions) {
        const key = `${canonicalizeString(question?.type)}:${canonicalizeString(question?.item)}:${canonicalizeString(question?.question)}`.toLowerCase();
        if (!key || seenQuestionKeys.has(key)) continue;
        seenQuestionKeys.add(key);
        dedupedClarificationQuestions.push(question);
    }

    return {
        ...pipelineResult,
        clarificationQuestions: dedupedClarificationQuestions,
        editor: editorOutput,
        doNotSave: editorOutput?.decision === 'DO_NOT_SAVE',
        doNotSaveReason: Array.isArray(editorOutput?.reasons) && editorOutput.reasons.length
            ? editorOutput.reasons.join(' ')
            : 'Editor agent marked this update as unsafe to save.',
    };
}

module.exports = {
    buildNutritionPreferenceUpdate,
    buildNutritionPreferenceUpdateWithEditor,
    buildNutritionPreferenceUpdateLegacy: buildNutritionPreferenceUpdate,
    extractNutritionPreferencesFromText,
    extractPreferenceSignalsFromText,
    normalizeExtractedPreferences,
    detectNutritionPreferenceConflicts,
    validateNutritionPreferencesUpdate,
    mergeNutritionPreferences,
};
