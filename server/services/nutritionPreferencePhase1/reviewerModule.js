const { canonicalizeString, dedupeStrings } = require('../nutritionPreferences/normalizationService');
const { LlmStructuredJsonClient } = require('./llmStructuredJsonClient');

function toObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function lower(value) {
    return canonicalizeString(value).toLowerCase();
}

function extractFoodMentionsFromNormalized(normalizedOutput = {}) {
    const np = toObject(normalizedOutput.nutrition_preferences);
    return dedupeStrings([
        ...toArray(np.soft_likes?.foods),
        ...toArray(np.soft_dislikes?.foods),
        ...toArray(np.hard_restrictions?.forbidden_ingredients),
    ]);
}

function detectInternalPreferenceContradictions(normalizedOutput = {}) {
    const np = toObject(normalizedOutput.nutrition_preferences);
    const likeFoods = new Set(toArray(np.soft_likes?.foods).map((item) => lower(item)));
    const dislikeFoods = new Set(toArray(np.soft_dislikes?.foods).map((item) => lower(item)));
    const contradictions = [];

    for (const item of likeFoods) {
        if (dislikeFoods.has(item)) {
            contradictions.push(`Same message contains both like and dislike for "${item}".`);
        }
    }

    const diets = new Set(toArray(np.hard_restrictions?.diets).map((item) => lower(item)));
    const likedFoods = new Set(toArray(np.soft_likes?.foods).map((item) => lower(item)));
    if (diets.has('vegan') && likedFoods.has('salmon')) {
        contradictions.push('Vegan diet conflicts with liking salmon.');
    }

    return contradictions;
}

function buildRuleSuggestions({ groundingIssues = [], ambiguities = [] }) {
    const suggestions = [];

    for (const issue of groundingIssues) {
        suggestions.push({
            proposal_type: 'add_prompt_clarification',
            target: 'promptClarifications',
            proposal: {
                clarification: 'Do not extract food items unless they appear explicitly or as known synonyms.',
            },
            reason: issue,
        });
        break;
    }

    for (const ambiguity of ambiguities) {
        suggestions.push({
            proposal_type: 'add_ambiguity_rule',
            target: 'ambiguityRules',
            proposal: {
                pattern: ambiguity.pattern || ambiguity,
                action: 'mark_uncertain',
            },
            reason: 'Ambiguous wording should stay uncertain before save.',
        });
        break;
    }

    return suggestions;
}

function deterministicReview({
    rawText,
    normalizedOutput,
    normalizedResult,
    validationResult,
    conflictDetectorResult,
}) {
    const text = lower(rawText);
    const groundingIssues = [];
    const extractedFoods = extractFoodMentionsFromNormalized(normalizedOutput);

    for (const food of extractedFoods) {
        const token = lower(food);
        if (!token) continue;
        if (!text.includes(token)) {
            groundingIssues.push(`Extracted food "${food}" is not clearly grounded in source text.`);
        }
    }

    const ambiguities = toArray(normalizedResult?.ambiguity_signals).map((signal) => ({
        pattern: signal.pattern,
        message: `Ambiguous phrase detected: ${signal.pattern}`,
    }));
    const contradictions = detectInternalPreferenceContradictions(normalizedOutput);
    const deleteRequestIssues = toArray(validationResult?.delete_request_issues);
    const conflictMessages = toArray(conflictDetectorResult).map((conflict) => ({
        path: conflict.path,
        message: conflict.message,
    }));

    const hasHardIssue = !validationResult?.is_valid || groundingIssues.length > 0;
    const hasSoftIssue = ambiguities.length > 0 || contradictions.length > 0 || conflictMessages.length > 0;
    const confidence = hasHardIssue ? 0.3 : hasSoftIssue ? 0.62 : 0.92;

    return {
        review_agreement: !hasHardIssue,
        confidence,
        grounding_issues: groundingIssues,
        ambiguities,
        contradictions: [
            ...contradictions.map((message) => ({ message })),
            ...conflictMessages,
        ],
        delete_request_issues: deleteRequestIssues,
        rule_suggestions: buildRuleSuggestions({ groundingIssues, ambiguities }),
    };
}

function sanitizeReviewerOutput(output, fallback) {
    const source = toObject(output);
    const base = deterministicReview(fallback);

    return {
        review_agreement: typeof source.review_agreement === 'boolean' ? source.review_agreement : base.review_agreement,
        confidence: Number.isFinite(source.confidence) ? Math.min(1, Math.max(0, source.confidence)) : base.confidence,
        grounding_issues: toArray(source.grounding_issues).length ? toArray(source.grounding_issues) : base.grounding_issues,
        ambiguities: toArray(source.ambiguities).length ? toArray(source.ambiguities) : base.ambiguities,
        contradictions: toArray(source.contradictions).length ? toArray(source.contradictions) : base.contradictions,
        delete_request_issues: toArray(source.delete_request_issues).length ? toArray(source.delete_request_issues) : base.delete_request_issues,
        rule_suggestions: toArray(source.rule_suggestions).length ? toArray(source.rule_suggestions) : base.rule_suggestions,
    };
}

function buildReviewerPrompts({ rawText, extractorOutput, normalizedOutput, validationResult }) {
    const system = [
        'You are a constrained reviewer module for nutrition extraction.',
        'Return JSON only with this exact shape:',
        JSON.stringify({
            review_agreement: true,
            confidence: 0.0,
            grounding_issues: [],
            ambiguities: [],
            contradictions: [],
            delete_request_issues: [],
            rule_suggestions: [],
        }, null, 2),
        'You must not suggest schema, enum, validator, merge-logic, or DB changes.',
    ].join('\n');

    const user = [
        'Review extractor output against source text.',
        'raw_text:',
        rawText,
        '',
        'extractor_output:',
        JSON.stringify(extractorOutput || {}, null, 2),
        '',
        'normalized_output:',
        JSON.stringify(normalizedOutput || {}, null, 2),
        '',
        'validation_result:',
        JSON.stringify(validationResult || {}, null, 2),
        '',
        'Return JSON only.',
    ].join('\n');

    return { system, user };
}

function createReviewerModule(config = {}) {
    const llmClient = config.llmClient || new LlmStructuredJsonClient({
        model: config.model || process.env.NUTRITION_REVIEWER_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: Number.isFinite(config.temperature) ? config.temperature : 0.0,
        maxTokens: config.maxTokens || 1200,
    });

    return {
        isConfigured: () => llmClient.isConfigured(),
        async review(input) {
            const fallback = deterministicReview(input);
            if (!llmClient.isConfigured()) {
                return fallback;
            }

            try {
                const { system, user } = buildReviewerPrompts(input);
                const raw = await llmClient.completeJson({
                    system,
                    user,
                    temperature: 0.0,
                    maxTokens: 1200,
                });
                return sanitizeReviewerOutput(raw, input);
            } catch (_error) {
                return fallback;
            }
        },
    };
}

module.exports = {
    createReviewerModule,
};
