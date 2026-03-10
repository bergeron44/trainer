const { validateNutritionPreferencesUpdate } = require('../nutritionPreferences/validator');

const DIRECT_NUTRITION_CATEGORY_KEYS = new Set([
    'hard_restrictions',
    'soft_likes',
    'soft_dislikes',
    'budget_preferences',
    'rule_based_preferences',
    'practical_constraints',
]);

function toObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function validateDeleteRequests(deleteRequests = []) {
    const issues = [];
    const requests = toArray(deleteRequests);

    for (const request of requests) {
        if (!request || typeof request !== 'object') {
            issues.push({ message: 'Delete request must be an object.' });
            continue;
        }

        const path = String(request.path || '').trim();
        if (!path) {
            issues.push({ message: 'Delete request is missing path.' });
        }

        if (!path.startsWith('nutrition_preferences.')) {
            issues.push({
                path,
                message: 'Delete request path is outside nutrition_preferences and is not allowed.',
            });
        }
    }

    return issues;
}

function validateNormalizedExtraction({ normalizedResult, extractorOutput }) {
    const normalizedOutput = toObject(normalizedResult?.normalized_output);
    const extractor = toObject(extractorOutput);
    const proposedUpdate = toObject(extractor.proposed_update);
    const topLevelKeys = Object.keys(proposedUpdate);

    const unknownTopLevelKeys = topLevelKeys.filter(
        (key) => key !== 'nutrition_preferences' && !DIRECT_NUTRITION_CATEGORY_KEYS.has(key)
    );
    const validatorResult = validateNutritionPreferencesUpdate(normalizedOutput);
    const deleteRequestIssues = validateDeleteRequests(normalizedResult?.delete_requests || []);

    const schemaErrors = [];
    if (unknownTopLevelKeys.length) {
        schemaErrors.push({
            path: 'proposed_update',
            message: `Unknown top-level fields in proposed_update: ${unknownTopLevelKeys.join(', ')}`,
        });
    }
    if (!validatorResult.isValid) {
        schemaErrors.push(...validatorResult.errors);
    }

    return {
        is_valid: schemaErrors.length === 0,
        errors: schemaErrors,
        validator_result: validatorResult,
        unknown_top_level_keys: unknownTopLevelKeys,
        delete_request_issues: deleteRequestIssues,
    };
}

module.exports = {
    validateNormalizedExtraction,
};
