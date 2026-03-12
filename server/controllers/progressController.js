const asyncHandler = require('express-async-handler');
const axios = require('axios');
const NutritionLog = require('../models/NutritionLog');
const WorkoutSession = require('../models/WorkoutSession');
const WorkoutLog = require('../models/WorkoutLog');
const Workout = require('../models/Workout');
const User = require('../models/User');
const DailyInsight = require('../models/DailyInsight');

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

// @desc    Get progress history (all-time stats + daily list + analytics data)
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

    // Group by day — expanded shape
    const dayMap = {};

    const ensureDay = (key) => {
        if (!dayMap[key]) dayMap[key] = {
            calories: 0,
            macros: { protein: 0, carbs: 0, fat: 0 },
            top_foods: [],
            workout_completed: false,
            muscle_group: null,
            workout_duration: 0,
            workout_intensity: 'Low',
            volume: 0,
            status: 'Rest Day',
        };
    };

    // Nutrition loop
    for (const n of recentNutrition) {
        const dayKey = new Date(n.date).toISOString().slice(0, 10);
        ensureDay(dayKey);
        dayMap[dayKey].calories += n.calories || 0;
        dayMap[dayKey].macros.protein += n.protein || 0;
        dayMap[dayKey].macros.carbs   += n.carbs   || 0;
        dayMap[dayKey].macros.fat     += n.fat     || 0;
        for (const f of (n.foods || [])) {
            if (f.name) dayMap[dayKey].top_foods.push({ name: f.name, calories: f.calories || 0 });
        }
    }

    // Keep top 3 foods by calories per day
    for (const key of Object.keys(dayMap)) {
        dayMap[key].top_foods = dayMap[key].top_foods
            .sort((a, b) => b.calories - a.calories)
            .slice(0, 3)
            .map(f => f.name);
    }

    // Sessions loop
    for (const s of recentSessions) {
        const dayKey = new Date(s.start_time).toISOString().slice(0, 10);
        ensureDay(dayKey);
        if (s.status === 'completed') {
            dayMap[dayKey].workout_completed = true;
            dayMap[dayKey].volume += s.total_volume || 0;

            const durationMs = s.end_time
                ? new Date(s.end_time) - new Date(s.start_time) : 0;
            dayMap[dayKey].workout_duration = Math.round(durationMs / 60000);

            const vol = s.total_volume || 0;
            dayMap[dayKey].workout_intensity = vol > 5000 ? 'High' : vol > 1000 ? 'Medium' : 'Low';

            if (s.workout_id) {
                const w = await Workout.findById(s.workout_id).select('muscle_group').lean();
                dayMap[dayKey].muscle_group = w?.muscle_group || dayMap[dayKey].muscle_group;
            }
        }
    }

    // Compute status per day
    for (const data of Object.values(dayMap)) {
        const pct = data.calories / Math.max(targetCalories, 1);
        if (data.workout_completed && pct >= 0.95)      data.status = 'Goal Reached';
        else if (pct >= 0.7)                            data.status = 'Almost There';
        else if (!data.workout_completed && pct < 0.05) data.status = 'Rest Day';
        else                                            data.status = 'Missed';
    }

    const daysList = Object.entries(dayMap)
        .map(([date, data]) => ({
            date,
            ...data,
            calories: Math.round(data.calories),
            macros: {
                protein: Math.round(data.macros.protein),
                carbs:   Math.round(data.macros.carbs),
                fat:     Math.round(data.macros.fat),
            },
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

    // macroSplit: average % across days with nutrition data
    const daysWithFood = Object.values(dayMap).filter(d => d.calories > 0);
    const sumCals = { p: 0, c: 0, f: 0 };
    for (const d of daysWithFood) {
        sumCals.p += d.macros.protein * 4;
        sumCals.c += d.macros.carbs   * 4;
        sumCals.f += d.macros.fat     * 9;
    }
    const totalMacroCals = sumCals.p + sumCals.c + sumCals.f || 1;
    const macroSplit = {
        protein_pct: Math.round((sumCals.p / totalMacroCals) * 100),
        carbs_pct:   Math.round((sumCals.c / totalMacroCals) * 100),
        fat_pct:     Math.round((sumCals.f / totalMacroCals) * 100),
    };

    // caloriesHistory sorted ascending for chart
    const caloriesHistory = daysList
        .map(d => ({ date: d.date, calories: d.calories }))
        .sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
        allTime,
        target_calories: targetCalories,
        macroSplit,
        caloriesHistory,
        days: daysList,
    });
});

// @desc    Get exercise performance trends from WorkoutLog
// @route   GET /api/progress/exercise-trends?days=30
// @access  Private
const getExerciseTrends = asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const userId = req.user.id;

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const logs = await WorkoutLog.find({ user: userId, date: { $gte: since } })
        .sort({ date: 1 }).lean();

    if (!logs.length) return res.status(200).json({ topExercise: null, exercises: [] });

    // Group by exercise_name → { "YYYY-MM-DD": maxWeight }
    const exerciseMap = {};
    for (const log of logs) {
        const dayKey = new Date(log.date).toISOString().slice(0, 10);
        if (!exerciseMap[log.exercise_name]) exerciseMap[log.exercise_name] = {};
        exerciseMap[log.exercise_name][dayKey] = Math.max(
            exerciseMap[log.exercise_name][dayKey] || 0,
            log.weight_used
        );
    }

    const exercises = Object.entries(exerciseMap).map(([name, byDay]) => {
        const data = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, weight]) => ({ date: date.slice(5), weight })); // "MM-DD"
        const startWeight = data[0]?.weight || 0;
        const endWeight   = data[data.length - 1]?.weight || 0;
        const improvement_kg  = parseFloat((endWeight - startWeight).toFixed(1));
        const improvement_pct = startWeight > 0
            ? Math.round((improvement_kg / startWeight) * 100) : 0;
        return { name, data, start_weight: startWeight, end_weight: endWeight,
                 improvement_kg, improvement_pct };
    });

    const topExercise = exercises
        .filter(e => e.data.length > 1 && e.improvement_kg > 0)
        .sort((a, b) => b.improvement_pct - a.improvement_pct)[0] || null;

    res.status(200).json({ topExercise, exercises: exercises.slice(0, 5) });
});

// @desc    Get AI insights for a specific date (cached per user/date, 12h TTL)
// @route   GET /api/progress/insights/:date
// @access  Private
const getDailyInsights = asyncHandler(async (req, res) => {
    const { date } = req.params; // "YYYY-MM-DD"
    const userId = req.user.id;
    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:5002';

    // Check cache (12h TTL)
    const cached = await DailyInsight.findOne({ user: userId, date });
    if (cached) {
        const ageHours = (Date.now() - new Date(cached.generated_at)) / 3_600_000;
        if (ageHours < 12) {
            return res.status(200).json({
                date,
                insights: cached.insights,
                cached: true,
                generated_at: cached.generated_at,
            });
        }
    }

    // Gather all day's data for the snapshot
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);

    const [user, nutritionLogs, sessions, workoutLogs] = await Promise.all([
        User.findById(userId).select('name profile').lean(),
        NutritionLog.find({ user: userId, date: { $gte: start, $lte: end }, archived: { $ne: true } }).lean(),
        WorkoutSession.find({ user: userId, start_time: { $gte: start, $lte: end } }).lean(),
        WorkoutLog.find({ user: userId, date: { $gte: start, $lte: end } }).lean(),
    ]);

    const completedSession = sessions.find(s => s.status === 'completed');

    const snapshot = {
        date,
        user: {
            name: user?.name,
            goal: user?.profile?.goal,
            target_calories: user?.profile?.target_calories || 2000,
            target_protein:  user?.profile?.protein_goal    || 150,
            target_carbs:    user?.profile?.carbs_goal      || 200,
            target_fat:      user?.profile?.fat_goal        || 65,
        },
        nutrition: {
            calories: Math.round(nutritionLogs.reduce((s, n) => s + (n.calories || 0), 0)),
            protein:  Math.round(nutritionLogs.reduce((s, n) => s + (n.protein  || 0), 0)),
            carbs:    Math.round(nutritionLogs.reduce((s, n) => s + (n.carbs    || 0), 0)),
            fat:      Math.round(nutritionLogs.reduce((s, n) => s + (n.fat      || 0), 0)),
            meals_count: nutritionLogs.length,
        },
        workout: completedSession ? {
            completed: true,
            duration_minutes: completedSession.end_time
                ? Math.round((new Date(completedSession.end_time) - new Date(completedSession.start_time)) / 60000)
                : 0,
            total_volume: completedSession.total_volume || 0,
            sets: workoutLogs.map(l => ({
                exercise: l.exercise_name,
                set:      l.set_number,
                reps:     l.reps_completed,
                weight:   l.weight_used,
            })),
        } : { completed: false },
        streak: (await calculateStreak(userId)).current,
    };

    // Call ai-service
    let insights = [];
    try {
        const aiRes = await axios.post(
            `${AI_URL}/ai/progress-insights`,
            { snapshot },
            { timeout: 15000 }
        );
        insights = aiRes.data?.insights || [];
        if (!Array.isArray(insights) || !insights.length) throw new Error('Empty or invalid response');
    } catch (err) {
        console.error('AI insights call failed, using rule-based fallback:', err.message);
        insights = generateRuleBasedInsights(snapshot);
    }

    // Upsert cache
    await DailyInsight.findOneAndUpdate(
        { user: userId, date },
        { insights, generated_at: new Date() },
        { upsert: true, new: true }
    );

    res.status(200).json({ date, insights, cached: false, generated_at: new Date() });
});

// Rule-based fallback when AI service is unavailable
function generateRuleBasedInsights(snap) {
    const insights = [];
    const { nutrition, workout, streak, user } = snap;
    const protPct = nutrition.protein / Math.max(user.target_protein, 1);
    const calPct  = nutrition.calories / Math.max(user.target_calories, 1);

    if (protPct < 0.6)
        insights.push({ type: 'warning', text: `Protein at ${nutrition.protein}g — well below your ${user.target_protein}g target. Add a protein source.` });
    else if (protPct >= 0.9)
        insights.push({ type: 'success', text: `Great protein intake today — ${nutrition.protein}g hit!` });

    if (calPct >= 0.95 && calPct <= 1.1)
        insights.push({ type: 'success', text: 'Calorie target nailed! Great nutritional consistency today.' });
    else if (calPct > 1.1)
        insights.push({ type: 'warning', text: `Calories exceeded target by ${Math.round((calPct - 1) * 100)}% today.` });

    if (workout?.completed && workout.total_volume > 3000)
        insights.push({ type: 'success', text: `Strong session — ${workout.total_volume.toLocaleString()} kg total volume logged.` });
    else if (!workout?.completed)
        insights.push({ type: 'tip', text: 'No workout logged today. Schedule your next session to keep your streak alive.' });

    if (streak >= 3)
        insights.push({ type: 'success', text: `${streak}-day active streak! Keep the momentum going 🔥` });

    if (!insights.length)
        insights.push({ type: 'tip', text: 'Log your meals and workouts consistently to unlock personalized insights.' });

    return insights;
}

// --- Helper: Calculate streak ---
async function calculateStreak(userId) {
    const sessions = await WorkoutSession.find({
        user: userId,
        status: 'completed',
    }).select('start_time').sort({ start_time: -1 }).lean();

    if (!sessions.length) return { current: 0, best: 0 };

    const uniqueDays = [...new Set(
        sessions.map(s => new Date(s.start_time).toISOString().slice(0, 10))
    )].sort((a, b) => b.localeCompare(a));

    let currentStreak = 0;
    let bestStreak = 0;
    let streak = 1;
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const isActive  = uniqueDays[0] === today || uniqueDays[0] === yesterday;

    for (let i = 1; i < uniqueDays.length; i++) {
        const prev = new Date(uniqueDays[i - 1]);
        const curr = new Date(uniqueDays[i]);
        const diffDays = (prev - curr) / 86400000;

        if (diffDays === 1) {
            streak++;
        } else {
            if (i === 1 || (i > 1 && currentStreak === 0 && isActive)) currentStreak = streak;
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
    getExerciseTrends,
    getDailyInsights,
};
