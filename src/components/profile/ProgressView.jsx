import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dumbbell, Utensils, TrendingUp, Calendar, Brain,
    AlertTriangle, CheckCircle, Lightbulb, Clock, Flame, Moon,
} from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '@/api/axios';
import { useTranslation } from 'react-i18next';

// ── Intensity colors ──
const intensityColor = {
    Low: 'text-white/40',
    Medium: 'text-[#CCFF00]',
    High: 'text-[#00F2FF]',
};

// ── Status Badge ──
const statusStyles = {
    'Goal Reached': 'bg-[#00F2FF]/20 text-[#00F2FF]',
    'Almost There': 'bg-[#CCFF00]/20 text-[#CCFF00]',
    'Rest Day': 'bg-white/5 text-white/40',
    'Missed': 'bg-red-500/20 text-red-400',
};

function StatusBadge({ status }) {
    if (!status) return null;
    return (
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusStyles[status] || statusStyles['Rest Day']}`}>
            {status}
        </span>
    );
}

// ── Nutrition Ring (static SVG, CSS transition like exmple.js) ──
function NutritionRing({ consumed, target, size = 64 }) {
    const pct = Math.min((consumed / Math.max(target, 1)) * 100, 100);
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={pct >= 95 ? '#00F2FF' : '#CCFF00'}
                    strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    className="transition-all duration-700"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{Math.round(pct)}%</span>
            </div>
        </div>
    );
}

// ── Macro Bar (for Today's Snapshot) ──
function MacroBar({ label, value, goal, color, icon }) {
    const pct = Math.min((value / Math.max(goal, 1)) * 100, 100);
    return (
        <div className="flex items-center gap-3">
            <span className="text-lg">{icon}</span>
            <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/60">{label}</span>
                    <span className="text-white/80 font-medium">{value}g / {goal}g</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                </div>
            </div>
        </div>
    );
}

// ── Stat Pill ──
function StatPill({ icon, label, value, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="bg-[#141414] border border-white/5 rounded-2xl p-4
                flex flex-col items-center justify-center gap-1"
        >
            <span className="text-2xl">{icon}</span>
            <span className="text-white font-bold text-lg">{value}</span>
            <span className="text-white/40 text-[10px] uppercase tracking-wider text-center leading-tight">{label}</span>
        </motion.div>
    );
}

// ── AI Insight Card (Lucide icons like exmple.js) ──
const insightIconMap = {
    warning: AlertTriangle,
    success: CheckCircle,
    tip: Lightbulb,
};
const insightStyleMap = {
    warning: 'border-[#CCFF00]/30 bg-[#CCFF00]/5',
    success: 'border-[#00F2FF]/30 bg-[#00F2FF]/5',
    tip: 'border-white/10 bg-white/[0.03]',
};
const insightIconColorMap = {
    warning: 'text-[#CCFF00]',
    success: 'text-[#00F2FF]',
    tip: 'text-white/40',
};

function InsightCard({ type, text, index }) {
    const Icon = insightIconMap[type] || Lightbulb;
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + index * 0.1 }}
            className={`border rounded-2xl p-4 flex items-start gap-3 ${insightStyleMap[type] || insightStyleMap.tip}`}
        >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${insightIconColorMap[type] || insightIconColorMap.tip}`} />
            <p className="text-sm text-white/70 leading-relaxed">{text}</p>
        </motion.div>
    );
}

// ── Day Card (open card like exmple.js, no accordion) ──
function DayCard({ day, targetCalories, index }) {
    const date = new Date(day.date + 'T12:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const shortDate = day.date;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + Math.min(index * 0.08, 0.5) }}
            className="bg-[#141414] border border-white/5 rounded-2xl p-5 space-y-4
                hover:border-[#00F2FF]/30 transition-colors cursor-pointer"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{dayName}</span>
                    <span className="text-xs text-white/40">{shortDate}</span>
                </div>
                <StatusBadge status={day.status} />
            </div>

            <div className="flex items-center gap-5">
                {/* Nutrition Ring */}
                <NutritionRing consumed={day.calories} target={targetCalories} />

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                    {/* Workout or Rest */}
                    {day.workout_completed ? (
                        <div className="flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-[#00F2FF] flex-shrink-0" />
                            <span className="text-sm font-medium text-white truncate">
                                {day.muscle_group || 'Workout'}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-white/40 ml-auto flex-shrink-0">
                                {day.workout_duration > 0 && (
                                    <>
                                        <Clock className="w-3 h-3" />
                                        <span>{day.workout_duration}m</span>
                                    </>
                                )}
                                {day.workout_intensity && (
                                    <span className={`ml-1 font-semibold ${intensityColor[day.workout_intensity] || 'text-white/40'}`}>
                                        {day.workout_intensity}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Moon className="w-4 h-4 text-white/30" />
                            <span className="text-sm text-white/30 italic">Rest Day</span>
                        </div>
                    )}

                    {/* Calories */}
                    <div className="flex items-center gap-2 text-xs text-white/40">
                        <Flame className="w-3 h-3 text-orange-400" />
                        <span>{day.calories} / {targetCalories} kcal</span>
                    </div>

                    {/* Top Foods as chips */}
                    {day.top_foods && day.top_foods.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                            {day.top_foods.map((food) => (
                                <span key={food}
                                    className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-white/50 truncate max-w-[120px]">
                                    {food}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Volume badge if available */}
            {day.volume > 0 && (
                <div className="flex items-center gap-2 text-xs text-white/30 border-t border-white/5 pt-3">
                    <span>Total volume:</span>
                    <span className="text-white/50 font-medium">{day.volume.toLocaleString()} kg</span>
                    {day.macros && (day.macros.protein > 0 || day.macros.carbs > 0) && (
                        <span className="ml-auto">
                            P: <span className="text-[#FF6B6B]">{day.macros.protein}g</span>
                            {' · '}C: <span className="text-[#00F2FF]">{day.macros.carbs}g</span>
                            {' · '}F: <span className="text-[#FFD93D]">{day.macros.fat}g</span>
                        </span>
                    )}
                </div>
            )}
        </motion.div>
    );
}

// ── Chart Tooltip ──
function ChartTooltip(unit) {
    return function CustomTooltip({ active, payload, label }) {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-xs">
                <p className="text-white/40 mb-1">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} className="font-bold" style={{ color: p.color }}>
                        {p.value}{unit}
                    </p>
                ))}
            </div>
        );
    };
}
const weightTooltip = ChartTooltip('kg');
const caloriesTooltip = ChartTooltip(' kcal');

// ══════════════════════════════════════════════
//  Main ProgressView
// ══════════════════════════════════════════════
export default function ProgressView() {
    const { t } = useTranslation();
    const [history, setHistory] = useState(null);
    const [daily, setDaily] = useState(null);
    const [exerciseTrends, setExerciseTrends] = useState(null);
    const [insights, setInsights] = useState(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        async function fetchData() {
            setLoading(true);
            try {
                const [histRes, dailyRes, trendsRes] = await Promise.all([
                    api.get('/progress/history?days=60', { signal: controller.signal }),
                    api.get('/progress/daily', { signal: controller.signal }),
                    api.get('/progress/exercise-trends?days=30', { signal: controller.signal }),
                ]);
                setHistory(histRes.data);
                setDaily(dailyRes.data);
                setExerciseTrends(trendsRes.data);
            } catch (err) {
                if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                    console.error('Failed to load progress:', err);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        fetchData();
        return () => controller.abort();
    }, []);

    // AI insights — non-blocking, loads after main data
    useEffect(() => {
        if (!daily) return;
        const today = new Date().toISOString().slice(0, 10);
        setInsightsLoading(true);
        api.get(`/progress/insights/${today}`)
            .then(res => setInsights(res.data.insights || []))
            .catch(() => setInsights(null))
            .finally(() => setInsightsLoading(false));
    }, [daily]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const allTime = history?.allTime || {};
    const days = history?.days || [];
    const targetCal = history?.target_calories || 2000;
    const macroSplit = history?.macroSplit || { protein_pct: 0, carbs_pct: 0, fat_pct: 0 };
    const caloriesHistory = history?.caloriesHistory || [];
    const streak = daily?.streak || { current: 0, best: 0 };
    const todayNut = daily?.nutrition || {};
    const todayWorkout = daily?.workout || {};
    const userTargets = { protein: 150, carbs: 200, fat: 65, calories: targetCal };

    const topExercise = exerciseTrends?.topExercise;
    const exerciseChartData = topExercise?.data || [];
    const calChartData = caloriesHistory.slice(-14);

    const hasMacroData = macroSplit.protein_pct > 0 || macroSplit.carbs_pct > 0 || macroSplit.fat_pct > 0;
    const macroPieData = [
        { name: 'Protein', value: macroSplit.protein_pct, color: '#00C853' },
        { name: 'Carbs', value: macroSplit.carbs_pct, color: '#FF6D00' },
        { name: 'Fats', value: macroSplit.fat_pct, color: '#448AFF' },
    ];

    return (
        <div className="space-y-8 pb-8">

            {/* ════ Stats Bar ════ */}
            <div className="grid grid-cols-3 gap-3">
                <StatPill icon="⚖️" label="Weight" value={`${allTime.last_weight || '—'} kg`} delay={0} />
                <StatPill icon="🔥" label="Weekly Cal Avg" value={allTime.avg_daily_calories || 0} delay={0.1} />
                <StatPill icon="⚡" label="Streak" value={`${streak.current} days`} delay={0.2} />
            </div>

            {/* ════ Today's Snapshot ════ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#141414] border border-white/5 rounded-2xl p-5 relative overflow-hidden"
            >
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#00F2FF]/5 rounded-full blur-3xl" />
                <h3 className="text-white/40 text-xs uppercase tracking-widest mb-4">
                    {t('progress.today', "Today's Progress")}
                </h3>
                <div className="flex items-center gap-5">
                    <div className="relative flex-shrink-0">
                        <NutritionRing
                            consumed={todayNut.calories_consumed || 0}
                            target={userTargets.calories}
                            size={110}
                        />
                    </div>
                    <div className="flex-1 space-y-2.5">
                        <MacroBar label="Protein" value={todayNut.protein || 0} goal={userTargets.protein} color="#FF6B6B" icon="🥩" />
                        <MacroBar label="Carbs" value={todayNut.carbs || 0} goal={userTargets.carbs} color="#00F2FF" icon="🍚" />
                        <MacroBar label="Fat" value={todayNut.fat || 0} goal={userTargets.fat} color="#FFD93D" icon="🥑" />
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                    <Dumbbell className="w-4 h-4 text-[#CCFF00]" />
                    <span className="text-sm text-white/70 flex-1">
                        {todayWorkout.completed
                            ? `${todayWorkout.muscle_group || 'Workout'} — ${todayWorkout.duration_minutes} min`
                            : todayWorkout.duration_minutes > 0
                                ? `🔥 ${t('progress.inProgress', 'In Progress')}...`
                                : `⏳ ${t('progress.noWorkoutYet', 'No workout yet')}`}
                    </span>
                    {todayWorkout.completed && <span className="text-[#CCFF00] text-sm font-bold">✅</span>}
                </div>
            </motion.div>

            {/* ════ Streak Banner ════ */}
            {streak.current > 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-r from-[#FF6B00]/20 via-[#FF3D00]/10 to-transparent
                        rounded-2xl px-5 py-4 border border-[#FF6B00]/20 flex items-center gap-4"
                >
                    <motion.span
                        className="text-4xl"
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >🔥</motion.span>
                    <div>
                        <span className="text-white font-bold text-xl">{streak.current} {t('progress.dayStreak', 'day streak!')}</span>
                        <p className="text-white/40 text-xs mt-0.5">
                            {t('progress.bestStreak', 'Best')}: {streak.best} {t('progress.days', 'days')}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* ════ Analytics ════ */}
            {(exerciseChartData.length > 1 || calChartData.length > 1 || hasMacroData) && (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white">Analytics</h2>

                    {/* All-Time Mini Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Avg Calories', value: allTime.avg_daily_calories || 0, icon: '🔥' },
                            { label: 'Workouts', value: allTime.total_workouts || 0, icon: '🏋️' },
                            { label: 'Avg Protein', value: `${Math.round((allTime.avg_protein || 0))}g`, icon: '🥩' },
                            { label: 'Best Streak', value: `${allTime.longest_streak || 0}d`, icon: '⚡' },
                        ].map((s, i) => (
                            <motion.div
                                key={s.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                className="bg-[#141414] border border-white/5 rounded-2xl p-4 flex flex-col gap-1"
                            >
                                <span className="text-xl">{s.icon}</span>
                                <span className="text-white/50 text-xs">{s.label}</span>
                                <span className="text-white font-bold text-xl">{s.value}</span>
                            </motion.div>
                        ))}
                    </div>

                    {/* Exercise Performance */}
                    {exerciseChartData.length > 1 && (
                        <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-semibold text-white">{topExercise.name}</span>
                                    <p className="text-xs text-white/40">Best improving exercise</p>
                                </div>
                                {topExercise.improvement_pct > 0 && (
                                    <div className="flex items-center gap-1 text-[#00F2FF] text-xs font-medium">
                                        <TrendingUp className="w-3.5 h-3.5" />
                                        <span>+{topExercise.improvement_pct}%</span>
                                    </div>
                                )}
                            </div>
                            <ResponsiveContainer width="100%" height={160}>
                                <AreaChart data={exerciseChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                                    <defs>
                                        <linearGradient id="exGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#00F2FF" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#00F2FF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date"
                                        axisLine={false} tickLine={false}
                                        tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11 }} />
                                    <YAxis hide />
                                    <Tooltip content={weightTooltip} />
                                    <Area type="monotone" dataKey="weight" stroke="#00F2FF" strokeWidth={2}
                                        fill="url(#exGrad)" dot={{ r: 3, fill: '#00F2FF' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Calorie History */}
                    {calChartData.length > 1 && (
                        <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 space-y-3">
                            <span className="text-sm font-semibold text-white">Daily Calorie Intake</span>
                            <ResponsiveContainer width="100%" height={160}>
                                <AreaChart data={calChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                                    <defs>
                                        <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#CCFF00" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#CCFF00" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date"
                                        axisLine={false} tickLine={false}
                                        tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11 }}
                                        tickFormatter={v => v.slice(5)} />
                                    <YAxis hide />
                                    <Tooltip content={caloriesTooltip} />
                                    <Area type="monotone" dataKey="calories" stroke="#CCFF00"
                                        strokeWidth={2} fill="url(#calGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Macro Pie */}
                    {hasMacroData && (
                        <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 space-y-3">
                            <span className="text-sm font-semibold text-white">Macro Split (Avg)</span>
                            <div className="flex items-center gap-6">
                                <ResponsiveContainer width={120} height={120}>
                                    <PieChart>
                                        <Pie data={macroPieData} cx="50%" cy="50%"
                                            innerRadius={35} outerRadius={52}
                                            paddingAngle={3} dataKey="value" strokeWidth={0}>
                                            {macroPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-2">
                                    {macroPieData.map(m => (
                                        <div key={m.name} className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                                            <span className="text-xs text-white/50">{m.name}</span>
                                            <span className="text-xs font-bold text-white ml-auto">{m.value}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════ Smart Insights ════ */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-4"
            >
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-[#00F2FF]" />
                    <h2 className="text-lg font-bold text-white">Smart Insights</h2>
                </div>
                {insightsLoading ? (
                    <div className="flex items-center gap-2 text-white/30 text-xs">
                        <div className="w-4 h-4 border border-[#00F2FF]/40 border-t-transparent rounded-full animate-spin" />
                        Analyzing your progress...
                    </div>
                ) : insights && insights.length > 0 ? (
                    <div className="space-y-3">
                        {insights.map((item, i) => (
                            <InsightCard key={i} type={item.type} text={item.text} index={i} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-white/30">
                        Log workouts or meals to get AI insights.
                    </p>
                )}
            </motion.div>

            {/* ════ Your Feed ════ */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-white">Your Feed</h2>
                {days.length === 0 ? (
                    <div className="text-center py-10 text-white/20 text-sm">
                        {t('progress.noActivity', 'No activity logged yet. Start training or log a meal! 💪')}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {days.map((day, i) => (
                            <DayCard key={day.date} day={day} targetCalories={targetCal} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
