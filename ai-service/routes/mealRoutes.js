const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { generateNextMeal, generateMealFromText } = require('../controllers/mealController');

// POST /ai/meal/next — Generate next meal via LLM
router.post('/next', protect, generateNextMeal);

// POST /ai/meal/from-text — Parse user's free-text meal description
router.post('/from-text', protect, generateMealFromText);

module.exports = router;
