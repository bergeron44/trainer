const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildMealPeriodsFromCount,
    buildOnboardingAiNutritionMenu,
} = require('../utils/onboardingNutritionMenuBuilder');

test('buildMealPeriodsFromCount returns canonical meal labels for 2-6 meals', () => {
    assert.deepEqual(buildMealPeriodsFromCount(2), ['First Meal', 'Final Feast']);
    assert.deepEqual(buildMealPeriodsFromCount(3), ['Morning Fuel', 'Midday Recharger', 'Evening Recovery']);
    assert.deepEqual(buildMealPeriodsFromCount(4), ['Breakfast', 'Lunch', 'Pre-Workout Snack', 'Dinner']);
    assert.deepEqual(buildMealPeriodsFromCount(5), ['Early Kickoff', 'Mid-Morning Snack', 'Lunch', 'Afternoon Fuel', 'Dinner']);
    assert.deepEqual(buildMealPeriodsFromCount(6), ['Early Kickoff', 'Mid-Morning Snack', 'Lunch', 'Afternoon Fuel', 'Dinner', 'Evening Snack']);
});

test('buildOnboardingAiNutritionMenu flattens LLM meal periods into menu entries with hidden reasoning', async () => {
    const result = await buildOnboardingAiNutritionMenu({
        profile: {
            goal: 'weight_loss',
            diet_type: 'everything',
            target_calories: 1800,
        },
        likedFoods: [
            { name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 4 },
        ],
        dislikedFoods: [{ name: 'Mushrooms' }],
        date: new Date('2026-03-09T00:00:00.000Z'),
        userId: 'user-123',
        generateChat: async () => ({
            text: JSON.stringify({
                reasoning: {
                    meal_count: 3,
                    meal_count_rationale: 'Three meals fit the weight-loss target.',
                    option_count: 3,
                    option_count_rationale: 'Three options give enough variety.',
                    notes: ['Keep execution simple.'],
                },
                meal_periods: [
                    {
                        meal_period: 'whatever-breakfast-label',
                        options: [
                            {
                                meal_name: 'Yogurt Bowl',
                                foods: [{ name: 'Greek Yogurt', portion: '220g', calories: 200, protein: 22, carbs: 10, fat: 5 }],
                                total_calories: 200,
                                total_protein: 22,
                                total_carbs: 10,
                                total_fat: 5,
                            },
                            {
                                meal_name: 'Egg Toast',
                                foods: [{ name: 'Eggs', portion: '2 units', calories: 150, protein: 12, carbs: 1, fat: 10 }],
                                total_calories: 150,
                                total_protein: 12,
                                total_carbs: 1,
                                total_fat: 10,
                            },
                            {
                                meal_name: 'Protein Oats',
                                foods: [{ name: 'Oats', portion: '70g', calories: 270, protein: 9, carbs: 46, fat: 5 }],
                                total_calories: 270,
                                total_protein: 9,
                                total_carbs: 46,
                                total_fat: 5,
                            },
                        ],
                    },
                    {
                        meal_period: 'whatever-lunch-label',
                        options: [
                            {
                                meal_name: 'Chicken Rice',
                                foods: [{ name: 'Chicken Breast', portion: '180g', calories: 297, protein: 56, carbs: 0, fat: 7 }],
                                total_calories: 520,
                                total_protein: 56,
                                total_carbs: 32,
                                total_fat: 10,
                            },
                            {
                                meal_name: 'Tuna Potato',
                                foods: [{ name: 'Tuna', portion: '160g', calories: 210, protein: 40, carbs: 0, fat: 2 }],
                                total_calories: 470,
                                total_protein: 40,
                                total_carbs: 35,
                                total_fat: 8,
                            },
                            {
                                meal_name: 'Turkey Wrap',
                                foods: [{ name: 'Turkey', portion: '160g', calories: 230, protein: 42, carbs: 0, fat: 5 }],
                                total_calories: 480,
                                total_protein: 42,
                                total_carbs: 36,
                                total_fat: 9,
                            },
                        ],
                    },
                    {
                        meal_period: 'whatever-dinner-label',
                        options: [
                            {
                                meal_name: 'Salmon Plate',
                                foods: [{ name: 'Salmon', portion: '180g', calories: 370, protein: 40, carbs: 0, fat: 23 }],
                                total_calories: 520,
                                total_protein: 40,
                                total_carbs: 24,
                                total_fat: 23,
                            },
                            {
                                meal_name: 'Lean Beef Bowl',
                                foods: [{ name: 'Lean Beef', portion: '180g', calories: 300, protein: 40, carbs: 0, fat: 14 }],
                                total_calories: 510,
                                total_protein: 40,
                                total_carbs: 28,
                                total_fat: 16,
                            },
                            {
                                meal_name: 'Chicken Potato',
                                foods: [{ name: 'Chicken Thigh', portion: '180g', calories: 376, protein: 38, carbs: 0, fat: 25 }],
                                total_calories: 530,
                                total_protein: 38,
                                total_carbs: 26,
                                total_fat: 25,
                            },
                        ],
                    },
                ],
            }),
            provider: 'gemini',
            model: 'gemini-2.5-flash',
        }),
    });

    assert.equal(result.menuEntries.length, 9);
    assert.deepEqual(
        [...new Set(result.menuEntries.map((entry) => entry.meal_period))],
        ['Morning Fuel', 'Midday Recharger', 'Evening Recovery']
    );
    assert.equal(result.reasoning.meal_count, 3);
    assert.equal(result.reasoning.option_count, 3);
    assert.equal(result.provider, 'gemini');
    assert.equal(result.model, 'gemini-2.5-flash');
});

test('buildOnboardingAiNutritionMenu rejects periods with fewer than 3 valid options', async () => {
    await assert.rejects(
        buildOnboardingAiNutritionMenu({
            profile: { target_calories: 2000 },
            generateChat: async () => ({
                text: JSON.stringify({
                    meal_periods: [
                        {
                            meal_period: 'Breakfast',
                            options: [
                                {
                                    meal_name: 'Only One',
                                    foods: [{ name: 'Eggs', portion: '2 units', calories: 150, protein: 12, carbs: 1, fat: 10 }],
                                    total_calories: 150,
                                    total_protein: 12,
                                    total_carbs: 1,
                                    total_fat: 10,
                                },
                            ],
                        },
                        {
                            meal_period: 'Lunch',
                            options: [],
                        },
                    ],
                }),
                provider: 'gemini',
                model: 'gemini-2.5-flash',
            }),
        }),
        /fewer than 3 valid meal options/i
    );
});

test('buildOnboardingAiNutritionMenu retries once when the first model response is invalid JSON', async () => {
    let callCount = 0;

    const result = await buildOnboardingAiNutritionMenu({
        profile: {
            goal: 'recomp',
            target_calories: 2400,
        },
        generateChat: async ({ userMessage }) => {
            callCount += 1;

            if (callCount === 1) {
                return {
                    text: '{\n  "meal_periods": [\n    {\n      meal_period: "Breakfast"\n    }\n  ]\n}',
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                };
            }

            assert.match(userMessage, /invalid json/i);

            return {
                text: JSON.stringify({
                    reasoning: {
                        meal_count: 2,
                        meal_count_rationale: 'Two meals fit the sample payload.',
                        option_count: 3,
                        option_count_rationale: 'Three options meet the minimum.',
                        notes: ['Repair retry succeeded.'],
                    },
                    meal_periods: [
                        {
                            meal_period: 'First Meal',
                            options: [
                                {
                                    meal_name: 'Egg Bowl',
                                    foods: [{ name: 'Eggs', portion: '3 units', calories: 210, protein: 18, carbs: 1, fat: 15 }],
                                    total_calories: 210,
                                    total_protein: 18,
                                    total_carbs: 1,
                                    total_fat: 15,
                                },
                                {
                                    meal_name: 'Oat Bowl',
                                    foods: [{ name: 'Oats', portion: '80g', calories: 310, protein: 10, carbs: 54, fat: 6 }],
                                    total_calories: 310,
                                    total_protein: 10,
                                    total_carbs: 54,
                                    total_fat: 6,
                                },
                                {
                                    meal_name: 'Toast Plate',
                                    foods: [{ name: 'Sourdough Toast', portion: '3 slices', calories: 240, protein: 9, carbs: 45, fat: 3 }],
                                    total_calories: 240,
                                    total_protein: 9,
                                    total_carbs: 45,
                                    total_fat: 3,
                                },
                            ],
                        },
                        {
                            meal_period: 'Final Feast',
                            options: [
                                {
                                    meal_name: 'Chicken Rice',
                                    foods: [{ name: 'Chicken Breast', portion: '220g', calories: 363, protein: 68, carbs: 0, fat: 8 }],
                                    total_calories: 640,
                                    total_protein: 68,
                                    total_carbs: 52,
                                    total_fat: 12,
                                },
                                {
                                    meal_name: 'Steak Potatoes',
                                    foods: [{ name: 'Sirloin Steak', portion: '220g', calories: 420, protein: 55, carbs: 0, fat: 22 }],
                                    total_calories: 700,
                                    total_protein: 55,
                                    total_carbs: 48,
                                    total_fat: 24,
                                },
                                {
                                    meal_name: 'Salmon Pasta',
                                    foods: [{ name: 'Salmon', portion: '200g', calories: 412, protein: 44, carbs: 0, fat: 26 }],
                                    total_calories: 690,
                                    total_protein: 44,
                                    total_carbs: 58,
                                    total_fat: 28,
                                },
                            ],
                        },
                    ],
                }),
                provider: 'openai',
                model: 'gpt-4o-mini',
            };
        },
    });

    assert.equal(callCount, 2);
    assert.equal(result.menuEntries.length, 6);
    assert.equal(result.reasoning.meal_count, 2);
});
