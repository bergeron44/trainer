const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { generateDailyWorkout } = require('../controllers/workoutController');

// POST /ai/workout/daily — Generate special daily workout via LLM
router.post('/daily', protect, generateDailyWorkout);

module.exports = router;
