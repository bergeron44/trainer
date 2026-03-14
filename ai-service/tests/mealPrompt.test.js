const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildMealRecapSystem,
    buildMealRecapUserMessage,
} = require('../prompts/mealPrompt');

test('meal recap prompt requests ingredients plus one detailed recipe guide and keeps macro flexibility', () => {
    const user = {
        profile: {
            trainer_personality: 'scientist',
        },
    };

    const systemPrompt = buildMealRecapSystem(user);
    const userPrompt = buildMealRecapUserMessage({
        meal: {
            meal_name: 'Salmon Rice Bowl',
            foods: [{ name: 'salmon', portion: '180g', calories: 360 }],
            total_calories: 620,
            total_protein: 42,
            total_carbs: 55,
            total_fat: 18,
        },
        current_consumed: {
            calories: 900,
            protein: 70,
            carbs: 80,
            fat: 30,
        },
        daily_targets: {
            calories: 2200,
            protein: 160,
            carbs: 220,
            fat: 70,
        },
        remaining_before_meal: {
            calories: 1300,
            protein: 90,
            carbs: 140,
            fat: 40,
        },
        updated_macros: {
            consumed_after_meal: {
                calories: 1520,
                protein: 112,
                carbs: 135,
                fat: 48,
            },
            remaining_after_meal: {
                calories: 680,
                protein: 48,
                carbs: 85,
                fat: 22,
            },
        },
        meal_request_note: 'High protein, easy digestion.',
        meal_request_priority: 'high',
    });

    assert.match(systemPrompt, /only recipe-making content/i);
    assert.match(systemPrompt, /not an exact match/i);
    assert.match(userPrompt, /Updated totals after this meal/i);
    assert.match(userPrompt, /Calories\/protein\/carbs\/fat do NOT need to match/i);
    assert.match(userPrompt, /ingredients rubric/i);
    assert.match(userPrompt, /"recipe_title":/);
    assert.match(userPrompt, /"ingredients_rubric":/);
    assert.match(userPrompt, /"recipe_guide":/);
    assert.match(userPrompt, /High protein, easy digestion/);
});
