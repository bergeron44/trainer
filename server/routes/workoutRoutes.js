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
    generateWorkoutPlan
} = require('../controllers/workoutController');
const { protect } = require('../middleware/authMiddleware');
const Workout = require('../models/Workout');
const asyncHandler = require('express-async-handler');

router.route('/').get(protect, getWorkouts).post(protect, setWorkout);
router.route('/generate').post(protect, generateWorkoutPlan);

// DELETE /api/workouts/reset — wipe all workouts for this user and reset has_existing_plan
router.delete('/reset', protect, asyncHandler(async (req, res) => {
    const User = require('../models/User');
    await Workout.deleteMany({ user: req.user.id });
    await User.findByIdAndUpdate(req.user.id, { 'profile.has_existing_plan': false });
    res.json({ message: 'Plan reset. A new plan will be generated on next dashboard load.' });
}));

router.route('/session').post(protect, startSession);
router.route('/session/active').get(protect, getActiveSession);
router.route('/:id').get(protect, getWorkout).put(protect, updateWorkout).delete(protect, deleteWorkout);

module.exports = router;
