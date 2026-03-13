const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    updateProfile,
    changePassword,
    addFoodPreference,
    getFoodPreferences,
    getNutritionPreferences,
    extractNutritionPreferences,
    extractNutritionPreferencesPhase1,
    forgotPassword
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.put('/nutrition-preferences/extract', protect, extractNutritionPreferences);
router.put('/nutrition-preferences/extract-phase1', protect, extractNutritionPreferencesPhase1);
router.get('/nutrition-preferences', protect, getNutritionPreferences);
router.post('/food-preference', protect, addFoodPreference);
router.get('/food-preferences', protect, getFoodPreferences);

module.exports = router;
