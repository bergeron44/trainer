const mongoose = require('mongoose');
const { z } = require('zod');
const Workout = require('../../../models/Workout');
const Exercise = require('../../../models/Exercise');
const WorkoutLog = require('../../../models/WorkoutLog');
const { ToolExecutionError } = require('../toolSchemas');
const { buildWorkoutInsertDocs } = require('../../../utils/workoutScheduler');

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

const createWorkoutInputSchema = z.object({
    date: z.string().datetime(),
    muscle_group: z.string().min(1).max(120),
    exercises: z.array(exerciseSchema).min(1).max(60),
    status: z.enum(['planned', 'in_progress', 'completed']).optional(),
    duration_minutes: z.number().int().nonnegative().max(1200).optional(),
    total_volume: z.number().nonnegative().max(1_000_000).optional(),
    notes: z.string().max(2000).optional(),
    archived: z.boolean().optional(),
    idempotencyKey: z.string().min(1).max(128),
}).strict();

const editWorkoutInputSchema = z.object({
    workoutId: z.string().min(1),
    patch: editWorkoutPatchSchema,
    idempotencyKey: z.string().min(1).max(128),
}).strict();

const logSessionEntrySchema = z.object({
    exercise_name: z.string().min(1).max(200),
    set_number: z.number().int().min(1).max(200),
    reps_completed: z.number().int().min(0).max(1000),
    weight_used: z.number().min(0).max(5000),
    rpe: z.number().min(0).max(10).optional(),
    date: z.string().datetime().optional(),
}).strict();

const logSessionInputSchema = z.object({
    workoutId: z.string().min(1),
    entries: z.array(logSessionEntrySchema).min(1).max(300),
    idempotencyKey: z.string().min(1).max(128),
}).strict();

const swapExerciseInputSchema = z.object({
    workoutId: z.string().min(1),
    exerciseName: z.string().min(1).optional(),
    exerciseId: z.string().min(1).optional(),
    constraints: z.object({
        avoidEquipment: z.array(z.string().min(1)).max(20).optional(),
        availableEquipment: z.array(z.string().min(1)).max(20).optional(),
        injuries: z.union([
            z.string().min(1),
            z.array(z.string().min(1)).max(20),
        ]).optional(),
        preferredMuscleGroup: z.string().min(1).max(120).optional(),
    }).strict().optional(),
    idempotencyKey: z.string().min(1).max(128),
}).strict().refine(
    (value) => Boolean(value.exerciseName || value.exerciseId),
    'Either exerciseName or exerciseId is required.'
);

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

function sanitizeWorkoutLog(log) {
    if (!log) return null;
    const source = typeof log.toObject === 'function' ? log.toObject() : log;
    return {
        id: String(source._id),
        workout_id: String(source.workout_id),
        exercise_name: source.exercise_name,
        set_number: source.set_number,
        reps_completed: source.reps_completed,
        weight_used: source.weight_used,
        rpe: source.rpe,
        date: source.date,
        createdAt: source.createdAt,
    };
}

function applyArchiveFilter(query, includeArchived) {
    if (!includeArchived) {
        query.archived = { $ne: true };
    }
}

function extractInjuryKeywords(injuries) {
    if (!injuries) return [];
    const list = Array.isArray(injuries)
        ? injuries
        : String(injuries).split(/[\s,]+/);
    return list
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean);
}

function isExerciseAllowedByConstraints(exercise, constraints = {}) {
    const equipment = String(exercise?.equipment || '').trim().toLowerCase();
    const avoid = new Set((constraints.avoidEquipment || []).map((item) => String(item).toLowerCase()));
    const allowed = new Set((constraints.availableEquipment || []).map((item) => String(item).toLowerCase()));

    if (avoid.size && equipment && avoid.has(equipment)) {
        return false;
    }
    if (allowed.size && equipment && !allowed.has(equipment)) {
        return false;
    }

    const injuryKeywords = extractInjuryKeywords(constraints.injuries);
    if (!injuryKeywords.length) return true;

    const searchable = [
        exercise?.muscle_group,
        exercise?.body_part,
        exercise?.target,
        ...(exercise?.secondary_muscles || []),
    ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

    return !injuryKeywords.some((keyword) => searchable.includes(keyword));
}

function normalizePreferredMuscleGroup(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';

    const map = new Map([
        ['full-body', 'full_body'],
        ['full body', 'full_body'],
        ['full_body', 'full_body'],
        ['abs', 'core'],
    ]);
    return map.get(raw) || raw;
}

async function findReplacementExercise({
    currentExercise,
    workout,
    constraints,
    ExerciseModel,
}) {
    const normalizedPreferred = normalizePreferredMuscleGroup(
        constraints?.preferredMuscleGroup || workout?.muscle_group
    );

    const currentDoc = await ExerciseModel.findOne({ name: currentExercise.name }).lean();
    const candidateByAlternatives = Array.isArray(currentDoc?.alternatives) && currentDoc.alternatives.length
        ? await ExerciseModel.find({
            name: { $in: currentDoc.alternatives },
        }).limit(30).lean()
        : [];

    let candidatePool = candidateByAlternatives;
    if (!candidatePool.length) {
        const query = {
            name: { $ne: currentExercise.name },
        };

        const effectiveMuscleGroup = normalizePreferredMuscleGroup(
            normalizedPreferred || currentDoc?.muscle_group
        );
        if (effectiveMuscleGroup) {
            query.muscle_group = effectiveMuscleGroup;
        }

        candidatePool = await ExerciseModel.find(query)
            .sort({ updatedAt: -1 })
            .limit(80)
            .lean();
    }

    const filtered = candidatePool
        .filter((candidate) => candidate?.name && candidate.name !== currentExercise.name)
        .filter((candidate) => isExerciseAllowedByConstraints(candidate, constraints));

    if (!filtered.length) {
        throw new ToolExecutionError({
            code: 'TOOL_NO_REPLACEMENT_FOUND',
            message: 'No suitable replacement exercise found with current constraints.',
            status: 422,
        });
    }

    return filtered[0];
}

function resolveExerciseIndex(workout, { exerciseId, exerciseName }) {
    if (!Array.isArray(workout.exercises) || !workout.exercises.length) {
        return -1;
    }

    if (exerciseId) {
        const byId = workout.exercises.findIndex((item) => String(item.id || '') === String(exerciseId));
        if (byId >= 0) return byId;
    }

    if (exerciseName) {
        const normalized = String(exerciseName).trim().toLowerCase();
        const byName = workout.exercises.findIndex(
            (item) => String(item.name || '').trim().toLowerCase() === normalized
        );
        if (byName >= 0) return byName;
    }

    return -1;
}

function getWorkoutModel(models = {}) {
    return models.Workout || Workout;
}

function getExerciseModel(models = {}) {
    return models.Exercise || Exercise;
}

function getWorkoutLogModel(models = {}) {
    return models.WorkoutLog || WorkoutLog;
}

const VALID_MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body'];
const VALID_MOVEMENT_TYPES = ['push', 'pull', 'legs', 'core', 'cardio', 'full_body'];

const exercisesSearchInputSchema = z.object({
    muscle_group: z.enum(VALID_MUSCLE_GROUPS).optional(),
    movement_type: z.enum(VALID_MOVEMENT_TYPES).optional(),
    name: z.string().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(30).optional(),
}).strict();

const sequenceWorkoutStepSchema = z.object({
    type: z.literal('workout'),
    name: z.string().min(1).max(120),
    exercises: z.array(exerciseSchema).min(1).max(60),
}).strict();

const sequenceRestStepSchema = z.object({
    type: z.literal('rest'),
}).strict();

const setSequenceInputSchema = z.object({
    sequence: z.array(z.discriminatedUnion('type', [
        sequenceWorkoutStepSchema,
        sequenceRestStepSchema,
    ])).min(1).max(14),
    weeks: z.number().int().min(1).max(52).optional(),
    idempotencyKey: z.string().min(1).max(128),
}).strict();

function createWorkoutTools({ models = {} } = {}) {
    const WorkoutModel = getWorkoutModel(models);
    const ExerciseModel = getExerciseModel(models);
    const WorkoutLogModel = getWorkoutLogModel(models);

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
            name: 'workouts_create_workout',
            description: 'Create a new workout for the authenticated user.',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 7000,
            inputSchema: createWorkoutInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['date', 'muscle_group', 'exercises', 'idempotencyKey'],
                properties: {
                    date: { type: 'string', format: 'date-time' },
                    muscle_group: { type: 'string', minLength: 1, maxLength: 120 },
                    exercises: {
                        type: 'array',
                        minItems: 1,
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
                    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const created = await WorkoutModel.create({
                    user: context.userId,
                    date: toDateOrThrow(args.date, 'date'),
                    muscle_group: args.muscle_group,
                    exercises: args.exercises,
                    status: args.status || 'planned',
                    duration_minutes: args.duration_minutes,
                    total_volume: args.total_volume,
                    notes: args.notes,
                    archived: args.archived,
                });

                return {
                    changedFields: [
                        'date',
                        'muscle_group',
                        'exercises',
                        'status',
                        'duration_minutes',
                        'total_volume',
                        'notes',
                        'archived',
                    ],
                    data: {
                        created: sanitizeWorkout(created),
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
        {
            name: 'workouts_log_session_result',
            description: 'Log workout set results (sets/reps/load/RPE) for the authenticated user.',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 7000,
            inputSchema: logSessionInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['workoutId', 'entries', 'idempotencyKey'],
                properties: {
                    workoutId: { type: 'string', minLength: 1 },
                    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
                    entries: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 300,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['exercise_name', 'set_number', 'reps_completed', 'weight_used'],
                            properties: {
                                exercise_name: { type: 'string', minLength: 1, maxLength: 200 },
                                set_number: { type: 'integer', minimum: 1, maximum: 200 },
                                reps_completed: { type: 'integer', minimum: 0, maximum: 1000 },
                                weight_used: { type: 'number', minimum: 0, maximum: 5000 },
                                rpe: { type: 'number', minimum: 0, maximum: 10 },
                                date: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const workout = await WorkoutModel.findOne({
                    _id: args.workoutId,
                    user: context.userId,
                }).lean();

                if (!workout) {
                    throw new ToolExecutionError({
                        code: 'TOOL_NOT_FOUND',
                        message: 'Workout not found for this user.',
                        status: 404,
                    });
                }

                const docs = args.entries.map((entry) => ({
                    user: context.userId,
                    workout_id: args.workoutId,
                    exercise_name: entry.exercise_name,
                    set_number: entry.set_number,
                    reps_completed: entry.reps_completed,
                    weight_used: entry.weight_used,
                    rpe: entry.rpe,
                    date: entry.date ? toDateOrThrow(entry.date, 'date') : new Date(),
                }));

                const inserted = await WorkoutLogModel.insertMany(docs);

                return {
                    changedFields: ['workout_logs'],
                    data: {
                        workoutId: args.workoutId,
                        count: inserted.length,
                        logs: inserted.map(sanitizeWorkoutLog),
                    },
                };
            },
        },
        {
            name: 'workouts_swap_exercise',
            description: 'Replace an exercise in a workout using safety constraints (equipment/injuries).',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 7000,
            inputSchema: swapExerciseInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['workoutId', 'idempotencyKey'],
                properties: {
                    workoutId: { type: 'string', minLength: 1 },
                    exerciseName: { type: 'string', minLength: 1 },
                    exerciseId: { type: 'string', minLength: 1 },
                    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
                    constraints: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            avoidEquipment: {
                                type: 'array',
                                maxItems: 20,
                                items: { type: 'string', minLength: 1 },
                            },
                            availableEquipment: {
                                type: 'array',
                                maxItems: 20,
                                items: { type: 'string', minLength: 1 },
                            },
                            injuries: {
                                oneOf: [
                                    { type: 'string', minLength: 1 },
                                    {
                                        type: 'array',
                                        maxItems: 20,
                                        items: { type: 'string', minLength: 1 },
                                    },
                                ],
                            },
                            preferredMuscleGroup: { type: 'string', minLength: 1, maxLength: 120 },
                        },
                    },
                },
                anyOf: [
                    { required: ['exerciseName'] },
                    { required: ['exerciseId'] },
                ],
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

                const idx = resolveExerciseIndex(workout, args);
                if (idx < 0) {
                    throw new ToolExecutionError({
                        code: 'TOOL_NOT_FOUND',
                        message: 'Exercise to swap was not found in this workout.',
                        status: 404,
                    });
                }

                const currentExercise = workout.exercises[idx];
                const replacement = await findReplacementExercise({
                    currentExercise,
                    workout,
                    constraints: args.constraints || {},
                    ExerciseModel,
                });

                workout.exercises[idx] = {
                    ...currentExercise,
                    name: replacement.name,
                    notes: `Swapped from ${currentExercise.name}${currentExercise.notes ? ` | ${currentExercise.notes}` : ''}`,
                    rest_seconds: currentExercise.rest_seconds ?? replacement.rest_seconds,
                };

                await workout.save();

                return {
                    changedFields: ['exercises'],
                    data: {
                        workoutId: String(workout._id),
                        previousExercise: currentExercise.name,
                        replacementExercise: replacement.name,
                        updatedWorkout: sanitizeWorkout(workout),
                    },
                };
            },
        },
        {
            name: 'exercises_search',
            description: 'Search exercises from the database by muscle_group, movement_type, or name. Use this to pick real exercises before calling workouts_set_sequence.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 6000,
            inputSchema: exercisesSearchInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    muscle_group: { type: 'string', enum: VALID_MUSCLE_GROUPS },
                    movement_type: { type: 'string', enum: VALID_MOVEMENT_TYPES },
                    name: { type: 'string', minLength: 1, maxLength: 120 },
                    limit: { type: 'integer', minimum: 1, maximum: 30 },
                },
            },
            async handler({ args }) {
                const filter = {};
                if (args.muscle_group) filter.muscle_group = args.muscle_group;
                if (args.movement_type) filter.movement_type = args.movement_type;
                if (args.name) {
                    filter.name = { $regex: escapeRegExp(args.name), $options: 'i' };
                }

                const limit = args.limit || 20;
                const exercises = await ExerciseModel.find(filter)
                    .limit(limit)
                    .select('name muscle_group movement_type equipment default_sets default_reps rest_seconds')
                    .lean();

                return {
                    data: {
                        count: exercises.length,
                        items: exercises.map((ex) => ({
                            id: String(ex._id),
                            name: ex.name,
                            muscle_group: ex.muscle_group,
                            movement_type: ex.movement_type,
                            equipment: ex.equipment,
                            default_sets: ex.default_sets,
                            default_reps: ex.default_reps,
                            rest_seconds: ex.rest_seconds,
                        })),
                    },
                };
            },
        },
        {
            name: 'workouts_set_sequence',
            description: 'Define a repeating workout cycle (e.g. Push/Pull/Legs/Rest). The system calculates dates automatically and inserts Workout records for the given number of weeks. Use this instead of workouts_create_workout during onboarding.',
            readWriteMode: 'write',
            idempotent: true,
            timeoutMs: 20000,
            inputSchema: setSequenceInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['sequence', 'idempotencyKey'],
                properties: {
                    sequence: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 14,
                        items: {
                            oneOf: [
                                {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['type', 'name', 'exercises'],
                                    properties: {
                                        type: { type: 'string', enum: ['workout'] },
                                        name: { type: 'string', minLength: 1, maxLength: 120 },
                                        exercises: {
                                            type: 'array',
                                            minItems: 1,
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
                                    },
                                },
                                {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['type'],
                                    properties: {
                                        type: { type: 'string', enum: ['rest'] },
                                    },
                                },
                            ],
                        },
                    },
                    weeks: { type: 'integer', minimum: 1, maximum: 52 },
                    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
                },
            },
            async handler({ args, context }) {
                ensureUserId(context.userId);

                const hasWorkoutStep = args.sequence.some((step) => step.type === 'workout');
                if (!hasWorkoutStep) {
                    throw new ToolExecutionError({
                        code: 'TOOL_VALIDATION_ERROR',
                        message: 'Sequence must contain at least one workout step.',
                        status: 400,
                    });
                }

                // Validate exercise names against the database before making any changes
                const allNames = [
                    ...new Set(
                        args.sequence
                            .filter((step) => step.type === 'workout')
                            .flatMap((step) => step.exercises.map((ex) => ex.name.trim()))
                    ),
                ];
                const found = await ExerciseModel.find({
                    name: { $in: allNames.map((n) => new RegExp(`^${escapeRegExp(n)}$`, 'i')) },
                }).select('name').lean();
                const foundNames = new Set(found.map((ex) => ex.name.toLowerCase()));
                const unrecognized = allNames.filter((n) => !foundNames.has(n.toLowerCase()));
                if (unrecognized.length > 0) {
                    return {
                        data: {
                            validated: false,
                            unrecognizedExercises: unrecognized,
                            message: `These exercise names were not found in the database: ${unrecognized.join(', ')}. Use only names from the AVAILABLE EXERCISES list in your instructions.`,
                        },
                    };
                }

                // Archive existing planned workouts before inserting the new plan
                await WorkoutModel.updateMany(
                    { user: context.userId, archived: false },
                    { $set: { archived: true } }
                );

                const docs = buildWorkoutInsertDocs({
                    userId: context.userId,
                    sequence: args.sequence,
                    weeks: args.weeks || 12,
                });

                const inserted = await WorkoutModel.insertMany(docs);

                return {
                    changedFields: ['workouts'],
                    data: {
                        count: inserted.length,
                        firstDate: inserted[0]?.date,
                        lastDate: inserted[inserted.length - 1]?.date,
                    },
                };
            },
        },
        {
            name: 'workouts_propose_sequence',
            description: 'Propose a repeating workout cycle without saving anything. Use this during planning to define the workout structure and exercises. The plan will be processed and saved by the system.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 5000,
            inputSchema: setSequenceInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['sequence'],
                properties: {
                    sequence: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 14,
                        items: {
                            oneOf: [
                                {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['type', 'name', 'exercises'],
                                    properties: {
                                        type: { type: 'string', enum: ['workout'] },
                                        name: { type: 'string', minLength: 1, maxLength: 120 },
                                        exercises: {
                                            type: 'array',
                                            minItems: 1,
                                            maxItems: 60,
                                            items: {
                                                type: 'object',
                                                additionalProperties: false,
                                                required: ['name'],
                                                properties: {
                                                    name: { type: 'string', minLength: 1 },
                                                    sets: { type: 'integer', minimum: 0 },
                                                    reps: { type: 'string', minLength: 1 },
                                                    rest_seconds: { type: 'integer', minimum: 0 },
                                                    notes: { type: 'string', maxLength: 1000 },
                                                },
                                            },
                                        },
                                    },
                                },
                                {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['type'],
                                    properties: {
                                        type: { type: 'string', enum: ['rest'] },
                                    },
                                },
                            ],
                        },
                    },
                    weeks: { type: 'integer', minimum: 1, maximum: 52 },
                },
            },
            async handler({ args }) {
                const hasWorkoutStep = args.sequence.some((step) => step.type === 'workout');
                if (!hasWorkoutStep) {
                    throw new ToolExecutionError({
                        code: 'TOOL_VALIDATION_ERROR',
                        message: 'Sequence must contain at least one workout step.',
                        status: 400,
                    });
                }
                return {
                    data: {
                        proposed: true,
                        sequence: args.sequence,
                        weeks: args.weeks || 12,
                    },
                };
            },
        },
        {
            name: 'workouts_submit_corrected_plan',
            description: 'Submit the final workout sequence after exercise names have been matched to the database. Called by the exercise name resolver.',
            readWriteMode: 'read',
            idempotent: false,
            timeoutMs: 5000,
            inputSchema: setSequenceInputSchema,
            jsonSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['sequence'],
                properties: {
                    sequence: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 14,
                        items: {
                            oneOf: [
                                {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['type', 'name', 'exercises'],
                                    properties: {
                                        type: { type: 'string', enum: ['workout'] },
                                        name: { type: 'string', minLength: 1, maxLength: 120 },
                                        exercises: {
                                            type: 'array',
                                            minItems: 1,
                                            maxItems: 60,
                                            items: {
                                                type: 'object',
                                                additionalProperties: false,
                                                required: ['name'],
                                                properties: {
                                                    name: { type: 'string', minLength: 1 },
                                                    sets: { type: 'integer', minimum: 0 },
                                                    reps: { type: 'string', minLength: 1 },
                                                    rest_seconds: { type: 'integer', minimum: 0 },
                                                    notes: { type: 'string', maxLength: 1000 },
                                                },
                                            },
                                        },
                                    },
                                },
                                {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['type'],
                                    properties: {
                                        type: { type: 'string', enum: ['rest'] },
                                    },
                                },
                            ],
                        },
                    },
                    weeks: { type: 'integer', minimum: 1, maximum: 52 },
                },
            },
            async handler({ args }) {
                const hasWorkoutStep = args.sequence.some((step) => step.type === 'workout');
                if (!hasWorkoutStep) {
                    throw new ToolExecutionError({
                        code: 'TOOL_VALIDATION_ERROR',
                        message: 'Sequence must contain at least one workout step.',
                        status: 400,
                    });
                }
                return {
                    data: {
                        accepted: true,
                        sequence: args.sequence,
                        weeks: args.weeks || 12,
                    },
                };
            },
        },
    ];
}

module.exports = {
    createWorkoutTools,
};
