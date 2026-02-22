const asyncHandler = require('express-async-handler');
const Workout = require('../models/Workout');
const WorkoutSession = require('../models/WorkoutSession');

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
    // 12-WEEK DEMO AI TEMPLATES
    // -----------------------------------------------------
    let planTemplate = [];

    // Helper: A generic Hypertrophy Push/Pull/Legs rotation (3 days a week)
    const templates = {
        muscle_gain: [
            { group: 'Push', exercises: [{ name: 'Bench Press', sets: 4, reps: '8-10', rest_seconds: 90 }, { name: 'Overhead Press', sets: 4, reps: '8-10', rest_seconds: 90 }, { name: 'Tricep Extensions', sets: 3, reps: '10-12', rest_seconds: 60 }] },
            { group: 'Pull', exercises: [{ name: 'Pull-ups', sets: 4, reps: '8-10', rest_seconds: 90 }, { name: 'Barbell Rows', sets: 4, reps: '8-10', rest_seconds: 90 }, { name: 'Bicep Curls', sets: 3, reps: '10-12', rest_seconds: 60 }] },
            { group: 'Legs', exercises: [{ name: 'Squats', sets: 4, reps: '8-10', rest_seconds: 120 }, { name: 'Romanian Deadlifts', sets: 4, reps: '8-10', rest_seconds: 90 }, { name: 'Calf Raises', sets: 4, reps: '15-20', rest_seconds: 60 }] }
        ],
        weight_loss: [
            { group: 'Full Body Circuit', exercises: [{ name: 'Burpees', sets: 4, reps: '15', rest_seconds: 45 }, { name: 'Kettlebell Swings', sets: 4, reps: '20', rest_seconds: 45 }, { name: 'Mountain Climbers', sets: 4, reps: '40', rest_seconds: 45 }] },
            { group: 'Upper Body + Core', exercises: [{ name: 'Push-ups', sets: 3, reps: '15', rest_seconds: 60 }, { name: 'Plank', sets: 3, reps: '60s', rest_seconds: 45 }, { name: 'Dumbbell Rows', sets: 3, reps: '15', rest_seconds: 60 }] },
            { group: 'Lower Body HIIT', exercises: [{ name: 'Jump Squats', sets: 4, reps: '15', rest_seconds: 45 }, { name: 'Walking Lunges', sets: 4, reps: '20', rest_seconds: 45 }, { name: 'Box Jumps', sets: 4, reps: '12', rest_seconds: 60 }] }
        ],
        athletic_performance: [
            { group: 'Power & Speed', exercises: [{ name: 'Power Cleans', sets: 5, reps: '3', rest_seconds: 120 }, { name: 'Box Jumps', sets: 4, reps: '5', rest_seconds: 90 }, { name: 'Medicine Ball Slams', sets: 4, reps: '10', rest_seconds: 60 }] },
            { group: 'Agility & Core', exercises: [{ name: 'Agility Ladder Drills', sets: 4, reps: '2 mins', rest_seconds: 60 }, { name: 'Russian Twists', sets: 3, reps: '20', rest_seconds: 45 }, { name: 'Sprints', sets: 5, reps: '50m', rest_seconds: 90 }] },
            { group: 'Functional Strength', exercises: [{ name: 'Deadlifts', sets: 4, reps: '5', rest_seconds: 120 }, { name: 'Farmer Walks', sets: 3, reps: '40m', rest_seconds: 60 }, { name: 'Prowler Push', sets: 3, reps: '20m', rest_seconds: 90 }] }
        ]
    };

    // Fallback appropriately
    planTemplate = templates[targetGoal] || templates['muscle_gain'];
    const frequencyPerWeek = user.profile.workout_days_per_week || 3;

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
