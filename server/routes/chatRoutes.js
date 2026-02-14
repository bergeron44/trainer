const express = require('express');
const router = express.Router();
const {
    generateResponse,
    getSummaries,
    createSummary,
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/response', protect, generateResponse);
router.route('/summaries').get(protect, getSummaries).post(protect, createSummary);

module.exports = router;
