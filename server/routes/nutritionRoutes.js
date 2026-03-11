const express = require('express');
const router = express.Router();
const {
    getNutritionLogs,
    logMeal,
    getLogsByDate,
    generateMealPlan,
    fetchFoods,
    retryOnboardingMenuPlan,
    getActiveMealPlan,
} = require('../controllers/nutritionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getNutritionLogs).post(protect, logMeal);
router.route('/date/:date').get(protect, getLogsByDate);
router.post('/meal-plan', protect, generateMealPlan);
router.post('/foods', protect, fetchFoods);
router.post('/menu/retry', protect, retryOnboardingMenuPlan);
router.get('/menu/active', protect, getActiveMealPlan);

module.exports = router;
