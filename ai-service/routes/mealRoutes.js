const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    generateNextMeal,
    generateMealFromText,
    generateMealRecap,
} = require('../controllers/mealController');

router.post('/next', protect, generateNextMeal);
router.post('/from-text', protect, generateMealFromText);
router.post('/recap', protect, generateMealRecap);

module.exports = router;
