const test = require('node:test');
const assert = require('node:assert/strict');

const SingleMealPlannerService = require('../services/singleMealPlannerService');

function createLimitedQuery(items) {
    return {
        sort() {
            return {
                limit() {
                    return Promise.resolve(items);
                },
            };
        },
    };
}

test('SingleMealPlannerService uses nutritionist agent with optional web search and parses meal JSON', async () => {
    const captured = { system: '', userPrompt: '', allowlist: [] };
    const fakeUser = {
        _id: 'user-1',
        profile: {
            goal: 'muscle_gain',
            diet_type: 'vegan',
            target_calories: 2600,
            protein_goal: 180,
            carbs_goal: 260,
            fat_goal: 70,
            workout_days_per_week: 5,
            session_duration: 60,
            trainer_personality: 'nutritionist',
            activity_level: 'moderately_active',
        },
        nutrition_preferences: {
            hard_restrictions: {
                forbidden_ingredients: ['shrimp'],
            },
            soft_likes: {
                foods: ['tofu'],
            },
        },
        liked_foods: [{ name: 'tofu', calories: 120, protein: 14, carbs: 3, fat: 7 }],
        disliked_foods: [{ name: 'liver' }],
    };

    const service = new SingleMealPlannerService({
        enabled: true,
        userModel: {
            async findById(id) {
                return id === 'user-1' ? fakeUser : null;
            },
        },
        nutritionLogModel: {
            find() {
                return createLimitedQuery([
                    {
                        meal_name: 'Tofu Rice Bowl',
                        calories: 620,
                        protein: 42,
                        carbs: 58,
                        fat: 16,
                        foods: [{ name: 'tofu' }, { name: 'rice' }],
                    },
                ]);
            },
        },
        chatBrainService: {
            async generateResponse(input) {
                captured.system = input.system;
                captured.userPrompt = input.messages[0]?.content || '';
                captured.allowlist = input.toolAllowlist || [];
                return {
                    response: JSON.stringify({
                        meal_name: 'Power Tofu Bowl',
                        meal_type: 'lunch',
                        foods: [
                            { name: 'Tofu', portion: '220g', calories: 260, protein: 30, carbs: 8, fat: 14 },
                            { name: 'Rice', portion: '180g', calories: 230, protein: 4, carbs: 48, fat: 1 },
                        ],
                        total_calories: 490,
                        total_protein: 34,
                        total_carbs: 56,
                        total_fat: 15,
                        coach_note: 'אחלה ארוחה להמשך היום',
                    }),
                    toolTrace: [],
                    provider: 'test-provider',
                };
            },
        },
    });

    const outcome = await service.generateMealForUser({
        userId: 'user-1',
        requestId: 'req-1',
        trigger: 'nutrition_demo_single_meal',
        mealContext: {
            current_calories_consumed: 900,
            protein_consumed: 70,
            carbs_consumed: 80,
            fat_consumed: 30,
            target_calories: 2600,
            protein_goal: 180,
            carbs_goal: 260,
            fat_goal: 70,
            time_of_day: '13:00',
            meal_period: 'lunch',
            day_of_week: 'monday',
            meals_eaten_today: 2,
            total_meals_planned: 5,
            meal_request_note: 'Something easy and high protein',
            meal_request_priority: 'high',
        },
    });

    assert.equal(outcome.status, 'ready');
    assert.equal(outcome.meal.meal_name, 'Power Tofu Bowl');
    assert.equal(outcome.meal.total_calories, 490);
    assert.equal(outcome.provider, 'test-provider');
    assert.deepEqual(captured.allowlist, ['nutrition_web_search']);
    assert.match(captured.system, /Treat the following as the actual meal-generation prompt for this task/i);
    assert.match(captured.system, /nutrition_web_search/i);
    assert.match(captured.system, /if the task is hard or your confidence in the meal is not high/i);
    assert.match(captured.userPrompt, /User profile:/i);
    assert.match(captured.userPrompt, /Diet: vegan/i);
    assert.match(captured.userPrompt, /Tofu Rice Bowl/);
    assert.match(captured.userPrompt, /My liked foods \(prefer these\)/i);
    assert.match(captured.userPrompt, /Decision tabs to read before creating this meal/i);
    assert.match(captured.userPrompt, /Target for THIS meal/i);
    assert.match(captured.userPrompt, /Something easy and high protein/);
});
