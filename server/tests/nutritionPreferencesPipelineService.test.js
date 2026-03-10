const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildNutritionPreferenceUpdate,
    mergeNutritionPreferences,
    normalizeExtractedPreferences,
    detectNutritionPreferenceConflicts,
    validateNutritionPreferencesUpdate,
} = require('../services/nutritionPreferences');

test('extracts realistic mixed Hebrew-English nutrition preferences', () => {
    const text = [
        'I am vegan and kosher.',
        'אני אלרגי לבוטנים.',
        'I like Mediterranean and sushi, but I do not like mushrooms.',
        'Budget: 80 ₪ per day.',
        'One cheat meal per week on Saturday.',
        'In the evening I want a light meal up to 500 calories.',
        'max 20 minutes prep, beginner, microwave only, 3 meals per day.',
    ].join(' ');

    const result = buildNutritionPreferenceUpdate({
        text,
        existingNutritionPreferences: {},
    });

    const update = result.partialUpdate.nutrition_preferences;
    assert.ok(update);
    assert.deepEqual(update.hard_restrictions.diets.sort(), ['kosher', 'vegan']);
    assert.ok(update.hard_restrictions.allergies.includes('בוטנים'));
    assert.ok(update.soft_likes.cuisines.includes('mediterranean'));
    assert.ok(update.soft_likes.foods.includes('sushi'));
    assert.ok(update.soft_dislikes.foods.includes('mushrooms'));
    assert.equal(update.budget_preferences.daily_budget, 80);
    assert.equal(update.budget_preferences.currency, 'ILS');
    assert.equal(update.rule_based_preferences.cheat_meals_per_week, 1);
    assert.ok(update.rule_based_preferences.cheat_days.includes('saturday'));
    assert.ok(Array.isArray(update.rule_based_preferences.day_rules));
    assert.ok(update.rule_based_preferences.day_rules.some((rule) => rule.day_of_week === 'saturday' && rule.rule_type === 'cheat_day'));
    assert.ok(Array.isArray(update.rule_based_preferences.meal_time_rules));
    assert.ok(update.rule_based_preferences.meal_time_rules.some((rule) => rule.meal_period === 'evening_snack' && rule.preference === 'light' && rule.max_calories === 500));
    assert.equal(update.practical_constraints.max_prep_time_minutes, 20);
    assert.equal(update.practical_constraints.cooking_skill, 'beginner');
    assert.ok(update.practical_constraints.equipment.includes('microwave'));
    assert.equal(update.practical_constraints.meals_per_day, 3);
});

test('returns partial update only for extracted categories', () => {
    const result = buildNutritionPreferenceUpdate({
        text: 'My budget is 60 USD per day.',
        existingNutritionPreferences: {},
    });

    const categories = Object.keys(result.partialUpdate.nutrition_preferences || {});
    assert.deepEqual(categories, ['budget_preferences']);
    assert.equal(result.partialUpdate.nutrition_preferences.budget_preferences.daily_budget, 60);
    assert.equal(result.partialUpdate.nutrition_preferences.budget_preferences.currency, 'USD');
});

test('merge deduplicates arrays and preserves unrelated existing fields', () => {
    const existing = {
        soft_likes: {
            foods: ['Sushi'],
        },
        practical_constraints: {
            meals_per_day: 4,
        },
    };
    const incoming = {
        soft_likes: {
            foods: ['sushi', 'salmon'],
        },
    };

    const merged = mergeNutritionPreferences(existing, incoming);
    assert.deepEqual(merged.soft_likes.foods.sort(), ['sushi', 'salmon'].sort());
    assert.equal(merged.practical_constraints.meals_per_day, 4);
});

test('detects conflicts with existing saved preferences', () => {
    const existing = {
        hard_restrictions: { diets: ['vegan'] },
        soft_likes: { foods: ['mushrooms'] },
    };
    const incoming = {
        hard_restrictions: { diets: ['pescatarian'] },
        soft_dislikes: { foods: ['mushrooms'] },
    };

    const conflicts = detectNutritionPreferenceConflicts(existing, incoming);
    assert.ok(conflicts.length >= 2);
    assert.ok(conflicts.some((conflict) => conflict.path === 'nutrition_preferences.hard_restrictions.diets'));
    assert.ok(conflicts.some((conflict) => conflict.path === 'nutrition_preferences.soft_dislikes'));
});

test('validator rejects invalid schema updates', () => {
    const validation = validateNutritionPreferencesUpdate({
        nutrition_preferences: {
            rule_based_preferences: {
                cheat_days: ['funday'],
            },
        },
    });

    assert.equal(validation.isValid, false);
    assert.ok(validation.errors.length > 0);
});

test('does not populate liked_foods or disliked_foods from free text extraction', () => {
    const result = buildNutritionPreferenceUpdate({
        text: 'I like chicken and rice, but I dislike liver.',
        existingNutritionPreferences: {},
    });

    assert.equal(Object.prototype.hasOwnProperty.call(result.partialUpdate, 'liked_foods'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result.partialUpdate, 'disliked_foods'), false);
});

test('latest statement wins: incoming dislike removes prior like across soft + game lists', () => {
    const result = buildNutritionPreferenceUpdate({
        text: 'I do not like tofu.',
        existingNutritionPreferences: {
            soft_likes: { foods: ['tofu'] },
            soft_dislikes: { foods: [] },
        },
        existingLikedFoods: [{ name: 'tofu', calories: 0, protein: 0, carbs: 0, fat: 0 }],
        existingDislikedFoods: [],
    });

    const merged = result.mergedNutritionPreferences;
    assert.ok(merged.soft_dislikes.foods.includes('tofu'));
    assert.equal((merged.soft_likes?.foods || []).includes('tofu'), false);

    assert.equal(result.mergedLikedFoods.some((food) => String(food.name).toLowerCase() === 'tofu'), false);
    assert.equal(result.mergedDislikedFoods.some((food) => String(food.name).toLowerCase() === 'tofu'), false);
    assert.ok(result.clarificationQuestions.length > 0);
});

test('same text conflict keeps latest mention and returns clarification question', () => {
    const result = buildNutritionPreferenceUpdate({
        text: 'I like tofu, but I dislike tofu.',
        existingNutritionPreferences: {},
        existingLikedFoods: [],
        existingDislikedFoods: [],
    });

    const merged = result.mergedNutritionPreferences;
    assert.equal((merged.soft_likes?.foods || []).includes('tofu'), false);
    assert.equal((merged.soft_dislikes?.foods || []).includes('tofu'), true);
    assert.ok(
        result.clarificationQuestions.some(
            (question) => question.type === 'same_text_conflict' && question.item === 'tofu'
        )
    );
});

test('merge normalizes expressive variants and keeps dislike side for overlap', () => {
    const merged = mergeNutritionPreferences(
        {
            soft_likes: { foods: ['טופו'] },
            soft_dislikes: { foods: ['טופו בכלל'] },
        },
        {}
    );

    assert.equal((merged.soft_likes?.foods || []).includes('טופו'), false);
    assert.ok((merged.soft_dislikes?.foods || []).some((item) => String(item).includes('טופו')));
});

test('normalization cleans preference phrases from food tokens', () => {
    const normalized = normalizeExtractedPreferences({
        soft_likes: {
            foods: ['טופו אני אוהב טופו'],
        },
        soft_dislikes: {
            foods: ['טופו אני לא אוהב טופו'],
        },
    });

    assert.ok((normalized.soft_likes?.foods || []).includes('טופו'));
    assert.ok((normalized.soft_dislikes?.foods || []).includes('טופו'));
});

test('cross-language tofu conflict removes liked_foods tofu when incoming dislike is Hebrew', () => {
    const result = buildNutritionPreferenceUpdate({
        text: '\u05d0\u05e0\u05d9 \u05dc\u05d0 \u05d0\u05d5\u05d4\u05d1 \u05d8\u05d5\u05e4\u05d5',
        existingNutritionPreferences: {
            soft_likes: { foods: ['tofu'] },
            soft_dislikes: { foods: [] },
        },
        existingLikedFoods: [{ name: 'tofu' }],
        existingDislikedFoods: [],
    });

    assert.equal((result.mergedNutritionPreferences?.soft_likes?.foods || []).includes('tofu'), false);
    assert.ok((result.mergedNutritionPreferences?.soft_dislikes?.foods || []).some((item) => String(item).includes('\u05d8\u05d5\u05e4\u05d5')));
    assert.equal(result.mergedLikedFoods.some((food) => String(food.name).toLowerCase() === 'tofu'), false);
    assert.equal(result.mergedDislikedFoods.some((food) => String(food.name).toLowerCase() === 'tofu'), false);
});

test('free-text extraction does not add new liked/disliked game items', () => {
    const result = buildNutritionPreferenceUpdate({
        text: 'I like pasta and I dislike tofu.',
        existingNutritionPreferences: {},
        existingLikedFoods: [],
        existingDislikedFoods: [],
    });

    assert.equal(result.mergedLikedFoods.length, 0);
    assert.equal(result.mergedDislikedFoods.length, 0);
    assert.ok((result.mergedNutritionPreferences?.soft_likes?.foods || []).includes('pasta'));
    assert.ok((result.mergedNutritionPreferences?.soft_dislikes?.foods || []).includes('tofu'));
});

test('extracts time_context_notes for day and meal period guidance', () => {
    const result = buildNutritionPreferenceUpdate({
        text: 'On Saturday dinner keep the meal very light. In the evening keep meals easy to digest.',
        existingNutritionPreferences: {},
    });

    const notes = result.partialUpdate?.nutrition_preferences?.rule_based_preferences?.time_context_notes || [];
    assert.ok(Array.isArray(notes));
    assert.ok(notes.some((entry) => entry.day_of_week === 'saturday' && entry.meal_period === 'dinner'));
    assert.ok(notes.some((entry) => entry.day_of_week === 'any' && entry.meal_period === 'evening_snack'));
});

test('hebrew day preference keeps food token and writes saturday time notes', () => {
    const result = buildNutritionPreferenceUpdate({
        text: '\u05d0\u05e0\u05d9 \u05d0\u05d5\u05d4\u05d1 \u05d2\'\u05d7\u05e0\u05d5\u05df \u05d1\u05e9\u05d1\u05ea',
        existingNutritionPreferences: {},
    });

    const prefs = result.partialUpdate?.nutrition_preferences || {};
    const foods = prefs.soft_likes?.foods || [];
    assert.ok(foods.includes('\u05d2\'\u05d7\u05e0\u05d5\u05df'));

    const saturdayNote = prefs.rule_based_preferences?.time_notes?.by_day?.saturday || '';
    assert.ok(String(saturdayNote).includes('\u05d2\'\u05d7\u05e0\u05d5\u05df'));

    const contextNotes = prefs.rule_based_preferences?.time_context_notes || [];
    assert.ok(contextNotes.some((entry) => entry.day_of_week === 'saturday' && entry.meal_period === 'any'));
});
