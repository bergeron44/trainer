const test = require('node:test');
const assert = require('node:assert/strict');

const OnboardingMenuPlannerService = require('../services/onboardingMenuPlannerService');

function createSortedQuery(items) {
    return {
        sort() {
            return Promise.resolve(items);
        },
    };
}

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

test('buildSystemPrompt includes structured nutrition data, food lists, and meal history', () => {
    const service = new OnboardingMenuPlannerService({
        enabled: true,
        chatBrainService: { generateResponse: async () => ({ toolTrace: [{ ok: true, toolName: 'menu_plan_save' }] }) },
    });

    const prompt = service.buildSystemPrompt({
        requestId: 'req-1',
        user: {
            profile: {
                goal: 'muscle_gain',
                diet_type: 'vegan',
                target_calories: 2600,
                protein_goal: 180,
                carbs_goal: 260,
                fat_goal: 70,
                workout_days_per_week: 5,
                session_duration: 60,
                menu_ai_preferences: { likes: 'pasta', dislikes: 'olives' },
            },
            liked_foods: [{ name: 'tofu', calories: 120, protein: 14, carbs: 3, fat: 7 }],
            disliked_foods: [{ name: 'olives' }],
            nutrition_preferences: {
                soft_likes: { foods: ['sushi'], cuisines: ['mediterranean'] },
                soft_dislikes: { foods: ['liver'] },
                rule_based_preferences: {
                    time_context_notes: [{ day_of_week: 'saturday', meal_period: 'dinner', note: 'keep it very light' }],
                },
                practical_constraints: { max_prep_time_minutes: 20 },
            },
        },
        planningContext: {
            recentAcceptedMeals: [
                {
                    meal_name: 'Chicken Bowl',
                    calories: 620,
                    protein: 42,
                    carbs: 58,
                    fat: 18,
                    foods: ['chicken', 'rice'],
                },
            ],
        },
    });

    assert.match(prompt, /Priority order for decisions/);
    assert.match(prompt, /Structured nutrition preferences snapshot/);
    assert.match(prompt, /Soft likes:/);
    assert.match(prompt, /foods: sushi/);
    assert.match(prompt, /liked_foods snapshot:/);
    assert.match(prompt, /tofu/);
    assert.match(prompt, /Recent accepted\/saved meal history:/);
    assert.match(prompt, /Chicken Bowl/);
});

test('ensurePlanForUser uses recent meal history and archives older agent plans after success', async () => {
    const captured = { system: '', userPrompt: '', updateMany: null };
    const fakeUser = {
        _id: 'user-1',
        profile: {
            onboarding_completed: true,
            menu_choice: 'ai',
            has_existing_menu: true,
            goal: 'recomp',
            diet_type: 'everything',
            target_calories: 2200,
            protein_goal: 160,
            carbs_goal: 220,
            fat_goal: 70,
            activity_level: 'moderately_active',
            workout_days_per_week: 4,
            session_duration: 60,
        },
        nutrition_preferences: {
            soft_likes: { foods: ['salmon'] },
        },
        liked_foods: [{ name: 'rice cakes' }],
        disliked_foods: [{ name: 'liver' }],
        async save() {
            return this;
        },
    };

    const service = new OnboardingMenuPlannerService({
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
                        meal_name: 'Salmon Rice Bowl',
                        calories: 610,
                        protein: 44,
                        carbs: 55,
                        fat: 17,
                        foods: [{ name: 'salmon' }, { name: 'rice' }],
                    },
                ]);
            },
        },
        mealPlanModel: {
            find() {
                return createSortedQuery([
                    { _id: 'new-plan' },
                    { _id: 'old-plan' },
                ]);
            },
            async updateMany(filter, update) {
                captured.updateMany = { filter, update };
                return { modifiedCount: 1 };
            },
            findOne() {
                return {
                    sort() {
                        return Promise.resolve({ _id: 'new-plan', meals: [{ meal_name: 'Plan Meal' }] });
                    },
                };
            },
        },
        chatBrainService: {
            async generateResponse(input) {
                captured.system = input.system;
                captured.userPrompt = input.messages[0]?.content || '';
                return {
                    response: 'saved',
                    toolTrace: [{ ok: true, toolName: 'menu_plan_save' }],
                };
            },
        },
    });

    const outcome = await service.ensurePlanForUser({
        userId: 'user-1',
        requestId: 'req-2',
        trigger: 'nutrition_demo_refresh',
        force: true,
    });

    assert.equal(outcome.status, 'ready');
    assert.equal(outcome.savedCount, 1);
    assert.equal(outcome.archivedPlanCount, 1);
    assert.equal(outcome.activePlan._id, 'new-plan');
    assert.equal(outcome.plannerMetadata.agent, 'nutritionist');
    assert.equal(outcome.plannerMetadata.data_sources.accepted_meal_history_count, 1);
    assert.match(captured.system, /Salmon Rice Bowl/);
    assert.match(captured.system, /soft likes/i);
    assert.match(captured.userPrompt, /latest user nutrition and training data/i);
    assert.deepEqual(captured.updateMany.filter, { _id: { $in: ['old-plan'] } });
});
