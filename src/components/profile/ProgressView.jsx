import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Dumbbell, Utensils, TrendingUp, Clock, Trophy, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import api from '@/api/axios';
import { useTranslation } from 'react-i18next';

// ── SVG Donut Chart ──
function DonutChart({ value, max, size = 100, strokeWidth = 8, color = '#00F2FF' }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(value / Math.max(max, 1), 1);
    const offset = circumference * (1 - pct);

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
            <motion.circle
                cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
            />
        </svg>
    );
}

// ── Macro Bar ──
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
            className="bg-gradient-to-br from-[#1A1A1A] to-[#111] rounded-2xl p-4 border border-white/5
                 flex flex-col items-center justify-center gap-1"
        >
            <span className="text-2xl">{icon}</span>
            <span className="text-white font-bold text-lg">{value}</span>
            <span className="text-white/40 text-[10px] uppercase tracking-wider text-center leading-tight">{label}</span>
        </motion.div>
    );
}

// ── Day Card ──
function DayCard({ day, targetCalories, index }) {
    const [expanded, setExpanded] = useState(false);
    const date = new Date(day.date + 'T12:00:00');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[date.getDay()];
    const calPct = Math.min((day.calories / Math.max(targetCalories, 1)) * 100, 100);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-gradient-to-r from-[#141414] to-[#1A1A1A] rounded-2xl border border-white/5
                 overflow-hidden"
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
            >
                {/* Date */}
                <div className="flex flex-col items-center min-w-[42px]">
                    <span className="text-[10px] text-white/30 uppercase">{dayName}</span>
                    <span className="text-white font-bold text-lg leading-tight">
                        {date.getDate()}
                    </span>
                    <span className="text-[10px] text-white/30">
                        {(date.getMonth() + 1).toString().padStart(2, '0')}
                    </span>
                </div>

                <div className="w-px h-8 bg-white/10" />

                {/* Calories mini donut */}
                <div className="relative">
                    <DonutChart value={day.calories} max={targetCalories} size={40} strokeWidth={4}
                        color={calPct >= 90 ? '#CCFF00' : calPct >= 50 ? '#00F2FF' : '#FF6B6B'} />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/60 font-bold">
                        {Math.round(calPct)}%
                    </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Utensils className="w-3 h-3 text-[#00F2FF]" />
                        <span className="text-white/80 text-sm font-medium">{day.calories} kcal</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <Dumbbell className="w-3 h-3 text-[#CCFF00]" />
                        <span className={`text-sm ${day.workout_completed ? 'text-[#CCFF00]' : 'text-white/30'}`}>
                            {day.workout_completed ? (day.muscle_group || '✅ Done') : '—'}
                        </span>
                    </div>
                </div>

                {/* Expand arrow */}
                {expanded
                    ? <ChevronUp className="w-4 h-4 text-white/20" />
                    : <ChevronDown className="w-4 h-4 text-white/20" />}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-3 border-t border-white/5 pt-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                    <span className="text-white/40 block">Calories</span>
                                    <span className="text-white font-bold">{day.calories} / {targetCalories}</span>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                    <span className="text-white/40 block">Workout</span>
                                    <span className={`font-bold ${day.workout_completed ? 'text-[#CCFF00]' : 'text-white/30'}`}>
                                        {day.workout_completed ? 'Completed ✅' : 'Rest day'}
                                    </span>
                                </div>
                                {day.volume > 0 && (
                                    <div className="bg-white/5 rounded-lg p-2 text-center col-span-2">
                                        <span className="text-white/40 block">Volume</span>
                                        <span className="text-white font-bold">{day.volume.toLocaleString()} kg</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ══════════════════════════════════════════════
//  Main ProgressView component
// ══════════════════════════════════════════════
export default function ProgressView() {
    const { t } = useTranslation();
    const [history, setHistory] = useState(null);
    const [daily, setDaily] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchData() {
            setLoading(true);
            try {
                const [histRes, dailyRes] = await Promise.all([
                    api.get('/progress/history?days=60', { signal: controller.signal }),
                    api.get('/progress/daily', { signal: controller.signal }),
                ]);
                setHistory(histRes.data);
                setDaily(dailyRes.data);
            } catch (err) {
                if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                    console.error('Failed to load progress:', err);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        fetchData();
        return () => controller.abort();
    }, []);

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
    const streak = daily?.streak || { current: 0, best: 0 };

    // Today's nutrition
    const todayNut = daily?.nutrition || {};
    const todayWorkout = daily?.workout || {};
    const userTargets = {
        protein: 150, carbs: 200, fat: 65, // Fallback; ideally from user profile
        calories: targetCal,
    };

    return (
        <div className="space-y-6 pb-8">

            {/* ════ Today's Snapshot ════ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-[#0F0F0F] to-[#1A1A1A] rounded-3xl p-5 border border-white/5
                   relative overflow-hidden"
            >
                {/* Glow accent */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#00F2FF]/5 rounded-full blur-3xl" />

                <h3 className="text-white/40 text-xs uppercase tracking-widest mb-4">
                    {t('progress.today', "Today's Progress")}
                </h3>

                <div className="flex items-center gap-5">
                    {/* Donut */}
                    <div className="relative flex-shrink-0">
                        <DonutChart
                            value={todayNut.calories_consumed || 0}
                            max={userTargets.calories}
                            size={110}
                            strokeWidth={10}
                            color={
                                (todayNut.calories_consumed || 0) >= userTargets.calories * 0.9
                                    ? '#CCFF00'
                                    : '#00F2FF'
                            }
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-white font-bold text-xl">{todayNut.calories_consumed || 0}</span>
                            <span className="text-white/30 text-[10px]">/ {userTargets.calories}</span>
                        </div>
                    </div>

                    {/* Macros */}
                    <div className="flex-1 space-y-2.5">
                        <MacroBar label="Protein" value={todayNut.protein || 0} goal={userTargets.protein} color="#FF6B6B" icon="🥩" />
                        <MacroBar label="Carbs" value={todayNut.carbs || 0} goal={userTargets.carbs} color="#00F2FF" icon="🍚" />
                        <MacroBar label="Fat" value={todayNut.fat || 0} goal={userTargets.fat} color="#FFD93D" icon="🥑" />
                    </div>
                </div>

                {/* Workout status bar */}
                <div className="mt-4 flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                    <Dumbbell className="w-4 h-4 text-[#CCFF00]" />
                    <span className="text-sm text-white/70 flex-1">
                        {todayWorkout.completed
                            ? `${todayWorkout.muscle_group || t('progress.workoutDone', 'Workout')} — ${todayWorkout.duration_minutes} min`
                            : todayWorkout.duration_minutes > 0
                                ? `🔥 ${t('progress.inProgress', 'In Progress')}...`
                                : `⏳ ${t('progress.noWorkoutYet', 'No workout yet')}`
                        }
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
                    >
                        🔥
                    </motion.span>
                    <div>
                        <span className="text-white font-bold text-xl">{streak.current} {t('progress.dayStreak', 'day streak!')}</span>
                        <p className="text-white/40 text-xs mt-0.5">
                            {t('progress.bestStreak', 'Best')}: {streak.best} {t('progress.days', 'days')}
                        </p>
                    </div>
                </motion.div>
            )}

            {/* ════ All-Time Stats Grid ════ */}
            <div>
                <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3 px-1">
                    {t('progress.allTimeStats', 'All-Time Stats')}
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                    <StatPill icon="🏋️" label={t('progress.workouts', 'Workouts')} value={allTime.total_workouts || 0} delay={0} />
                    <StatPill icon="🔥" label="kcal" value={(allTime.total_calories_logged || 0).toLocaleString()} delay={0.05} />
                    <StatPill icon="⏱️" label={t('progress.minutes', 'Minutes')} value={(allTime.total_training_minutes || 0).toLocaleString()} delay={0.1} />
                    <StatPill icon="💪" label="Volume" value={`${((allTime.total_volume || 0) / 1000).toFixed(1)}t`} delay={0.15} />
                    <StatPill icon="📈" label={t('progress.avgKcal', 'Avg/day')} value={allTime.avg_daily_calories || 0} delay={0.2} />
                    <StatPill icon="🏆" label={t('progress.bestStreak', 'Best')} value={`${allTime.longest_streak || 0}d`} delay={0.25} />
                </div>
            </div>

            {/* ════ Daily History ════ */}
            <div>
                <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {t('progress.recentDays', 'Recent Activity')}
                </h3>
                {days.length === 0 ? (
                    <div className="text-center py-10 text-white/20 text-sm">
                        {t('progress.noActivity', 'No activity logged yet. Start training or log a meal! 💪')}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {days.map((day, i) => (
                            <DayCard key={day.date} day={day} targetCalories={targetCal} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
