import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isToday, isFuture } from 'date-fns';
import { Calendar, Dumbbell, Check, Clock, ChevronRight, List, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/api/axios';
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
    </div>
  );
}
