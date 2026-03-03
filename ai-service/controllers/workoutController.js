const asyncHandler = require('express-async-handler');
const Workout = require('../models/Workout');
const { callWithFallback } = require('../services/llmChain');
const { buildWorkoutSystem, buildWorkoutUserMessage, suggestTodayFocus } = require('../prompts/workoutPrompt');

/**
 * @desc    Generate a special one-time daily workout using LLM
 * @route   POST /ai/workout/daily
 * @access  Private
 */
const generateDailyWorkout = asyncHandler(async (req, res) => {
    const user = req.user;

    // Get last 7 workouts to understand recent history
    const recentWorkouts = await Workout.find({ user: user._id })
        .sort({ date: -1 })
        .limit(7)
        .select('date muscle_group exercises status')
        .lean();

    const todayFocus = suggestTodayFocus(recentWorkouts);

    const systemPrompt = buildWorkoutSystem(user);
    const userMessage = buildWorkoutUserMessage({ recentWorkouts, todayFocus, user });

    const { text, provider } = await callWithFallback(systemPrompt, userMessage, 1200);

    // Parse JSON — strip markdown code fences if model added them
    let workout;
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        workout = JSON.parse(cleaned);
    } catch (err) {
        res.status(500);
        throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
    }

    res.json({ ...workout, _provider: provider });
});

module.exports = { generateDailyWorkout };
