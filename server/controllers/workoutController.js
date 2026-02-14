const asyncHandler = require('express-async-handler');
const Workout = require('../models/Workout');
const WorkoutSession = require('../models/WorkoutSession');

// @desc    Get workouts
// @route   GET /api/workouts
// @access  Private
const getWorkouts = asyncHandler(async (req, res) => {
    const workouts = await Workout.find({ user: req.user.id });

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


module.exports = {
    getWorkouts,
    setWorkout,
    updateWorkout,
    deleteWorkout,
    startSession,
    getActiveSession
};
