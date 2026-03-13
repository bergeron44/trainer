function firstClarificationMessage({ reviewerOutput, conflicts, uncertainItems }) {
    if (Array.isArray(reviewerOutput?.ambiguities) && reviewerOutput.ambiguities.length) {
        return reviewerOutput.ambiguities[0]?.message || reviewerOutput.ambiguities[0]?.pattern || 'Please clarify ambiguous preference.';
    }
    if (Array.isArray(reviewerOutput?.contradictions) && reviewerOutput.contradictions.length) {
        return reviewerOutput.contradictions[0]?.message || 'Please clarify contradictory preferences.';
    }
    if (Array.isArray(conflicts) && conflicts.length) {
        return conflicts[0]?.message || 'Incoming preferences conflict with existing saved preferences.';
    }
    if (Array.isArray(uncertainItems) && uncertainItems.length) {
        return `Please clarify: ${String(uncertainItems[0])}`;
    }
    return null;
}

function decideNutritionExtraction({
    extractorOutput,
    normalizedResult,
    validationResult,
    reviewerOutput,
    conflictDetectorResult,
    safetyChecks = {},
}) {
    const reasons = [];
    const conflicts = Array.isArray(conflictDetectorResult) ? conflictDetectorResult : [];
    const uncertainItems = Array.isArray(normalizedResult?.uncertain_items) ? normalizedResult.uncertain_items : [];
    const ambiguities = Array.isArray(reviewerOutput?.ambiguities) ? reviewerOutput.ambiguities : [];
    const contradictions = Array.isArray(reviewerOutput?.contradictions) ? reviewerOutput.contradictions : [];
    const deleteRequestIssues = Array.isArray(reviewerOutput?.delete_request_issues) ? reviewerOutput.delete_request_issues : [];
    const deleteRequests = Array.isArray(normalizedResult?.delete_requests) ? normalizedResult.delete_requests : [];
    const extractedNutritionPreferences = normalizedResult?.normalized_output?.nutrition_preferences || {};
    const hasExtractedStructuredUpdate = Object.keys(extractedNutritionPreferences).length > 0;

    if (!validationResult?.is_valid) {
        reasons.push('Validation failed for normalized proposed_update.');
        return {
            final_decision: 'DO_NOT_SAVE',
            reasons,
            clarification_question: firstClarificationMessage({ reviewerOutput, conflicts, uncertainItems }),
        };
    }

    if ((safetyChecks.recent_failure_count || 0) >= 3) {
        reasons.push('Repeated failure pattern detected.');
        return {
            final_decision: 'SAVE_FOR_PROGRAMMER_REVIEW',
            reasons,
            clarification_question: null,
        };
    }

    if (Number(reviewerOutput?.confidence || 0) < 0.25) {
        reasons.push('Reviewer confidence is very low.');
        return {
            final_decision: 'SAVE_FOR_PROGRAMMER_REVIEW',
            reasons,
            clarification_question: null,
        };
    }

    if (Array.isArray(validationResult?.unknown_top_level_keys) && validationResult.unknown_top_level_keys.length) {
        reasons.push('Unsafe overwrite attempt: unknown top-level fields in proposed_update.');
        return {
            final_decision: 'DO_NOT_SAVE',
            reasons,
            clarification_question: null,
        };
    }

    if (reviewerOutput?.review_agreement === false && Array.isArray(reviewerOutput.grounding_issues) && reviewerOutput.grounding_issues.length) {
        reasons.push('Reviewer disagrees: extracted facts are not grounded enough.');
        return {
            final_decision: 'DO_NOT_SAVE',
            reasons,
            clarification_question: firstClarificationMessage({ reviewerOutput, conflicts, uncertainItems }),
        };
    }

    if (!hasExtractedStructuredUpdate) {
        reasons.push('No structured update was extracted from the text.');
        return {
            final_decision: 'ASK_USER',
            reasons,
            clarification_question: firstClarificationMessage({ reviewerOutput, conflicts, uncertainItems }) || 'Please restate your nutrition preference in a clearer way.',
        };
    }

    if (deleteRequestIssues.length) {
        reasons.push('Delete request needs clarification before safe save.');
        return {
            final_decision: 'ASK_USER',
            reasons,
            clarification_question: firstClarificationMessage({ reviewerOutput, conflicts, uncertainItems }),
        };
    }

    if (ambiguities.length || contradictions.length) {
        reasons.push('Clarification required before safe save.');
        return {
            final_decision: 'ASK_USER',
            reasons,
            clarification_question: firstClarificationMessage({ reviewerOutput, conflicts, uncertainItems }),
        };
    }

    if (uncertainItems.length) {
        reasons.push('Saved with caution: some uncertain phrases were detected.');
    }
    if (deleteRequests.length) {
        reasons.push('Saved with explicit user-negation signals.');
    }
    if (conflicts.length) {
        reasons.push('Saved and merged with existing preferences using deterministic conflict handling.');
    }
    reasons.push('Validated extraction with reviewer agreement.');
    return {
        final_decision: 'AUTO_SAVE',
        reasons,
        clarification_question: null,
    };
}

module.exports = {
    decideNutritionExtraction,
};
