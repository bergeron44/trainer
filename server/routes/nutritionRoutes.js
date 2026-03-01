const express = require('express');
const router = express.Router();
const {
    getNutritionLogs,
    logMeal,
    getLogsByDate,
    generateMealPlan,
    fetchFoods
} = require('../controllers/nutritionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getNutritionLogs).post(protect, logMeal);
router.route('/date/:date').get(protect, getLogsByDate);
router.post('/meal-plan', protect, generateMealPlan);
router.post('/foods', protect, fetchFoods);

module.exports = router;
