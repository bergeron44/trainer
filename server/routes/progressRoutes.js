const express = require('express');
const router = express.Router();
const { getDailyProgress, getProgressHistory } = require('../controllers/progressController');
const { protect } = require('../middleware/authMiddleware');

router.get('/daily', protect, getDailyProgress);
router.get('/history', protect, getProgressHistory);

module.exports = router;
