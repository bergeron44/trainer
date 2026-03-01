const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    updateProfile,
    addFoodPreference,
    getFoodPreferences
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/food-preference', protect, addFoodPreference);
router.get('/food-preferences', protect, getFoodPreferences);

module.exports = router;
