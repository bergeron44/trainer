const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { generateNextMeal } = require('../controllers/mealController');

// POST /ai/meal/next — Generate next meal via LLM
router.post('/next', protect, generateNextMeal);

module.exports = router;
