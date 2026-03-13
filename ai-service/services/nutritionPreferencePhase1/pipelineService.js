const { loadSafeRuleLayer } = require('./rules');
const { createExtractorModule } = require('./extractorModule');
const { normalizeExtractionResult } = require('./normalizationModule');
const { validateNormalizedExtraction } = require('./validationModule');
const { createReviewerModule } = require('./reviewerModule');
const { decideNutritionExtraction } = require('./decisionEngine');
const { appendNutritionAuditLog } = require('./auditLogger');
const { enqueueProgrammerReview } = require('./programmerReviewQueue');
const { detectNutritionPreferenceConflicts } = require('../nutritionPreferences/conflictDetector');
const { mergeNutritionPreferences } = require('../nutritionPreferences/mergeService');

function buildErrorType({ validationResult, reviewerOutput, decision }) {
    if (!validationResult?.is_valid) return 'validation_error';
    if (Array.isArray(reviewerOutput?.grounding_issues) && reviewerOutput.grounding_issues.length) return 'grounding_error';
    if (decision === 'ASK_USER') return 'clarification_required';
    if (decision === 'SAVE_FOR_PROGRAMMER_REVIEW') return 'manual_review_required';
    return null;
}

async function runNutritionPreferencePhase1Pipeline({
    rawText,
    userId,
    existingNutritionPreferences = {},
    llm = {},
    recentFailureCount = 0,
    logger = {},
}) {
    const safeRuleLayer = loadSafeRuleLayer();
    const extractor = createExtractorModule({
        llmClient: llm.extractorClient,
        model: llm.extractorModel,
        temperature: llm.extractorTemperature,
    });
    const reviewer = createReviewerModule({
        llmClient: llm.reviewerClient,
        model: llm.reviewerModel,
        temperature: llm.reviewerTemperature,
    });

    let extractorOutput;
    try {
        extractorOutput = await extractor.extract({
            rawText,
            existingPreferences: existingNutritionPreferences,
            safeRuleLayer,
        });
    } catch (error) {
        extractorOutput = {
            raw_text: String(rawText || ''),
            proposed_update: {},
            uncertain_items: ['Extractor failed to parse input.'],
            conflicts_detected: [],
            delete_requests: [],
            extractor_error: error?.message || 'Extractor failed',
        };
    }

    const normalizedResult = normalizeExtractionResult({
        extractorOutput,
        safeRuleLayer,
    });

    const validationResult = validateNormalizedExtraction({
        normalizedResult,
        extractorOutput,
    });

    const normalizedPreferences = normalizedResult.normalized_output?.nutrition_preferences || {};
    const conflictDetectorResult = detectNutritionPreferenceConflicts(
        existingNutritionPreferences || {},
        normalizedPreferences
    );

    const reviewerOutput = await reviewer.review({
        rawText: extractorOutput.raw_text || rawText,
        extractorOutput,
        normalizedOutput: normalizedResult.normalized_output,
        normalizedResult,
        validationResult,
        conflictDetectorResult,
    });

    const decision = decideNutritionExtraction({
        extractorOutput,
        normalizedResult,
        validationResult,
        reviewerOutput,
        conflictDetectorResult,
        safetyChecks: {
            recent_failure_count: recentFailureCount,
        },
    });

    const mergedNutritionPreferences = decision.final_decision === 'AUTO_SAVE'
        ? mergeNutritionPreferences(existingNutritionPreferences || {}, normalizedPreferences || {})
        : existingNutritionPreferences || {};

    const { logPath, entry: auditEntry } = await appendNutritionAuditLog({
        filePath: logger.auditLogPath,
        user_id: userId,
        raw_text: extractorOutput.raw_text || rawText,
        extractor_output: extractorOutput,
        normalized_output: normalizedResult.normalized_output,
        validation_result: validationResult,
        reviewer_output: reviewerOutput,
        final_decision: decision.final_decision,
        clarification_question: decision.clarification_question,
        error_type: buildErrorType({
            validationResult,
            reviewerOutput,
            decision: decision.final_decision,
        }),
        corrected_output_if_available: normalizedResult.normalized_output || null,
    });

    let reviewQueue = null;
    if (decision.final_decision === 'SAVE_FOR_PROGRAMMER_REVIEW' || decision.final_decision === 'DO_NOT_SAVE') {
        reviewQueue = await enqueueProgrammerReview({
            filePath: logger.programmerQueuePath,
            user_id: userId,
            reason: decision.reasons.join(' '),
            audit_entry: auditEntry,
            extractor_output: extractorOutput,
            reviewer_output: reviewerOutput,
            final_decision: decision.final_decision,
        });
    }

    return {
        extractor_output: extractorOutput,
        normalized_output: normalizedResult.normalized_output,
        validation_result: validationResult,
        reviewer_output: reviewerOutput,
        conflicts_detected: conflictDetectorResult,
        final_decision: decision.final_decision,
        decision_reasons: decision.reasons,
        clarification_question: decision.clarification_question,
        merged_nutrition_preferences: mergedNutritionPreferences,
        rule_suggestions: reviewerOutput.rule_suggestions || [],
        audit_log_path: logPath,
        programmer_review_queue_path: reviewQueue?.queuePath || null,
    };
}

module.exports = {
    runNutritionPreferencePhase1Pipeline,
};
