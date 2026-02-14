const express = require('express');
const router = express.Router();
const {
    getNutritionLogs,
    logMeal,
    getLogsByDate
} = require('../controllers/nutritionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getNutritionLogs).post(protect, logMeal);
router.route('/date/:date').get(protect, getLogsByDate);

module.exports = router;
