const { z } = require('zod');
const User = require('../../../models/User');
const NutritionLog = require('../../../models/NutritionLog');
const { ToolExecutionError } = require('../toolSchemas');

const nutritionTargetPatchSchema = z.object({
    diet_type: z.enum(['everything', 'vegan', 'vegetarian', 'keto', 'paleo']).optional(),
    allergies: z.string().max(2000).optional(),
    meal_frequency: z.number().int().min(0).max(12).optional(),
    activity_level: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active']).optional(),
    sleep_hours: z.number().min(0).max(24).optional(),
    tdee: z.number().min(0).max(10000).optional(),
    target_calories: z.number().min(0).max(10000).optional(),
    protein_goal: z.number().min(0).max(1000).optional(),
    carbs_goal: z.number().min(0).max(1000).optional(),
    fat_goal: z.number().min(0).max(1000).optional(),
}).strict();

const getNutritionDataInputSchema = z.object({
    date: z.string().datetime().optional(),
    range: z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
    }).strict().optional(),
}).strict();

const editNutritionDataInputSchema = z.object({
    patch: nutritionTargetPatchSchema,
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

function buildDateQuery(args) {
    if (args.range) {
        const from = new Date(args.range.from);
        const to = new Date(args.range.to);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new ToolExecutionError({
                code: 'TOOL_VALIDATION_ERROR',
                message: 'Invalid range dates.',
                status: 400,
            });
        }
        return { $gte: from, $lte: to };
    }

    if (args.date) {
        const { start, end } = toDayRange(args.date);
        return { $gte: start, $lte: end };
    }

    return undefined;
}

function sumField(logs, field) {
    return logs.reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function getUserModel(models = {}) {
    return models.User || User;
}

function getNutritionLogModel(models = {}) {
    return models.NutritionLog || NutritionLog;
}

function createNutritionTools({ models = {} } = {}) {
    const UserModel = getUserModel(models);
    const NutritionLogModel = getNutritionLogModel(models);

    return [
        {
            name: 'nutrition_get_user_data',
            description: 'Get nutrition targets and meal log summaries for the authenticated user.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 6000,
            inputSchema: getNutritionDataInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    date: { type: 'string', format: 'date-time' },
                    range: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['from', 'to'],
                        properties: {
                            from: { type: 'string', format: 'date-time' },
                            to: { type: 'string', format: 'date-time' },
                        },
                    },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const user = await UserModel.findById(context.userId);
                if (!user) {
                    throw new ToolExecutionError({
                        code: 'TOOL_NOT_FOUND',
                        message: 'User not found.',
                        status: 404,
                    });
                }

                const query = { user: context.userId, archived: { $ne: true } };
                const dateQuery = buildDateQuery(args);
                if (dateQuery) {
                    query.date = dateQuery;
                }

                const logs = await NutritionLogModel.find(query)
                    .sort({ date: -1, createdAt: -1 })
                    .limit(200);

                const totals = {
                    calories: sumField(logs, 'calories'),
                    protein: sumField(logs, 'protein'),
                    carbs: sumField(logs, 'carbs'),
                    fat: sumField(logs, 'fat'),
                };

                return {
                    data: {
                        targets: {
                            target_calories: user.profile?.target_calories,
                            protein_goal: user.profile?.protein_goal,
                            carbs_goal: user.profile?.carbs_goal,
                            fat_goal: user.profile?.fat_goal,
                            tdee: user.profile?.tdee,
                            diet_type: user.profile?.diet_type,
                        },
                        consumed: totals,
                        logCount: logs.length,
                        logs,
                    },
                };
            },
        },
        {
            name: 'nutrition_edit_user_data',
            description: 'Edit allowlisted nutrition targets and preferences for the authenticated user.',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 7000,
            inputSchema: editNutritionDataInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['patch', 'idempotencyKey'],
                properties: {
                    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
                    patch: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            diet_type: { type: 'string', enum: ['everything', 'vegan', 'vegetarian', 'keto', 'paleo'] },
                            allergies: { type: 'string', maxLength: 2000 },
                            meal_frequency: { type: 'integer', minimum: 0, maximum: 12 },
                            activity_level: { type: 'string', enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active'] },
                            sleep_hours: { type: 'number', minimum: 0, maximum: 24 },
                            tdee: { type: 'number', minimum: 0, maximum: 10000 },
                            target_calories: { type: 'number', minimum: 0, maximum: 10000 },
                            protein_goal: { type: 'number', minimum: 0, maximum: 1000 },
                            carbs_goal: { type: 'number', minimum: 0, maximum: 1000 },
                            fat_goal: { type: 'number', minimum: 0, maximum: 1000 },
                        },
                    },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const user = await UserModel.findById(context.userId);
                if (!user) {
                    throw new ToolExecutionError({
                        code: 'TOOL_NOT_FOUND',
                        message: 'User not found.',
                        status: 404,
                    });
                }

                user.profile = {
                    ...(user.profile || {}),
                    ...args.patch,
                };

                const changedFields = Object.keys(args.patch).map((key) => `profile.${key}`);
                await user.save();

                return {
                    changedFields,
                    data: {
                        updatedTargets: {
                            target_calories: user.profile?.target_calories,
                            protein_goal: user.profile?.protein_goal,
                            carbs_goal: user.profile?.carbs_goal,
                            fat_goal: user.profile?.fat_goal,
                            tdee: user.profile?.tdee,
                            diet_type: user.profile?.diet_type,
                            allergies: user.profile?.allergies,
                            meal_frequency: user.profile?.meal_frequency,
                            activity_level: user.profile?.activity_level,
                            sleep_hours: user.profile?.sleep_hours,
                        },
                    },
                };
            },
        },
    ];
}

module.exports = {
    createNutritionTools,
};
