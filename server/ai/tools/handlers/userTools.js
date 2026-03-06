const { z } = require('zod');
const User = require('../../../models/User');
const { ToolExecutionError } = require('../toolSchemas');

const profilePatchSchema = z.object({
    age: z.number().int().min(0).max(120).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    height: z.number().min(0).max(300).optional(),
    weight: z.number().min(0).max(700).optional(),
    goal: z.enum(['weight_loss', 'muscle_gain', 'recomp', 'athletic_performance']).optional(),
    body_fat_percentage: z.number().min(0).max(100).optional(),
    injuries: z.string().max(2000).optional(),
    experience_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    workout_days_per_week: z.number().int().min(0).max(14).optional(),
    session_duration: z.enum([30, 60, 90]).optional(),
    environment: z.enum(['commercial_gym', 'home_gym', 'bodyweight_park']).optional(),
    diet_type: z.enum(['everything', 'vegan', 'vegetarian', 'keto', 'paleo']).optional(),
    allergies: z.string().max(2000).optional(),
    meal_frequency: z.number().int().min(0).max(12).optional(),
    activity_level: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active']).optional(),
    sleep_hours: z.number().min(0).max(24).optional(),
    past_obstacles: z.string().max(4000).optional(),
    motivation_source: z.string().max(4000).optional(),
    tdee: z.number().min(0).max(10000).optional(),
    target_calories: z.number().min(0).max(10000).optional(),
    protein_goal: z.number().min(0).max(1000).optional(),
    carbs_goal: z.number().min(0).max(1000).optional(),
    fat_goal: z.number().min(0).max(1000).optional(),
    coach_style: z.string().min(1).max(80).optional(),
    plan_choice: z.enum(['ai', 'existing']).optional(),
    nutrition_plan_choice: z.enum(['ai', 'existing', 'tracking_only']).optional(),
    custom_plan: z.array(z.object({
        day: z.string().max(60).optional(),
        name: z.string().max(120).optional(),
        exercises: z.array(z.object({
            name: z.string().min(1).max(200),
            sets: z.number().int().min(0).max(100).optional(),
            reps: z.string().max(80).optional(),
        }).strict()).max(60).optional(),
    }).strict()).max(14).optional(),
    onboarding_date: z.string().datetime().optional(),
    trainer_personality: z.enum(['drill_sergeant_coach', 'scientist_coach', 'nutritionist', 'zen_coach']).optional(),
    onboarding_completed: z.boolean().optional(),
    has_existing_plan: z.boolean().optional(),
    workout_plan_status: z.enum(['pending', 'generating', 'ready', 'failed', 'skipped']).optional(),
    workout_plan_error: z.string().max(400).optional(),
    workout_plan_generated_at: z.string().datetime().optional(),
    workout_plan_source: z.enum(['agent', 'legacy', 'manual']).optional(),
    nutrition_plan_status: z.enum(['pending', 'generating', 'ready', 'failed', 'skipped']).optional(),
    nutrition_plan_error: z.string().max(400).optional(),
    nutrition_plan_generated_at: z.string().datetime().optional(),
    nutrition_plan_source: z.enum(['agent', 'legacy', 'manual', 'none']).optional(),
}).strict();

const likedFoodSchema = z.object({
    name: z.string().min(1),
    image: z.string().optional(),
    calories: z.number().nonnegative().optional(),
    protein: z.number().nonnegative().optional(),
    carbs: z.number().nonnegative().optional(),
    fat: z.number().nonnegative().optional(),
}).strict();

const dislikedFoodSchema = z.object({
    name: z.string().min(1),
}).strict();

const getProfileInputSchema = z.object({}).strict();

const editProfileInputSchema = z.object({
    patch: z.object({
        name: z.string().min(1).max(120).optional(),
        profile: profilePatchSchema.optional(),
        liked_foods: z.array(likedFoodSchema).max(200).optional(),
        disliked_foods: z.array(dislikedFoodSchema).max(200).optional(),
    }).strict(),
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

function sanitizeUser(user) {
    if (!user) return null;
    const source = typeof user.toObject === 'function' ? user.toObject() : user;
    return {
        id: String(source._id),
        name: source.name,
        email: source.email,
        profile: source.profile || {},
        liked_foods: source.liked_foods || [],
        disliked_foods: source.disliked_foods || [],
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
}

function getUserModel(models = {}) {
    return models.User || User;
}

function createUserTools({ models = {} } = {}) {
    const UserModel = getUserModel(models);

    return [
        {
            name: 'user_get_profile',
            description: 'Get the authenticated user profile and preference data.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 6000,
            inputSchema: getProfileInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {},
            },
            async handler({ context }) {
                ensureUserId(context.userId);
                const user = await UserModel.findById(context.userId);
                if (!user) {
                    throw new ToolExecutionError({
                        code: 'TOOL_NOT_FOUND',
                        message: 'User not found.',
                        status: 404,
                    });
                }
                return {
                    data: sanitizeUser(user),
                };
            },
        },
        {
            name: 'user_edit_profile',
            description: 'Edit allowlisted fields of the authenticated user profile.',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 7000,
            inputSchema: editProfileInputSchema,
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
                            name: { type: 'string', minLength: 1, maxLength: 120 },
                            profile: { type: 'object', additionalProperties: false },
                            liked_foods: { type: 'array' },
                            disliked_foods: { type: 'array' },
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

                const changedFields = [];
                const patch = args.patch;

                if (patch.name !== undefined) {
                    user.name = patch.name;
                    changedFields.push('name');
                }

                if (patch.profile !== undefined) {
                    user.profile = {
                        ...(user.profile || {}),
                        ...patch.profile,
                    };
                    changedFields.push(...Object.keys(patch.profile).map((key) => `profile.${key}`));
                }

                if (patch.liked_foods !== undefined) {
                    user.liked_foods = patch.liked_foods;
                    changedFields.push('liked_foods');
                }

                if (patch.disliked_foods !== undefined) {
                    user.disliked_foods = patch.disliked_foods;
                    changedFields.push('disliked_foods');
                }

                await user.save();

                return {
                    changedFields,
                    data: {
                        updated: sanitizeUser(user),
                    },
                };
            },
        },
    ];
}

module.exports = {
    createUserTools,
};
