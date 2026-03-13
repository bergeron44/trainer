const EDITOR_AGENT_SCHEMA_CONTRACT = {
    root: 'nutrition_preferences',
    fillable_sections: {
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
            cheat_meals_per_week: 'number',
            cheat_days: 'week_day[]',
            day_rules: [{ day_of_week: 'week_day', rule_type: 'cheat_day|budget_flex|fasting|custom', note: 'string' }],
            meal_time_rules: [{ meal_period: 'breakfast|lunch|afternoon_snack|dinner|evening_snack', preference: 'light|moderate|heavy|high_protein|low_carb', max_calories: 'number', note: 'string' }],
            time_context_notes: [{ day_of_week: 'week_day|any', meal_period: 'meal_period|any', note: 'string' }],
            time_notes: {
                by_day: { sunday: 'string', monday: 'string', tuesday: 'string', wednesday: 'string', thursday: 'string', friday: 'string', saturday: 'string' },
                by_meal_period: { breakfast: 'string', lunch: 'string', afternoon_snack: 'string', dinner: 'string', evening_snack: 'string' },
            },
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

module.exports = {
    EDITOR_AGENT_SCHEMA_CONTRACT,
};
