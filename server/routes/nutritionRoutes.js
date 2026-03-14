const express = require('express');
const router = express.Router();
const {
    getNutritionLogs,
    logMeal,
    getLogsByDate,
    getNutritionCalendar,
    updateNutritionLog,
    deleteNutritionLog,
    getRecentSavedMeals,
    getLikedMealRecaps,
    saveLikedMealRecap,
    deleteLikedMealRecap,
    generateMealPlan,
    fetchFoods,
    retryOnboardingMenuPlan,
    regenerateActiveMealPlan,
    getActiveMealPlan,
} = require('../controllers/nutritionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getNutritionLogs).post(protect, logMeal);
router.get('/calendar', protect, getNutritionCalendar);
router.route('/entry/:id').put(protect, updateNutritionLog).delete(protect, deleteNutritionLog);
router.get('/recent-saved', protect, getRecentSavedMeals);
router.route('/liked-recaps').get(protect, getLikedMealRecaps).post(protect, saveLikedMealRecap);
router.delete('/liked-recaps/:id', protect, deleteLikedMealRecap);
router.route('/date/:date').get(protect, getLogsByDate);
router.post('/meal-plan', protect, generateMealPlan);
router.post('/foods', protect, fetchFoods);
router.post('/menu/retry', protect, retryOnboardingMenuPlan);
router.post('/menu/regenerate', protect, regenerateActiveMealPlan);
router.get('/menu/active', protect, getActiveMealPlan);

module.exports = router;
