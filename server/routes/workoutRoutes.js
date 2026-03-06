const express = require('express');
const router = express.Router();
const {
    getWorkouts,
    getWorkout,
    setWorkout,
    updateWorkout,
    deleteWorkout,
    startSession,
    getActiveSession,
    generateWorkoutPlan,
    retryOnboardingWorkoutPlan,
} = require('../controllers/workoutController');
const { protect } = require('../middleware/authMiddleware');
const Workout = require('../models/Workout');
const asyncHandler = require('express-async-handler');

router.route('/').get(protect, getWorkouts).post(protect, setWorkout);
router.route('/generate').post(protect, generateWorkoutPlan);
router.post('/plan/retry', protect, retryOnboardingWorkoutPlan);

// DELETE /api/workouts/reset — wipe all workouts for this user and reset has_existing_plan
router.delete('/reset', protect, asyncHandler(async (req, res) => {
    const User = require('../models/User');
    await Workout.deleteMany({ user: req.user.id });
    await User.findByIdAndUpdate(req.user.id, {
        'profile.has_existing_plan': false,
        'profile.workout_plan_status': 'pending',
        'profile.workout_plan_error': undefined,
    });
    res.json({ message: 'Plan reset. Use AI planner retry to generate a new plan.' });
}));

router.route('/session').post(protect, startSession);
router.route('/session/active').get(protect, getActiveSession);
router.route('/:id').get(protect, getWorkout).put(protect, updateWorkout).delete(protect, deleteWorkout);

module.exports = router;
