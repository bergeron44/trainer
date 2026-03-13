const { z } = require('zod');
const { WEEK_DAYS } = require('./normalizationService');

const MEAL_PERIODS = ['breakfast', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];
const TIME_CONTEXT_DAY_VALUES = [...WEEK_DAYS, 'any'];
const TIME_CONTEXT_MEAL_VALUES = [...MEAL_PERIODS, 'any'];
const DAY_RULE_TYPES = ['cheat_day', 'budget_flex', 'fasting', 'custom'];
const MEAL_PREFERENCE_TYPES = ['light', 'moderate', 'heavy', 'high_protein', 'low_carb'];

const hardRestrictionsSchema = z.object({
    diets: z.array(z.enum(['vegan', 'vegetarian', 'pescatarian', 'kosher', 'halal', 'gluten_free', 'lactose_free'])).optional(),
    allergies: z.array(z.string().min(1)).optional(),
    medical_restrictions: z.array(z.string().min(1)).optional(),
    forbidden_ingredients: z.array(z.string().min(1)).optional(),
    notes: z.string().min(1).optional(),
}).strict().optional();

const softPreferenceSchema = z.object({
    cuisines: z.array(z.string().min(1)).optional(),
    foods: z.array(z.string().min(1)).optional(),
    notes: z.string().min(1).optional(),
}).strict().optional();

const budgetPreferencesSchema = z.object({
    currency: z.string().min(1).optional(),
    daily_budget: z.number().nonnegative().optional(),
    weekly_budget: z.number().nonnegative().optional(),
    expensive_days: z.array(z.object({
        day_of_week: z.enum(WEEK_DAYS),
        budget_cap: z.number().nonnegative().optional(),
        note: z.string().min(1).optional(),
    }).strict()).optional(),
    notes: z.string().min(1).optional(),
}).strict().optional();

const ruleBasedPreferencesSchema = z.object({
    cheat_meals_per_week: z.number().int().min(0).max(21).optional(),
    cheat_days: z.array(z.enum(WEEK_DAYS)).optional(),
    day_rules: z.array(z.object({
        day_of_week: z.enum(WEEK_DAYS),
        rule_type: z.enum(DAY_RULE_TYPES),
        note: z.string().min(1).optional(),
    }).strict()).optional(),
    meal_time_rules: z.array(z.object({
        meal_period: z.enum(MEAL_PERIODS),
        preference: z.enum(MEAL_PREFERENCE_TYPES),
        max_calories: z.number().nonnegative().optional(),
        note: z.string().min(1).optional(),
    }).strict()).optional(),
    time_context_notes: z.array(z.object({
        day_of_week: z.enum(TIME_CONTEXT_DAY_VALUES).optional(),
        meal_period: z.enum(TIME_CONTEXT_MEAL_VALUES).optional(),
        note: z.string().min(1),
    }).strict()).optional(),
    time_notes: z.object({
        by_day: z.object({
            sunday: z.string().optional(),
            monday: z.string().optional(),
            tuesday: z.string().optional(),
            wednesday: z.string().optional(),
            thursday: z.string().optional(),
            friday: z.string().optional(),
            saturday: z.string().optional(),
        }).strict().optional(),
        by_meal_period: z.object({
            breakfast: z.string().optional(),
            lunch: z.string().optional(),
            afternoon_snack: z.string().optional(),
            dinner: z.string().optional(),
            evening_snack: z.string().optional(),
        }).strict().optional(),
    }).strict().optional(),
    special_rules: z.array(z.string().min(1)).optional(),
    notes: z.string().min(1).optional(),
}).strict().optional();

const practicalConstraintsSchema = z.object({
    max_prep_time_minutes: z.number().int().nonnegative().optional(),
    cooking_skill: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    equipment: z.array(z.string().min(1)).optional(),
    meals_per_day: z.number().int().nonnegative().optional(),
    batch_cooking: z.boolean().optional(),
    notes: z.string().min(1).optional(),
}).strict().optional();

const nutritionPreferencesSchema = z.object({
    hard_restrictions: hardRestrictionsSchema,
    soft_likes: softPreferenceSchema,
    soft_dislikes: softPreferenceSchema,
    budget_preferences: budgetPreferencesSchema,
    rule_based_preferences: ruleBasedPreferencesSchema,
    practical_constraints: practicalConstraintsSchema,
}).strict();

const nutritionPreferencesUpdateSchema = z.object({
    nutrition_preferences: nutritionPreferencesSchema,
}).strict();

function formatZodError(error) {
    return error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
    }));
}

function validateNutritionPreferencesUpdate(update) {
    const result = nutritionPreferencesUpdateSchema.safeParse(update);
    if (result.success) {
        return { isValid: true, data: result.data, errors: [] };
    }
    return {
        isValid: false,
        data: null,
        errors: formatZodError(result.error),
    };
}

module.exports = {
    validateNutritionPreferencesUpdate,
};
