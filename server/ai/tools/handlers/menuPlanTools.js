const { z } = require('zod');
const MealPlan = require('../../../models/MealPlan');
const { ToolExecutionError } = require('../toolSchemas');

const MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack', 'post_workout', 'other'];

const foodSchema = z.object({
    name:     z.string().min(1),
    portion:  z.string().optional(),
    calories: z.number().nonnegative().optional(),
    protein:  z.number().nonnegative().optional(),
    carbs:    z.number().nonnegative().optional(),
    fat:      z.number().nonnegative().optional(),
}).strict();

const mealSchema = z.object({
    meal_name: z.string().min(1).max(200),
    meal_type: z.enum(MEAL_TYPES).optional(),
    foods:     z.array(foodSchema).max(50).optional(),
    calories:  z.number().nonnegative().optional(),
    protein:   z.number().nonnegative().optional(),
    carbs:     z.number().nonnegative().optional(),
    fat:       z.number().nonnegative().optional(),
}).strict();

const savePlanInputSchema = z.object({
    meals:          z.array(mealSchema).min(1).max(40),
    idempotencyKey: z.string().min(1).max(128),
}).strict();

function ensureUserId(userId) {
    if (!userId) {
        throw new ToolExecutionError({
            code: 'TOOL_AUTH_REQUIRED',
            message: 'Authenticated user is required for this tool.',
            status: 401,
        });
    }
}

function sanitizePlan(doc) {
    if (!doc) return null;
    const source = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
        id:        String(source._id),
        source:    source.source,
        meals:     source.meals || [],
        archived:  Boolean(source.archived),
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
}

function createMenuPlanTools({ models = {} } = {}) {
    const MealPlanModel = models.MealPlan || MealPlan;

    return [
        {
            name: 'menu_plan_save',
            description: 'Save the generated daily meal plan for the authenticated user. Call this exactly once with the complete meals array.',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 8000,
            inputSchema: savePlanInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['meals', 'idempotencyKey'],
                properties: {
                    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
                    meals: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 40,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['meal_name'],
                            properties: {
                                meal_name: { type: 'string', minLength: 1, maxLength: 200 },
                                meal_type: { type: 'string', enum: MEAL_TYPES },
                                calories:  { type: 'number', minimum: 0 },
                                protein:   { type: 'number', minimum: 0 },
                                carbs:     { type: 'number', minimum: 0 },
                                fat:       { type: 'number', minimum: 0 },
                                foods: {
                                    type: 'array',
                                    maxItems: 50,
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['name'],
                                        properties: {
                                            name:     { type: 'string', minLength: 1 },
                                            portion:  { type: 'string' },
                                            calories: { type: 'number', minimum: 0 },
                                            protein:  { type: 'number', minimum: 0 },
                                            carbs:    { type: 'number', minimum: 0 },
                                            fat:      { type: 'number', minimum: 0 },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const plan = await MealPlanModel.create({
                    user:     context.userId,
                    source:   'agent',
                    meals:    args.meals,
                    archived: false,
                });

                return {
                    changedFields: ['meals'],
                    data: { created: sanitizePlan(plan) },
                };
            },
        },
    ];
}

module.exports = { createMenuPlanTools };
