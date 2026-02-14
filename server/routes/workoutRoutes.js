const express = require('express');
const router = express.Router();
const {
    getWorkouts,
    getWorkout,
    setWorkout,
    updateWorkout,
    deleteWorkout,
    startSession,
    getActiveSession
} = require('../controllers/workoutController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getWorkouts).post(protect, setWorkout);
router.route('/:id').get(protect, getWorkout).put(protect, updateWorkout).delete(protect, deleteWorkout);
router.route('/session').post(protect, startSession);
router.route('/session/active').get(protect, getActiveSession);

module.exports = router;
