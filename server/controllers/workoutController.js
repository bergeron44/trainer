const asyncHandler = require('express-async-handler');
const Workout = require('../models/Workout');
const WorkoutSession = require('../models/WorkoutSession');
const Exercise = require('../models/Exercise');

// @desc    Get workouts
// @route   GET /api/workouts
// @access  Private
const getWorkouts = asyncHandler(async (req, res) => {
    // Check for optional date filters
    const { startDate, endDate } = req.query;

    let query = { user: req.user.id };

    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }

    // Sort by date ascending to load workouts in order
    const workouts = await Workout.find(query).sort({ date: 1 });

    res.status(200).json(workouts);
});

// @desc    Set workout
// @route   POST /api/workouts
// @access  Private
const setWorkout = asyncHandler(async (req, res) => {
    //   if (!req.body.text) {
    //     res.status(400);
    //     throw new Error('Please add a text field');
    //   }

    const workout = await Workout.create({
        user: req.user.id,
        ...req.body
    });

    res.status(200).json(workout);
});

// @desc    Update workout
// @route   PUT /api/workouts/:id
// @access  Private
const updateWorkout = asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id);

    if (!workout) {
        res.status(400);
        throw new Error('Workout not found');
    }

    // Check for user
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Make sure the logged in user matches the workout user
    if (workout.user.toString() !== req.user.id) {
        res.status(401);
        throw new Error('User not authorized');
    }

    const updatedWorkout = await Workout.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
    });

    res.status(200).json(updatedWorkout);
});

// @desc    Delete workout
// @route   DELETE /api/workouts/:id
// @access  Private
const deleteWorkout = asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id);

    if (!workout) {
        res.status(400);
        throw new Error('Workout not found');
    }

    // Check for user
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Make sure the logged in user matches the workout user
    if (workout.user.toString() !== req.user.id) {
        res.status(401);
        throw new Error('User not authorized');
    }

    await workout.remove();

    res.status(200).json({ id: req.params.id });
});

// @desc    Start workout session
// @route   POST /api/workouts/session
// @access  Private
const startSession = asyncHandler(async (req, res) => {
    const { workout_id } = req.body;

    // Check for existing active session
    const existingSession = await WorkoutSession.findOne({
        user: req.user.id,
        status: 'active'
    });

    if (existingSession) {
        res.status(400);
        throw new Error('Active session already exists');
    }

    const session = await WorkoutSession.create({
        user: req.user.id,
        workout_id,
        start_time: new Date(),
        status: 'active'
    });

    res.status(200).json(session);
});

// @desc    Get active session
// @route   GET /api/workouts/session/active
// @access  Private
const getActiveSession = asyncHandler(async (req, res) => {
    const session = await WorkoutSession.findOne({
        user: req.user.id,
        status: 'active'
    });

    res.status(200).json(session || null);
});

// @desc    Get workout by ID
// @route   GET /api/workouts/:id
// @access  Private
const getWorkout = asyncHandler(async (req, res) => {
    const workout = await Workout.findById(req.params.id);

    if (!workout) {
        res.status(400);
        throw new Error('Workout not found');
    }

    // Check for user
    if (!req.user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Make sure the logged in user matches the workout user
    if (workout.user.toString() !== req.user.id) {
        res.status(401);
        throw new Error('User not authorized');
    }

    res.status(200).json(workout);
});

// @desc    Generate 12-week Training Plan (Demo AI)
// @route   POST /api/workouts/generate
// @access  Private
const generateWorkoutPlan = asyncHandler(async (req, res) => {
    const User = require('../models/User'); // Import here to avoid circular dep if any
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(401);
        throw new Error('User not found');
    }

    // Prevent duplicate generations
    if (user.profile.has_existing_plan) {
        res.status(400);
        throw new Error('User already has a 12-week training plan.');
    }

    const targetGoal = user.profile.goal || 'recomp';

    // -----------------------------------------------------
    // BUILD PLAN FROM DB EXERCISES
    // -----------------------------------------------------
    const frequencyPerWeek = user.profile.workout_days_per_week || 3;

    // Helper: pick N random exercises from a DB query result
    function pickRandom(arr, n) {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    }

    // Helper: map an Exercise doc → workout exercise entry
    function toWorkoutEx(ex) {
        return {
            name:         ex.name,
            sets:         ex.default_sets,
            reps:         ex.default_reps,
            rest_seconds: ex.rest_seconds,
            weight:       0,
        };
    }

    // Fetch exercises from DB grouped by movement pattern
    const [pushExercises, pullExercises, legsExercises, coreExercises, cardioExercises, fullBodyExercises] =
        await Promise.all([
            Exercise.find({ movement_type: 'push',     video_url: { $ne: null } }).lean(),
            Exercise.find({ movement_type: 'pull',     video_url: { $ne: null } }).lean(),
            Exercise.find({ movement_type: 'legs',     video_url: { $ne: null } }).lean(),
            Exercise.find({ movement_type: 'core',     video_url: { $ne: null } }).lean(),
            Exercise.find({ movement_type: 'cardio',   video_url: { $ne: null } }).lean(),
            Exercise.find({ movement_type: 'full_body',video_url: { $ne: null } }).lean(),
        ]);

    // Define workout day "slots" per goal — each slot picks from a pool
    const DAY_TEMPLATES = {
        muscle_gain: [
            { group: 'Push',  pools: [{ src: pushExercises,  compound: 2, isolation: 3 }] },
            { group: 'Pull',  pools: [{ src: pullExercises,  compound: 2, isolation: 3 }] },
            { group: 'Legs',  pools: [{ src: legsExercises,  compound: 2, isolation: 3 }] },
        ],
        weight_loss: [
            { group: 'Full Body Circuit', pools: [{ src: cardioExercises,  compound: 3, isolation: 2 }, { src: fullBodyExercises, compound: 1, isolation: 0 }] },
            { group: 'Upper + Core',      pools: [{ src: pushExercises,    compound: 2, isolation: 1 }, { src: coreExercises,     compound: 0, isolation: 2 }] },
            { group: 'Lower HIIT',        pools: [{ src: legsExercises,    compound: 2, isolation: 2 }, { src: cardioExercises,   compound: 0, isolation: 1 }] },
        ],
        athletic_performance: [
            { group: 'Power & Speed',      pools: [{ src: fullBodyExercises, compound: 2, isolation: 1 }, { src: cardioExercises,  compound: 0, isolation: 2 }] },
            { group: 'Agility & Core',     pools: [{ src: coreExercises,    compound: 2, isolation: 2 }, { src: cardioExercises,  compound: 0, isolation: 1 }] },
            { group: 'Functional Strength',pools: [{ src: pullExercises,    compound: 2, isolation: 1 }, { src: legsExercises,    compound: 2, isolation: 0 }] },
        ],
    };

    const daySlots = DAY_TEMPLATES[targetGoal] || DAY_TEMPLATES['muscle_gain'];

    // Build exercise list for each slot by sampling from DB pools
    function buildDayExercises(slot) {
        const exercises = [];
        for (const { src, compound, isolation } of slot.pools) {
            // compound exercises = default_sets >= 4 (heavy), isolation = less
            const heavy = src.filter(e => e.default_sets >= 4);
            const light = src.filter(e => e.default_sets < 4);
            exercises.push(...pickRandom(heavy.length ? heavy : src, compound).map(toWorkoutEx));
            exercises.push(...pickRandom(light.length  ? light  : src, isolation).map(toWorkoutEx));
        }
        // Deduplicate by name (in case same exercise appears in multiple pools)
        const seen = new Set();
        return exercises.filter(e => seen.has(e.name) ? false : seen.add(e.name));
    }

    let planTemplate = daySlots.map(slot => ({
        group:     slot.group,
        exercises: buildDayExercises(slot),
    }));

    // -----------------------------------------------------
    // Generate dates mapped out for 12 weeks (84 days)
    // -----------------------------------------------------
    const workoutsToInsert = [];
    const TOTAL_WEEKS = 12;
    const today = new Date();
    // Normalize today back to midnight so the UI matching is timezone-friendly
    today.setHours(0, 0, 0, 0);

    let workoutCounter = 0;

    for (let week = 0; week < TOTAL_WEEKS; week++) {
        // Spread the workouts across the week (e.g. M W F)
        // For simplicity: Every other day until frequency is hit
        for (let dw = 0; dw < frequencyPerWeek; dw++) {
            const daysToAdd = (week * 7) + (dw * 2); // Week offset + spaced out days

            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + daysToAdd);

            // Pull sequentially from our template pool
            const workoutDay = planTemplate[workoutCounter % planTemplate.length];

            // Ensure unique IDs inside the embedded exercises array
            const generatedExercises = workoutDay.exercises.map((ex, idx) => ({
                ...ex,
                id: `gen_ex_${Date.now()}_${workoutCounter}_${idx}`
            }));

            workoutsToInsert.push({
                user: user._id,
                date: targetDate,
                muscle_group: workoutDay.group,
                exercises: generatedExercises,
                status: 'planned'
            });

            workoutCounter++;
        }
    }

    // Insert all documents at once
    const generatedWorkouts = await Workout.insertMany(workoutsToInsert);

    // Update user profile
    user.profile.has_existing_plan = true;
    await user.save();

    res.status(201).json({
        message: '12-week training plan generated successfully',
        count: generatedWorkouts.length,
        workouts: generatedWorkouts
    });
});



module.exports = {
    getWorkouts,
    getWorkout,
    setWorkout,
    updateWorkout,
    deleteWorkout,
    startSession,
    getActiveSession,
    generateWorkoutPlan
};
