const asyncHandler = require('express-async-handler');
const NutritionLog = require('../models/NutritionLog');

// @desc    Get nutrition logs
// @route   GET /api/nutrition
// @access  Private
const getNutritionLogs = asyncHandler(async (req, res) => {
    const logs = await NutritionLog.find({ user: req.user.id });

    res.status(200).json(logs);
});

// @desc    Log meal
// @route   POST /api/nutrition
// @access  Private
const logMeal = asyncHandler(async (req, res) => {
    const log = await NutritionLog.create({
        user: req.user.id,
        ...req.body
    });

    res.status(200).json(log);
});

// @desc    Get logs by date
// @route   GET /api/nutrition/:date
// @access  Private
const getLogsByDate = asyncHandler(async (req, res) => {
    const start = new Date(req.params.date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(req.params.date);
    end.setHours(23, 59, 59, 999);

    const logs = await NutritionLog.find({
        user: req.user.id,
        date: {
            $gte: start,
            $lte: end
        }
    });

    res.status(200).json(logs);
});

module.exports = {
    getNutritionLogs,
    logMeal,
    getLogsByDate
};
