const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { lookupFood } = require('../controllers/foodController');

// POST /ai/food/lookup — Estimate nutritional values for a food item
router.post('/lookup', protect, lookupFood);

module.exports = router;
