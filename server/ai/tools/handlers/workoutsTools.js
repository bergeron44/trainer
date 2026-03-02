const mongoose = require('mongoose');
const { z } = require('zod');
const Workout = require('../../../models/Workout');
const { ToolExecutionError } = require('../toolSchemas');

const WORKOUT_SORT = Object.freeze({ date: -1, createdAt: -1 });

const exerciseSchema = z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    sets: z.number().int().nonnegative().optional(),
    reps: z.string().min(1).optional(),
    weight: z.number().nonnegative().optional(),
    rest_seconds: z.number().int().nonnegative().optional(),
    notes: z.string().max(1000).optional(),
}).strict();

const editWorkoutPatchSchema = z.object({
    date: z.string().datetime().optional(),
    muscle_group: z.string().min(1).max(120).optional(),
    exercises: z.array(exerciseSchema).max(60).optional(),
    status: z.enum(['planned', 'in_progress', 'completed']).optional(),
    duration_minutes: z.number().int().nonnegative().max(1200).optional(),
    total_volume: z.number().nonnegative().max(1_000_000).optional(),
    notes: z.string().max(2000).optional(),
    archived: z.boolean().optional(),
}).strict();

const getUserWorkoutsInputSchema = z.object({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().datetime().optional(),
    includeArchived: z.boolean().optional(),
}).strict();

const getWorkoutByTypeInputSchema = z.object({
    type: z.string().min(1).max(120),
    limit: z.number().int().min(1).max(100).optional(),
    includeArchived: z.boolean().optional(),
}).strict();

const getWorkoutTypesInputSchema = z.object({
    includeArchived: z.boolean().optional(),
}).strict();

const editWorkoutInputSchema = z.object({
    workoutId: z.string().min(1),
    patch: editWorkoutPatchSchema,
    idempotencyKey: z.string().min(1).max(128),
}).strict();

function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureUserId(userId) {
    if (!userId) {
        throw new ToolExecutionError({
            code: 'TOOL_AUTH_REQUIRED',
            message: 'Authenticated user is required for this tool.',
            status: 401,
        });
    }
}

function toDateOrThrow(dateString, fieldName) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        throw new ToolExecutionError({
            code: 'TOOL_VALIDATION_ERROR',
            message: `Invalid ${fieldName}.`,
            status: 400,
        });
    }
    return date;
}

function sanitizeWorkout(workout) {
    if (!workout) return null;
    const source = typeof workout.toObject === 'function' ? workout.toObject() : workout;
    return {
        id: String(source._id),
        date: source.date,
        muscle_group: source.muscle_group,
        exercises: source.exercises || [],
        status: source.status,
        duration_minutes: source.duration_minutes,
        total_volume: source.total_volume,
        notes: source.notes,
        archived: Boolean(source.archived),
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
}

function applyArchiveFilter(query, includeArchived) {
    if (!includeArchived) {
        query.archived = { $ne: true };
    }
}

function getWorkoutModel(models = {}) {
    return models.Workout || Workout;
}

function createWorkoutTools({ models = {} } = {}) {
    const WorkoutModel = getWorkoutModel(models);

    return [
        {
            name: 'workouts_get_user_workouts',
            description: 'Get the authenticated user\'s workouts with optional pagination.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 6000,
            inputSchema: getUserWorkoutsInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    limit: { type: 'integer', minimum: 1, maximum: 100 },
                    cursor: { type: 'string', format: 'date-time' },
                    includeArchived: { type: 'boolean' },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const limit = args.limit || 20;
                const query = { user: context.userId };
                applyArchiveFilter(query, args.includeArchived);
                if (args.cursor) {
                    query.createdAt = { $lt: toDateOrThrow(args.cursor, 'cursor') };
                }

                const workouts = await WorkoutModel.find(query)
                    .sort(WORKOUT_SORT)
                    .limit(limit + 1);

                const hasMore = workouts.length > limit;
                const items = workouts.slice(0, limit).map(sanitizeWorkout);
                const nextCursor = hasMore && items.length
                    ? items[items.length - 1].createdAt
                    : null;

                return {
                    data: {
                        items,
                        paging: {
                            hasMore,
                            nextCursor,
                        },
                    },
                };
            },
        },
        {
            name: 'workouts_get_workout_by_type',
            description: 'Get workouts filtered by workout type or muscle group (A/B/C/full-body/push/pull/legs).',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 6000,
            inputSchema: getWorkoutByTypeInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['type'],
                properties: {
                    type: { type: 'string', minLength: 1, maxLength: 120 },
                    limit: { type: 'integer', minimum: 1, maximum: 100 },
                    includeArchived: { type: 'boolean' },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);
                const limit = args.limit || 20;
                const query = {
                    user: context.userId,
                    muscle_group: { $regex: escapeRegExp(args.type), $options: 'i' },
                };
                applyArchiveFilter(query, args.includeArchived);

                const workouts = await WorkoutModel.find(query)
                    .sort(WORKOUT_SORT)
                    .limit(limit);

                return {
                    data: {
                        type: args.type,
                        count: workouts.length,
                        items: workouts.map(sanitizeWorkout),
                    },
                };
            },
        },
        {
            name: 'workouts_get_workout_types',
            description: 'List distinct workout types/muscle groups for the authenticated user with counts.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 6000,
            inputSchema: getWorkoutTypesInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    includeArchived: { type: 'boolean' },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);
                const userMatch = mongoose.Types.ObjectId.isValid(context.userId)
                    ? new mongoose.Types.ObjectId(context.userId)
                    : context.userId;

                const match = { user: userMatch };
                if (!args.includeArchived) {
                    match.archived = { $ne: true };
                }

                const rows = await WorkoutModel.aggregate([
                    { $match: match },
                    {
                        $group: {
                            _id: '$muscle_group',
                            count: { $sum: 1 },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            type: '$_id',
                            count: 1,
                        },
                    },
                    { $sort: { count: -1, type: 1 } },
                ]);

                return {
                    data: {
                        items: rows,
                        count: rows.length,
                    },
                };
            },
        },
        {
            name: 'workouts_edit_workout',
            description: 'Edit one of the authenticated user\'s workouts by applying an allowlisted patch.',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 7000,
            inputSchema: editWorkoutInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['workoutId', 'patch', 'idempotencyKey'],
                properties: {
                    workoutId: { type: 'string', minLength: 1 },
                    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
                    patch: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            date: { type: 'string', format: 'date-time' },
                            muscle_group: { type: 'string', minLength: 1, maxLength: 120 },
                            exercises: {
                                type: 'array',
                                maxItems: 60,
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['name'],
                                    properties: {
                                        id: { type: 'string' },
                                        name: { type: 'string', minLength: 1 },
                                        sets: { type: 'integer', minimum: 0 },
                                        reps: { type: 'string', minLength: 1 },
                                        weight: { type: 'number', minimum: 0 },
                                        rest_seconds: { type: 'integer', minimum: 0 },
                                        notes: { type: 'string', maxLength: 1000 },
                                    },
                                },
                            },
                            status: { type: 'string', enum: ['planned', 'in_progress', 'completed'] },
                            duration_minutes: { type: 'integer', minimum: 0, maximum: 1200 },
                            total_volume: { type: 'number', minimum: 0, maximum: 1000000 },
                            notes: { type: 'string', maxLength: 2000 },
                            archived: { type: 'boolean' },
                        },
                    },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const workout = await WorkoutModel.findOne({
                    _id: args.workoutId,
                    user: context.userId,
                });

                if (!workout) {
                    throw new ToolExecutionError({
                        code: 'TOOL_NOT_FOUND',
                        message: 'Workout not found for this user.',
                        status: 404,
                    });
                }

                const changedFields = [];
                const patch = args.patch;
                if (patch.date !== undefined) {
                    workout.date = toDateOrThrow(patch.date, 'date');
                    changedFields.push('date');
                }
                if (patch.muscle_group !== undefined) {
                    workout.muscle_group = patch.muscle_group;
                    changedFields.push('muscle_group');
                }
                if (patch.exercises !== undefined) {
                    workout.exercises = patch.exercises;
                    changedFields.push('exercises');
                }
                if (patch.status !== undefined) {
                    workout.status = patch.status;
                    changedFields.push('status');
                }
                if (patch.duration_minutes !== undefined) {
                    workout.duration_minutes = patch.duration_minutes;
                    changedFields.push('duration_minutes');
                }
                if (patch.total_volume !== undefined) {
                    workout.total_volume = patch.total_volume;
                    changedFields.push('total_volume');
                }
                if (patch.notes !== undefined) {
                    workout.notes = patch.notes;
                    changedFields.push('notes');
                }
                if (patch.archived !== undefined) {
                    workout.archived = patch.archived;
                    changedFields.push('archived');
                }

                await workout.save();

                return {
                    changedFields,
                    data: {
                        updated: sanitizeWorkout(workout),
                    },
                };
            },
        },
    ];
}

module.exports = {
    createWorkoutTools,
};
