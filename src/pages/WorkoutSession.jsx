import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import api from '@/api/axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Check, X,
  SkipForward, Sparkles, Timer, Dumbbell, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import AICoachChat from '@/components/dashboard/AICoachChat';
import Confetti from 'react-confetti';

export default function WorkoutSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const workoutId = searchParams.get('id');

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [restMode, setRestMode] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [completedSets, setCompletedSets] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStats, setSessionStats] = useState(null);

  const { data: workout, isLoading } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: async () => {
      // Use custom API endpoint to get workout by ID
      const { data } = await api.get(`/workouts/${workoutId}`);
      return data;
    },
    enabled: !!workoutId
  });

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data;
    }
  });

  const updateWorkoutMutation = useMutation({
    mutationFn: async ({ exercises }) => {
      // Use custom API to update workout
      return api.put(`/workouts/${workoutId}`, { exercises });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout', workoutId] });
    }
  });

  useEffect(() => {
    let interval;
    if (timerRunning && !restMode) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else if (restMode && restTime > 0) {
      interval = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) {
            setRestMode(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, restMode, restTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentExercise = workout?.exercises?.[currentExerciseIndex];
  const totalExercises = workout?.exercises?.length || 0;
  const exerciseProgress = ((currentExerciseIndex + 1) / totalExercises) * 100;

  const handleSetComplete = () => {
    if (!currentExercise) return;

    setTimerRunning(false);
    setTimeElapsed(0);

    const exerciseId = currentExercise.id;
    const newCompletedSets = {
      ...completedSets,
      [exerciseId]: (completedSets[exerciseId] || 0) + 1
    };
    setCompletedSets(newCompletedSets);

    if (currentSet < currentExercise.sets) {
      setCurrentSet(prev => prev + 1);
      setRestMode(true);
      setRestTime(currentExercise.rest_seconds || 60);
    } else {
      // Move to next exercise
      if (currentExerciseIndex < totalExercises - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
        setRestMode(false);
      } else {
        // Workout complete!
        handleFinishWorkout();
      }
    }
  };

  const handleSkipExercise = () => {
    if (currentExerciseIndex < totalExercises - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setCurrentSet(1);
      setTimerRunning(false);
      setRestMode(false);
      setTimeElapsed(0);
    } else {
      handleFinishWorkout();
    }
  };

  const handleFinishWorkout = async () => {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000 / 60);
    const totalSetsCompleted = Object.values(completedSets).reduce((a, b) => a + b, 0);
    const xpEarned = totalSetsCompleted * 10;

    const stats = {
      duration: sessionDuration,
      setsCompleted: totalSetsCompleted,
      exercisesCompleted: currentExerciseIndex + 1,
      xpEarned
    };

    setSessionStats(stats);
    setShowSummary(true);

    try {
      // Update workout status
      await api.put(`/workouts/${workoutId}`, {
        status: 'completed',
        duration_minutes: sessionDuration
      });

      // Create session record
      await api.post('/workouts/session', {
        workout_id: workoutId,
        start_time: new Date(sessionStartTime).toISOString(),
        end_time: new Date().toISOString(),
        completed_exercises: workout.exercises.map(ex => ({
          exercise_id: ex.id,
          sets_completed: completedSets[ex.id] || 0,
          time_spent: 0
        })),
        xp_earned: xpEarned,
        status: 'completed'
      });
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  const handleQuit = () => {
    if (window.confirm(t('session.confirmQuit', 'Are you sure you want to quit? Your progress will not be saved.'))) {
      navigate(createPageUrl('Dashboard'));
    }
  };

  const handleSummaryClose = () => {
    navigate(createPageUrl('Dashboard'));
  };

  const handleWorkoutUpdate = (newExercises) => {
    updateWorkoutMutation.mutate({ exercises: newExercises });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Timer className="w-8 h-8 animate-spin text-[#00F2FF]" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] px-6">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">{t('session.workoutNotFound', 'Workout Not Found')}</h2>
        <Button onClick={() => navigate(createPageUrl('Dashboard'))}>
          {t('session.goHome', 'Go Home')}
        </Button>
      </div>
    );
  }

  if (showSummary && sessionStats) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6 relative overflow-hidden">
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="w-24 h-24 rounded-full gradient-green flex items-center justify-center mx-auto mb-6"
          >
            <Check className="w-12 h-12 text-black" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-bold mb-2"
          >
            {t('session.workoutComplete', 'Workout Complete! 💪')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-gray-500 mb-8"
          >
            {t('session.outstandingWork', 'Outstanding work today!')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-2 gap-4 mb-8"
          >
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A]">
              <p className="text-4xl font-bold text-[#00F2FF] mb-2">{sessionStats.duration}</p>
              <p className="text-sm text-gray-500">{t('common.min', 'min')}</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A]">
              <p className="text-4xl font-bold text-[#CCFF00] mb-2">{sessionStats.setsCompleted}</p>
              <p className="text-sm text-gray-500">{t('common.sets', 'Sets')}</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A]">
              <p className="text-4xl font-bold text-[#FF6B6B] mb-2">{sessionStats.exercisesCompleted}</p>
              <p className="text-sm text-gray-500">{t('workouts.exercises.title', 'Exercises')}</p>
            </div>
            <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2A2A2A]">
              <p className="text-4xl font-bold text-[#FFD93D] mb-2">+{sessionStats.xpEarned}</p>
              <p className="text-sm text-gray-500">XP</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Button
              onClick={handleSummaryClose}
              className="w-full h-14 gradient-cyan text-black font-semibold text-lg"
            >
              {t('session.backToDashboard', 'Back to Dashboard')}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between mb-4">
          <button onClick={handleQuit} className="p-2 hover:bg-[#1A1A1A] rounded-lg transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
          <div className="text-center">
            <p className="text-sm text-gray-500">{t('session.exercise', 'Exercise')} {currentExerciseIndex + 1} / {totalExercises}</p>
            <p className="font-semibold text-[#00F2FF]">{workout.muscle_group}</p>
          </div>
          <button onClick={handleSkipExercise} className="p-2 hover:bg-[#1A1A1A] rounded-lg transition-colors">
            <SkipForward className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${exerciseProgress}%` }}
            className="h-full bg-gradient-to-r from-[#00F2FF] to-[#CCFF00] rounded-full"
          />
        </div>
      </div>

      {/* Main Exercise Display */}
      <div className="flex-1 flex flex-col justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentExerciseIndex}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="text-center"
          >
            {/* Exercise name */}
            <motion.h2
              className="text-3xl font-bold mb-6"
              animate={restMode ? {} : timerRunning ? {
                scale: [1, 1.02, 1],
              } : {}}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {currentExercise?.name}
            </motion.h2>

            {/* Set info */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="text-center">
                <p className="text-sm text-gray-500">{t('session.set', 'Set')}</p>
                <p className="text-2xl font-bold text-[#00F2FF]">
                  {currentSet}/{currentExercise?.sets}
                </p>
              </div>
              <div className="w-px h-12 bg-[#2A2A2A]" />
              <div className="text-center">
                <p className="text-sm text-gray-500">{t('session.reps', 'Reps')}</p>
                <p className="text-2xl font-bold text-white">{currentExercise?.reps}</p>
              </div>
              {currentExercise?.weight > 0 && (
                <>
                  <div className="w-px h-12 bg-[#2A2A2A]" />
                  <div className="text-center">
                    <p className="text-sm text-gray-500">{t('session.weight', 'Weight')}</p>
                    <p className="text-2xl font-bold text-[#CCFF00]">{currentExercise.weight} {t('common.kg')}</p>
                  </div>
                </>
              )}
            </div>

            {/* Timer Display */}
            <motion.div
              className={`mb-8 ${restMode
                ? 'animate-pulse'
                : timerRunning
                  ? 'animate-pulse-glow'
                  : ''
                }`}
            >
              {restMode ? (
                <div>
                  <p className="text-sm text-[#CCFF00] mb-2 uppercase tracking-wide">{t('session.restPeriod', 'Rest Period')}</p>
                  <motion.p
                    className="text-7xl font-bold text-[#CCFF00]"
                    animate={{
                      scale: restTime <= 5 ? [1, 1.1, 1] : 1,
                    }}
                    transition={{
                      duration: 1,
                      repeat: restTime <= 5 ? Infinity : 0,
                    }}
                  >
                    {formatTime(restTime)}
                  </motion.p>
                  <p className="text-sm text-gray-500 mt-2">{t('session.recover', 'Recover and prepare for next set')}</p>
                </div>
              ) : timerRunning ? (
                <div>
                  <p className="text-sm text-[#00F2FF] mb-2 uppercase tracking-wide">{t('session.setDuration', 'Set Duration')}</p>
                  <p className="text-7xl font-bold text-[#00F2FF]">{formatTime(timeElapsed)}</p>
                  <p className="text-sm text-gray-500 mt-2">{t('session.focusOnForm', 'Focus on form and control')}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-2">{t('session.readyToStart', 'Ready to start?')}</p>
                  <Dumbbell className="w-16 h-16 text-gray-600 mx-auto" />
                </div>
              )}
            </motion.div>

            {/* Exercise notes */}
            {currentExercise?.notes && (
              <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] mb-8">
                <p className="text-sm text-gray-400">💡 {currentExercise.notes}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="px-6 pb-8">
        {!restMode && (
          <Button
            onClick={timerRunning ? handleSetComplete : () => setTimerRunning(true)}
            className={`w-full h-16 text-lg font-semibold transition-all ${timerRunning
              ? 'gradient-green text-black'
              : 'gradient-cyan text-black'
              }`}
          >
            {timerRunning ? (
              <>
                <Check className="w-6 h-6 mr-3" />
                {t('session.completeSet', 'Complete Set')}
              </>
            ) : (
              <>
                <Play className="w-6 h-6 mr-3" />
                {t('session.startSet', 'Start Set')}
              </>
            )}
          </Button>
        )}

        {restMode && (
          <Button
            onClick={() => {
              setRestMode(false);
              setRestTime(0);
            }}
            className="w-full h-16 text-lg font-semibold bg-[#1A1A1A] border-2 border-[#CCFF00] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black transition-all"
          >
            {t('session.skipRest', 'Skip Rest')}
          </Button>
        )}
      </div>

      {/* Floating AI Coach */}
      <motion.button
        onClick={() => setChatOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-28 right-6 w-14 h-14 rounded-full gradient-cyan flex items-center justify-center shadow-lg glow-cyan z-40"
      >
        <Sparkles className="w-6 h-6 text-black" />
      </motion.button>

      {/* AI Coach Chat */}
      <AICoachChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        userProfile={profile}
        currentWorkout={workout}
        onWorkoutUpdate={handleWorkoutUpdate}
        isInSession={true}
      />
    </div>
  );
}