const express = require('express');
const router = express.Router();
const { getDailyProgress, getProgressHistory, getExerciseTrends, getDailyInsights } = require('../controllers/progressController');
const { protect } = require('../middleware/authMiddleware');

router.get('/daily', protect, getDailyProgress);
router.get('/history', protect, getProgressHistory);
router.get('/exercise-trends', protect, getExerciseTrends);
router.get('/insights/:date', protect, getDailyInsights);

module.exports = router;
