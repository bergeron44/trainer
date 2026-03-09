const asyncHandler = require('express-async-handler');
const NutritionLog = require('../models/NutritionLog');
const WorkoutSession = require('../models/WorkoutSession');
const WorkoutLog = require('../models/WorkoutLog');
const Workout = require('../models/Workout');
const User = require('../models/User');

// @desc    Get daily progress (nutrition + workout + streak)
// @route   GET /api/progress/daily?date=YYYY-MM-DD
// @access  Private
const getDailyProgress = asyncHandler(async (req, res) => {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const userId = req.user.id;

    // Fetch user for targets
    const user = await User.findById(userId).select('profile').lean();
    const targetCalories = user?.profile?.target_calories || 2000;

    // --- Nutrition ---
    const nutritionLogs = await NutritionLog.find({
        user: userId,
        date: { $gte: start, $lte: end },
        archived: { $ne: true },
    }).lean();

    const nutrition = {
        calories_consumed: 0,
        target_calories: targetCalories,
        protein: 0,
        carbs: 0,
        fat: 0,
        meals_count: nutritionLogs.length,
    };

    for (const log of nutritionLogs) {
        nutrition.calories_consumed += log.calories || 0;
        nutrition.protein += log.protein || 0;
        nutrition.carbs += log.carbs || 0;
        nutrition.fat += log.fat || 0;
    }

    // --- Workout ---
    const sessions = await WorkoutSession.find({
        user: userId,
        start_time: { $gte: start, $lte: end },
    }).lean();

    const completedSession = sessions.find(s => s.status === 'completed');
    const activeSession = sessions.find(s => s.status === 'active');
    const session = completedSession || activeSession;

    let workout = { completed: false, duration_minutes: 0, total_volume: 0, exercises_completed: 0, muscle_group: null };

    if (session) {
        const durationMs = session.end_time
            ? new Date(session.end_time) - new Date(session.start_time)
            : Date.now() - new Date(session.start_time);

        // Try to get muscle group from the linked workout
        let muscleGroup = null;
        if (session.workout_id) {
            const linkedWorkout = await Workout.findById(session.workout_id).select('muscle_group').lean();
            muscleGroup = linkedWorkout?.muscle_group || null;
        }

        workout = {
            completed: session.status === 'completed',
            duration_minutes: Math.round(durationMs / 60000),
            total_volume: session.total_volume || 0,
            exercises_completed: session.completed_exercises?.length || 0,
            muscle_group: muscleGroup,
        };
    }

    // --- Streak ---
    const streak = await calculateStreak(userId);

    res.status(200).json({
        date: dateStr,
        nutrition,
        workout,
        streak,
    });
});

// @desc    Get progress history (all-time stats + daily list)
// @route   GET /api/progress/history?days=30
// @access  Private
const getProgressHistory = asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const userId = req.user.id;

    const user = await User.findById(userId).select('profile').lean();
    const targetCalories = user?.profile?.target_calories || 2000;

    // --- All-Time Stats ---
    const allSessions = await WorkoutSession.find({
        user: userId,
        status: 'completed',
    }).lean();

    const allNutrition = await NutritionLog.find({
        user: userId,
        archived: { $ne: true },
    }).lean();

    let totalVolume = 0;
    let totalTrainingMs = 0;
    for (const s of allSessions) {
        totalVolume += s.total_volume || 0;
        if (s.start_time && s.end_time) {
            totalTrainingMs += new Date(s.end_time) - new Date(s.start_time);
        }
    }

    let totalCaloriesLogged = 0;
    for (const n of allNutrition) {
        totalCaloriesLogged += n.calories || 0;
    }

    // Count distinct days with nutrition logs for average
    const distinctNutritionDays = new Set(
        allNutrition.map(n => new Date(n.date).toISOString().slice(0, 10))
    ).size;

    const streak = await calculateStreak(userId);

    const allTime = {
        total_workouts: allSessions.length,
        total_calories_logged: Math.round(totalCaloriesLogged),
        total_volume: Math.round(totalVolume),
        total_training_minutes: Math.round(totalTrainingMs / 60000),
        avg_daily_calories: distinctNutritionDays > 0
            ? Math.round(totalCaloriesLogged / distinctNutritionDays)
            : 0,
        longest_streak: streak.best,
    };

    // --- Daily Breakdown (last N days) ---
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const recentNutrition = await NutritionLog.find({
        user: userId,
        date: { $gte: startDate, $lte: endDate },
        archived: { $ne: true },
    }).lean();

    const recentSessions = await WorkoutSession.find({
        user: userId,
        start_time: { $gte: startDate, $lte: endDate },
    }).lean();

    // Group by day
    const dayMap = {};

    for (const n of recentNutrition) {
        const dayKey = new Date(n.date).toISOString().slice(0, 10);
        if (!dayMap[dayKey]) dayMap[dayKey] = { calories: 0, workout_completed: false, muscle_group: null, volume: 0 };
        dayMap[dayKey].calories += n.calories || 0;
    }

    for (const s of recentSessions) {
        const dayKey = new Date(s.start_time).toISOString().slice(0, 10);
        if (!dayMap[dayKey]) dayMap[dayKey] = { calories: 0, workout_completed: false, muscle_group: null, volume: 0 };
        if (s.status === 'completed') {
            dayMap[dayKey].workout_completed = true;
            dayMap[dayKey].volume += s.total_volume || 0;
            // Try to get muscle group
            if (s.workout_id) {
                const w = await Workout.findById(s.workout_id).select('muscle_group').lean();
                dayMap[dayKey].muscle_group = w?.muscle_group || dayMap[dayKey].muscle_group;
            }
        }
    }

    const daysList = Object.entries(dayMap)
        .map(([date, data]) => ({ date, ...data, calories: Math.round(data.calories) }))
        .sort((a, b) => b.date.localeCompare(a.date));

    res.status(200).json({
        allTime,
        target_calories: targetCalories,
        days: daysList,
    });
});

// --- Helper: Calculate streak ---
async function calculateStreak(userId) {
    const sessions = await WorkoutSession.find({
        user: userId,
        status: 'completed',
    }).select('start_time').sort({ start_time: -1 }).lean();

    if (!sessions.length) return { current: 0, best: 0 };

    // Get unique days (sorted descending)
    const uniqueDays = [...new Set(
        sessions.map(s => new Date(s.start_time).toISOString().slice(0, 10))
    )].sort((a, b) => b.localeCompare(a));

    let currentStreak = 0;
    let bestStreak = 0;
    let streak = 1;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Check if streak is active (trained today or yesterday)
    const isActive = uniqueDays[0] === today || uniqueDays[0] === yesterday;

    for (let i = 1; i < uniqueDays.length; i++) {
        const prev = new Date(uniqueDays[i - 1]);
        const curr = new Date(uniqueDays[i]);
        const diffDays = (prev - curr) / 86400000;

        if (diffDays === 1) {
            streak++;
        } else {
            if (i === 1 || (i > 1 && currentStreak === 0 && isActive)) {
                currentStreak = streak;
            }
            bestStreak = Math.max(bestStreak, streak);
            streak = 1;
        }
    }

    bestStreak = Math.max(bestStreak, streak);
    if (currentStreak === 0 && isActive) currentStreak = streak;

    return { current: currentStreak, best: bestStreak };
}

module.exports = {
    getDailyProgress,
    getProgressHistory,
};
