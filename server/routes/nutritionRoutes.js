const express = require('express');
const router = express.Router();
const {
    getNutritionLogs,
    logMeal,
    getLogsByDate,
    getRecentSavedMeals,
    generateMealPlan,
    fetchFoods,
    retryOnboardingMenuPlan,
    getActiveMealPlan,
} = require('../controllers/nutritionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getNutritionLogs).post(protect, logMeal);
router.get('/recent-saved', protect, getRecentSavedMeals);
router.route('/date/:date').get(protect, getLogsByDate);
router.post('/foods', protect, fetchFoods);
router.post('/menu/retry', protect, retryOnboardingMenuPlan);
router.get('/menu/active', protect, getActiveMealPlan);

module.exports = router;
