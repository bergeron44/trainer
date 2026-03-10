const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { runNutritionPreferencePhase1Pipeline } = require('../services/nutritionPreferencePhase1');

class MockJsonClient {
    constructor(payload) {
        this.payload = payload;
    }

    isConfigured() {
        return true;
    }

    async completeJson() {
        return this.payload;
    }
}

async function createTempLogPaths() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nutrition-phase1-'));
    return {
        dir,
        auditLogPath: path.join(dir, 'audit.jsonl'),
        programmerQueuePath: path.join(dir, 'queue.jsonl'),
    };
}

async function readJsonLines(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

test('phase1 pipeline AUTO_SAVE for grounded valid extraction', async () => {
    const logs = await createTempLogPaths();
    const extractorClient = new MockJsonClient({
        raw_text: 'I am vegan and kosher. I like couscous and pasta. I dislike onion and garlic.',
        proposed_update: {
            nutrition_preferences: {
                hard_restrictions: { diets: ['vegan', 'kosher'] },
                soft_likes: { foods: ['cuscus', 'pasta'] },
                soft_dislikes: { foods: ['onion', 'garlic'] },
                practical_constraints: { max_prep_time_minutes: 20 },
            },
        },
        uncertain_items: [],
        conflicts_detected: [],
        delete_requests: [],
    });
    const reviewerClient = new MockJsonClient({
        review_agreement: true,
        confidence: 0.95,
        grounding_issues: [],
        ambiguities: [],
        contradictions: [],
        delete_request_issues: [],
        rule_suggestions: [],
    });

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'I am vegan and kosher. I like couscous and pasta. I dislike onion and garlic.',
        userId: 'user-auto-save',
        existingNutritionPreferences: {},
        llm: { extractorClient, reviewerClient },
        logger: logs,
    });

    assert.equal(result.final_decision, 'AUTO_SAVE');
    assert.ok(result.merged_nutrition_preferences.hard_restrictions.diets.includes('vegan'));
    assert.ok(result.merged_nutrition_preferences.soft_likes.foods.includes('couscous'));
    assert.ok(result.merged_nutrition_preferences.soft_dislikes.foods.includes('garlic'));

    const auditLines = await readJsonLines(logs.auditLogPath);
    assert.ok(auditLines.length >= 1);
    assert.equal(auditLines[0].final_decision, 'AUTO_SAVE');

    await fs.rm(logs.dir, { recursive: true, force: true });
});

test('phase1 pipeline ASK_USER when ambiguity exists', async () => {
    const logs = await createTempLogPaths();
    const extractorClient = new MockJsonClient({
        raw_text: 'I try not to eat too many carbs.',
        proposed_update: {
            nutrition_preferences: {
                hard_restrictions: { forbidden_ingredients: ['carbs'] },
            },
        },
        uncertain_items: [],
        conflicts_detected: [],
        delete_requests: [],
    });
    const reviewerClient = new MockJsonClient({
        review_agreement: true,
        confidence: 0.71,
        grounding_issues: [],
        ambiguities: [{ message: 'The phrase is preference-like and ambiguous.' }],
        contradictions: [],
        delete_request_issues: [],
        rule_suggestions: [],
    });

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'I try not to eat too many carbs.',
        userId: 'user-ask',
        existingNutritionPreferences: {},
        llm: { extractorClient, reviewerClient },
        logger: logs,
    });

    assert.equal(result.final_decision, 'ASK_USER');
    assert.ok(String(result.clarification_question || '').length > 0);

    await fs.rm(logs.dir, { recursive: true, force: true });
});

test('phase1 pipeline DO_NOT_SAVE on invalid extractor shape', async () => {
    const logs = await createTempLogPaths();
    const extractorClient = new MockJsonClient({
        raw_text: 'Budget 50 usd daily',
        proposed_update: {
            random_field: { x: 1 },
        },
        uncertain_items: [],
        conflicts_detected: [],
        delete_requests: [],
    });
    const reviewerClient = new MockJsonClient({
        review_agreement: true,
        confidence: 0.9,
        grounding_issues: [],
        ambiguities: [],
        contradictions: [],
        delete_request_issues: [],
        rule_suggestions: [],
    });

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'Budget 50 usd daily',
        userId: 'user-invalid',
        existingNutritionPreferences: {},
        llm: { extractorClient, reviewerClient },
        logger: logs,
    });

    assert.equal(result.final_decision, 'DO_NOT_SAVE');
    assert.ok(result.programmer_review_queue_path);

    await fs.rm(logs.dir, { recursive: true, force: true });
});

test('phase1 accepts direct nutrition category keys in proposed_update', async () => {
    const logs = await createTempLogPaths();
    const extractorClient = new MockJsonClient({
        raw_text: 'I dislike tofu.',
        proposed_update: {
            soft_dislikes: { foods: ['tofu'] },
        },
        uncertain_items: [],
        conflicts_detected: [],
        delete_requests: [],
    });
    const reviewerClient = new MockJsonClient({
        review_agreement: true,
        confidence: 0.88,
        grounding_issues: [],
        ambiguities: [],
        contradictions: [],
        delete_request_issues: [],
        rule_suggestions: [],
    });

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'I dislike tofu.',
        userId: 'user-direct-keys',
        existingNutritionPreferences: {},
        llm: { extractorClient, reviewerClient },
        logger: logs,
    });

    assert.equal(result.final_decision, 'AUTO_SAVE');
    assert.ok(result.merged_nutrition_preferences.soft_dislikes.foods.includes('tofu'));

    await fs.rm(logs.dir, { recursive: true, force: true });
});

test('phase1 pipeline SAVE_FOR_PROGRAMMER_REVIEW on very low reviewer confidence', async () => {
    const logs = await createTempLogPaths();
    const extractorClient = new MockJsonClient({
        raw_text: 'I like pasta.',
        proposed_update: {
            nutrition_preferences: {
                soft_likes: { foods: ['pasta'] },
            },
        },
        uncertain_items: [],
        conflicts_detected: [],
        delete_requests: [],
    });
    const reviewerClient = new MockJsonClient({
        review_agreement: true,
        confidence: 0.1,
        grounding_issues: [],
        ambiguities: [],
        contradictions: [],
        delete_request_issues: [],
        rule_suggestions: [],
    });

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'I like pasta.',
        userId: 'user-review',
        existingNutritionPreferences: {},
        llm: { extractorClient, reviewerClient },
        logger: logs,
    });

    assert.equal(result.final_decision, 'SAVE_FOR_PROGRAMMER_REVIEW');
    assert.ok(result.programmer_review_queue_path);
    const queueLines = await readJsonLines(logs.programmerQueuePath);
    assert.ok(queueLines.length >= 1);

    await fs.rm(logs.dir, { recursive: true, force: true });
});

test('phase1 deterministic reviewer catches vegan + salmon contradiction', async () => {
    const logs = await createTempLogPaths();
    const extractorClient = new MockJsonClient({
        raw_text: 'I am vegan but I love salmon.',
        proposed_update: {
            nutrition_preferences: {
                hard_restrictions: { diets: ['vegan'] },
                soft_likes: { foods: ['salmon'] },
            },
        },
        uncertain_items: [],
        conflicts_detected: [],
        delete_requests: [],
    });

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'I am vegan but I love salmon.',
        userId: 'user-contradiction',
        existingNutritionPreferences: {},
        llm: { extractorClient },
        logger: logs,
    });

    assert.equal(result.final_decision, 'ASK_USER');
    assert.ok(result.reviewer_output.contradictions.length > 0);

    await fs.rm(logs.dir, { recursive: true, force: true });
});

test('phase1 pipeline handles mixed Hebrew-English schedule rule', async () => {
    const logs = await createTempLogPaths();
    const extractorClient = new MockJsonClient({
        raw_text: 'בשבת I want to indulge and keep dinner light.',
        proposed_update: {
            nutrition_preferences: {
                rule_based_preferences: {
                    day_rules: [{ day_of_week: 'Saturday', rule_type: 'cheat', note: 'בשבת indulge' }],
                    meal_time_rules: [{ meal_period: 'dinner', preference: 'light' }],
                },
            },
        },
        uncertain_items: [],
        conflicts_detected: [],
        delete_requests: [],
    });
    const reviewerClient = new MockJsonClient({
        review_agreement: true,
        confidence: 0.9,
        grounding_issues: [],
        ambiguities: [],
        contradictions: [],
        delete_request_issues: [],
        rule_suggestions: [],
    });

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'בשבת I want to indulge and keep dinner light.',
        userId: 'user-mixed-schedule',
        existingNutritionPreferences: {},
        llm: { extractorClient, reviewerClient },
        logger: logs,
    });

    assert.equal(result.final_decision, 'AUTO_SAVE');
    const dayRules = result.merged_nutrition_preferences.rule_based_preferences.day_rules || [];
    assert.ok(dayRules.some((rule) => rule.day_of_week === 'saturday' && rule.rule_type === 'cheat_day'));

    await fs.rm(logs.dir, { recursive: true, force: true });
});

test('phase1 Hebrew dislike text does not fail validation edge-case', async () => {
    const logs = await createTempLogPaths();
    const extractorClient = new MockJsonClient({
        raw_text: 'אני לא אוהב טופו',
        proposed_update: {
            nutrition_preferences: {
                soft_dislikes: { foods: ['טופו'] },
            },
        },
        uncertain_items: [],
        conflicts_detected: [],
        delete_requests: ['remove tofu from likes if exists'],
    });
    const reviewerClient = new MockJsonClient({
        review_agreement: true,
        confidence: 0.86,
        grounding_issues: [],
        ambiguities: [],
        contradictions: [],
        delete_request_issues: [],
        rule_suggestions: [],
    });

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'אני לא אוהב טופו',
        userId: 'user-hebrew-dislike',
        existingNutritionPreferences: {},
        llm: { extractorClient, reviewerClient },
        logger: logs,
    });

    assert.notEqual(result.final_decision, 'DO_NOT_SAVE');
    assert.ok(result.normalized_output?.nutrition_preferences?.soft_dislikes?.foods?.includes('טופו'));

    await fs.rm(logs.dir, { recursive: true, force: true });
});

test('phase1 falls back to deterministic extractor when LLM is unavailable', async () => {
    const logs = await createTempLogPaths();

    const result = await runNutritionPreferencePhase1Pipeline({
        rawText: 'אני אוהב טופו',
        userId: 'user-no-llm-fallback',
        existingNutritionPreferences: {},
        llm: {},
        logger: logs,
    });

    assert.equal(result.final_decision, 'AUTO_SAVE');
    assert.ok(result.merged_nutrition_preferences?.soft_likes?.foods?.length >= 1);

    await fs.rm(logs.dir, { recursive: true, force: true });
});
