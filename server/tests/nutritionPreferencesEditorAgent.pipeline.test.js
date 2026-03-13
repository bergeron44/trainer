const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildNutritionPreferenceUpdate,
    buildNutritionPreferenceUpdateWithEditor,
} = require('../services/nutritionPreferences');

test('editor-enabled pipeline falls back safely when editor is disabled', async () => {
    const prev = process.env.NUTRITION_EDITOR_ENABLED;
    process.env.NUTRITION_EDITOR_ENABLED = 'false';

    try {
        const input = {
            text: 'I like pasta and dislike tofu.',
            existingNutritionPreferences: {
                soft_likes: { foods: ['rice'] },
            },
            existingLikedFoods: [{ name: 'Tofu' }],
            existingDislikedFoods: [],
        };

        const legacy = buildNutritionPreferenceUpdate(input);
        const withEditor = await buildNutritionPreferenceUpdateWithEditor(input);

        assert.deepEqual(withEditor.partialUpdate, legacy.partialUpdate);
        assert.deepEqual(withEditor.mergedNutritionPreferences, legacy.mergedNutritionPreferences);
        assert.equal(withEditor.editor?.enabled, false);
        assert.equal(withEditor.doNotSave, false);
    } finally {
        process.env.NUTRITION_EDITOR_ENABLED = prev;
    }
});

test('editor-enabled pipeline preserves save path when provider is unavailable', async () => {
    const prevEditorFlag = process.env.NUTRITION_EDITOR_ENABLED;
    const prevProvider = process.env.LLM_PROVIDER;

    process.env.NUTRITION_EDITOR_ENABLED = 'true';
    process.env.LLM_PROVIDER = 'invalid_provider_name_for_test';

    try {
        const result = await buildNutritionPreferenceUpdateWithEditor({
            text: 'אני אוהב קוסקוס ולא אוהב טופו',
            existingNutritionPreferences: {
                soft_likes: { foods: ['rice'] },
            },
            existingLikedFoods: [{ name: 'tofu' }],
            existingDislikedFoods: [],
        });

        assert.ok(result.partialUpdate);
        assert.equal(result.doNotSave, false);
        assert.equal(result.editor?.decision, 'SAVE');
        assert.ok(Array.isArray(result.clarificationQuestions));
    } finally {
        process.env.NUTRITION_EDITOR_ENABLED = prevEditorFlag;
        process.env.LLM_PROVIDER = prevProvider;
    }
});
