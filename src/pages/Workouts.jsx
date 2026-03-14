import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isToday, isFuture } from 'date-fns';
import { Calendar, Dumbbell, Check, Clock, ChevronRight, List, CalendarDays, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/api/axios';
import aiApi from '@/api/aiAxios';
import WorkoutHistoryCalendar from '@/components/calendar/WorkoutHistoryCalendar';
import WorkoutReelsPreview from '@/components/workouts/WorkoutReelsPreview';

export default function Workouts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list');
  const [filter, setFilter] = useState('upcoming');
  const [workouts, setWorkouts] = useState([]);
  const [previewWorkout, setPreviewWorkout] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAiWorkout, setShowAiWorkout] = useState(false);
  const [aiWorkout, setAiWorkout] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiNotes, setAiNotes] = useState('');

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const { data } = await api.get('/workouts');
        setWorkouts(data);
      } catch (error) {
        console.error('Failed to fetch workouts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorkouts();
  }, []);

  const generateAiWorkout = async (userNotes = '') => {
    setShowAiWorkout(true);
    setIsAiLoading(true);
    setAiWorkout(null);
    try {
      const { data } = await aiApi.post('/workout/daily', { user_notes: userNotes });
      setAiWorkout(data);
      // Update the workout in the local list so the page reflects the change immediately
      const todayStr = new Date().toISOString().split('T')[0];
      setWorkouts(prev => {
        const idx = prev.findIndex(w => w.date?.startsWith(todayStr) || w._id === data._id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data };
          return updated;
        }
        // No today's workout existed before → add it
        return [data, ...prev];
      });
    } catch (err) {
      console.error('AI workout failed:', err);
      setAiWorkout({ error: true });
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredWorkouts = workouts.filter(workout => {
    const workoutDate = parseISO(workout.date);
    switch (filter) {
      case 'completed': return workout.status === 'completed';
      case 'upcoming':  return isFuture(workoutDate) || isToday(workoutDate);
      default:          return true;
    }
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getStatusBadge = (workout) => {
    const workoutDate = parseISO(workout.date);
    if (workout.status === 'completed') return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
        <Check className="w-3 h-3" /> {t('workouts.statusCompleted', 'Done')}
      </span>
    );
    if (isToday(workoutDate)) return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#00F2FF]/20 text-[#00F2FF]">
        <Dumbbell className="w-3 h-3" /> {t('workouts.statusToday', 'Today')}
      </span>
    );
    if (isFuture(workoutDate)) return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-500/20 text-gray-400">
        <Clock className="w-3 h-3" /> {t('workouts.statusPlanned', 'Planned')}
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
        {t('workouts.statusMissed', 'Missed')}
      </span>
    );
  };

  const completedCount = workouts.filter(w => w.status === 'completed').length;
  const streak = 3;

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        {/* Row 1: title + view toggle */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">{t('workouts.title', 'Workouts')}</h1>
            <p className="text-gray-500 text-sm">{t('workouts.history', 'Your training history & schedule')}</p>
          </div>
          <div className="flex items-center gap-1 bg-[#1A1A1A] rounded-xl p-1 border border-[#2A2A2A]">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[#00F2FF] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-[#00F2FF] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Row 2: Special Workout button — full width on mobile */}
        <button
          onClick={() => { setShowAiWorkout(true); setAiWorkout(null); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#CCFF00]/10 to-[#00F2FF]/10 border border-[#CCFF00]/30 text-[#CCFF00] text-sm font-medium hover:border-[#CCFF00]/60 hover:from-[#CCFF00]/20 hover:to-[#00F2FF]/20 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          {t('workouts.specialToday', '✦ Special Workout Today — Let AI Build My Session')}
        </button>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Calendar View */}
          {viewMode === 'calendar' ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <WorkoutHistoryCalendar />
            </motion.div>
          ) : (
            <>
              {/* Filter Tabs */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
                <div className="flex bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-1 gap-1">
                  {['upcoming', 'completed'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        filter === f ? 'bg-[#00F2FF] text-black' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {f === 'upcoming' ? t('workouts.upcoming', 'Upcoming') : t('workouts.completed', 'Completed')}
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Stats */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: t('workouts.thisWeek', 'This Week'), value: completedCount, color: '#00F2FF' },
                  { label: t('workouts.total', 'Total'), value: workouts.length, color: '#CCFF00' },
                  { label: t('analytics.streak', 'Streak'), value: `${streak} ${t('common.days', 'days')}`, color: '#FF6B6B' }
                ].map(stat => (
                  <div key={stat.label} className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                    <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Workout List — clicking goes directly to video reels */}
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredWorkouts.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                      <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500">{t('dashboard.noWorkoutsFound', 'No workouts found')}</p>
                    </motion.div>
                  ) : (
                    filteredWorkouts.map((workout, index) => (
                      <motion.button
                        key={workout._id || workout.id || `workout-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => setPreviewWorkout(workout)}
                        className="w-full text-left bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] hover:border-[#00F2FF]/30 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusBadge(workout)}
                            </div>
                            <h3 className="font-semibold text-lg group-hover:text-[#00F2FF] transition-colors">{workout.muscle_group}</h3>
                            <p className="text-sm text-gray-500">{format(parseISO(workout.date), 'EEEE, MMM d')}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                              <span>{workout.exercises?.length || 0} {t('common.exercises', 'exercises')}</span>
                              {workout.total_volume && (
                                <span>{workout.total_volume.toLocaleString()} {t('common.kg')} {t('workouts.total', 'total').toLowerCase()}</span>
                              )}
                              {workout.duration_minutes && (
                                <span>{workout.duration_minutes} {t('common.minutes')}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-[#00F2FF] transition-colors" />
                        </div>
                      </motion.button>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </>
      )}

      {/* Video Reels — opens directly when clicking a workout */}
      <AnimatePresence>
        {previewWorkout && (
          <WorkoutReelsPreview
            exercises={previewWorkout.exercises}
            onClose={() => setPreviewWorkout(null)}
            onStart={() => {
              const workoutId = previewWorkout._id || previewWorkout.id;
              setPreviewWorkout(null);
              navigate(`/WorkoutSession?id=${workoutId}`);
            }}
          />
        )}
      </AnimatePresence>

      {/* AI Special Workout Modal */}
      <AnimatePresence>
        {showAiWorkout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm pb-20"
            onClick={() => setShowAiWorkout(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111] rounded-t-2xl border-t border-x border-[#2A2A2A] max-h-[65vh] overflow-y-auto"
            >
              {/* Handle + header row */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#CCFF00]" />
                  <span className="text-sm font-semibold text-[#CCFF00]">
                    {t('workouts.specialWorkoutTitle', 'Special Workout Today')}
                  </span>
                </div>
                <button onClick={() => setShowAiWorkout(false)} className="text-gray-500 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mx-4 h-px bg-[#2A2A2A] mb-3" />

              <div className="px-4 pb-5">
                {/* Step 1 — notes + generate */}
                {!isAiLoading && !aiWorkout && (
                  <div className="space-y-3">
                    <textarea
                      value={aiNotes}
                      onChange={e => setAiNotes(e.target.value)}
                      placeholder={t('workouts.aiNotesPlaceholder', 'Notes (optional): skip legs, prefer machines…')}
                      className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#CCFF00]/40 h-14"
                    />
                    <button
                      onClick={() => generateAiWorkout(aiNotes)}
                      className="w-full py-2.5 rounded-xl bg-[#CCFF00] text-black font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#CCFF00]/90 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('workouts.generateBtn', 'Generate My Workout')}
                    </button>
                  </div>
                )}

                {/* Step 2 — loading */}
                {isAiLoading && (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <div className="w-5 h-5 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">{t('workouts.generatingWorkout', 'Building your workout…')}</p>
                  </div>
                )}

                {/* Step 3 — result */}
                {!isAiLoading && aiWorkout && !aiWorkout.error && (
                  <div className="space-y-3">
                    {/* Title row */}
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-bold text-base text-white">{aiWorkout.title}</h3>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">
                        {aiWorkout.muscle_group}{aiWorkout.duration_minutes ? ` · ${aiWorkout.duration_minutes}m` : ''}
                      </span>
                    </div>

                    {/* Exercise list — compact rows */}
                    <div className="divide-y divide-[#1E1E1E]">
                      {aiWorkout.exercises?.map((ex, i) => (
                        <div key={i} className="flex items-center gap-2 py-2">
                          <span className="text-[#CCFF00] font-bold text-xs w-4 shrink-0">{i + 1}</span>
                          <span className="font-medium text-sm flex-1 truncate">{ex.name}</span>
                          <span className="text-xs text-gray-500 shrink-0">{ex.sets}×{ex.reps}</span>
                        </div>
                      ))}
                    </div>

                    {aiWorkout.coach_note && (
                      <p className="text-xs text-[#CCFF00]/60 italic leading-snug">{aiWorkout.coach_note}</p>
                    )}

                    <button
                      onClick={() => setAiWorkout(null)}
                      className="w-full py-2 rounded-xl border border-[#2A2A2A] text-gray-500 text-xs hover:text-[#CCFF00] hover:border-[#CCFF00]/30 transition-colors"
                    >
                      {t('workouts.regenerateBtn', 'Regenerate')}
                    </button>
                  </div>
                )}

                {/* Error */}
                {!isAiLoading && aiWorkout?.error && (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-gray-500 text-sm">{t('workouts.aiError', 'Could not generate workout. Try again.')}</p>
                    <button
                      onClick={() => setAiWorkout(null)}
                      className="px-5 py-1.5 rounded-xl border border-[#2A2A2A] text-gray-400 text-xs hover:text-white transition-colors"
                    >
                      {t('common.tryAgain', 'Try Again')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
