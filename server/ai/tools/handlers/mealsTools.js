const { z } = require('zod');
const NutritionLog = require('../../../models/NutritionLog');
const { ToolExecutionError } = require('../toolSchemas');

const foodSchema = z.object({
    name: z.string().min(1),
    portion: z.string().min(1).optional(),
    calories: z.number().nonnegative().optional(),
}).strict();

const getUserMealsInputSchema = z.object({
    date: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    includeArchived: z.boolean().optional(),
}).strict();

const editMealPatchSchema = z.object({
    date: z.string().datetime().optional(),
    meal_name: z.string().min(1).max(200).optional(),
    calories: z.number().nonnegative().optional(),
    protein: z.number().nonnegative().optional(),
    carbs: z.number().nonnegative().optional(),
    fat: z.number().nonnegative().optional(),
    foods: z.array(foodSchema).max(100).optional(),
    archived: z.boolean().optional(),
}).strict();

const editMealInputSchema = z.object({
    mealId: z.string().min(1),
    patch: editMealPatchSchema,
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

function toDayRange(dateString) {
    const start = new Date(dateString);
    if (Number.isNaN(start.getTime())) {
        throw new ToolExecutionError({
            code: 'TOOL_VALIDATION_ERROR',
            message: 'Invalid date.',
            status: 400,
        });
    }
    const end = new Date(start);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function sanitizeMeal(log) {
    if (!log) return null;
    const source = typeof log.toObject === 'function' ? log.toObject() : log;
    return {
        id: String(source._id),
        date: source.date,
        meal_name: source.meal_name,
        calories: source.calories,
        protein: source.protein,
        carbs: source.carbs,
        fat: source.fat,
        foods: source.foods || [],
        archived: Boolean(source.archived),
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
}

function getNutritionLogModel(models = {}) {
    return models.NutritionLog || NutritionLog;
}

function createMealsTools({ models = {} } = {}) {
    const NutritionLogModel = getNutritionLogModel(models);

    return [
        {
            name: 'meals_get_user_meals',
            description: 'Get meal logs for the authenticated user.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 6000,
            inputSchema: getUserMealsInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    date: { type: 'string', format: 'date-time' },
                    limit: { type: 'integer', minimum: 1, maximum: 100 },
                    includeArchived: { type: 'boolean' },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const query = { user: context.userId };
                if (!args.includeArchived) {
                    query.archived = { $ne: true };
                }
                if (args.date) {
                    const { start, end } = toDayRange(args.date);
                    query.date = { $gte: start, $lte: end };
                }

                const limit = args.limit || 30;
                const meals = await NutritionLogModel.find(query)
                    .sort({ date: -1, createdAt: -1 })
                    .limit(limit);

                return {
                    data: {
                        items: meals.map(sanitizeMeal),
                        count: meals.length,
                    },
                };
            },
        },
        {
            name: 'meals_edit_meal',
            description: 'Edit one meal record belonging to the authenticated user.',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 7000,
            inputSchema: editMealInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['mealId', 'patch', 'idempotencyKey'],
                properties: {
                    mealId: { type: 'string', minLength: 1 },
                    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
                    patch: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            date: { type: 'string', format: 'date-time' },
                            meal_name: { type: 'string', minLength: 1, maxLength: 200 },
                            calories: { type: 'number', minimum: 0 },
                            protein: { type: 'number', minimum: 0 },
                            carbs: { type: 'number', minimum: 0 },
                            fat: { type: 'number', minimum: 0 },
                            foods: {
                                type: 'array',
                                maxItems: 100,
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['name'],
                                    properties: {
                                        name: { type: 'string', minLength: 1 },
                                        portion: { type: 'string', minLength: 1 },
                                        calories: { type: 'number', minimum: 0 },
                                    },
                                },
                            },
                            archived: { type: 'boolean' },
                        },
                    },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const meal = await NutritionLogModel.findOne({
                    _id: args.mealId,
                    user: context.userId,
                });

                if (!meal) {
                    throw new ToolExecutionError({
                        code: 'TOOL_NOT_FOUND',
                        message: 'Meal not found for this user.',
                        status: 404,
                    });
                }

                const changedFields = [];
                const patch = args.patch;

                if (patch.date !== undefined) {
                    meal.date = new Date(patch.date);
                    changedFields.push('date');
                }
                if (patch.meal_name !== undefined) {
                    meal.meal_name = patch.meal_name;
                    changedFields.push('meal_name');
                }
                if (patch.calories !== undefined) {
                    meal.calories = patch.calories;
                    changedFields.push('calories');
                }
                if (patch.protein !== undefined) {
                    meal.protein = patch.protein;
                    changedFields.push('protein');
                }
                if (patch.carbs !== undefined) {
                    meal.carbs = patch.carbs;
                    changedFields.push('carbs');
                }
                if (patch.fat !== undefined) {
                    meal.fat = patch.fat;
                    changedFields.push('fat');
                }
                if (patch.foods !== undefined) {
                    meal.foods = patch.foods;
                    changedFields.push('foods');
                }
                if (patch.archived !== undefined) {
                    meal.archived = patch.archived;
                    changedFields.push('archived');
                }

                await meal.save();

                return {
                    changedFields,
                    data: {
                        updated: sanitizeMeal(meal),
                    },
                };
            },
        },
    ];
}

module.exports = {
    createMealsTools,
};
