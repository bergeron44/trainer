const asyncHandler = require('express-async-handler');
const Workout = require('../models/Workout');
const Exercise = require('../models/Exercise');
const { callWithFallback } = require('../services/llmChain');
const {
    buildWorkoutSystem,
    buildWorkoutUserMessage,
    suggestTodayFocus,
    getMuscleGroupsForFocus,
} = require('../prompts/workoutPrompt');

/**
 * @desc  Generate a new workout for today using LLM, selecting exercises from DB,
 *        then update (or create) today's workout document for the user.
 * @route POST /ai/workout/daily
 * @access Private
 */
const generateDailyWorkout = asyncHandler(async (req, res) => {
    const user = req.user;
    const userNotes = req.body?.user_notes || '';

    // ── 1. Find today's existing workout ────────────────────────────────────
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const todayWorkout = await Workout.findOne({
        user: user._id,
        date: { $gte: todayStart, $lte: todayEnd },
    }).lean();

    // ── 2. Determine focus ─────────────────────────────────────────────────
    const recentWorkouts = await Workout.find({ user: user._id })
        .sort({ date: -1 })
        .limit(7)
        .select('date muscle_group exercises status notes')
        .lean();

    // Use today's muscle_group if exists, otherwise auto-rotate
    const todayFocus = todayWorkout?.muscle_group || suggestTodayFocus(recentWorkouts);

    // ── 3. Fetch relevant exercises from DB ────────────────────────────────
    const primaryMuscles = getMuscleGroupsForFocus(todayFocus);

    // Primary exercises for the focus group
    const primaryExercises = await Exercise.find({ muscle_group: { $in: primaryMuscles } })
        .select('name muscle_group equipment movement_type default_sets default_reps rest_seconds')
        .lean();

    // Always include some arms + core as optional accessories
    const accessoryExercises = await Exercise.find({
        muscle_group: { $in: ['arms', 'core'] },
    })
        .select('name muscle_group equipment default_sets default_reps rest_seconds')
        .limit(30)
        .lean();

    const availableExercises = [...primaryExercises, ...accessoryExercises];

    // ── 4. Build prompts ───────────────────────────────────────────────────
    const systemPrompt = buildWorkoutSystem(user);
    const userMessage  = buildWorkoutUserMessage({
        recentWorkouts,
        todayFocus,
        todayWorkout,
        availableExercises,
        userNotes,
        user,
    });

    // ── 5. Call LLM ────────────────────────────────────────────────────────
    const { text, provider } = await callWithFallback(systemPrompt, userMessage, 1500);

    // ── 6. Parse JSON ─────────────────────────────────────────────────────
    let result;
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        result = JSON.parse(cleaned);
    } catch (err) {
        res.status(500);
        throw new Error(`LLM returned invalid JSON: ${text.slice(0, 300)}`);
    }

    // ── 7. Map exercise names → DB ids ────────────────────────────────────
    // Build lookup map (case-insensitive)
    const exerciseMap = {};
    availableExercises.forEach(ex => {
        exerciseMap[ex.name.toLowerCase().trim()] = ex;
    });

    const mappedExercises = (result.exercises || []).map(ex => {
        const dbEx = exerciseMap[ex.name.toLowerCase().trim()];
        return {
            id:          dbEx?._id?.toString() || null,
            name:        ex.name,
            sets:        ex.sets        || dbEx?.default_sets  || 3,
            reps:        ex.reps        || dbEx?.default_reps  || '8-12',
            rest_seconds: ex.rest_seconds || dbEx?.rest_seconds || 90,
            notes:       ex.notes       || '',
            weight:      0,
        };
    });

    // ── 8. Update or create today's workout ───────────────────────────────
    const workoutFields = {
        exercises:        mappedExercises,
        muscle_group:     result.muscle_group || todayFocus,
        duration_minutes: result.duration_minutes || (user.profile?.session_duration || 60),
        notes:            result.coach_note || '',
        status:           todayWorkout?.status === 'completed' ? 'completed' : 'planned',
    };

    let savedWorkout;
    if (todayWorkout) {
        savedWorkout = await Workout.findByIdAndUpdate(
            todayWorkout._id,
            workoutFields,
            { new: true }
        ).lean();
    } else {
        savedWorkout = await Workout.create({
            user: user._id,
            date: new Date(),
            ...workoutFields,
        });
        savedWorkout = savedWorkout.toObject();
    }

    // ── 9. Return the full updated workout + meta ─────────────────────────
    res.json({
        ...savedWorkout,
        title:       result.title,
        coach_note:  result.coach_note,
        _provider:   provider,
    });
});

module.exports = { generateDailyWorkout };
