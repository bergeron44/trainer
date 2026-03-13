const express = require('express');
const router = express.Router();
const {
    extractNutritionPreferences,
    extractNutritionPreferencesPhase1
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/nutrition-preferences/extract', protect, extractNutritionPreferences);
router.put('/nutrition-preferences/extract-phase1', protect, extractNutritionPreferencesPhase1);

module.exports = router;
