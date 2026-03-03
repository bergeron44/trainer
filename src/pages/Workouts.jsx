import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isToday, isFuture } from 'date-fns';
import { Calendar, Dumbbell, Check, Clock, ChevronRight, List, CalendarDays, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/api/axios';
import aiApi from '@/api/aiAxios';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TrainingCalendar from '@/components/calendar/TrainingCalendar';
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

  const generateAiWorkout = async () => {
    setShowAiWorkout(true);
    setIsAiLoading(true);
    setAiWorkout(null);
    try {
      const { data } = await aiApi.post('/workout/daily');
      setAiWorkout(data);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('workouts.title', 'Workouts')}</h1>
            <p className="text-gray-500 text-sm">{t('workouts.history', 'Your training history & schedule')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateAiWorkout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#CCFF00]/20 to-[#00F2FF]/20 border border-[#CCFF00]/30 text-[#CCFF00] text-sm font-medium hover:border-[#CCFF00]/60 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {t('workouts.specialToday', 'Special')}
            </button>
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
        </div>
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
              <TrainingCalendar workouts={workouts} />
            </motion.div>
          ) : (
            <>
              {/* Filter Tabs */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
                <Tabs value={filter} onValueChange={setFilter}>
                  <TabsList className="bg-[#1A1A1A] border border-[#2A2A2A] w-full">
                    <TabsTrigger value="upcoming" className="flex-1 data-[state=active]:bg-[#00F2FF] data-[state=active]:text-black">
                      {t('workouts.upcoming', 'Upcoming')}
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="flex-1 data-[state=active]:bg-[#00F2FF] data-[state=active]:text-black">
                      {t('workouts.completed', 'Completed')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAiWorkout(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111] rounded-t-3xl border border-[#2A2A2A] max-h-[85vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#333]" />
              </div>

              <div className="px-5 pb-8 pt-2">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#CCFF00]" />
                    <h2 className="text-lg font-bold text-[#CCFF00]">
                      {t('workouts.specialWorkoutTitle', 'Special Workout Today')}
                    </h2>
                  </div>
                  <button onClick={() => setShowAiWorkout(false)} className="text-gray-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isAiLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="w-10 h-10 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">{t('workouts.generatingWorkout', 'NEXUS is building your workout...')}</p>
                  </div>
                )}

                {!isAiLoading && aiWorkout && !aiWorkout.error && (
                  <div className="space-y-4">
                    <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#CCFF00]/20">
                      <h3 className="font-bold text-xl mb-1">{aiWorkout.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="capitalize">{aiWorkout.muscle_group}</span>
                        {aiWorkout.duration_minutes && <span>· {aiWorkout.duration_minutes} min</span>}
                        {aiWorkout._provider && <span className="text-[#CCFF00]/50 text-xs ml-auto">via {aiWorkout._provider}</span>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {aiWorkout.exercises?.map((ex, i) => (
                        <div key={i} className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] flex items-start gap-3">
                          <span className="text-[#CCFF00] font-bold text-sm w-5 shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{ex.name}</p>
                            <p className="text-sm text-gray-400">{ex.sets} sets × {ex.reps} · {ex.rest_seconds}s rest</p>
                            {ex.notes && <p className="text-xs text-gray-500 mt-1 italic">{ex.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {aiWorkout.coach_note && (
                      <div className="bg-[#CCFF00]/10 border border-[#CCFF00]/20 rounded-xl p-4">
                        <p className="text-sm text-[#CCFF00]/80 leading-relaxed">{aiWorkout.coach_note}</p>
                      </div>
                    )}
                  </div>
                )}

                {!isAiLoading && aiWorkout?.error && (
                  <div className="text-center py-10 text-gray-500">
                    <p>{t('workouts.aiError', 'Could not generate workout. Try again later.')}</p>
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
