import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isToday, isPast, isFuture, addDays } from 'date-fns';
import { Calendar, Dumbbell, Check, Clock, ChevronRight, List, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import api from '@/api/axios';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import TrainingCalendar from '@/components/calendar/TrainingCalendar';

// Generate mock workout history
const generateMockWorkouts = () => {
  const workouts = [];
  const muscleGroups = ['Push', 'Pull', 'Legs', 'Upper Body', 'Lower Body', 'Full Body'];
  const today = new Date();

  // Past workouts (completed)
  for (let i = 14; i > 0; i--) {
    const date = addDays(today, -i);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) continue; // Skip Sundays

    workouts.push({
      id: `past_${i}`,
      date: format(date, 'yyyy-MM-dd'),
      muscle_group: muscleGroups[i % muscleGroups.length],
      status: Math.random() > 0.2 ? 'completed' : 'missed',
      exercises: [
        { name: 'Exercise 1', sets: 4, reps: '8-10' },
        { name: 'Exercise 2', sets: 3, reps: '10-12' },
        { name: 'Exercise 3', sets: 3, reps: '12-15' },
      ],
      total_volume: Math.round(8000 + Math.random() * 5000),
      duration_minutes: Math.round(45 + Math.random() * 30)
    });
  }

  // Today's workout
  workouts.push({
    id: 'today',
    date: format(today, 'yyyy-MM-dd'),
    muscle_group: muscleGroups[today.getDay() % muscleGroups.length],
    status: 'planned',
    exercises: [
      { name: 'Exercise 1', sets: 4, reps: '8-10' },
      { name: 'Exercise 2', sets: 3, reps: '10-12' },
      { name: 'Exercise 3', sets: 3, reps: '12-15' },
    ]
  });

  // Future workouts (planned)
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) continue; // Skip Sundays

    workouts.push({
      id: `future_${i}`,
      date: format(date, 'yyyy-MM-dd'),
      muscle_group: muscleGroups[(today.getDay() + i) % muscleGroups.length],
      status: 'planned',
      exercises: [
        { name: 'Exercise 1', sets: 4, reps: '8-10' },
        { name: 'Exercise 2', sets: 3, reps: '10-12' },
        { name: 'Exercise 3', sets: 3, reps: '12-15' },
      ]
    });
  }

  return workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export default function Workouts() {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [filter, setFilter] = useState('upcoming');
  const [workouts, setWorkouts] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
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
      case 'completed':
        return workout.status === 'completed';
      case 'upcoming':
        return isFuture(workoutDate) || isToday(workoutDate);
      default:
        return true;
    }
  }).sort((a, b) => {
    // Past to future order (oldest first)
    return new Date(a.date) - new Date(b.date);
  });

  const getStatusBadge = (workout) => {
    const workoutDate = parseISO(workout.date);
    if (workout.status === 'completed') {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
          <Check className="w-3 h-3" />
          Done
        </span>
      );
    }
    if (isToday(workoutDate)) {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#00F2FF]/20 text-[#00F2FF]">
          <Dumbbell className="w-3 h-3" />
          Today
        </span>
      );
    }
    if (isFuture(workoutDate)) {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-500/20 text-gray-400">
          <Clock className="w-3 h-3" />
          Planned
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
        Missed
      </span>
    );
  };

  const completedCount = workouts.filter(w => w.status === 'completed').length;
  const streak = 3; // Mock streak

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Workouts</h1>
            <p className="text-gray-500 text-sm">Your training history & schedule</p>
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <TrainingCalendar workouts={workouts.length > 0 ? workouts : undefined} />
            </motion.div>
          ) : (
            <>
              {/* Filter Tabs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <Tabs value={filter} onValueChange={setFilter}>
                  <TabsList className="bg-[#1A1A1A] border border-[#2A2A2A] w-full">
                    <TabsTrigger value="upcoming" className="flex-1 data-[state=active]:bg-[#00F2FF] data-[state=active]:text-black">
                      Upcoming
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="flex-1 data-[state=active]:bg-[#00F2FF] data-[state=active]:text-black">
                      Completed
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="grid grid-cols-3 gap-3 mb-6"
              >
                {[
                  { label: 'This Week', value: completedCount, color: '#00F2FF' },
                  { label: 'Total', value: workouts.length, color: '#CCFF00' },
                  { label: 'Streak', value: `${streak} days`, color: '#FF6B6B' }
                ].map((stat, index) => (
                  <div key={stat.label} className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                    <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Workout List */}
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredWorkouts.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12"
                    >
                      <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500">No workouts found</p>
                    </motion.div>
                  ) : (
                    filteredWorkouts.map((workout, index) => (
                      <motion.button
                        key={workout.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => setSelectedWorkout(workout)}
                        className="w-full text-left bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusBadge(workout)}
                            </div>
                            <h3 className="font-semibold text-lg">{workout.muscle_group}</h3>
                            <p className="text-sm text-gray-500">
                              {format(parseISO(workout.date), 'EEEE, MMM d')}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                              <span>{workout.exercises?.length || 0} exercises</span>
                              {workout.total_volume && (
                                <span>{workout.total_volume.toLocaleString()} kg total</span>
                              )}
                              {workout.duration_minutes && (
                                <span>{workout.duration_minutes} min</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        </div>
                      </motion.button>
                    ))
                  )}
                </AnimatePresence>

                {/* Workout Detail Modal */}
                <Dialog open={!!selectedWorkout} onOpenChange={() => setSelectedWorkout(null)}>
                  <DialogContent className="bg-[#0A0A0A] border border-[#2A2A2A] text-white max-w-md max-h-[80vh] overflow-y-auto">
                    {selectedWorkout && (
                      <>
                        <DialogHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500">{format(parseISO(selectedWorkout.date), 'EEEE, MMMM d')}</p>
                              <DialogTitle className="text-xl font-bold text-[#00F2FF]">
                                {selectedWorkout.muscle_group}
                              </DialogTitle>
                            </div>
                            {getStatusBadge(selectedWorkout)}
                          </div>
                        </DialogHeader>

                        <div className="flex items-center gap-4 py-3 border-b border-[#2A2A2A]">
                          {selectedWorkout.duration_minutes && (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Clock className="w-4 h-4" />
                              <span>{selectedWorkout.duration_minutes} min</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Dumbbell className="w-4 h-4" />
                            <span>{selectedWorkout.exercises?.length || 0} exercises</span>
                          </div>
                          {selectedWorkout.total_volume && (
                            <div className="text-sm text-gray-400">
                              {selectedWorkout.total_volume.toLocaleString()} kg
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 py-2">
                          {selectedWorkout.exercises?.map((exercise, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center justify-between py-3 border-b border-[#1A1A1A] last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center text-sm font-bold text-gray-500">
                                  {i + 1}
                                </div>
                                <span className="font-medium">{exercise.name}</span>
                              </div>
                              <span className="text-sm text-[#00F2FF] font-medium">
                                {exercise.sets} × {exercise.reps}
                              </span>
                            </motion.div>
                          ))}
                        </div>

                        <Button
                          onClick={() => setSelectedWorkout(null)}
                          className="w-full h-12 mt-2 gradient-cyan text-black font-semibold"
                        >
                          Close
                        </Button>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}
        </div>
      );
}