const express = require('express');
const router = express.Router();
const { generateProgressInsights } = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

router.post('/insights', protect, generateProgressInsights);

module.exports = router;
