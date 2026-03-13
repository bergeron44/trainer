const SCHEMA_CONTRACT = {
    nutrition_preferences: {
        hard_restrictions: {
            diets: ['vegan', 'vegetarian', 'pescatarian', 'kosher', 'halal', 'gluten_free', 'lactose_free'],
            allergies: 'string[]',
            medical_restrictions: 'string[]',
            forbidden_ingredients: 'string[]',
            notes: 'string',
        },
        soft_likes: {
            cuisines: 'string[]',
            foods: 'string[]',
            notes: 'string',
        },
        soft_dislikes: {
            cuisines: 'string[]',
            foods: 'string[]',
            notes: 'string',
        },
        budget_preferences: {
            currency: 'string',
            daily_budget: 'number',
            weekly_budget: 'number',
            expensive_days: [{ day_of_week: 'week_day', budget_cap: 'number', note: 'string' }],
            notes: 'string',
        },
        rule_based_preferences: {
            cheat_meals_per_week: 'number_0_21',
            cheat_days: 'week_day[]',
            day_rules: [{ day_of_week: 'week_day', rule_type: 'day_rule_type', note: 'string' }],
            meal_time_rules: [{ meal_period: 'meal_period', preference: 'meal_preference_type', max_calories: 'number', note: 'string' }],
            special_rules: 'string[]',
            notes: 'string',
        },
        practical_constraints: {
            max_prep_time_minutes: 'number',
            cooking_skill: ['beginner', 'intermediate', 'advanced'],
            equipment: 'string[]',
            meals_per_day: 'number',
            batch_cooking: 'boolean',
            notes: 'string',
        },
    },
};

const EXTRACTOR_OUTPUT_CONTRACT = {
    raw_text: 'string',
    proposed_update: {},
    uncertain_items: [],
    conflicts_detected: [],
    delete_requests: [],
};

module.exports = {
    SCHEMA_CONTRACT,
    EXTRACTOR_OUTPUT_CONTRACT,
};
